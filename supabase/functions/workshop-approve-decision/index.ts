/**
 * Edge Function: workshop-approve-decision
 * Публичная функция — клиент через страницу /approve/:token нажимает
 * «Утвердить» или «Отказаться». Валидирует токен, обновляет заказ,
 * очищает токен (one-time), уведомляет мастера в TG.
 *
 * Request: POST { token: string, action: 'approve' | 'reject' }
 * Response: { ok: true, status: <new_status> } | { error: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const MASTER_BOT_TOKEN = Deno.env.get('TG_BOT_TOKEN_WORKSHOP')
  ?? Deno.env.get('TG_BOT_TOKEN')
  ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function notifyMaster(chatId: string | null, text: string): Promise<void> {
  if (!chatId || !MASTER_BOT_TOKEN) return
  try {
    await fetch(`https://api.telegram.org/bot${MASTER_BOT_TOKEN}/sendMessage`, {
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
    console.error('notifyMaster error:', err)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { token, action } = await req.json()
    if (!token || !['approve', 'reject'].includes(action)) {
      return new Response(JSON.stringify({ error: 'token and valid action required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch order by token
    const { data: order, error: fetchErr } = await supabase
      .from('workshop_orders')
      .select(`
        id, number, status, product, client_approved,
        item_type_name, brand, model, estimated_cost,
        assigned_to_profile:master_profiles!workshop_orders_assigned_to_fkey(id, tg_chat_id),
        accepted_by_profile:master_profiles!workshop_orders_accepted_by_fkey(id, tg_chat_id)
      `)
      .eq('approval_token', token)
      .maybeSingle()

    if (fetchErr || !order) {
      return new Response(JSON.stringify({ error: 'invalid or expired token' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Идемпотентность: если уже применено, просто вернуть текущий статус.
    if (order.client_approved && action === 'approve') {
      return new Response(JSON.stringify({ ok: true, status: order.status, alreadyApplied: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const newStatus = action === 'approve' ? 'in_progress' : 'refused'
    const updates: Record<string, unknown> = {
      client_approved: action === 'approve',
      client_approved_at: new Date().toISOString(),
      status: newStatus,
      approval_token: null, // one-time
    }

    const { error: updErr } = await supabase
      .from('workshop_orders')
      .update(updates)
      .eq('id', order.id)

    if (updErr) {
      console.error('update error:', updErr)
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // History
    await supabase.from('workshop_order_history').insert({
      order_id: order.id,
      old_status: order.status,
      new_status: newStatus,
      note: action === 'approve' ? 'Клиент согласовал смету' : 'Клиент отказался от ремонта',
    })

    // Notify master (assigned_to has priority, fallback to accepted_by)
    const master: any = (order as any).assigned_to_profile ?? (order as any).accepted_by_profile
    if (master?.tg_chat_id) {
      const device = [order.item_type_name, order.brand, order.model].filter(Boolean).join(' ') || 'устройство'
      const text = action === 'approve'
        ? `✅ Клиент согласовал смету\n<b>${order.number}</b> · ${device}\nСмета: ${order.estimated_cost ?? '—'}\nПриступайте к ремонту.`
        : `❌ Клиент отказался от ремонта\n<b>${order.number}</b> · ${device}\nСвяжитесь с клиентом для выдачи устройства.`
      await notifyMaster(String(master.tg_chat_id), text)
    }

    return new Response(JSON.stringify({ ok: true, status: newStatus }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('workshop-approve-decision error:', err)
    return new Response(JSON.stringify({ error: err.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
