/**
 * Edge Function: subscription-checker
 *
 * Запускается ежедневно через cron на VPS:
 *   0 9 * * * curl -s -X POST "https://ezze.site/functions/v1/subscription-checker" \
 *     -H "Authorization: Bearer SERVICE_ROLE_KEY"
 *
 * Логика:
 *   A. НАПОМИНАНИЯ — находим подписки истекающие через 7/3/1 день, шлём TG
 *   B. ИСТЕЧЕНИЕ   — находим истёкшие подписки, даунгрейдим + soft-lock данных
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const TG_API = `https://api.telegram.org/bot${Deno.env.get('TG_BOT_TOKEN')}`
const APP_URL = Deno.env.get('APP_URL') ?? 'https://pro.ezze.site'

// Лимит услуг на Free плане (синхронизировать с plan_limits в app_settings)
const FREE_SERVICES_LIMIT = 20

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const months = ['января','февраля','марта','апреля','мая','июня',
                  'июля','августа','сентября','октября','ноября','декабря']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

async function sendTgMessage(chatId: string, text: string, inlineButton?: { text: string; url: string }) {
  const body: Record<string, unknown> = {
    chat_id:    chatId,
    text,
    parse_mode: 'HTML',
  }
  if (inlineButton) {
    body.reply_markup = {
      inline_keyboard: [[{
        text:    inlineButton.text,
        web_app: { url: inlineButton.url },
      }]],
    }
  }
  try {
    const res = await fetch(`${TG_API}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    const result = await res.json()
    if (!result.ok) {
      console.error('[checker] TG sendMessage error:', result.description, 'chat_id:', chatId)
    }
  } catch (e) {
    console.error('[checker] TG sendMessage exception:', e)
  }
}

/** Получить tg_chat_id мастера по user_id */
async function getTgChatId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('master_profiles')
    .select('tg_chat_id')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.tg_chat_id ?? null
}

/** Кнопка "Продлить подписку" → открывает /billing в Mini App */
const renewButton = { text: '💳 Продлить подписку', url: `${APP_URL}/billing` }

// ── A. Напоминания (за 7 / 3 / 1 день) ───────────────────────────────────────

async function processReminders() {
  const now = new Date()

  for (const days of [7, 3, 1]) {
    // Окно: expires_at в диапазоне [now + days - 12h, now + days + 12h]
    // Это защищает от дублей при запуске в разное время суток
    const from = new Date(now.getTime() + (days - 0.5) * 86400000).toISOString()
    const to   = new Date(now.getTime() + (days + 0.5) * 86400000).toISOString()

    const { data: subs, error } = await supabaseAdmin
      .from('subscriptions')
      .select('id, user_id, plan, expires_at, reminders_sent')
      .eq('status', 'active')
      .gte('expires_at', from)
      .lte('expires_at', to)

    if (error) {
      console.error(`[checker] reminders query error (${days}d):`, error.message)
      continue
    }

    for (const sub of (subs ?? [])) {
      const sent = (sub.reminders_sent ?? {}) as Record<string, string>

      // Пропускаем если напоминание за этот период уже отправлено
      if (sent[String(days)]) continue

      const chatId = await getTgChatId(sub.user_id)
      if (!chatId) continue

      const planLabel = sub.plan === 'enterprise' ? 'Enterprise' : 'Pro'
      const expiryDate = formatDate(sub.expires_at)

      let text = ''
      if (days === 7) {
        text = `⚠️ <b>Подписка истекает через 7 дней</b>\n\nВаш тариф <b>${planLabel}</b> будет деактивирован <b>${expiryDate}</b>.\n\nПродлите подписку, чтобы сохранить доступ ко всем функциям.`
      } else if (days === 3) {
        text = `⚠️ <b>Осталось 3 дня</b>\n\nТариф <b>${planLabel}</b> истекает <b>${expiryDate}</b>.\n\nНе откладывайте — продлите сейчас.`
      } else {
        text = `🔴 <b>Завтра истекает подписка!</b>\n\nЗавтра ваш тариф <b>${planLabel}</b> будет переведён на <b>Free</b>.\n\nПродлите сегодня, чтобы не потерять данные команды и услуги.`
      }

      await sendTgMessage(chatId, text, renewButton)

      // Фиксируем отправку
      const newSent = { ...sent, [String(days)]: now.toISOString() }
      await supabaseAdmin
        .from('subscriptions')
        .update({ reminders_sent: newSent })
        .eq('id', sub.id)

      console.log(`[checker] reminder ${days}d sent: user=${sub.user_id} plan=${sub.plan}`)
    }
  }
}

