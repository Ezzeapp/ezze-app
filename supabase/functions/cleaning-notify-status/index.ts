import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://kong:8000'
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const BOT_TOKEN    = Deno.env.get('TG_CLIENT_BOT_TOKEN') || Deno.env.get('TG_BOT_TOKEN') || ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPPORTED_LANGS = ['ru', 'en', 'uz'] as const
type Lang = typeof SUPPORTED_LANGS[number]

function normalizeLang(raw: string | null | undefined): Lang {
  const s = String(raw || '').toLowerCase().slice(0, 2)
  return (SUPPORTED_LANGS as readonly string[]).includes(s) ? (s as Lang) : 'ru'
}

function fmt(n: number): string {
  return (Number(n) || 0).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = String(s).slice(0, 10).split('-')
  if (d.length !== 3) return String(s)
  return `${d[2]}.${d[1]}.${d[0]}`
}

function substitute(tpl: string, vars: Record<string, string>): string {
  let out = tpl
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, v)
  }
  return out
}

/** Извлечь текст шаблона по языку — поддержка нового texts.{lang} + BC к text */
function pickText(tpl: any, lang: Lang): string | null {
  if (tpl?.texts && typeof tpl.texts === 'object') {
    return tpl.texts[lang] || tpl.texts.ru || tpl.texts.en || tpl.text || null
  }
  return tpl?.text || null
}

async function sendTg(chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!chatId || !text) return { ok: false, error: 'missing_chat_or_text' }
  if (!BOT_TOKEN)        return { ok: false, error: 'no_bot_token' }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('sendTg HTTP', res.status, body)
      return { ok: false, error: `tg_${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    console.error('sendTg error:', err)
    return { ok: false, error: String(err) }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { order_id, new_status } = await req.json()
    if (!order_id || !new_status) {
      return new Response(JSON.stringify({ sent: false, reason: 'missing_params' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY)

    const { data: order } = await sb
      .from('cleaning_orders')
      .select('id, number, status, total_amount, paid_amount, ready_date, product, client:clients(id, first_name, last_name, tg_chat_id, phone_normalized)')
      .eq('id', order_id)
      .single()

    if (!order?.client) {
      return new Response(JSON.stringify({ sent: false, reason: 'no_client' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const client = (order as any).client

    // Lookup tg_chat_id: clients.tg_chat_id → tg_clients.phone_normalized
    let tgChatId: string | null = client.tg_chat_id || null
    if (!tgChatId && client.phone_normalized) {
      const { data: tgc } = await sb
        .from('tg_clients')
        .select('tg_chat_id')
        .eq('phone_normalized', client.phone_normalized)
        .maybeSingle()
      tgChatId = tgc?.tg_chat_id || null
      if (tgChatId) {
        await sb.from('clients').update({ tg_chat_id: tgChatId }).eq('id', client.id)
      }
    }

    if (!tgChatId) {
      return new Response(JSON.stringify({ sent: false, reason: 'no_chat_id' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Определяем язык клиента по tg_clients.lang
    let lang: Lang = 'ru'
    {
      const { data: tgc } = await sb
        .from('tg_clients')
        .select('lang')
        .eq('tg_chat_id', String(tgChatId))
        .maybeSingle()
      lang = normalizeLang(tgc?.lang)
    }

    // Templates — читаем для product заказа (обычно 'cleaning')
    const productKey = order.product || 'cleaning'
    const { data: settings } = await sb
      .from('app_settings')
      .select('value')
      .eq('product', productKey)
      .eq('key', 'cleaning_notification_templates')
      .maybeSingle()

    if (!settings?.value) {
      return new Response(JSON.stringify({ sent: false, reason: 'no_templates' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    let templates: any[] = []
    try { templates = JSON.parse(settings.value) } catch { /* ignore */ }

    const tpl = Array.isArray(templates) ? templates.find((t: any) => t.status === new_status && t.enabled) : null
    if (!tpl) {
      return new Response(JSON.stringify({ sent: false, reason: 'no_matching_template' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const tplText = pickText(tpl, lang)
    if (!tplText) {
      return new Response(JSON.stringify({ sent: false, reason: 'template_empty' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ')
    const remaining = Math.max(0, (order.total_amount || 0) - (order.paid_amount || 0))

    const text = substitute(tplText, {
      number: order.number,
      client_name: clientName,
      ready_date: fmtDate(order.ready_date),
      total: fmt(order.total_amount || 0),
      remaining: fmt(remaining),
      track_url: `https://cleaning.ezze.site/track/${order.number}`,
    })

    // Не глотаем ошибки TG: иначе оператор не узнает, что уведомление не дошло.
    const tgRes = await sendTg(tgChatId, text)

    return new Response(JSON.stringify({ sent: tgRes.ok, lang, error: tgRes.error }), {
      status: tgRes.ok ? 200 : 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('cleaning-notify-status error:', err)
    return new Response(JSON.stringify({ sent: false, reason: 'error' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
