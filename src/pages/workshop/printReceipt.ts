import dayjs from 'dayjs'
import { formatCurrency } from '@/lib/utils'
import { getFileUrl } from '@/lib/storage'
import type { WorkshopOrder } from '@/hooks/useWorkshopOrders'
import type { WorkshopReceiptTemplate } from '@/pages/settings/WorkshopReceiptTemplateTab'

interface PrintOpts {
  order: WorkshopOrder
  template: WorkshopReceiptTemplate
  statusLabel: string
  trackUrl: string   // e.g. https://workshop.ezze.site/track/РМ-0001
}

export function printWorkshopReceipt({ order, template, statusLabel, trackUrl }: PrintOpts) {
  const client = order.client
  const clientName = client ? `${client.first_name} ${client.last_name ?? ''}`.trim() : '—'
  const clientPhone = client?.phone ?? ''
  const device = [order.item_type_name, order.brand, order.model].filter(Boolean).join(' ')

  const worksRows = (order.works ?? []).map(w => `
    <tr>
      <td>${esc(w.name)}</td>
      <td class="num">${w.quantity ?? 1}</td>
      <td class="num">${formatCurrency(w.price)}</td>
      <td class="num">${formatCurrency(w.price * (w.quantity ?? 1))}</td>
    </tr>
  `).join('')

  const partsRows = (order.parts ?? []).map(p => `
    <tr>
      <td>${esc(p.name)}${p.sku ? ` <span class="muted">(${esc(p.sku)})</span>` : ''}</td>
      <td class="num">${p.quantity ?? 1}</td>
      <td class="num">${formatCurrency(p.sell_price)}</td>
      <td class="num">${formatCurrency(p.sell_price * (p.quantity ?? 1))}</td>
    </tr>
  `).join('')

  // QR код через api.qrserver.com (внешний сервис, безусловно работает из окна печати)
  const qrImg = template.show_qr
    ? `<div class="qr">
         <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(trackUrl)}" alt="QR"/>
         <div class="qr-hint">Отследить заказ онлайн:<br/>${esc(trackUrl)}</div>
       </div>`
    : ''

  // Фото (до 6 в сетке)
  const photosHtml = (order.photos ?? []).length > 0
    ? `<h2>Фото при приёмке</h2>
       <div class="photos">
         ${(order.photos ?? []).slice(0, 6).map(p =>
           `<img src="${esc(getFileUrl('workshop-photos', p))}" alt=""/>`
         ).join('')}
       </div>`
    : ''

  // Реквизиты
  const companyBlock = template.company_name
    ? `<div class="company-name">${esc(template.company_name)}</div>
       ${template.header_note ? `<div class="muted">${esc(template.header_note)}</div>` : ''}
       ${template.address ? `<div class="small">${esc(template.address)}</div>` : ''}
       <div class="small">
         ${template.phone ? `тел. ${esc(template.phone)}` : ''}
         ${template.phone && template.inn ? ' · ' : ''}
         ${template.inn ? `ИНН ${esc(template.inn)}` : ''}
       </div>`
    : `<div class="company-name">Квитанция на ремонт</div>`

  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Квитанция ${esc(order.number)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #000; padding: 16px; font-size: 12px; line-height: 1.4; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 14px; margin: 14px 0 6px; border-bottom: 1px solid #000; padding-bottom: 4px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
    .company-name { font-size: 15px; font-weight: 700; }
    .right { text-align: right; flex-shrink: 0; }
    .right .number { font-size: 18px; font-weight: 700; }
    .row { display: flex; gap: 8px; margin: 3px 0; }
    .row .label { min-width: 120px; color: #555; }
    .row .val { flex: 1; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0; }
    th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; font-size: 11px; }
    th { background: #f0f0f0; }
    td.num, th.num { text-align: right; }
    .totals { margin-top: 8px; text-align: right; }
    .totals .line { display: flex; justify-content: space-between; padding: 2px 0; max-width: 300px; margin-left: auto; }
    .totals .grand { font-size: 14px; font-weight: 700; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px; }
    .signatures { margin-top: 30px; display: flex; gap: 24px; }
    .sig { flex: 1; border-top: 1px solid #000; padding-top: 4px; font-size: 10px; color: #555; }
    .muted { color: #666; font-size: 11px; }
    .small { font-size: 11px; }
    .notes { padding: 6px; background: #f8f8f8; border-left: 3px solid #999; margin: 4px 0; white-space: pre-wrap; }
    .terms { margin-top: 10px; font-size: 10px; color: #444; line-height: 1.5; }
    .terms p { margin: 3px 0; }
    .qr { display: flex; align-items: center; gap: 8px; margin: 12px 0; padding: 8px; border: 1px dashed #aaa; border-radius: 4px; }
    .qr img { width: 90px; height: 90px; }
    .qr-hint { font-size: 10px; color: #555; }
    .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin: 6px 0; }
    .photos img { width: 100%; aspect-ratio: 1/1; object-fit: cover; border: 1px solid #ccc; }
    @media print {
      body { padding: 8mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${companyBlock}
      <div class="muted" style="margin-top:4px">Квитанция-договор на приём в ремонт</div>
    </div>
    <div class="right">
      <div class="number">№ ${esc(order.number)}</div>
      <div class="muted">${dayjs(order.created_at).format('DD.MM.YYYY HH:mm')}</div>
      <div class="muted">Статус: ${esc(statusLabel)}</div>
    </div>
  </div>

  <h2>Заказчик</h2>
  <div class="row"><div class="label">ФИО</div><div class="val">${esc(clientName)}</div></div>
  ${clientPhone ? `<div class="row"><div class="label">Телефон</div><div class="val">${esc(clientPhone)}</div></div>` : ''}

  <h2>Устройство</h2>
  <div class="row"><div class="label">Наименование</div><div class="val">${esc(device)}</div></div>
  ${order.serial_number ? `<div class="row"><div class="label">Серийный №</div><div class="val">${esc(order.serial_number)}</div></div>` : ''}
  ${order.imei ? `<div class="row"><div class="label">IMEI</div><div class="val">${esc(order.imei)}</div></div>` : ''}
  ${order.defect_description ? `<div class="row"><div class="label">Неисправность</div><div class="val">${esc(order.defect_description)}</div></div>` : ''}
  ${order.visible_defects ? `<div class="row"><div class="label">Внешний вид</div><div class="val">${esc(order.visible_defects)}</div></div>` : ''}
  ${order.completeness ? `<div class="row"><div class="label">Комплектность</div><div class="val">${esc(order.completeness)}</div></div>` : ''}

  ${photosHtml}

  ${(order.works && order.works.length) ? `
    <h2>Работы</h2>
    <table>
      <thead>
        <tr><th>Наименование</th><th class="num">Кол-во</th><th class="num">Цена</th><th class="num">Сумма</th></tr>
      </thead>
      <tbody>${worksRows}</tbody>
    </table>
  ` : ''}

  ${(order.parts && order.parts.length) ? `
    <h2>Запчасти</h2>
    <table>
      <thead>
        <tr><th>Наименование</th><th class="num">Кол-во</th><th class="num">Цена</th><th class="num">Сумма</th></tr>
      </thead>
      <tbody>${partsRows}</tbody>
    </table>
  ` : ''}

  <div class="totals">
    <div class="line"><span>Работы</span><span>${formatCurrency(order.works_amount)}</span></div>
    <div class="line"><span>Запчасти</span><span>${formatCurrency(order.parts_amount)}</span></div>
    <div class="line grand"><span>Итого</span><span>${formatCurrency(order.total_amount)}</span></div>
    ${order.prepaid_amount > 0 ? `<div class="line"><span>Предоплата</span><span>${formatCurrency(order.prepaid_amount)}</span></div>` : ''}
    ${order.paid_amount > 0 ? `<div class="line"><span>Оплачено</span><span>${formatCurrency(order.paid_amount)}</span></div>` : ''}
    ${(order.total_amount - order.paid_amount) > 0 ? `<div class="line"><span>К доплате</span><span>${formatCurrency(order.total_amount - order.paid_amount)}</span></div>` : ''}
  </div>

  <div class="row" style="margin-top:12px">
    <div class="label">Срок готовности</div>
    <div class="val">${order.ready_date ? dayjs(order.ready_date).format('DD.MM.YYYY') : '—'}</div>
  </div>
  <div class="row">
    <div class="label">Гарантия</div>
    <div class="val">${order.warranty_days} дн. с даты выдачи</div>
  </div>

  ${qrImg}

  <div class="terms">
    ${template.warranty_terms ? `<p><b>Гарантия.</b> ${esc(template.warranty_terms)}</p>` : ''}
    ${template.refuse_terms ? `<p><b>Отказ от ремонта.</b> ${esc(template.refuse_terms)}${order.diagnostic_price > 0 ? ` Стоимость диагностики: ${formatCurrency(order.diagnostic_price)}.` : ''}</p>` : ''}
    ${template.pickup_terms ? `<p><b>Получение.</b> ${esc(template.pickup_terms)}</p>` : ''}
  </div>

  <div class="signatures">
    <div class="sig">Принял (мастер): _________________</div>
    <div class="sig">Сдал (клиент): _________________</div>
  </div>

  ${template.footer ? `<div class="muted" style="text-align:center; margin-top:14px">${esc(template.footer)}</div>` : ''}

  <div class="no-print" style="margin-top: 20px; text-align: center;">
    <button onclick="window.print()" style="padding: 8px 20px; font-size: 14px; cursor: pointer;">Печать</button>
    <button onclick="window.close()" style="padding: 8px 20px; font-size: 14px; cursor: pointer; margin-left: 8px;">Закрыть</button>
  </div>

  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 500))</script>
</body>
</html>`

  const w = window.open('', '_blank', 'width=800,height=1000')
  if (!w) return
  w.document.write(html)
  w.document.close()
}

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
