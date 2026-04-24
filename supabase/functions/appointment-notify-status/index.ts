// appointment-notify-status
//
// Отправляет Telegram-уведомление КЛИЕНТУ при создании / изменении / отмене
// записи в таблице appointments. Вызывается из React-хуков useAppointments.
//
// Линковка клиента к Telegram-чату:
//   1) appointments.telegram_id — если уже проставлен
//   2) clients.tg_chat_id через client_id
//   3) tg_clients.tg_chat_id через clients.phone_normalized (мастер создал клиента вручную)
//   4) tg_clients.tg_chat_id через appointments.client_phone_normalized (гость)
//
// Шаблон сообщения — из app_settings(key='appointment_notification_templates', product=<...>),
// поддержка multilang: tpl.texts.{ru|en|uz}. Если шаблон отсутствует — fallback на встроенные
// тексты в трёх языках. Язык клиента — tg_clients.lang.
//
// Использует TG_CLIENT_BOT_TOKEN (единый клиентский бот @ezzeclient_bot).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://kong:8000'
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const BOT_TOKEN    = Deno.env.get('TG_CLIENT_BOT_TOKEN') || Deno.env.get('TG_BOT_TOKEN') || ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Event = 'created' | 'updated' | 'cancelled' | 'reminder'

const SUPPORTED_LANGS = ['ru', 'en', 'uz'] as const
type Lang = typeof SUPPORTED_LANGS[number]

function normalizeLang(raw: string | null | undefined): Lang {
  const s = String(raw || '').toLowerCase().slice(0, 2)
  return (SUPPORTED_LANGS as readonly string[]).includes(s) ? (s as Lang) : 'ru'
}

function fmtPrice(n: number): string {
  return (Number(n) || 0).toLocaleString('ru-RU')
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = String(s).slice(0, 10).split('-')
  if (d.length !== 3) return String(s)
  return `${d[2]}.${d[1]}.${d[0]}`
}

function fmtTime(t: string | null | undefined): string {
  return String(t ?? '').slice(0, 5)
}

function substitute(tpl: string, vars: Record<string, string>): string {
  let out = tpl
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, v)
  }
  return out
}

function pickText(tpl: any, lang: Lang): string | null {
  if (tpl?.texts && typeof tpl.texts === 'object') {
    return tpl.texts[lang] || tpl.texts.ru || tpl.texts.en || tpl.text || null
  }
  return tpl?.text || null
}

/** Fallback-тексты (ru/en/uz) на случай отсутствия шаблонов в app_settings */
const FALLBACK: Record<Event, Record<Lang, string>> = {
  created: {
    ru: '✅ <b>Запись создана</b>\n\n📅 {date} · {time}\n👤 {master_name}\n{service_line}{price_line}',
    en: '✅ <b>Appointment created</b>\n\n📅 {date} · {time}\n👤 {master_name}\n{service_line}{price_line}',
    uz: '✅ <b>Yozuv yaratildi</b>\n\n📅 {date} · {time}\n👤 {master_name}\n{service_line}{price_line}',
  },
  updated: {
    ru: 'ℹ️ <b>Запись обновлена</b>\n\n📅 {date} · {time}\n👤 {master_name}\n{service_line}',
    en: 'ℹ️ <b>Appointment updated</b>\n\n📅 {date} · {time}\n👤 {master_name}\n{service_line}',
    uz: 'ℹ️ <b>Yozuv yangilandi</b>\n\n📅 {date} · {time}\n👤 {master_name}\n{service_line}',
  },
  cancelled: {
    ru: '❌ <b>Запись отменена</b>\n\n📅 {date} · {time}\n👤 {master_name}',
    en: '❌ <b>Appointment cancelled</b>\n\n📅 {date} · {time}\n👤 {master_name}',
    uz: '❌ <b>Yozuv bekor qilindi</b>\n\n📅 {date} · {time}\n👤 {master_name}',
  },
  reminder: {
    ru: '⏰ <b>Напоминание</b>\n\n📅 {date} · {time}\n👤 {master_name}\n{service_line}',
    en: '⏰ <b>Reminder</b>\n\n📅 {date} · {time}\n👤 {master_name}\n{service_line}',
    uz: '⏰ <b>Eslatma</b>\n\n📅 {date} · {time}\n👤 {master_name}\n{service_line}',
  },
}