// ── B. Обработка истёкших подписок ───────────────────────────────────────────

async function processExpired() {
  const now = new Date().toISOString()

  const { data: expired, error } = await supabaseAdmin
    .from('subscriptions')
    .select('id, user_id, plan, expires_at')
    .eq('status', 'active')
    .lt('expires_at', now)

  if (error) {
    console.error('[checker] expired query error:', error.message)
    return
  }

  for (const sub of (expired ?? [])) {
    console.log(`[checker] processing expired sub=${sub.id} user=${sub.user_id} plan=${sub.plan}`)

    // 1. Помечаем подписку как истёкшую
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'expired' })
      .eq('id', sub.id)

    // 2. Переводим пользователя на Free
    await supabaseAdmin
      .from('users')
      .update({ plan: 'free' })
      .eq('id', sub.user_id)

    // 3. Soft-lock услуг сверх лимита Free (оставляем первые FREE_SERVICES_LIMIT по order)
    const { data: services } = await supabaseAdmin
      .from('services')
      .select('id, "order"')
      .eq('master_id', sub.user_id)
      .eq('is_active', true)
      .eq('suspended_by_expiry', false)
      .order('order', { ascending: true })
      .order('created_at', { ascending: true })

    let suspendedServices = 0
    if (services && services.length > FREE_SERVICES_LIMIT) {
      const toSuspend = services.slice(FREE_SERVICES_LIMIT).map((s: { id: string }) => s.id)
      const { error: svcErr } = await supabaseAdmin
        .from('services')
        .update({ is_active: false, suspended_by_expiry: true })
        .in('id', toSuspend)
      if (!svcErr) {
        suspendedServices = toSuspend.length
        console.log(`[checker] suspended ${suspendedServices} services for user=${sub.user_id}`)
      }
    }

    // 4. Soft-lock всех активных членов команды (команда недоступна на Free)
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('owner_id', sub.user_id)
      .maybeSingle()

    let suspendedMembers = 0
    if (team) {
      const { data: members } = await supabaseAdmin
        .from('team_members')
        .select('id')
        .eq('team_id', team.id)
        .eq('status', 'active')
        .eq('suspended_by_expiry', false)

      if (members && members.length > 0) {
        const memberIds = members.map((m: { id: string }) => m.id)
        const { error: teamErr } = await supabaseAdmin
          .from('team_members')
          .update({ status: 'paused', suspended_by_expiry: true })
          .in('id', memberIds)
        if (!teamErr) {
          suspendedMembers = memberIds.length
          console.log(`[checker] paused ${suspendedMembers} team members for user=${sub.user_id}`)
        }
      }
    }

    // 5. TG уведомление об истечении
    const chatId = await getTgChatId(sub.user_id)
    if (chatId) {
      const planLabel = sub.plan === 'enterprise' ? 'Enterprise' : 'Pro'
      let details = ''
      if (suspendedMembers > 0) details += `\n👥 Деактивировано членов команды: <b>${suspendedMembers}</b>`
      if (suspendedServices > 0) details += `\n🛠 Скрыто услуг: <b>${suspendedServices}</b>`

      const text =
        `❌ <b>Подписка ${escapeHtml(planLabel)} истекла</b>\n\n` +
        `Ваш аккаунт переведён на тариф <b>Free</b>.` +
        (details ? `\n${details}\n\n<i>Данные сохранены — продлите подписку для восстановления.</i>` : '') +
        `\n\nПродлите подписку, чтобы вернуть полный доступ.`

      await sendTgMessage(chatId, text, renewButton)
    }
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Принимаем GET (для ручной проверки) и POST (cron)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const botToken = Deno.env.get('TG_BOT_TOKEN')
  if (!botToken) {
    console.error('[checker] TG_BOT_TOKEN not set')
  }

  const startTime = Date.now()
  console.log('[checker] starting subscription check at', new Date().toISOString())

  await Promise.allSettled([
    processReminders(),
    processExpired(),
  ])

  const elapsed = Date.now() - startTime
  console.log(`[checker] done in ${elapsed}ms`)

  return new Response(JSON.stringify({ ok: true, elapsed_ms: elapsed }), {
    status:  200,
    headers: { 'Content-Type': 'application/json' },
  })
})
