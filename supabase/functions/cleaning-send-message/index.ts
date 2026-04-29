// cleaning-send-message
// Универсальная отправка произвольного текста клиенту(ам) в Telegram.
// Используется модалкой MessageModal в разделе Заказы.
//
// Body:
//   { order_ids: string[], text: string }
//
// Для каждого заказа:
//   1. Подгружаем клиента + tg_chat_id
//   2. Подставляем переменные {{имя}}, {{номер}}, {{сумма}}, {{остаток}}, {{адрес}}, {{дата}}
//   3. Отправляем через TG Bot API
//
// Возвращает массив результатов: [{order_id, sent: bool, reason?: string}]

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
    const re = new RegExp(`\\{\\{${k}\\}\\}`, 'g')
    out = out.replace(re, v)
  }
  return out
}

async function sendTg(chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!BOT_TOKEN) return { ok: false, error: 'no_bot_token' }
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
      return { ok: false, error: `tg_${res.status}: ${body.slice(0, 100)}` }
    }
    const data = await res.json().catch(() => ({}))
    return data?.ok ? { ok: true } : { ok: false, error: data?.description || 'tg_error' }
  } catch (err) {
    return { ok: false, error: String(err).slice(0, 100) }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { order_ids, text } = await req.json()
    if (!Array.isArray(order_ids) || order_ids.length === 0 || !text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'order_ids and text required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY)

    const { data: orders } = await sb
      .from('cleaning_orders')
      .select('id, number, total_amount, paid_amount, ready_date, visit_address, client:clients(id, first_name, last_name, tg_chat_id, phone_normalized)')
      .in('id', order_ids)

    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ results: [], reason: 'no_orders_found' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const results: Array<{ order_id: string; sent: boolean; reason?: string }> = []

    for (const order of orders) {
      const client = (order as any).client
      if (!client) {
        results.push({ order_id: order.id, sent: false, reason: 'no_client' })
        continue
      }

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
        results.push({ order_id: order.id, sent: false, reason: 'no_chat_id' })
        continue
      }

      const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ') || 'клиент'
      const remaining = Math.max(0, (order.total_amount || 0) - (order.paid_amount || 0))

      const message = substitute(text, {
        'имя':     clientName,
        'номер':   order.number,
        'сумма':   fmt(order.total_amount || 0),
        'остаток': fmt(remaining),
        'адрес':   order.visit_address || '—',
        'дата':    fmtDate(order.ready_date),
      })

      const sendResult = await sendTg(tgChatId, message)
      results.push({
        order_id: order.id,
        sent: sendResult.ok,
        reason: sendResult.ok ? undefined : sendResult.error,
      })
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('cleaning-send-message error:', err)
    return new Response(JSON.stringify({ error: String(err).slice(0, 200) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