async function sendTg(chatId: string, text: string) {
  if (!chatId || !text || !BOT_TOKEN) return
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: String(chatId), text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(8000),
    })
  } catch (err) {
    console.error('sendTg error:', err)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const body = await req.json()
    const appointment_id = body.appointment_id as string | undefined
    const event = (body.event || 'created') as Event

    if (!appointment_id) {
      return new Response(JSON.stringify({ sent: false, reason: 'missing_params' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY)

    // 1. Получаем запись + мастера + услугу + привязанного клиента
    const { data: appt } = await sb
      .from('appointments')
      .select(`
        id, date, start_time, end_time, status, price, telegram_id,
        client_id, client_name, client_phone, client_phone_normalized,
        master_id,
        services ( name ),
        client:clients ( id, tg_chat_id, phone_normalized, first_name, last_name )
      `)
      .eq('id', appointment_id)
      .maybeSingle()

    if (!appt) {
      return new Response(JSON.stringify({ sent: false, reason: 'appt_not_found' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const linkedClient = (appt as any).client as
      | { id: string; tg_chat_id: string | null; phone_normalized: string | null; first_name: string | null; last_name: string | null }
      | null

    // 2. Определяем tg_chat_id — пробуем все источники
    let tgChatId: string | null = appt.telegram_id || null

    if (!tgChatId && linkedClient?.tg_chat_id) {
      tgChatId = linkedClient.tg_chat_id
    }

    if (!tgChatId && linkedClient?.phone_normalized) {
      const { data: tgc } = await sb
        .from('tg_clients')
        .select('tg_chat_id')
        .eq('phone_normalized', linkedClient.phone_normalized)
        .maybeSingle()
      tgChatId = tgc?.tg_chat_id || null
      if (tgChatId) {
        await sb.from('clients').update({ tg_chat_id: tgChatId }).eq('id', linkedClient.id)
      }
    }

    if (!tgChatId && appt.client_phone_normalized) {
      const { data: tgc } = await sb
        .from('tg_clients')
        .select('tg_chat_id')
        .eq('phone_normalized', appt.client_phone_normalized)
        .maybeSingle()
      tgChatId = tgc?.tg_chat_id || null
    }

    if (tgChatId && !appt.telegram_id) {
      await sb.from('appointments')
        .update({ telegram_id: tgChatId })
        .eq('id', appointment_id)
    }

    if (!tgChatId) {
      return new Response(JSON.stringify({ sent: false, reason: 'no_tg_chat_id' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // 3. Язык клиента
    let lang: Lang = 'ru'
    {
      const { data: tgc } = await sb
        .from('tg_clients')
        .select('lang')
        .eq('tg_chat_id', String(tgChatId))
        .maybeSingle()
      lang = normalizeLang(tgc?.lang)
    }

    // 4. Имя мастера + продукт (для фильтра шаблонов)
    const { data: mp } = await sb
      .from('master_profiles')
      .select('profession, product')
      .eq('user_id', appt.master_id)
      .maybeSingle()

    const resolvedClientName =
      appt.client_name ||
      [linkedClient?.first_name, linkedClient?.last_name].filter(Boolean).join(' ').trim() ||
      ''

    const priceStr = appt.price ? fmtPrice(appt.price) : '0'
    const serviceStr = (appt.services as any)?.name || ''

    const vars = {
      date: fmtDate(appt.date),
      time: fmtTime(appt.start_time),
      master_name: mp?.profession || '—',
      service: serviceStr,
      service_line: serviceStr ? `💼 ${serviceStr}\n` : '',
      price: priceStr,
      price_line: priceStr !== '0' ? `💰 ${priceStr}` : '',
      client_name: resolvedClientName,
    }

    // 5. Шаблон из app_settings
    let text: string | null = null
    try {
      const product = mp?.product || 'beauty'
      const { data: settings } = await sb
        .from('app_settings')
        .select('value')
        .eq('product', product)
        .eq('key', 'appointment_notification_templates')
        .maybeSingle()

      if (settings?.value) {
        const templates = JSON.parse(settings.value) as any[]
        const tpl = Array.isArray(templates) ? templates.find(t => t.event === event && t.enabled) : null
        const tplText = tpl ? pickText(tpl, lang) : null
        if (tplText) text = substitute(tplText, vars)
      }
    } catch (e) {
      console.warn('template fetch failed, using fallback:', (e as Error).message)
    }

    if (!text) text = substitute(FALLBACK[event][lang], vars).trim()

    await sendTg(tgChatId, text)

    return new Response(JSON.stringify({ sent: true, chat_id: tgChatId, event, lang }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('appointment-notify-status error:', err)
    return new Response(JSON.stringify({ sent: false, reason: 'error', message: (err as Error).message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
