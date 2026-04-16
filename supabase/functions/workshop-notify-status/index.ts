/**
 * Edge Function: workshop-notify-status
 * Sends a Telegram notification to the client when a workshop order status changes.
 *
 * Called from frontend after updating status: supabase.functions.invoke('workshop-notify-status',
 *   { body: { order_id, status } })
 *
 * Reads template from app_settings (key='workshop_notification_templates') for the product.
 * If template disabled or missing — no-op.
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

function fmt(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n))
}

function substitute(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
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

    // Fetch order with client
    const { data: order, error: orderErr } = await supabase
      .from('workshop_orders')
      .select(`
        id, number, status, product,
        item_type_name, brand, model,
        total_amount, paid_amount, ready_date, estimated_cost, approval_token, public_token,
        client:clients(id, first_name, last_name, tg_chat_id)
      `)
      .eq('id', order_id)
      .single()

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: 'order not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const client = (order as any).client
    if (!client?.tg_chat_id) {
      return new Response(JSON.stringify({ skipped: 'no tg_chat_id' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch templates
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

    const tpl = templates.find(t => t.status === status && t.enabled)
    if (!tpl?.text) {
      return new Response(JSON.stringify({ skipped: 'template disabled or missing' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build substitutions
    const device = [order.item_type_name, order.brand, order.model].filter(Boolean).join(' ')
    const remaining = Math.max(0, (order.total_amount ?? 0) - (order.paid_amount ?? 0))
    const trackSlug = order.public_token || encodeURIComponent(order.number)
    const trackUrl = `${APP_URL_WORKSHOP}/track/${trackSlug}`
    const approveUrl = order.approval_token
      ? `${APP_URL_WORKSHOP}/approve/${order.approval_token}`
      : ''

    const text = substitute(tpl.text, {
      number: order.number,
      device: device || 'устройство',
      client_name: client.first_name ?? '',
      ready_date: order.ready_date ?? '—',
      total: fmt(order.total_amount ?? 0),
      remaining: fmt(remaining),
      estimated: fmt(order.estimated_cost ?? 0),
      track_url: trackUrl,
      approve_url: approveUrl,
    })

    await sendTg(String(client.tg_chat_id), text)

    return new Response(JSON.stringify({ ok: true, sent_to: client.tg_chat_id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('workshop-notify-status error:', err)
    return new Response(JSON.stringify({ error: err.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
