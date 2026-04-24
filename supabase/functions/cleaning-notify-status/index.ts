import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://kong:8000'
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const BOT_TOKEN    = Deno.env.get('TG_CLIENT_BOT_TOKEN') || Deno.env.get('TG_BOT_TOKEN') || ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function fmt(n: number): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function substitute(tpl: string, vars: Record<string, string>): string {
  let out = tpl
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, v)
  }
  return out
}

async function sendTg(chatId: string, text: string) {
  if (!chatId || !text || !BOT_TOKEN) return
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: String(chatId), text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(8000),
    })
  } catch (err) {
    console.error('sendTg error:', err)
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

    // Fetch order with client
    const { data: order } = await sb
      .from('cleaning_orders')
      .select('id, number, status, total_amount, paid_amount, ready_date, client:clients(id, first_name, last_name, tg_chat_id, phone_normalized)')
      .eq('id', order_id)
      .single()

    if (!order?.client) {
      return new Response(JSON.stringify({ sent: false, reason: 'no_client' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Fallback: если tg_chat_id ещё не проставлен, пробуем найти клиента в
    // tg_clients по нормализованному телефону (клиент зарегистрировался в
    // боте, но строка clients создана мастером отдельно)
    let tgChatId: string | null = order.client.tg_chat_id || null
    if (!tgChatId && order.client.phone_normalized) {
      const { data: tgc } = await sb
        .from('tg_clients')
        .select('tg_chat_id')
        .eq('phone_normalized', order.client.phone_normalized)
        .maybeSingle()
      tgChatId = tgc?.tg_chat_id || null
      if (tgChatId) {
        // Backfill: проставляем tg_chat_id в clients, чтобы последующие
        // уведомления работали без этого fallback-запроса
        await sb.from('clients')
          .update({ tg_chat_id: tgChatId })
          .eq('id', order.client.id)
      }
    }

    if (!tgChatId) {
      return new Response(JSON.stringify({ sent: false, reason: 'no_chat_id' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Fetch templates
    const { data: settings } = await sb
      .from('app_settings')
      .select('value')
      .eq('product', 'cleaning')
      .eq('key', 'cleaning_notification_templates')
      .maybeSingle()

    if (!settings?.value) {
      return new Response(JSON.stringify({ sent: false, reason: 'no_templates' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const templates = JSON.parse(settings.value) as { status: string; enabled: boolean; text: string }[]
    const tpl = templates.find(t => t.status === new_status && t.enabled)
    if (!tpl) {
      return new Response(JSON.stringify({ sent: false, reason: 'no_matching_template' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const clientName = [order.client.first_name, order.client.last_name].filter(Boolean).join(' ')
    const remaining = Math.max(0, (order.total_amount || 0) - (order.paid_amount || 0))

    const text = substitute(tpl.text, {
      number: order.number,
      client_name: clientName,
      ready_date: order.ready_date ? new Date(order.ready_date).toLocaleDateString('ru-RU') : '—',
      total: fmt(order.total_amount || 0),
      remaining: fmt(remaining),
      track_url: `https://cleaning.ezze.site/track/${order.number}`,
    })

    await sendTg(tgChatId, text)

    return new Response(JSON.stringify({ sent: true }), {
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
