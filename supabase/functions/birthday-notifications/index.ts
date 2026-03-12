/**
 * Edge Function: birthday-notifications
 * Sends birthday notifications to masters (about their clients)
 * and optionally congratulates clients via Telegram.
 *
 * Triggered by pg_cron every day at 09:00 local time.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const TG_BOT_TOKEN = Deno.env.get('TG_BOT_TOKEN') ?? ''

async function sendTg(chatId: string, text: string) {
  if (!TG_BOT_TOKEN || !chatId) return
  await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const today = new Date()
    const month = today.getMonth() + 1  // 1-12
    const day = today.getDate()

    // Find all clients whose birthday is today (month+day match, regardless of year)
    const { data: clients, error } = await supabase
      .from('clients')
      .select(`
        id, first_name, last_name, birthday,
        master_id,
        master_profiles!inner(tg_chat_id, notification_email)
      `)
      .not('birthday', 'is', null)
      .not('birthday', 'eq', '')

    if (error) throw error
    if (!clients?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }))

    let sent = 0

    for (const client of clients as any[]) {
      const bday = client.birthday
      if (!bday) continue

      // Parse birthday (YYYY-MM-DD or MM-DD)
      const parts = bday.split('-')
      let bMonth: number, bDay: number
      if (parts.length === 3) {
        bMonth = parseInt(parts[1])
        bDay = parseInt(parts[2])
      } else if (parts.length === 2) {
        bMonth = parseInt(parts[0])
        bDay = parseInt(parts[1])
      } else continue

      if (bMonth !== month || bDay !== day) continue

      const masterId = client.master_id
      const tgChatId = client.master_profiles?.tg_chat_id

      // Check notification settings for birthday_notify
      const { data: notifSetting } = await supabase
        .from('notification_settings')
        .select('enabled')
        .eq('master_id', masterId)
        .eq('type', 'birthday_notify')
        .maybeSingle()

      const notifyEnabled = notifSetting?.enabled ?? true  // default enabled

      if (notifyEnabled && tgChatId) {
        const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ')
        await sendTg(
          tgChatId,
          `🎂 <b>День рождения!</b>\n\nСегодня день рождения у вашего клиента — <b>${clientName}</b>.\n\nОтличный повод написать и предложить скидку! 🎁`
        )
        sent++
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }))
  } catch (err) {
    console.error('birthday-notifications error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
