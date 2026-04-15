import dayjs from 'dayjs'
import { formatCurrency } from '@/lib/utils'
import type { WorkshopOrder } from '@/hooks/useWorkshopOrders'

export function printWorkshopReceipt(order: WorkshopOrder, companyName: string, statusLabel: string) {
  const client = order.client
  const clientName = client ? `${client.first_name} ${client.last_name ?? ''}`.trim() : '—'
  const clientPhone = client?.phone ?? ''
  const device = [order.item_type_name, order.brand, order.model].filter(Boolean).join(' ')

  const worksRows = (order.works ?? []).map(w => `
    <tr>
      <td>${escape(w.name)}</td>
      <td class="num">${w.quantity ?? 1}</td>
      <td class="num">${formatCurrency(w.price)}</td>
      <td class="num">${formatCurrency(w.price * (w.quantity ?? 1))}</td>
    </tr>
  `).join('')

  const partsRows = (order.parts ?? []).map(p => `
    <tr>
      <td>${escape(p.name)}${p.sku ? ` <span class="muted">(${escape(p.sku)})</span>` : ''}</td>
      <td class="num">${p.quantity ?? 1}</td>
      <td class="num">${formatCurrency(p.sell_price)}</td>
      <td class="num">${formatCurrency(p.sell_price * (p.quantity ?? 1))}</td>
    </tr>
  `).join('')

  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Квитанция ${escape(order.number)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #000; padding: 16px; font-size: 12px; line-height: 1.4; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 14px; margin: 16px 0 6px; border-bottom: 1px solid #000; padding-bottom: 4px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
    .company { font-size: 16px; font-weight: 700; }
    .num-box { text-align: right; }
    .num-box .number { font-size: 18px; font-weight: 700; }
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
    .muted { color: #888; font-size: 10px; }
    .notes { padding: 6px; background: #f8f8f8; border-left: 3px solid #999; margin: 4px 0; white-space: pre-wrap; }
    @media print {
      body { padding: 8mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">${escape(companyName)}</div>
      <div class="muted">Квитанция-договор на приём в ремонт</div>
    </div>
    <div class="num-box">
      <div class="number">№ ${escape(order.number)}</div>
      <div class="muted">${dayjs(order.created_at).format('DD.MM.YYYY HH:mm')}</div>
      <div class="muted">${escape(statusLabel)}</div>
    </div>
  </div>

  <h2>Заказчик</h2>
  <div class="row"><div class="label">ФИО</div><div class="val">${escape(clientName)}</div></div>
  ${clientPhone ? `<div class="row"><div class="label">Телефон</div><div class="val">${escape(clientPhone)}</div></div>` : ''}

  <h2>Устройство</h2>
  <div class="row"><div class="label">Наименование</div><div class="val">${escape(device)}</div></div>
  ${order.serial_number ? `<div class="row"><div class="label">Серийный №</div><div class="val">${escape(order.serial_number)}</div></div>` : ''}
  ${order.imei ? `<div class="row"><div class="label">IMEI</div><div class="val">${escape(order.imei)}</div></div>` : ''}
  ${order.defect_description ? `
    <div class="row"><div class="label">Неисправность</div><div class="val">${escape(order.defect_description)}</div></div>
  ` : ''}
  ${order.visible_defects ? `
    <div class="row"><div class="label">Внешний вид</div><div class="val">${escape(order.visible_defects)}</div></div>
  ` : ''}
  ${order.completeness ? `
    <div class="row"><div class="label">Комплектность</div><div class="val">${escape(order.completeness)}</div></div>
  ` : ''}

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

  <div class="muted" style="margin-top:12px">
    Клиент подтверждает правильность описания устройства и неисправности. В случае отказа от ремонта после диагностики
    оплачивается стоимость диагностики${order.diagnostic_price > 0 ? ` (${formatCurrency(order.diagnostic_price)})` : ''}.
    Устройство, не востребованное в течение 30 дней с даты готовности, может быть утилизировано.
  </div>

  <div class="signatures">
    <div class="sig">Принял (мастер): _________________</div>
    <div class="sig">Сдал (клиент): _________________</div>
  </div>

  <div class="no-print" style="margin-top: 20px; text-align: center;">
    <button onclick="window.print()" style="padding: 8px 20px; font-size: 14px; cursor: pointer;">Печать</button>
    <button onclick="window.close()" style="padding: 8px 20px; font-size: 14px; cursor: pointer; margin-left: 8px;">Закрыть</button>
  </div>

  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 300))</script>
</body>
</html>`

  const w = window.open('', '_blank', 'width=800,height=1000')
  if (!w) return
  w.document.write(html)
  w.document.close()
}

function escape(s: string | null | undefined): string {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
