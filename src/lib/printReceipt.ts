import type { Appointment, Service } from '@/types'
import dayjs from 'dayjs'

interface ReceiptData {
  appointment: Appointment
  masterName: string
  services: Service[]
  currency: string
}

export function printReceipt({ appointment, masterName, services, currency }: ReceiptData) {
  const serviceNames = services.map(s => s.name).join(', ') || appointment.notes?.match(/^\[([^\]]+)\]/)?.[1] || '—'
  const dateFormatted = dayjs(appointment.date).format('DD.MM.YYYY')
  const priceTotal = appointment.price ?? 0
  const discount = appointment.discount ?? 0
  const promoDiscount = appointment.promo_discount ?? 0
  const totalDiscount = discount + promoDiscount

  const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₽'
  const fmt = (n: number) => `${n.toLocaleString('ru-RU')} ${currencySymbol}`

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<title>Чек — ${dateFormatted}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 13px; color: #111; background: #fff; padding: 20px; max-width: 320px; margin: 0 auto; }
  .header { text-align: center; border-bottom: 2px dashed #aaa; padding-bottom: 12px; margin-bottom: 12px; }
  .header h1 { font-size: 18px; font-weight: bold; letter-spacing: 1px; }
  .header p { font-size: 11px; color: #555; margin-top: 4px; }
  .row { display: flex; justify-content: space-between; margin: 5px 0; }
  .row .label { color: #555; }
  .divider { border: none; border-top: 1px dashed #ccc; margin: 10px 0; }
  .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 15px; border-top: 2px dashed #aaa; padding-top: 10px; margin-top: 10px; }
  .footer { text-align: center; margin-top: 16px; font-size: 10px; color: #888; }
</style>
</head>
<body>
<div class="header">
  <h1>ЧЕК / RECEIPT</h1>
  <p>${masterName}</p>
  <p>${dateFormatted} · ${appointment.start_time}${appointment.end_time ? ' – ' + appointment.end_time : ''}</p>
</div>

<div class="row">
  <span class="label">Услуга</span>
  <span style="text-align:right; max-width: 60%">${serviceNames}</span>
</div>

${appointment.client_name ? `<div class="row"><span class="label">Клиент</span><span>${appointment.client_name}</span></div>` : ''}
${appointment.client_phone ? `<div class="row"><span class="label">Телефон</span><span>${appointment.client_phone}</span></div>` : ''}

<hr class="divider" />

${priceTotal > 0 || totalDiscount > 0 ? `
<div class="row">
  <span class="label">Сумма</span>
  <span>${fmt(priceTotal + totalDiscount)}</span>
</div>
${discount > 0 ? `<div class="row"><span class="label">Скидка</span><span>-${fmt(discount)}</span></div>` : ''}
${promoDiscount > 0 ? `<div class="row"><span class="label">Промокод${appointment.promo_code ? ' (' + appointment.promo_code + ')' : ''}</span><span>-${fmt(promoDiscount)}</span></div>` : ''}
<div class="total-row">
  <span>ИТОГО</span>
  <span>${fmt(priceTotal)}</span>
</div>
` : ''}

${appointment.payment_method ? `<div class="row" style="margin-top:8px"><span class="label">Оплата</span><span>${PAYMENT_LABELS[appointment.payment_method] || appointment.payment_method}</span></div>` : ''}

<div class="footer">
  <p>Спасибо! · Ezze</p>
</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=400,height=600')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 500)
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  transfer: 'Перевод',
  other: 'Другое',
}
