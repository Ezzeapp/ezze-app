/**
 * Edge Function: workshop-notify-status
 * Sends a Telegram notification to the client when a workshop order status changes.
 *
 * Called from frontend after updating status: supabase.functions.invoke('workshop-notify-status',
 *   { body: { order_id, status } })
 *
 * Reads template from app_settings (key='workshop_notification_templates') for the product.
 * Supports multilang templates: tpl.texts.{ru|en|uz}. Falls back to tpl.text (legacy).
 * Client language is taken from tg_clients.lang.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const CLIENT_BOT_TOKEN = Deno.env.get('TG_CLIENT_BOT_TOKEN')
  ?? Deno.env.get('TG_BOT_TOKEN_WORKSHOP')
  ?? Deno.env.get('TG_BOT_TOKEN')
  ?? ''

const APP_URL_WORKSHOP = Deno.env.get('APP_URL_WORKSHOP') ?? 'https://workshop.ezze.site'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPPORTED_LANGS = ['ru', 'en', 'uz'] as const
type Lang = typeof SUPPORTED_LANGS[number]

function normalizeLang(raw: string | null | undefined): Lang {
  const s = String(raw || '').toLowerCase().slice(0, 2)
  return (SUPPORTED_LANGS as readonly string[]).includes(s) ? (s as Lang) : 'ru'
}

function fmt(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n))
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = String(s).slice(0, 10).split('-')
  if (d.length !== 3) return String(s)
  return `${d[2]}.${d[1]}.${d[0]}`
}

function substitute(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
}

function pickText(tpl: any, lang: Lang): string | null {
  if (tpl?.texts && typeof tpl.texts === 'object') {
    return tpl.texts[lang] || tpl.texts.ru || tpl.texts.en || tpl.text || null
  }
  return tpl?.text || null
}

async function sendTg(chatId: string, text: string): Promise<void> {
  if (!chatId || !CLIENT_BOT_TOKEN) return
  try {
    await fetch(`https://api.telegram.org/bot${CLIENT_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
  } catch (err) {
    console.error('sendTg error:', err)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { order_id, status } = await req.json()
    if (!order_id || !status) {
      return new Response(JSON.stringify({ error: 'order_id and status required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: order, error: orderErr } = await supabase
      .from('workshop_orders')
      .select(`
        id, number, status, product,
        item_type_name, brand, model,
        total_amount, paid_amount, ready_date, estimated_cost, approval_token, public_token,
        client:clients(id, first_name, last_name, tg_chat_id, phone_normalized)
      `)
      .eq('id', order_id)
      .single()

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: 'order not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const client = (order as any).client
    if (!client) {
      return new Response(JSON.stringify({ skipped: 'no client' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Lookup tg_chat_id via clients.tg_chat_id → tg_clients.phone_normalized
    let tgChatId: string | null = client.tg_chat_id || null
    if (!tgChatId && client.phone_normalized) {
      const { data: tgc } = await supabase
        .from('tg_clients')
        .select('tg_chat_id')
        .eq('phone_normalized', client.phone_normalized)
        .maybeSingle()
      tgChatId = tgc?.tg_chat_id || null
      if (tgChatId) {
        await supabase.from('clients')
          .update({ tg_chat_id: tgChatId })
          .eq('id', client.id)
      }
    }

    if (!tgChatId) {
      return new Response(JSON.stringify({ skipped: 'no tg_chat_id' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Детект языка клиента
    let lang: Lang = 'ru'
    {
      const { data: tgc } = await supabase
        .from('tg_clients')
        .select('lang')
        .eq('tg_chat_id', String(tgChatId))
        .maybeSingle()
      lang = normalizeLang(tgc?.lang)
    }

    // Templates
    const { data: settings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('product', order.product)
      .eq('key', 'workshop_notification_templates')
      .maybeSingle()

    if (!settings?.value) {
      return new Response(JSON.stringify({ skipped: 'no templates configured' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let templates: any[] = []
    try { templates = JSON.parse(settings.value) } catch { /* ignore */ }

    const tpl = Array.isArray(templates) ? templates.find((t: any) => t.status === status && t.enabled) : null
    if (!tpl) {
      return new Response(JSON.stringify({ skipped: 'template disabled or missing' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tplText = pickText(tpl, lang)
    if (!tplText) {
      return new Response(JSON.stringify({ skipped: 'template empty for lang' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const device = [order.item_type_name, order.brand, order.model].filter(Boolean).join(' ')
    const remaining = Math.max(0, (order.total_amount ?? 0) - (order.paid_amount ?? 0))
    const trackSlug = order.public_token || encodeURIComponent(order.number)
    const trackUrl = `${APP_URL_WORKSHOP}/track/${trackSlug}`
    const approveUrl = order.approval_token
      ? `${APP_URL_WORKSHOP}/approve/${order.approval_token}`
      : ''
    const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ')

    const text = substitute(tplText, {
      number: order.number,
      device: device || 'устройство',
      client_name: clientName || client.first_name || '',
      ready_date: fmtDate(order.ready_date),
      total: fmt(order.total_amount ?? 0),
      remaining: fmt(remaining),
      estimated: fmt(order.estimated_cost ?? 0),
      track_url: trackUrl,
      approve_url: approveUrl,
    })

    await sendTg(String(tgChatId), text)

    return new Response(JSON.stringify({ ok: true, sent_to: tgChatId, lang }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('workshop-notify-status error:', err)
    return new Response(JSON.stringify({ error: err.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
