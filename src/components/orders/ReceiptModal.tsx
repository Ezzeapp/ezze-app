import { useState } from 'react'
import { X, Printer, FileText, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { useReceiptConfig, DEFAULT_RECEIPT_CONFIG, type ReceiptConfig } from '@/hooks/useReceiptConfig'
import dayjs from 'dayjs'

// ── Типы данных для квитанции ─────────────────────────────────────────────────

export interface ReceiptItem {
  item_type_name: string
  price: number
  ready_date?: string | null
  color?: string | null
  brand?: string | null
  defects?: string | null
  area_m2?: number | null
  width_m?: number | string | null
  length_m?: number | string | null
}

export interface ReceiptData {
  id: string
  number: string
  created_at: string
  order_type?: string
  client?: { first_name: string; last_name?: string | null; phone?: string | null } | null
  items: ReceiptItem[]
  total_amount: number
  prepaid_amount: number
  notes?: string | null
}

// ── Генерация HTML-строки квитанции (для окна печати) ─────────────────────────

function num(n: number): string {
  return n.toLocaleString('ru')
}

function buildReceiptCopyHtml(
  data: ReceiptData,
  config: ReceiptConfig,
  symbol: string,
  format: 'a4' | '80mm',
  copyLabel: string,
  isLast: boolean
): string {
  const narrow = format === '80mm'
  const rem = data.total_amount - data.prepaid_amount

  const itemRows = data.items.map((it, i) => `
    <tr>
      <td style="padding:3px 2px;vertical-align:top;">${i + 1}</td>
      <td style="padding:3px 2px;">
        ${it.item_type_name}
        ${config.show_item_details && (it.color || it.brand)
          ? `<div style="color:#666;font-size:10px;">${[it.color, it.brand].filter(Boolean).join(', ')}</div>` : ''}
        ${config.show_item_details && it.area_m2
          ? `<div style="color:#666;font-size:10px;">${it.width_m}×${it.length_m} м = ${Number(it.area_m2).toFixed(2)} м²</div>` : ''}
        ${config.show_item_details && it.defects
          ? `<div style="color:#888;font-size:10px;">Дефекты: ${it.defects}</div>` : ''}
      </td>
      <td style="text-align:right;padding:3px 2px;white-space:nowrap;">${num(it.price)} ${symbol}</td>
      <td style="text-align:right;padding:3px 2px;white-space:nowrap;">${it.ready_date ? dayjs(it.ready_date).format('DD.MM') : '—'}</td>
    </tr>
  `).join('')

  return `
    <div style="
      ${narrow ? 'width:72mm;' : 'width:100%;'}
      font-family:Arial,sans-serif;
      font-size:${narrow ? '11px' : '13px'};
      padding:${narrow ? '4px 0' : '0'};
      page-break-after:${isLast ? 'auto' : 'always'};
    ">
      <!-- Шапка -->
      <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:8px;">
        ${config.company_name
          ? `<div style="font-weight:bold;font-size:${narrow ? '14px' : '18px'};margin-bottom:2px;">${config.company_name}</div>` : ''}
        ${config.company_address ? `<div>${config.company_address}</div>` : ''}
        ${config.company_phone ? `<div>${config.company_phone}</div>` : ''}
      </div>

      <!-- Номер и дата -->
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:${narrow ? '12px' : '15px'};margin-bottom:4px;">
        <span>КВИТАНЦИЯ № ${data.number}</span>
        <span>${dayjs(data.created_at).format('DD.MM.YYYY')}</span>
      </div>
      ${data.client
        ? `<div style="margin-bottom:4px;">Клиент: <b>${[data.client.first_name, data.client.last_name].filter(Boolean).join(' ')}</b>${data.client.phone ? ' · ' + data.client.phone : ''}</div>`
        : ''}
      ${data.notes
        ? `<div style="font-style:italic;color:#555;font-size:10px;margin-bottom:4px;">Примечание: ${data.notes}</div>`
        : ''}

      <!-- Таблица изделий -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:${narrow ? '10px' : '12px'};">
        <thead>
          <tr style="border-bottom:1px solid #000;">
            <th style="text-align:left;padding:3px 2px;">№</th>
            <th style="text-align:left;padding:3px 2px;">Наименование</th>
            <th style="text-align:right;padding:3px 2px;">Цена</th>
            <th style="text-align:right;padding:3px 2px;">Срок</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <!-- Итого -->
      <div style="border-top:2px solid #000;padding-top:6px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:${narrow ? '13px' : '15px'};">
          <span>ИТОГО:</span>
          <span>${num(data.total_amount)} ${symbol}</span>
        </div>
        ${data.prepaid_amount > 0 ? `
          <div style="display:flex;justify-content:space-between;margin-top:3px;">
            <span>Предоплата:</span><span>${num(data.prepaid_amount)} ${symbol}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:3px;font-weight:bold;">
            <span>К оплате при выдаче:</span><span>${num(rem)} ${symbol}</span>
          </div>` : ''}
      </div>

      <!-- Подписи -->
      <div style="display:flex;justify-content:space-between;gap:24px;margin-bottom:12px;">
        <div style="flex:1;border-top:1px solid #000;padding-top:3px;font-size:11px;">Сдал</div>
        <div style="flex:1;border-top:1px solid #000;padding-top:3px;font-size:11px;">Принял</div>
      </div>

      <!-- Метка копии -->
      ${copyLabel ? `<div style="text-align:center;color:#666;font-size:10px;margin-bottom:4px;">${copyLabel}</div>` : ''}

      <!-- Нижний колонтитул -->
      ${config.footer_text
        ? `<div style="text-align:center;border-top:1px dashed #ccc;padding-top:6px;font-size:11px;color:#555;">${config.footer_text}</div>`
        : ''}
    </div>
  `
}

function buildFullHtml(
  data: ReceiptData,
  config: ReceiptConfig,
  symbol: string,
  format: 'a4' | '80mm'
): string {
  const pageStyle = format === '80mm'
    ? `@page { size: 80mm auto; margin: 3mm; } body { width: 80mm; }`
    : `@page { size: A4; margin: 15mm; } body { width: 100%; }`

  const copies: { label: string }[] = config.copy_count === 2
    ? [{ label: 'Экземпляр клиента' }, { label: 'Экземпляр организации' }]
    : [{ label: '' }]

  const bodyCopies = copies
    .map((c, i) => buildReceiptCopyHtml(data, config, symbol, format, c.label, i === copies.length - 1))
    .join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, sans-serif; }
  table { border-collapse: collapse; }
  ${pageStyle}
</style>
</head><body>${bodyCopies}</body></html>`
}

// ── Превью квитанции ──────────────────────────────────────────────────────────

function ReceiptPreview({ data, config, symbol, format }: {
  data: ReceiptData
  config: ReceiptConfig
  symbol: string
  format: 'a4' | '80mm'
}) {
  const narrow = format === '80mm'
  const rem = data.total_amount - data.prepaid_amount
  const copies: string[] = config.copy_count === 2
    ? ['Экземпляр клиента', 'Экземпляр организации']
    : ['']

  return (
    <div className={cn(
      'bg-white text-black shadow-lg mx-auto',
      narrow ? 'w-[302px] text-[11px]' : 'w-full text-[13px]'
    )}>
      {copies.map((copyLabel, copyIdx) => (
        <div
          key={copyIdx}
          className={cn('p-4', copyIdx > 0 && 'border-t-4 border-dashed border-gray-300 mt-4')}
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          {/* Шапка */}
          <div className="text-center border-b-2 border-black pb-2 mb-2">
            {config.company_name && (
              <div className={cn('font-bold', narrow ? 'text-sm' : 'text-lg')}>{config.company_name}</div>
            )}
            {!config.company_name && (
              <div className="text-gray-400 italic text-xs">Название организации</div>
            )}
            {config.company_address && <div>{config.company_address}</div>}
            {config.company_phone && <div>{config.company_phone}</div>}
          </div>

          {/* Номер и дата */}
          <div className="flex justify-between font-bold mb-1" style={{ fontSize: narrow ? '12px' : '15px' }}>
            <span>КВИТАНЦИЯ № {data.number}</span>
            <span>{dayjs(data.created_at).format('DD.MM.YYYY')}</span>
          </div>
          {data.client && (
            <div className="mb-1">
              Клиент: <b>{[data.client.first_name, data.client.last_name].filter(Boolean).join(' ')}</b>
              {data.client.phone && ` · ${data.client.phone}`}
            </div>
          )}
          {data.notes && (
            <div className="italic text-gray-500 text-[10px] mb-1">Примечание: {data.notes}</div>
          )}

          {/* Таблица изделий */}
          <table className="w-full border-collapse mb-2 text-[10px]">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left p-[3px_2px]">№</th>
                <th className="text-left p-[3px_2px]">Наименование</th>
                <th className="text-right p-[3px_2px] whitespace-nowrap">Цена</th>
                <th className="text-right p-[3px_2px] whitespace-nowrap">Срок</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it, i) => (
                <tr key={i} className="border-b border-dashed border-gray-300">
                  <td className="p-[3px_2px] align-top">{i + 1}</td>
                  <td className="p-[3px_2px]">
                    <div>{it.item_type_name}</div>
                    {config.show_item_details && (it.color || it.brand) && (
                      <div className="text-gray-500 text-[10px]">{[it.color, it.brand].filter(Boolean).join(', ')}</div>
                    )}
                    {config.show_item_details && it.area_m2 && (
                      <div className="text-gray-500 text-[10px]">{it.width_m}×{it.length_m} м = {Number(it.area_m2).toFixed(2)} м²</div>
                    )}
                    {config.show_item_details && it.defects && (
                      <div className="text-gray-400 text-[10px]">Дефекты: {it.defects}</div>
                    )}
                  </td>
                  <td className="text-right p-[3px_2px] whitespace-nowrap">{num(it.price)} {symbol}</td>
                  <td className="text-right p-[3px_2px] whitespace-nowrap">
                    {it.ready_date ? dayjs(it.ready_date).format('DD.MM') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Итого */}
          <div className="border-t-2 border-black pt-1.5 mb-2.5">
            <div className="flex justify-between font-bold" style={{ fontSize: narrow ? '13px' : '15px' }}>
              <span>ИТОГО:</span>
              <span>{num(data.total_amount)} {symbol}</span>
            </div>
            {data.prepaid_amount > 0 && (
              <>
                <div className="flex justify-between mt-1">
                  <span>Предоплата:</span>
                  <span>{num(data.prepaid_amount)} {symbol}</span>
                </div>
                <div className="flex justify-between mt-1 font-bold">
                  <span>К оплате при выдаче:</span>
                  <span>{num(rem)} {symbol}</span>
                </div>
              </>
            )}
          </div>

          {/* Подписи */}
          <div className="flex gap-6 mb-3">
            <div className="flex-1 border-t border-black pt-1 text-[11px]">Сдал</div>
            <div className="flex-1 border-t border-black pt-1 text-[11px]">Принял</div>
          </div>

          {/* Метка копии */}
          {copyLabel && (
            <div className="text-center text-gray-500 text-[10px] mb-1">{copyLabel}</div>
          )}

          {/* Нижний колонтитул */}
          {config.footer_text && (
            <div className="text-center border-t border-dashed border-gray-300 pt-1.5 text-[11px] text-gray-500">
              {config.footer_text}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Основной компонент модального окна ────────────────────────────────────────

export function ReceiptModal({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const [format, setFormat] = useState<'a4' | '80mm'>('a4')
  const { data: config = DEFAULT_RECEIPT_CONFIG } = useReceiptConfig()
  const symbol = useCurrencySymbol()

  function handlePrint() {
    const html = buildFullHtml(data, config, symbol, format)
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) { alert('Разрешите всплывающие окна для печати'); return }
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Заголовок */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Квитанция {data.number}</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Переключатель формата */}
            <div className="flex rounded-lg border overflow-hidden text-sm">
              {(['a4', '80mm'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={cn(
                    'px-3 py-1.5 font-medium transition-colors',
                    format === f ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
                  )}
                >
                  {f === 'a4' ? 'A4' : '80 мм'}
                </button>
              ))}
            </div>
            {/* Переключатель 1/2 копии */}
            <button
              onClick={() => {}}
              title={config.copy_count === 2 ? '2 экземпляра' : '1 экземпляр'}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <Layers className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Превью */}
        <div className="flex-1 overflow-auto p-4 bg-muted/40">
          <ReceiptPreview data={data} config={config} symbol={symbol} format={format} />
        </div>

        {/* Кнопки */}
        <div className="flex gap-3 px-5 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Закрыть
          </Button>
          <Button onClick={handlePrint} className="flex-1">
            <Printer className="h-4 w-4 mr-2" />
            Печать
          </Button>
        </div>
      </div>
    </div>
  )
}
