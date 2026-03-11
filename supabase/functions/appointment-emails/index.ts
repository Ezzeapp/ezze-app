/**
 * Edge Function: appointment-emails
 * Sends email notifications when appointments are created or updated.
 *
 * Called via PostgreSQL trigger (pg_net) or directly via HTTP POST.
 * Body: { record: AppointmentRow, old_record?: AppointmentRow, type: 'INSERT' | 'UPDATE' }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const APP_URL = Deno.env.get('APP_URL') ?? 'https://ezze.site'

// ── Email helpers ─────────────────────────────────────────────────────────────

async function getEmailConfig() {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'email_config')
    .maybeSingle()
  if (!data) return null
  try { return JSON.parse(data.value) } catch { return null }
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!to) return
  const cfg = await getEmailConfig()
  if (!cfg || !cfg.enabled || !cfg.smtp_pass) return
  const from = `${cfg.from_name ?? 'Ezze'} <${cfg.from_address ?? 'noreply@ezze.site'}>`
  try {
    if (cfg.smtp_host === 'smtp.resend.com') {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cfg.smtp_pass}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to.trim()], subject, html }),
      })
      if (!r.ok) console.error('sendEmail error', r.status, await r.text())
      else console.log('sendEmail OK to', to)
    }
  } catch (err) { console.error('sendEmail exc:', err) }
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

function buildHtml(title: string, rows: {l:string;v:string}[], cancelLink?: string, bookLink?: string): string {
  const trs = rows.filter(r => r.v).map(r =>
    `<tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;width:40%">${r.l}</td>` +
    `<td style="padding:8px 12px;color:#111827;font-size:13px;font-weight:500">${r.v}</td></tr>`
  ).join('')
  let btns = ''
  if (cancelLink) btns += `<p style="margin-top:20px"><a href="${cancelLink}" style="display:inline-block;background:#ef4444;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px">Отменить запись</a></p>`
  if (bookLink) btns += `<p style="margin-top:12px"><a href="${bookLink}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px">Записаться снова</a></p>`
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">` +
    `<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">` +
    `<table style="max-width:520px;width:100%;background:#fff;border-radius:12px;border:1px solid #e5e7eb">` +
    `<tr><td style="background:#6366f1;padding:24px 28px;border-radius:12px 12px 0 0"><p style="margin:0;font-size:20px;font-weight:700;color:#fff">${title}</p></td></tr>` +
    `<tr><td style="padding:20px 16px"><table width="100%" style="border:1px solid #e5e7eb;border-radius:8px">${trs}</table>${btns}</td></tr>` +
    `<tr><td style="padding:12px;text-align:center;border-top:1px solid #f3f4f6"><p style="margin:0;font-size:11px;color:#9ca3af">Платформа <a href="${APP_URL}" style="color:#6366f1">Ezze</a></p></td></tr>` +
    `</table></td></tr></table></body></html>`
}

async function getNotifEmailEnabled(masterId: string, type: string): Promise<boolean> {
  const { data } = await supabase
    .from('notification_settings')
    .select('enable_email')
    .eq('master_id', masterId)
    .eq('type', type)
    .maybeSingle()
  return data?.enable_email ?? false
}

// ── Handle INSERT: new appointment ────────────────────────────────────────────

async function handleInsert(record: any) {
  const masterId = record.master_id
  if (!masterId) return

  const { data: prof } = await supabase
    .from('master_profiles')
    .select('*')
    .eq('user_id', masterId)
    .maybeSingle()
  if (!prof) return

  const { data: masterUser } = await supabase
    .from('users')
    .select('email')
    .eq('id', masterId)
    .maybeSingle()

  let svcName = '-', svcPrice = ''
  if (record.service_id) {
    const { data: svc } = await supabase.from('services').select('name,price').eq('id', record.service_id).maybeSingle()
    if (svc) {
      svcName = svc.name ?? '-'
      if (svc.price) svcPrice = `${svc.price} ${prof.currency ?? 'UZS'}`
    }
  }

  const date = fmtDate(record.date ?? '')
  const time = (record.start_time ?? '').slice(0, 5) || '-'
  const cancelLink = record.cancel_token ? `${APP_URL}/cancel/${record.cancel_token}` : ''
  const online = record.booked_via === 'online'

  const mEmail = prof.notification_email || masterUser?.email || ''
  const cEmail = record.client_email ?? ''

  // Email to master
  if (await getNotifEmailEnabled(masterId, 'new_appointment') && mEmail) {
    await sendEmail(mEmail, `Новая запись — ${record.client_name}`, buildHtml('Новая запись', [
      { l: 'Клиент', v: record.client_name ?? '-' },
      { l: 'Телефон', v: record.client_phone ?? '' },
      { l: 'Email', v: cEmail },
      { l: 'Услуга', v: svcName },
      { l: 'Дата', v: date },
      { l: 'Время', v: time },
      { l: 'Стоимость', v: svcPrice },
      { l: 'Источник', v: online ? 'Онлайн' : 'Вручную' },
      { l: 'Комментарий', v: record.notes ?? '' },
    ]))
  }

  // Confirmation email to client
  if (await getNotifEmailEnabled(masterId, 'appointment_confirmed') && cEmail) {
    const mName = masterUser ? '' : (prof.profession ?? 'Мастер')
    await sendEmail(cEmail, `Запись подтверждена — ${date}`, buildHtml('Запись подтверждена', [
      { l: 'Мастер', v: mName },
      { l: 'Услуга', v: svcName },
      { l: 'Дата', v: date },
      { l: 'Время', v: time },
      { l: 'Адрес', v: prof.address ?? '' },
      { l: 'Стоимость', v: svcPrice },
    ], cancelLink))
  }
}

// ── Handle UPDATE: cancelled or rescheduled ───────────────────────────────────

async function handleUpdate(record: any, oldRecord: any) {
  const masterId = record.master_id
  const cEmail = record.client_email ?? ''
  if (!masterId || !cEmail) return

  const { data: prof } = await supabase.from('master_profiles').select('*').eq('user_id', masterId).maybeSingle()
  if (!prof) return

  const { data: masterUser } = await supabase.from('users').select('email').eq('id', masterId).maybeSingle()
  const mName = masterUser ? '' : (prof.profession ?? 'Мастер')
  const slug = prof.booking_slug ?? ''
  const date = fmtDate(record.date ?? '')
  const time = (record.start_time ?? '').slice(0, 5) || '-'
  const cancelLink = record.cancel_token ? `${APP_URL}/cancel/${record.cancel_token}` : ''

  let svcName = '-'
  if (record.service_id) {
    const { data: svc } = await supabase.from('services').select('name').eq('id', record.service_id).maybeSingle()
    if (svc) svcName = svc.name ?? '-'
  }

  if (record.status === 'cancelled') {
    if (await getNotifEmailEnabled(masterId, 'appointment_cancelled')) {
      await sendEmail(cEmail, `Запись отменена — ${date}`, buildHtml('Запись отменена', [
        { l: 'Мастер', v: mName }, { l: 'Дата', v: date },
        { l: 'Время', v: time }, { l: 'Услуга', v: svcName },
      ], undefined, `${APP_URL}/book/${slug}`))
    }
    return
  }

  // Rescheduled?
  if (oldRecord && (oldRecord.date !== record.date || oldRecord.start_time !== record.start_time)) {
    if (await getNotifEmailEnabled(masterId, 'appointment_rescheduled')) {
      await sendEmail(cEmail, `Запись перенесена — ${date}`, buildHtml('Запись перенесена', [
        { l: 'Мастер', v: mName }, { l: 'Услуга', v: svcName },
        { l: 'Новая дата', v: date }, { l: 'Новое время', v: time },
      ], cancelLink))
    }
  }
}

// ── Reminder cron ─────────────────────────────────────────────────────────────

async function handleReminders() {
  const now = new Date()
  const offsets = [60, 120, 1440, 2880]
  const cfg = await getEmailConfig()
  if (!cfg || !cfg.enabled || !cfg.smtp_pass) return

  for (const off of offsets) {
    const t = new Date(now.getTime() + off * 60000)
    const tDate = t.toISOString().slice(0, 10)
    const tTime = t.toTimeString().slice(0, 5)

    const { data: appts } = await supabase
      .from('appointments')
      .select('*, master_profiles!inner(user_id, address, notification_email, booking_slug, currency, remind_master_hours, remind_client_hours)')
      .eq('date', tDate)
      .eq('start_time', tTime)
      .eq('status', 'scheduled')
      .limit(100)
    if (!appts?.length) continue

    const hoursLabel = off >= 60 ? `${off / 60} ч` : `${off} мин`

    for (const appt of appts) {
      const masterId = appt.master_id
      const { data: masterUser } = await supabase.from('users').select('email').eq('id', masterId).maybeSingle()
      const mEmail = (appt as any).master_profiles?.notification_email || masterUser?.email || ''
      const cEmail = appt.client_email ?? ''

      let svcName = '-'
      if (appt.service_id) {
        const { data: svc } = await supabase.from('services').select('name').eq('id', appt.service_id).maybeSingle()
        if (svc) svcName = svc.name ?? '-'
      }

      // Reminder to master (24h before)
      if (off === 1440 && await getNotifEmailEnabled(masterId, 'reminder_master') && mEmail) {
        await sendEmail(mEmail, `Напоминание — запись через ${hoursLabel}`, buildHtml('Напоминание о записи', [
          { l: 'Через', v: hoursLabel }, { l: 'Клиент', v: appt.client_name ?? '-' },
          { l: 'Услуга', v: svcName }, { l: 'Дата', v: fmtDate(appt.date) },
          { l: 'Время', v: (appt.start_time ?? '').slice(0, 5) },
        ]))
      }

      // Reminder to client (24h before)
      if (off === 1440 && await getNotifEmailEnabled(masterId, 'reminder_client') && cEmail) {
        const cancelLink = appt.cancel_token ? `${APP_URL}/cancel/${appt.cancel_token}` : ''
        await sendEmail(cEmail, `Напоминание о записи — ${fmtDate(appt.date)}`, buildHtml('Напоминание о записи', [
          { l: 'Через', v: hoursLabel }, { l: 'Услуга', v: svcName },
          { l: 'Дата', v: fmtDate(appt.date) }, { l: 'Время', v: (appt.start_time ?? '').slice(0, 5) },
        ], cancelLink))
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

    // Called from pg_net webhook with appointment row
    if (body.type === 'INSERT' && body.record) {
      await handleInsert(body.record)
      return new Response(JSON.stringify({ ok: true }))
    }
    if (body.type === 'UPDATE' && body.record) {
      await handleUpdate(body.record, body.old_record)
      return new Response(JSON.stringify({ ok: true }))
    }

    // Called as reminder cron
    if (body.type === 'CRON' || body.reminders) {
      await handleReminders()
      return new Response(JSON.stringify({ ok: true, type: 'reminders' }))
    }

    return new Response(JSON.stringify({ ok: true, skipped: true }))
  } catch (err) {
    console.error('appointment-emails error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
