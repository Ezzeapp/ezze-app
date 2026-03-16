/**
 * Edge Function: telegram-notifications
 * Sends Telegram notifications when appointments are created, updated, or via cron.
 *
 * Called via PostgreSQL trigger (pg_net) or cron.
 * Body: { record: AppointmentRow, old_record?: AppointmentRow, type: 'INSERT' | 'UPDATE' | 'CRON' }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const APP_URL = Deno.env.get('APP_URL') ?? 'https://ezze.site'
// Мастерский бот (@ezzeapp_bot) — уведомления мастерам
const MASTER_BOT_TOKEN = Deno.env.get('TG_BOT_TOKEN') ?? '8365728736:AAHdA_B9bVQQLqqCsJsSzBk9ej2Mocsw_7M'
// Клиентский бот (@ezzeclient_bot) — уведомления клиентам
const CLIENT_BOT_TOKEN = Deno.env.get('TG_CLIENT_BOT_TOKEN') ?? '8767615503:AAF7hZEf6wZqZk_CDd42_ceLAqltdrjcbY0'

// ── Telegram helpers ──────────────────────────────────────────────────────────

// Отправляет сообщение через нужный бот
// toMaster=true → @ezzeapp_bot, toMaster=false → @ezzeclient_bot
async function sendTgVia(chatId: string, text: string, toMaster: boolean) {
  if (!chatId || !text) return
  const token = toMaster ? MASTER_BOT_TOKEN : CLIENT_BOT_TOKEN
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: String(chatId), text, parse_mode: 'HTML' }),
    })
  } catch (err) { console.error('sendTgVia error:', err) }
}

// Обратная совместимость — по умолчанию через мастерский бот (для уведомлений мастеру)
async function sendTg(chatId: string, text: string, _showMenu = false) {
  await sendTgVia(chatId, text, true)
}

// Отправляет мастеру уведомление через МАСТЕРСКИЙ бот с кнопкой "❌ Отменить запись"
// callback_data обрабатывает master bot (tg_master_bot.js)
async function sendTgMasterWithCancelButton(chatId: string, text: string, apptId: string) {
  if (!chatId || !text) return
  try {
    await fetch(`https://api.telegram.org/bot${MASTER_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Отменить запись', style: 'danger', callback_data: `cancel_appt_${apptId}` }]],
        },
      }),
    })
  } catch (err) { console.error('sendTgMasterWithCancelButton error:', err) }
}

// Отправляет сообщение с inline кнопкой "❌ Отменить запись" (callback_data = cancel_appt_<id>)
// sendTgWithCancelButton идёт через КЛИЕНТСКИЙ бот (callback_data обрабатывает client bot)
async function sendTgWithCancelButton(chatId: string, text: string, apptId: string) {
  if (!chatId || !text) return
  try {
    await fetch(`https://api.telegram.org/bot${CLIENT_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Отменить запись', style: 'danger', callback_data: `cancel_appt_${apptId}` }]],
        },
      }),
    })
  } catch (err) { console.error('sendTgWithCancelButton error:', err) }
}

function fmtDate(s: string): string {
  const months = ['января','февраля','марта','апреля','мая','июня',
                  'июля','августа','сентября','октября','ноября','декабря']
  const d = (s ?? '').slice(0, 10).split('-')
  if (d.length !== 3) return s
  const day = parseInt(d[2]), mon = parseInt(d[1]) - 1, yr = d[0]
  if (mon < 0 || mon > 11) return s
  return `${day} ${months[mon]} ${yr}`
}

async function getNotifSetting(masterId: string, type: string) {
  const { data } = await supabase
    .from('notification_settings')
    .select('enabled,timing_hours,timing_days,template')
    .eq('master_id', masterId)
    .eq('type', type)
    .maybeSingle()
  return data ?? { enabled: true, timing_hours: null, timing_days: null, template: '' }
}

function applyTemplate(tmpl: string, vars: Record<string, string>): string {
  let r = tmpl
  for (const k in vars) r = r.split(`{${k}}`).join(vars[k] ?? '')
  return r
}

// ── INSERT: new appointment → notify master + confirm client ──────────────────

async function handleInsert(record: any) {
  const masterId = record.master_id
  if (!masterId) return

  const { data: prof } = await supabase
    .from('master_profiles')
    .select('*')
    .eq('user_id', masterId)
    .maybeSingle()
  if (!prof) return

  const { data: mu } = await supabase.from('users').select('email').eq('id', masterId).maybeSingle()

  // Get service info
  let svcName = '-', svcPrice = '', svcDuration = ''
  if (record.service_id) {
    const { data: svc } = await supabase.from('services').select('name,price,duration_min').eq('id', record.service_id).maybeSingle()
    if (svc) {
      svcName = svc.name ?? '-'
      if (svc.price) svcPrice = `${svc.price} ${prof.currency ?? 'UZS'}`
      if (svc.duration_min) svcDuration = `${svc.duration_min} мин`
    }
  }

  const date = fmtDate(record.date ?? '')
  const startTime = record.start_time ?? '-'
  const endTime = record.end_time ?? ''
  const isOnline = record.booked_via === 'online'
  const masterName = prof.profession ?? 'Мастер'
  const cancelLink = record.cancel_token ? `${APP_URL}/cancel/${record.cancel_token}` : ''
  const cancelToken = record.cancel_token ?? ''

  // Generate cancel_token if missing (set it via service role)
  if (!cancelToken) {
    const tok = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2,'0')).join('')
    await supabase.from('appointments').update({ cancel_token: tok }).eq('id', record.id)
  }

  // Найти или создать клиента, обновить client_id в записи (service role — bypass RLS)
  // Публичная страница бронирования не может INSERT в clients из-за RLS (auth.uid() ≠ master_id)
  const clientPhone = record.client_phone ?? ''
  const clientTelegramUsername = (record.client_telegram ?? '').replace('@', '')
  const clientTelegramId = record.telegram_id ? String(record.telegram_id) : ''
  if (clientPhone) {
    try {
      const telegramPatch: Record<string, string> = {}
      if (clientTelegramUsername) telegramPatch.telegram = clientTelegramUsername
      if (clientTelegramId) telegramPatch.tg_chat_id = clientTelegramId

      // Ищем клиента по телефону и мастеру
      let { data: clientRow } = await supabase
        .from('clients')
        .select('id')
        .eq('master_id', masterId)
        .eq('phone', clientPhone)
        .maybeSingle()

      if (clientRow?.id) {
        // Обновляем telegram-поля если есть
        if (Object.keys(telegramPatch).length > 0) {
          await supabase.from('clients').update(telegramPatch).eq('id', clientRow.id)
        }
      } else {
        // Клиент не найден — создаём (публичная страница не смогла из-за RLS)
        const nameParts = (record.client_name ?? '').trim().split(/\s+/)
        const { data: newClient } = await supabase
          .from('clients')
          .insert({
            master_id: masterId,
            first_name: nameParts[0] || record.client_name || '',
            last_name: nameParts.slice(1).join(' ') || '',
            phone: clientPhone,
            source: 'online_booking',
            ...telegramPatch,
          })
          .select('id')
          .single()
        clientRow = newClient
      }

      // Если в записи нет client_id — ставим его
      if (clientRow?.id && !record.client_id) {
        await supabase
          .from('appointments')
          .update({ client_id: clientRow.id })
          .eq('id', record.id)
      }
    } catch (e) { console.error('client find/create error:', e) }
  }

  // Resolve client name — may be empty for manually created appointments (client selected by id)
  let clientName = (record.client_name ?? '').trim()
  if (!clientName && record.client_id) {
    const { data: cl } = await supabase
      .from('clients').select('first_name, last_name').eq('id', record.client_id).maybeSingle()
    if (cl) clientName = [cl.first_name, cl.last_name].filter(Boolean).join(' ')
  }
  if (!clientName) clientName = '-'

  // Notify master
  const mSetting = await getNotifSetting(masterId, 'new_appointment')
  const masterTgId = prof.tg_chat_id ?? ''
  if (mSetting.enabled && masterTgId) {
    const msg = mSetting.template?.trim()
      ? applyTemplate(mSetting.template, {
          client_name: clientName,
          client_phone: record.client_phone ?? '-',
          client_email: record.client_email ?? '',
          service: svcName, price: svcPrice, duration: svcDuration,
          date, time: startTime, end_time: endTime, notes: record.notes ?? '',
          online: isOnline ? '1' : '',
        })
      : `🔔 <b>Новая запись!</b>\n\n` +
        `👤 <b>Клиент:</b> ${clientName}\n` +
        (record.client_phone ? `📞 <b>Телефон:</b> ${record.client_phone}\n` : '') +
        `\n✂️ <b>Услуга:</b> ${svcName}\n` +
        (svcPrice ? `💰 <b>Стоимость:</b> ${svcPrice}\n` : '') +
        `\n📅 <b>Дата:</b> ${date}\n🕐 <b>Время:</b> ${startTime}` +
        (endTime ? ` — ${endTime}` : '') +
        (record.notes ? `\n\n💬 <b>Комментарий:</b> ${record.notes}` : '') +
        `\n\n📌 <b>Источник:</b> ${isOnline ? '🌐 онлайн' : '📱 вручную'}`
    // Отправляем через мастерский бот с кнопкой "Отменить запись"
    if (msg) await sendTgMasterWithCancelButton(masterTgId, msg, record.id)
  }

  // Confirm to client
  const clientTgId = record.telegram_id ?? ''
  const clientTgUsr = record.client_telegram ?? ''
  if (clientTgId || clientTgUsr) {
    const cSetting = await getNotifSetting(masterId, 'appointment_confirmed')
    if (cSetting.enabled) {
      let cMsg = cSetting.template?.trim()
        ? applyTemplate(cSetting.template, {
            master_name: masterName, service: svcName, price: svcPrice,
            date, time: startTime, end_time: endTime, address: prof.address ?? '',
            cancel_link: cancelLink,
          })
        : `✅ <b>Запись подтверждена!</b>\n\nВы записаны к <b>${masterName}</b>\n\n` +
          `✂️ <b>Услуга:</b> ${svcName}\n` +
          (svcPrice ? `💰 <b>Стоимость:</b> ${svcPrice}\n` : '') +
          `📅 <b>Дата:</b> ${date}\n🕐 <b>Время:</b> ${startTime}` +
          (endTime ? ` — ${endTime}` : '') +
          (prof.address ? `\n📍 <b>Адрес:</b> ${prof.address}` : '') +
          `\n\nДо встречи! 🌟`
      if (cMsg) await sendTgWithCancelButton(clientTgId || clientTgUsr, cMsg, record.id)
    }
  }
}

// ── UPDATE: confirmed / cancelled / rescheduled → notify client ──────────────

async function handleUpdate(record: any, oldRecord: any) {
  const masterId = record.master_id
  const clientTgId = record.telegram_id ?? ''
  const clientTgUsr = record.client_telegram ?? ''
  if (!masterId || (!clientTgId && !clientTgUsr)) return

  const { data: prof } = await supabase.from('master_profiles').select('*').eq('user_id', masterId).maybeSingle()
  if (!prof) return

  const slug = prof.booking_slug ?? ''
  const date = fmtDate(record.date ?? '')
  const startTime = record.start_time ?? '-'
  const endTime = record.end_time ?? ''
  const cancelLink = record.cancel_token ? `${APP_URL}/cancel/${record.cancel_token}` : ''
  const masterName = prof.profession ?? 'Мастер'

  let svcName = '-', svcPrice = ''
  if (record.service_id) {
    const { data: svc } = await supabase.from('services').select('name,price').eq('id', record.service_id).maybeSingle()
    if (svc) {
      svcName = svc.name ?? '-'
      if (svc.price) svcPrice = `${svc.price} ${prof.currency ?? 'UZS'}`
    }
  }

  const sendToClient = async (msg: string) => {
    await sendTgVia(clientTgId || clientTgUsr, msg, false) // клиентский бот
  }

  // Master confirmed the appointment (confirmed_at changed from null to a value)
  if (oldRecord && !oldRecord.confirmed_at && record.confirmed_at) {
    const setting = await getNotifSetting(masterId, 'appointment_master_confirmed')
    if (setting.enabled) {
      const msg = setting.template?.trim()
        ? applyTemplate(setting.template, {
            master_name: masterName, service: svcName, price: svcPrice,
            date, time: startTime, end_time: endTime,
            address: prof.address ?? '', cancel_link: cancelLink,
          })
        : `✅ <b>Запись подтверждена мастером!</b>\n\n` +
          `👤 <b>Мастер:</b> ${masterName}\n` +
          `✂️ <b>Услуга:</b> ${svcName}\n` +
          (svcPrice ? `💰 <b>Стоимость:</b> ${svcPrice}\n` : '') +
          `📅 <b>Дата:</b> ${date}\n🕐 <b>Время:</b> ${startTime}` +
          (endTime ? ` — ${endTime}` : '') +
          (prof.address ? `\n📍 <b>Адрес:</b> ${prof.address}` : '') +
          `\n\nДо встречи! 🌟`
      if (msg) await sendTgWithCancelButton(clientTgId || clientTgUsr, msg, record.id)
    }
    return
  }

  if (record.status === 'cancelled') {
    const setting = await getNotifSetting(masterId, 'appointment_cancelled')
    if (setting.enabled) {
      const bookAgainLine = slug ? `\n\nЗаписаться снова: ${APP_URL}/book/${slug}` : ''
      const msg = setting.template?.trim()
        ? applyTemplate(setting.template, { master_name: masterName, date, time: startTime, service: svcName, booking_slug: slug })
        : `❌ <b>Запись отменена</b>\n\nВаша запись к <b>${masterName}</b> на ${date} в ${startTime} отменена.${bookAgainLine}`
      if (msg) await sendToClient(msg)
    }
    return
  }

  // Check if rescheduled
  if (oldRecord && (oldRecord.date !== record.date || oldRecord.start_time !== record.start_time)) {
    const setting = await getNotifSetting(masterId, 'appointment_rescheduled')
    if (setting.enabled) {
      const msg = setting.template?.trim()
        ? applyTemplate(setting.template, { service: svcName, date, time: startTime, end_time: endTime, cancel_link: cancelLink, master_name: masterName })
        : `📅 <b>Запись перенесена!</b>\n\n✂️ <b>Услуга:</b> ${svcName}\nНовое время: <b>${date} в ${startTime}</b>` +
          (endTime ? ` — ${endTime}` : '')
      if (msg) await sendTgWithCancelButton(clientTgId || clientTgUsr, msg, record.id)
    }
  }
}

// ── CRON: reminders ───────────────────────────────────────────────────────────

async function handleReminders() {
  const now = new Date()
  const offsets = [60, 120, 24 * 60, 48 * 60]

  for (const offsetMin of offsets) {
    const t = new Date(now.getTime() + offsetMin * 60000)
    const tDate = t.toISOString().slice(0, 10)
    const tTime = t.toTimeString().slice(0, 5)

    const { data: appts } = await supabase
      .from('appointments')
      .select('*')
      .eq('date', tDate)
      .eq('start_time', tTime)
      .eq('status', 'scheduled')
      .limit(100)
    if (!appts?.length) continue

    const hoursLabel = offsetMin >= 60 ? `${offsetMin / 60} ч` : `${offsetMin} мин`

    for (const appt of appts) {
      const masterId = appt.master_id
      const { data: prof } = await supabase.from('master_profiles').select('*').eq('user_id', masterId).maybeSingle()
      if (!prof) continue

      let svcName = '-'
      if (appt.service_id) {
        const { data: svc } = await supabase.from('services').select('name').eq('id', appt.service_id).maybeSingle()
        if (svc) svcName = svc.name ?? '-'
      }

      const masterName = prof.profession ?? 'Мастер'
      const clientName = appt.client_name ?? '-'
      const startTime = appt.start_time ?? '-'
      const masterTgId = prof.tg_chat_id ?? ''
      const clientTgId = appt.telegram_id ?? ''
      const clientTgUsr = appt.client_telegram ?? ''

      // Reminder to master
      const mRS = await getNotifSetting(masterId, 'reminder_master')
      const mRH = (mRS.timing_hours ?? prof.remind_master_hours ?? 24) as number
      if (mRS.enabled && mRH > 0 && offsetMin === mRH * 60 && masterTgId) {
        const msg = mRS.template?.trim()
          ? applyTemplate(mRS.template, { client_name: clientName, service: svcName, time: startTime, hours_label: hoursLabel, master_name: masterName })
          : `⏰ <b>Напоминание!</b> Через ${hoursLabel} запись:\n\n👤 <b>Клиент:</b> ${clientName}\n✂️ <b>Услуга:</b> ${svcName}\n🕐 <b>Время:</b> ${startTime}`
        if (msg) await sendTg(masterTgId, msg)
      }

      // Reminder to client
      const cRS = await getNotifSetting(masterId, 'reminder_client')
      const cRH = (cRS.timing_hours ?? prof.remind_client_hours ?? 24) as number
      if (cRS.enabled && cRH > 0 && offsetMin === cRH * 60 && (clientTgId || clientTgUsr)) {
        const msg = cRS.template?.trim()
          ? applyTemplate(cRS.template, { master_name: masterName, service: svcName, time: startTime, hours_label: hoursLabel, address: prof.address ?? '' })
          : `⏰ <b>Напоминание!</b> Через ${hoursLabel} у вас запись:\n\n👤 <b>Мастер:</b> ${masterName}\n✂️ <b>Услуга:</b> ${svcName}\n🕐 <b>Время:</b> ${startTime}` +
            (prof.address ? `\n📍 <b>Адрес:</b> ${prof.address}` : '')
        if (msg) await sendTgVia(clientTgId || clientTgUsr, msg, false) // клиентский бот
      }
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const body = await req.json()

    if (body.type === 'INSERT' && body.record) {
      await handleInsert(body.record)
      return new Response(JSON.stringify({ ok: true, type: 'insert' }))
    }
    if (body.type === 'UPDATE' && body.record) {
      await handleUpdate(body.record, body.old_record)
      return new Response(JSON.stringify({ ok: true, type: 'update' }))
    }
    if (body.type === 'CRON' || body.reminders) {
      await handleReminders()
      return new Response(JSON.stringify({ ok: true, type: 'reminders' }))
    }

    return new Response(JSON.stringify({ ok: true, skipped: true }))
  } catch (err) {
    console.error('telegram-notifications error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
