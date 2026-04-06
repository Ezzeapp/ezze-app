/**
 * Edge Function: send-broadcast
 * Sends Telegram messages to a filtered list of clients.
 *
 * Body: { campaign_id: string }
 * Auth: Bearer <user JWT>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Рассылка идёт через мастер-бот: именно с ним взаимодействуют клиенты
// через записи и уведомления. CLIENT_BOT_TOKEN доступен только тем клиентам,
// кто явно запустил @ezzeprogo_bot (кабинет клиента).
const MASTER_BOT_TOKEN = Deno.env.get('TG_BOT_TOKEN') ?? ''
const CLIENT_BOT_TOKEN = Deno.env.get('TG_CLIENT_BOT_TOKEN') ?? ''

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function sendTg(chatId: string, text: string): Promise<boolean> {
  if (!chatId || !text) return false
  // Пробуем мастер-бот (первичный канал), затем клиентский как fallback
  for (const token of [MASTER_BOT_TOKEN, CLIENT_BOT_TOKEN]) {
    if (!token) continue
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      })
      const data = await res.json()
      if (data.ok === true) return true
      // Если 403 (заблокирован) — смысла пробовать другой бот нет
      if (data.error_code === 403) return false
      // 404 — клиент не стартовал этот бот, пробуем следующий
    } catch {
      continue
    }
  }
  return false
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  // Auth: user JWT
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace('Bearer ', '')
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  let campaign_id = ''
  try {
    const body = await req.json()
    campaign_id = body.campaign_id ?? ''
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: 'campaign_id required' }), { status: 400 })
    }

    // Load campaign — only master's own campaign
    const { data: campaign, error: campError } = await supabase
      .from('broadcast_campaigns')
      .select('*')
      .eq('id', campaign_id)
      .eq('master_id', user.id)
      .maybeSingle()

    if (campError || !campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), { status: 404 })
    }

    if (campaign.status === 'sending' || campaign.status === 'sent') {
      return new Response(JSON.stringify({ error: 'Campaign already sent or in progress' }), { status: 400 })
    }

    // Mark as sending
    await supabase
      .from('broadcast_campaigns')
      .update({ status: 'sending' })
      .eq('id', campaign_id)

    const masterId = user.id
    const filterType  = campaign.filter_type  as string
    const filterValue = campaign.filter_value as string | null

    // Build recipients query
    let query = supabase
      .from('clients')
      .select('id, first_name, last_name, tg_chat_id, total_visits, last_visit, tags, birthday')
      .eq('master_id', masterId)
      .not('tg_chat_id', 'is', null)

    if (filterType === 'tag' && filterValue) {
      query = query.contains('tags', [filterValue])
    } else if (filterType === 'level' && filterValue) {
      const THRESHOLDS: Record<string, number> = { regular: 3, vip: 10, premium: 20 }
      const threshold = THRESHOLDS[filterValue] ?? 3
      query = query.gte('total_visits', threshold)
    } else if (filterType === 'inactive' && filterValue) {
      const days = parseInt(filterValue)
      if (!isNaN(days)) {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - days)
        query = query.or(`last_visit.is.null,last_visit.lte.${cutoff.toISOString().slice(0, 10)}`)
      }
    }
    // birthday_month — post-filter after fetch

    const { data: clients, error: clientsError } = await query.limit(1000)

    if (clientsError) {
      await supabase.from('broadcast_campaigns').update({ status: 'failed' }).eq('id', campaign_id)
      return new Response(JSON.stringify({ error: 'Failed to load clients' }), { status: 500 })
    }

    let recipients = clients ?? []

    // Post-filter: birthday_month
    if (filterType === 'birthday_month' && filterValue) {
      const targetMonth = parseInt(filterValue)
      recipients = recipients.filter((c: any) => {
        if (!c.birthday) return false
        const bd = String(c.birthday)
        const parts = bd.split('-')
        const month = parts.length === 3 ? parseInt(parts[1]) : parseInt(parts[0])
        return month === targetMonth
      })
    }

    // Load promo code if attached
    let promoCode = ''
    if (campaign.promo_code_id) {
      const { data: promo } = await supabase
        .from('promo_codes')
        .select('code')
        .eq('id', campaign.promo_code_id)
        .maybeSingle()
      if (promo?.code) promoCode = promo.code
    }

    let sentCount   = 0
    let failedCount = 0

    // Send with rate limiting (max 25/sec to avoid Telegram 429)
    for (let i = 0; i < recipients.length; i++) {
      const client = recipients[i] as any
      if (!client.tg_chat_id) continue

      const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ') || 'Клиент'
      let text = campaign.message.replace(/{client_name}/g, clientName)
      if (promoCode) {
        text += `\n\n🎁 <b>Промокод:</b> <code>${promoCode}</code>`
      }

      const ok = await sendTg(String(client.tg_chat_id), text)
      if (ok) sentCount++
      else failedCount++

      // Rate limit: 1 second pause every 25 messages
      if ((i + 1) % 25 === 0) {
        await sleep(1000)
      }
    }

    // Update final stats
    await supabase
      .from('broadcast_campaigns')
      .update({
        status:           'sent',
        sent_at:          new Date().toISOString(),
        total_recipients: recipients.length,
        sent_count:       sentCount,
        failed_count:     failedCount,
      })
      .eq('id', campaign_id)

    return new Response(JSON.stringify({
      ok:    true,
      total: recipients.length,
      sent:  sentCount,
      failed: failedCount,
    }))
  } catch (err) {
    console.error('send-broadcast error:', err)
    if (campaign_id) {
      await supabase.from('broadcast_campaigns')
        .update({ status: 'failed' }).eq('id', campaign_id)
    }
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
