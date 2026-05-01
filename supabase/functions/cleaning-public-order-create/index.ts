// Public cleaning order creation — used by public landing form (/order/:slug).
// Anonymous users cannot INSERT into cleaning_orders directly (RLS only allows authenticated).
// This function uses SERVICE_KEY to insert on behalf of public visitors,
// after validating the master exists and is_public.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://kong:8000'
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const BOT_TOKEN    = Deno.env.get('TG_BOT_TOKEN') || ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PublicOrderItem {
  item_type_id?: string | null
  item_type_name: string
  color?: string | null
  brand?: string | null
  defects?: string | null
  price: number
  width_m?: number | null
  length_m?: number | null
  area_m2?: number | null
  weight_kg?: number | null
}

interface PublicOrderPayload {
  slug: string
  client: {
    name: string
    phone: string
    address?: string | null
    notes?: string | null
  }
  order_type?: string
  items: PublicOrderItem[]
}

function normPhone(s: string): string {
  return String(s || '').replace(/\D/g, '')
}

async function sendTg(chatId: string, text: string) {
  if (!chatId || !BOT_TOKEN) return
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(5000),
    })
  } catch { /* fire-and-forget */ }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const payload = await req.json() as PublicOrderPayload
    if (!payload?.slug || !payload?.client?.phone || !payload?.client?.name) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    if (!payload.items || payload.items.length === 0) {
      return new Response(JSON.stringify({ error: 'No items' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY)

    // 1. Найти master_profile по slug + product='cleaning'
    const { data: master, error: mErr } = await sb
      .from('master_profiles')
      .select('id, user_id, display_name, tg_chat_id, page_enabled, is_public')
      .eq('booking_slug', payload.slug)
      .eq('product', 'cleaning')
      .maybeSingle()
    if (mErr || !master) {
      return new Response(JSON.stringify({ error: 'Master not found' }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    if (master.page_enabled === false || master.is_public === false) {
      return new Response(JSON.stringify({ error: 'Page disabled' }), {
        status: 403,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // 2. Determine team_id (master может быть в команде)
    const { data: tm } = await sb
      .from('team_members')
      .select('team_id')
      .eq('user_id', master.user_id)
      .maybeSingle()
    const teamId = tm?.team_id ?? null

    // 3. Найти/создать клиента по phone (scoped по master)
    const phoneDigits = normPhone(payload.client.phone)
    if (!phoneDigits) {
      return new Response(JSON.stringify({ error: 'Invalid phone' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    const phoneNorm = '+' + phoneDigits

    let { data: client } = await sb
      .from('clients')
      .select('id')
      .eq('master_id', master.user_id)
      .eq('phone', phoneNorm)
      .maybeSingle()

    if (!client) {
      const nameParts = payload.client.name.trim().split(/\s+/)
      const firstName = nameParts[0] || payload.client.name
      const lastName = nameParts.slice(1).join(' ') || ''
      const { data: newClient, error: cErr } = await sb
        .from('clients')
        .insert({
          master_id: master.user_id,
          first_name: firstName,
          last_name: lastName,
          phone: phoneNorm,
          team_id: teamId,
        })
        .select('id')
        .single()
      if (cErr || !newClient) {
        return new Response(JSON.stringify({ error: 'Failed to create client', detail: cErr?.message }), {
          status: 500,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }
      client = newClient
    }

    // 4. Сгенерировать номер заказа
    const { data: numData, error: numErr } = await sb
      .rpc('generate_cleaning_order_number', { p_product: 'cleaning' })
    if (numErr) {
      return new Response(JSON.stringify({ error: 'Failed to gen number', detail: numErr.message }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // 5. Подсчёт total
    const total = payload.items.reduce((sum, it) => sum + (Number(it.price) || 0), 0)

    // 6. Insert order
    const { data: order, error: oErr } = await sb
      .from('cleaning_orders')
      .insert({
        product:        'cleaning',
        number:         numData,
        order_type:     payload.order_type || 'clothing',
        client_id:      client.id,
        accepted_by:    master.id,
        total_amount:   total,
        notes:          payload.client.notes || null,
        team_id:        teamId,
        created_by:     master.user_id,
        status:         'received',
        payment_method: 'cash',
        payment_status: 'unpaid',
      })
      .select('id, number')
      .single()
    if (oErr || !order) {
      return new Response(JSON.stringify({ error: 'Failed to create order', detail: oErr?.message }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // 7. Insert items
    const itemRows = payload.items.map(it => ({
      order_id: order.id,
      item_type_id: it.item_type_id || null,
      item_type_name: it.item_type_name,
      color: it.color || null,
      brand: it.brand || null,
      defects: it.defects || null,
      price: Number(it.price) || 0,
      width_m: it.width_m ?? null,
      length_m: it.length_m ?? null,
      area_m2: it.area_m2 ?? null,
      weight_kg: it.weight_kg ?? null,
      team_id: teamId,
      created_by: master.user_id,
    }))
    const { error: iErr } = await sb.from('cleaning_order_items').insert(itemRows)
    if (iErr) {
      // Откатить заказ — items не вставились
      await sb.from('cleaning_orders').delete().eq('id', order.id)
      return new Response(JSON.stringify({ error: 'Failed to add items', detail: iErr.message }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // 8. TG-уведомление мастеру (best-effort)
    if (master.tg_chat_id) {
      const itemsText = payload.items
        .map(it => `• ${it.item_type_name} — ${(Number(it.price) || 0).toLocaleString('ru-RU')}`)
        .join('\n')
      const text =
        `🆕 <b>Новый заказ #${order.number}</b>\n\n` +
        `👤 ${payload.client.name}\n` +
        `📞 ${phoneNorm}\n` +
        (payload.client.address ? `📍 ${payload.client.address}\n` : '') +
        `\n${itemsText}\n\n` +
        `💰 Итого: <b>${total.toLocaleString('ru-RU')}</b>`
      sendTg(master.tg_chat_id, text)
    }

    return new Response(JSON.stringify({
      ok: true,
      order_id: order.id,
      order_number: order.number,
    }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Internal error', detail: String(e) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
