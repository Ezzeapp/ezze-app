import { X, Printer, Truck, MapPin, Phone, PackageOpen, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { useReceiptConfig, DEFAULT_RECEIPT_CONFIG, type ReceiptConfig } from '@/hooks/useReceiptConfig'
import dayjs from 'dayjs'

export interface DeliverySlipItem {
  item_type_name: string
  price: number
  color?: string | null
  brand?: string | null
  defects?: string | null
}

export interface DeliverySlipData {
  number: string
  created_at: string
  client?: { first_name: string; last_name?: string | null; phone?: string | null } | null
  items: DeliverySlipItem[]
  total_amount: number
  prepaid_amount: number
  pickup_date?: string | null
  delivery_date?: string | null
  visit_address?: string | null
  notes?: string | null
}

function num(n: number): string {
  return n.toLocaleString('ru')
}

// XSS-фикс: всё user-input оборачиваем перед интерполяцией в HTML.
// Имя/адрес/notes клиента приходят в т.ч. из публичной формы /order/:slug.
function escapeHtml(s: unknown): string {
  if (s == null) return ''
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function buildSlipHtml(
  data: DeliverySlipData,
  config: ReceiptConfig,
  symbol: string,
): string {
  const rem = data.total_amount - data.prepaid_amount
  const e = escapeHtml
  const clientName = data.client ? [data.client.first_name, data.client.last_name].filter(Boolean).join(' ') : '—'
  const phone = data.client?.phone ?? ''
  const itemRows = data.items.map((it, i) => `
    <tr>
      <td style="padding:4px;border-bottom:1px dashed #ccc;vertical-align:top;">${i + 1}</td>
      <td style="padding:4px;border-bottom:1px dashed #ccc;">
        ${e(it.item_type_name)}
        ${(it.color || it.brand) ? `<div style="color:#666;font-size:11px;">${e([it.color, it.brand].filter(Boolean).join(', '))}</div>` : ''}
        ${it.defects ? `<div style="color:#888;font-size:11px;">Дефекты: ${e(it.defects)}</div>` : ''}
      </td>
      <td style="padding:4px;border-bottom:1px dashed #ccc;text-align:center;">☐</td>
    </tr>
  `).join('')

  const copyBlock = (label: string) => `
    <div style="page-break-after:always;padding:4mm 0;">
      <!-- Шапка -->
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px;">
        <div>
          ${config.company_name ? `<div style="font-weight:bold;font-size:16px;">${e(config.company_name)}</div>` : ''}
          ${config.company_phone ? `<div style="font-size:12px;color:#555;">${e(config.company_phone)}</div>` : ''}
        </div>
        <div style="text-align:right;">
          <div style="font-weight:bold;font-size:18px;">НАКЛАДНАЯ</div>
          <div style="font-size:11px;color:#666;">на доставку / забор</div>
        </div>
      </div>

      <!-- Номер, дата, метка -->
      <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:10px;">
        <span>Заказ: <b>№ ${e(data.number)}</b></span>
        <span>Оформлен: ${dayjs(data.created_at).format('DD.MM.YYYY HH:mm')}</span>
        ${label ? `<span style="color:#666;font-size:11px;">${e(label)}</span>` : ''}
      </div>

      <!-- Даты забора / доставки (крупно) -->
      <div style="display:flex;gap:8px;margin-bottom:10px;">
        ${data.pickup_date ? `
          <div style="flex:1;border:1px solid #000;border-radius:6px;padding:8px;text-align:center;">
            <div style="font-size:11px;color:#555;text-transform:uppercase;">Забор у клиента</div>
            <div style="font-weight:bold;font-size:18px;">${dayjs(data.pickup_date).format('DD.MM.YYYY')}</div>
          </div>` : ''}
        ${data.delivery_date ? `
          <div style="flex:1;border:1px solid #000;border-radius:6px;padding:8px;text-align:center;">
            <div style="font-size:11px;color:#555;text-transform:uppercase;">Доставка клиенту</div>
            <div style="font-weight:bold;font-size:18px;">${dayjs(data.delivery_date).format('DD.MM.YYYY')}</div>
          </div>` : ''}
      </div>

      <!-- Клиент / телефон / адрес -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:14px;">
        <tr>
          <td style="padding:6px 4px;width:110px;color:#555;">Клиент:</td>
          <td style="padding:6px 4px;font-weight:bold;">${e(clientName)}</td>
        </tr>
        ${phone ? `
          <tr>
            <td style="padding:6px 4px;color:#555;">Телефон:</td>
            <td style="padding:6px 4px;font-weight:bold;font-size:16px;">${e(phone)}</td>
          </tr>` : ''}
        ${data.visit_address ? `
          <tr>
            <td style="padding:6px 4px;color:#555;vertical-align:top;">Адрес:</td>
            <td style="padding:6px 4px;font-weight:bold;font-size:15px;">${e(data.visit_address)}</td>
          </tr>` : ''}
        ${data.notes ? `
          <tr>
            <td style="padding:6px 4px;color:#555;vertical-align:top;">Примечание:</td>
            <td style="padding:6px 4px;font-style:italic;">${e(data.notes)}</td>
          </tr>` : ''}
      </table>

      <!-- Список изделий с чекбоксами -->
      <div style="font-weight:bold;font-size:13px;margin:12px 0 4px;">ИЗДЕЛИЙ: ${data.items.length}</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;border-top:1px solid #000;border-bottom:1px solid #000;margin-bottom:10px;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="text-align:left;padding:4px;width:28px;">№</th>
            <th style="text-align:left;padding:4px;">Наименование</th>
            <th style="text-align:center;padding:4px;width:40px;">Сверено</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <!-- Сумма -->
      <div style="border:1px solid #000;border-radius:6px;padding:8px 12px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;font-size:14px;">
          <span>Итого:</span><span><b>${num(data.total_amount)} ${symbol}</b></span>
        </div>
        ${data.prepaid_amount > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:13px;color:#555;margin-top:2px;">
            <span>Предоплачено:</span><span>${num(data.prepaid_amount)} ${symbol}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:bold;margin-top:4px;padding-top:4px;border-top:1px dashed #999;">
            <span>К оплате при ${data.delivery_date ? 'доставке' : 'заборе'}:</span><span>${num(rem)} ${symbol}</span>
          </div>` : `
          <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:bold;margin-top:4px;">
            <span>К оплате:</span><span>${num(data.total_amount)} ${symbol}</span>
          </div>`}
      </div>

      <!-- Подписи -->
      <div style="display:flex;gap:16px;margin-top:22px;">
        <div style="flex:1;">
          <div style="border-top:1px solid #000;padding-top:4px;font-size:12px;">Сдал (курьер) / подпись</div>
          <div style="margin-top:10px;border-top:1px solid #000;padding-top:4px;font-size:12px;">ФИО</div>
        </div>
        <div style="flex:1;">
          <div style="border-top:1px solid #000;padding-top:4px;font-size:12px;">Принял (клиент) / подпись</div>
          <div style="margin-top:10px;border-top:1px solid #000;padding-top:4px;font-size:12px;">ФИО</div>
        </div>
      </div>

      ${config.footer_text ? `
        <div style="text-align:center;border-top:1px dashed #ccc;padding-top:6px;margin-top:14px;font-size:11px;color:#555;">
          ${e(config.footer_text)}
        </div>` : ''}
    </div>`

  const copies = config.copy_count === 2
    ? [copyBlock('Экземпляр курьера'), copyBlock('Экземпляр клиента')]
    : [copyBlock('')]

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  @page { size: A4; margin: 12mm; }
  body { margin:0; font-family: Arial, sans-serif; color:#000; }
  table { border-collapse: collapse; }
</style>
</head><body>${copies.join('')}</body></html>`
}

export function DeliverySlipModal({ data, onClose }: { data: DeliverySlipData; onClose: () => void }) {
  const { data: config = DEFAULT_RECEIPT_CONFIG } = useReceiptConfig()
  const symbol = useCurrencySymbol()
  const rem = data.total_amount - data.prepaid_amount
  const clientName = data.client ? [data.client.first_name, data.client.last_name].filter(Boolean).join(' ') : '—'

  function handlePrint() {
    const html = buildSlipHtml(data, config, symbol)
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) { alert('Разрешите всплывающие окна для печати'); return }
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center sm:p-4">
      <div className="bg-background shadow-2xl w-full h-full sm:h-auto sm:rounded-2xl sm:max-w-2xl sm:max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Truck className="h-5 w-5 text-primary shrink-0" />
            <h2 className="font-semibold truncate"><span className="hidden sm:inline">Накладная · </span>{data.number}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 bg-muted/40">
          <div className="bg-white text-black shadow-lg mx-auto w-full max-w-[560px] p-5 text-[13px]" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-3">
              <div>
                {config.company_name && <div className="font-bold text-base">{config.company_name}</div>}
                {config.company_phone && <div className="text-xs text-gray-500">{config.company_phone}</div>}
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">НАКЛАДНАЯ</div>
                <div className="text-xs text-gray-500">на доставку / забор</div>
              </div>
            </div>

            <div className="flex justify-between text-sm mb-3">
              <span>Заказ: <b>№ {data.number}</b></span>
              <span className="text-gray-500">Оформлен: {dayjs(data.created_at).format('DD.MM.YYYY HH:mm')}</span>
            </div>

            <div className="flex gap-2 mb-3">
              {data.pickup_date && (
                <div className="flex-1 border border-black rounded-md p-2 text-center">
                  <div className="text-[10px] text-gray-500 uppercase flex items-center justify-center gap-1">
                    <PackageOpen className="h-3 w-3" /> Забор у клиента
                  </div>
                  <div className="font-bold text-base">{dayjs(data.pickup_date).format('DD.MM.YYYY')}</div>
                </div>
              )}
              {data.delivery_date && (
                <div className="flex-1 border border-black rounded-md p-2 text-center">
                  <div className="text-[10px] text-gray-500 uppercase flex items-center justify-center gap-1">
                    <Truck className="h-3 w-3" /> Доставка клиенту
                  </div>
                  <div className="font-bold text-base">{dayjs(data.delivery_date).format('DD.MM.YYYY')}</div>
                </div>
              )}
            </div>

            <table className="w-full text-sm mb-3">
              <tbody>
                <tr>
                  <td className="py-1 text-gray-500 w-28">Клиент:</td>
                  <td className="py-1 font-bold">{clientName}</td>
                </tr>
                {data.client?.phone && (
                  <tr>
                    <td className="py-1 text-gray-500">Телефон:</td>
                    <td className="py-1 font-bold text-base flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> {data.client.phone}
                    </td>
                  </tr>
                )}
                {data.visit_address && (
                  <tr>
                    <td className="py-1 text-gray-500 align-top">Адрес:</td>
                    <td className="py-1 font-bold flex items-start gap-1">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {data.visit_address}
                    </td>
                  </tr>
                )}
                {data.notes && (
                  <tr>
                    <td className="py-1 text-gray-500 align-top">Примечание:</td>
                    <td className="py-1 italic">{data.notes}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="font-bold text-xs mt-3 mb-1">ИЗДЕЛИЙ: {data.items.length}</div>
            <table className="w-full text-xs border-t border-b border-black mb-3">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-1 w-7">№</th>
                  <th className="text-left p-1">Наименование</th>
                  <th className="text-center p-1 w-12">Сверено</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it, i) => (
                  <tr key={i} className="border-b border-dashed border-gray-300">
                    <td className="p-1 align-top">{i + 1}</td>
                    <td className="p-1">
                      <div>{it.item_type_name}</div>
                      {(it.color || it.brand) && (
                        <div className="text-gray-500 text-[11px]">{[it.color, it.brand].filter(Boolean).join(', ')}</div>
                      )}
                      {it.defects && (
                        <div className="text-gray-400 text-[11px]">Дефекты: {it.defects}</div>
                      )}
                    </td>
                    <td className="p-1 text-center text-lg">☐</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border border-black rounded-md px-3 py-2 mb-3 text-sm">
              <div className="flex justify-between">
                <span>Итого:</span><span className="font-bold">{num(data.total_amount)} {symbol}</span>
              </div>
              {data.prepaid_amount > 0 ? (
                <>
                  <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                    <span>Предоплачено:</span><span>{num(data.prepaid_amount)} {symbol}</span>
                  </div>
                  <div className="flex justify-between font-bold mt-1 pt-1 border-t border-dashed border-gray-400">
                    <span>К оплате при {data.delivery_date ? 'доставке' : 'заборе'}:</span>
                    <span>{num(rem)} {symbol}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between font-bold mt-1">
                  <span>К оплате:</span><span>{num(data.total_amount)} {symbol}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <div className="flex-1">
                <div className="border-t border-black pt-1 text-[11px]">Сдал (курьер)</div>
                <div className="mt-3 border-t border-black pt-1 text-[11px]">ФИО</div>
              </div>
              <div className="flex-1">
                <div className="border-t border-black pt-1 text-[11px]">Принял (клиент)</div>
                <div className="mt-3 border-t border-black pt-1 text-[11px]">ФИО</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose} className="flex-1">Закрыть</Button>
          <Button onClick={handlePrint} className="flex-1">
            <Printer className="h-4 w-4 mr-2" /> Печать
          </Button>
        </div>
      </div>
    </div>
  )
}
