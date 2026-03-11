/**
 * Утилиты для отправки уведомлений через Telegram Bot API
 */

export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<boolean> {
  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    const data = await resp.json()
    return data.ok === true
  } catch {
    return false
  }
}

export function buildAppointmentMessage(opts: {
  clientName: string
  serviceName: string
  date: string
  time: string
  price?: number
  currency?: string
  notes?: string
  isNew: boolean
}): string {
  const { clientName, serviceName, date, time, price, currency, notes, isNew } = opts
  const emoji = isNew ? '🆕' : '✏️'
  const action = isNew ? 'Новая запись' : 'Запись обновлена'

  let msg = `${emoji} <b>${action}</b>\n\n`
  msg += `👤 Клиент: <b>${clientName}</b>\n`
  msg += `💼 Услуга: ${serviceName}\n`
  msg += `📅 Дата: ${date}\n`
  msg += `🕐 Время: ${time}\n`
  if (price) msg += `💰 Стоимость: ${price} ${currency || ''}\n`
  if (notes) msg += `📝 Заметка: ${notes}\n`

  return msg
}

export async function testTelegramConnection(botToken: string, chatId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '✅ <b>Ezze</b> подключён! Уведомления о записях будут приходить сюда.',
        parse_mode: 'HTML',
      }),
    })
    const data = await resp.json()
    if (data.ok) return { ok: true }
    return { ok: false, error: data.description || 'Неизвестная ошибка' }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
