// appointment-notify-status
//
// Отправляет Telegram-уведомление КЛИЕНТУ при создании / изменении / отмене
// записи в таблице appointments. Вызывается из React-хуков useAppointments.
//
// Линковка клиента к Telegram-чату:
//   1) appointments.telegram_id — если уже проставлен (напр. запись сделана через бота)
//   2) tg_clients.tg_chat_id через client_phone_normalized (если клиент есть в боте)
//
// Шаблон сообщения берётся из app_settings(key='appointment_notification_templates'),
// фильтр по product из `master_profiles.product` приёма. Если шаблон не найден
// — используется fallback-текст на русском.
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

/** Fallback-тексты (ru) на случай отсутствия шаблонов в app_settings */
function fallbackText(event: Event, vars: Record<string, string>): string {
  switch (event) {
    case 'created':
      return (
        `✅ <b>Запись создана</b>\n\n` +
        `📅 ${vars.date} · ${vars.time}\n` +
        `👤 ${vars.master_name}\n` +
        (vars.service ? `💼 ${vars.service}\n` : '') +
        (vars.price && vars.price !== '0' ? `💰 ${vars.price}` : '')
      ).trim()
    case 'updated':
      return (
        `ℹ️ <b>Запись обновлена</b>\n\n` +
        `📅 ${vars.date} · ${vars.time}\n` +
        `👤 ${vars.master_name}\n` +
        (vars.service ? `💼 ${vars.service}` : '')
      ).trim()
    case 'cancelled':
      return (
        `❌ <b>Запись отменена</b>\n\n` +
        `📅 ${vars.date} · ${vars.time}\n` +
        `👤 ${vars.master_name}`
      ).trim()
    case 'reminder':
      return (
        `⏰ <b>Напоминание о записи</b>\n\n` +
        `📅 ${vars.date} · ${vars.time}\n` +
        `👤 ${vars.master_name}\n` +
        (vars.service ? `💼 ${vars.service}` : '')
      ).trim()
  }
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

    // 1. Получаем запись + мастера + услугу + привязанного клиента (по client_id)
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

    // 2. Определяем tg_chat_id — пробуем по порядку все возможные источники
    let tgChatId: string | null = appt.telegram_id || null

    // 2a. clients.tg_chat_id (если client_id привязан)
    if (!tgChatId && linkedClient?.tg_chat_id) {
      tgChatId = linkedClient.tg_chat_id
    }

    // 2b. tg_clients по phone_normalized из clients (мастер добавил клиента уже зарегистрированного в боте)
    if (!tgChatId && linkedClient?.phone_normalized) {
      const { data: tgc } = await sb
        .from('tg_clients')
        .select('tg_chat_id')
        .eq('phone_normalized', linkedClient.phone_normalized)
        .maybeSingle()
      tgChatId = tgc?.tg_chat_id || null

      // Backfill clients.tg_chat_id для последующих уведомлений
      if (tgChatId) {
        await sb.from('clients')
          .update({ tg_chat_id: tgChatId })
          .eq('id', linkedClient.id)
      }
    }

    // 2c. tg_clients по client_phone_normalized из самой записи (гостевая запись без client_id)
    if (!tgChatId && appt.client_phone_normalized) {
      const { data: tgc } = await sb
        .from('tg_clients')
        .select('tg_chat_id')
        .eq('phone_normalized', appt.client_phone_normalized)
        .maybeSingle()
      tgChatId = tgc?.tg_chat_id || null
    }

    // Если нашли — заодно проставим telegram_id в appointment для быстрого доступа в будущем
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

    // 3. Имя мастера + продукт (для фильтра шаблонов)
    const { data: mp } = await sb
      .from('master_profiles')
      .select('profession, product')
      .eq('user_id', appt.master_id)
      .maybeSingle()

    const resolvedClientName =
      appt.client_name ||
      [linkedClient?.first_name, linkedClient?.last_name].filter(Boolean).join(' ').trim() ||
      ''

    const vars = {
      date: fmtDate(appt.date),
      time: fmtTime(appt.start_time),
      master_name: mp?.profession || '—',
      service: (appt.services as any)?.name || '',
      price: appt.price ? fmtPrice(appt.price) : '0',
      client_name: resolvedClientName,
    }

    // 4. Пытаемся достать шаблон из app_settings
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
        const templates = JSON.parse(settings.value) as { event: string; enabled: boolean; text: string }[]
        const tpl = Array.isArray(templates) ? templates.find(t => t.event === event && t.enabled) : null
        if (tpl?.text) text = substitute(tpl.text, vars)
      }
    } catch (e) {
      console.warn('template fetch failed, using fallback:', (e as Error).message)
    }

    if (!text) text = fallbackText(event, vars)

    await sendTg(tgChatId, text)

    return new Response(JSON.stringify({ sent: true, chat_id: tgChatId, event }), {
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
