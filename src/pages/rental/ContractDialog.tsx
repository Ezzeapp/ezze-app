import { useEffect, useMemo, useState } from 'react'
import { FileText, Printer, Save } from 'lucide-react'
import type { Client } from '@/types'
import type { RentalBooking, RentalItem } from '@/types/rental'
import { RENTAL_PRICING_UNIT_LABELS } from '@/types/rental'
import { useRentalContract, useUpsertRentalContract } from '@/hooks/useRentalContracts'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/components/shared/Toaster'

interface Props {
  open: boolean
  onClose: () => void
  booking: RentalBooking
  item: RentalItem | undefined
  client: Client | null | undefined
  masterName?: string
}

interface ClientIdentity {
  last_name?: string
  first_name?: string
  middle_name?: string
  passport_number?: string
  passport_issued_by?: string
  passport_issued_at?: string
  birthday?: string
  address?: string
  drivers_license_number?: string
  drivers_license_categories?: string
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function fmtRu(iso: string): string {
  return new Date(iso).toLocaleString('ru', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtRuDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function ContractDialog({ open, onClose, booking, item, client, masterName }: Props) {
  const { data: existing } = useRentalContract(booking.id)
  const upsert = useUpsertRentalContract()
  const currencySymbol = useCurrencySymbol()

  const [identity, setIdentity] = useState<ClientIdentity>({})
  const [extraTerms, setExtraTerms] = useState('')

  // Load existing or pre-fill from client record
  useEffect(() => {
    if (!open) return
    if (existing) {
      setIdentity((existing.client_identity as ClientIdentity) ?? {})
      setExtraTerms(((existing.terms as { extra?: string })?.extra) ?? '')
    } else if (client) {
      setIdentity({
        last_name:  client.last_name ?? '',
        first_name: client.first_name ?? '',
        address:    (client as Client & { address?: string }).address ?? '',
        birthday:   client.birthday ?? '',
      })
      setExtraTerms('')
    }
  }, [open, existing, client])

  const fullName = [identity.last_name, identity.first_name, identity.middle_name]
    .filter(Boolean).join(' ').trim() || (client ? `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() : '—')

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        ...(existing?.id ? { id: existing.id } : {}),
        booking_id: booking.id,
        client_identity: identity as unknown as Record<string, unknown>,
        terms: {
          item_name: item?.name ?? '',
          item_brand: item?.brand ?? null,
          item_model: item?.model ?? null,
          item_serial: item?.serial_number ?? null,
          item_plate: item?.registration_plate ?? null,
          period_start: booking.start_at,
          period_end: booking.end_at,
          unit_price: booking.unit_price,
          units_count: booking.units_count,
          base_price: booking.base_price,
          deposit_amount: booking.deposit_amount,
          deposit_required: booking.deposit_required,
          extra: extraTerms.trim() || null,
        },
        status: existing?.status === 'signed' ? 'signed' : 'draft',
      })
      toast.success('Договор сохранён')
    } catch (e) {
      console.error(e)
      toast.error('Ошибка сохранения')
    }
  }

  const totalAmount = booking.total_amount || booking.base_price

  // ── Сборка HTML для печати ────────────────────────────────────────────────
  const printDocument = () => {
    const contractNumber = existing?.contract_number ?? '<черновик>'
    const today = fmtRuDate(new Date().toISOString())
    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>Договор аренды ${escapeHtml(contractNumber)}</title>
<style>
  @page { size: A4; margin: 18mm 18mm 22mm 18mm; }
  body { font-family: Georgia, "Times New Roman", serif; font-size: 11pt; line-height: 1.45; color: #111; max-width: 174mm; margin: 0 auto; }
  h1 { text-align: center; font-size: 14pt; margin: 0 0 4px; }
  .sub { text-align: center; font-size: 10pt; color: #555; margin-bottom: 20px; }
  .section { margin-bottom: 14px; }
  .section h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #999; padding-bottom: 2px; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 6px; vertical-align: top; }
  td:first-child { width: 35%; color: #555; }
  td:last-child { font-weight: 500; }
  .signatures { margin-top: 30px; display: flex; justify-content: space-between; gap: 24px; }
  .signature { flex: 1; }
  .signature .line { border-bottom: 1px solid #333; height: 18px; margin: 24px 0 4px; }
  .signature .label { font-size: 9pt; color: #555; }
  .total { font-size: 12pt; font-weight: 600; }
  .terms { font-size: 10pt; line-height: 1.4; }
  .terms p { margin: 4px 0; }
  pre { white-space: pre-wrap; font-family: inherit; font-size: 10pt; margin: 4px 0; }
</style>
</head>
<body>

<h1>Договор аренды № ${escapeHtml(contractNumber)}</h1>
<p class="sub">${escapeHtml(today)}</p>

<div class="section">
  <h2>1. Стороны</h2>
  <table>
    <tr><td>Арендодатель</td><td>${escapeHtml(masterName || '—')}</td></tr>
    <tr><td>Арендатор</td><td>${escapeHtml(fullName)}</td></tr>
    ${identity.passport_number ? `<tr><td>Паспорт</td><td>${escapeHtml(identity.passport_number)}${identity.passport_issued_by ? ', выдан ' + escapeHtml(identity.passport_issued_by) : ''}${identity.passport_issued_at ? ' от ' + escapeHtml(identity.passport_issued_at) : ''}</td></tr>` : ''}
    ${identity.birthday ? `<tr><td>Дата рождения</td><td>${escapeHtml(identity.birthday)}</td></tr>` : ''}
    ${identity.address ? `<tr><td>Адрес</td><td>${escapeHtml(identity.address)}</td></tr>` : ''}
    ${identity.drivers_license_number ? `<tr><td>Водительское удостоверение</td><td>${escapeHtml(identity.drivers_license_number)}${identity.drivers_license_categories ? ' (кат. ' + escapeHtml(identity.drivers_license_categories) + ')' : ''}</td></tr>` : ''}
    ${client?.phone ? `<tr><td>Телефон</td><td>${escapeHtml(client.phone)}</td></tr>` : ''}
  </table>
</div>

<div class="section">
  <h2>2. Предмет аренды</h2>
  <table>
    <tr><td>Наименование</td><td>${escapeHtml(item?.name ?? '—')}</td></tr>
    ${item?.brand || item?.model ? `<tr><td>Бренд / модель</td><td>${escapeHtml([item?.brand, item?.model].filter(Boolean).join(' '))}</td></tr>` : ''}
    ${item?.serial_number ? `<tr><td>Серийный номер / VIN</td><td>${escapeHtml(item.serial_number)}</td></tr>` : ''}
    ${item?.registration_plate ? `<tr><td>Гос. номер</td><td>${escapeHtml(item.registration_plate)}</td></tr>` : ''}
  </table>
</div>

<div class="section">
  <h2>3. Срок и стоимость аренды</h2>
  <table>
    <tr><td>Период</td><td>${escapeHtml(fmtRu(booking.start_at))} — ${escapeHtml(fmtRu(booking.end_at))}</td></tr>
    <tr><td>Тариф</td><td>${formatCurrency(booking.unit_price)} ${escapeHtml(currencySymbol)} / ${escapeHtml(RENTAL_PRICING_UNIT_LABELS[booking.pricing_unit])}</td></tr>
    <tr><td>Кол-во единиц</td><td>${booking.units_count}</td></tr>
    <tr><td class="total">Сумма аренды</td><td class="total">${formatCurrency(totalAmount)} ${escapeHtml(currencySymbol)}</td></tr>
    ${booking.deposit_required ? `<tr><td>Залог</td><td>${formatCurrency(booking.deposit_amount)} ${escapeHtml(currencySymbol)}</td></tr>` : ''}
    ${booking.prepaid_amount > 0 ? `<tr><td>Предоплата</td><td>${formatCurrency(booking.prepaid_amount)} ${escapeHtml(currencySymbol)}</td></tr>` : ''}
  </table>
</div>

<div class="section terms">
  <h2>4. Условия</h2>
  <p>4.1. Арендатор обязуется бережно использовать предмет аренды и вернуть его в срок и исправном состоянии.</p>
  <p>4.2. При повреждении или утрате предмета аренды Арендатор возмещает стоимость восстановления. Возмещение покрывается из суммы залога; в случае превышения — доплачивается отдельно.</p>
  <p>4.3. За каждый час просрочки возврата Арендатор уплачивает штраф согласно тарифу либо фиксированную сумму, согласованную с Арендодателем.</p>
  <p>4.4. Ответственность за нарушение ПДД и иные административные правонарушения, совершённые в период аренды, несёт Арендатор.</p>
  <p>4.5. Арендатор подтверждает, что осмотрел предмет аренды и согласен с его текущим состоянием, зафиксированным в акте приёма-передачи.</p>
  ${extraTerms ? `<p><strong>Дополнительно:</strong></p><pre>${escapeHtml(extraTerms)}</pre>` : ''}
</div>

<div class="signatures">
  <div class="signature">
    <p>Арендодатель</p>
    <div class="line"></div>
    <p class="label">${escapeHtml(masterName || 'подпись')}</p>
  </div>
  <div class="signature">
    <p>Арендатор</p>
    <div class="line"></div>
    <p class="label">${escapeHtml(fullName)}</p>
  </div>
</div>

</body>
</html>`
    const win = window.open('', '_blank')
    if (!win) {
      toast.error('Разрешите всплывающие окна для печати')
      return
    }
    win.document.write(html)
    win.document.close()
    setTimeout(() => {
      try { win.focus(); win.print() } catch { /* ignore */ }
    }, 250)
  }

  const handleSaveAndPrint = async () => {
    await handleSave()
    printDocument()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Договор аренды {existing?.contract_number ? `№ ${existing.contract_number}` : '(черновик)'}
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="rounded-md bg-muted/40 p-2.5 text-sm space-y-0.5">
          <p>
            <span className="text-muted-foreground">Объект:</span> {item?.name ?? '—'}
            {item?.brand && <span className="text-muted-foreground"> · {item.brand}</span>}
          </p>
          <p>
            <span className="text-muted-foreground">Период:</span> {fmtRu(booking.start_at)} → {fmtRu(booking.end_at)}
          </p>
          <p>
            <span className="text-muted-foreground">Сумма:</span> {formatCurrency(totalAmount)} {currencySymbol}
            {booking.deposit_required && <span className="text-muted-foreground"> · залог {formatCurrency(booking.deposit_amount)} {currencySymbol}</span>}
          </p>
        </div>

        {/* Identity form */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Данные арендатора</p>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Фамилия</Label>
              <Input value={identity.last_name ?? ''} onChange={e => setIdentity(s => ({ ...s, last_name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Имя</Label>
              <Input value={identity.first_name ?? ''} onChange={e => setIdentity(s => ({ ...s, first_name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Отчество</Label>
              <Input value={identity.middle_name ?? ''} onChange={e => setIdentity(s => ({ ...s, middle_name: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Дата рождения</Label>
              <Input type="date" value={identity.birthday ?? ''} onChange={e => setIdentity(s => ({ ...s, birthday: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Адрес</Label>
              <Input value={identity.address ?? ''} onChange={e => setIdentity(s => ({ ...s, address: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Серия и номер паспорта</Label>
              <Input value={identity.passport_number ?? ''} onChange={e => setIdentity(s => ({ ...s, passport_number: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Дата выдачи</Label>
              <Input type="date" value={identity.passport_issued_at ?? ''} onChange={e => setIdentity(s => ({ ...s, passport_issued_at: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Кем выдан</Label>
            <Input value={identity.passport_issued_by ?? ''} onChange={e => setIdentity(s => ({ ...s, passport_issued_by: e.target.value }))} />
          </div>

          {item?.category === 'transport' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Водительские права (номер)</Label>
                <Input value={identity.drivers_license_number ?? ''} onChange={e => setIdentity(s => ({ ...s, drivers_license_number: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Категории</Label>
                <Input value={identity.drivers_license_categories ?? ''} onChange={e => setIdentity(s => ({ ...s, drivers_license_categories: e.target.value }))} placeholder="B, C..." />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Дополнительные условия (опционально)</Label>
          <textarea
            value={extraTerms}
            onChange={e => setExtraTerms(e.target.value)}
            rows={3}
            placeholder="Ограничение пробега 200 км/сут, запрет на выезд за пределы региона..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Закрыть</Button>
          <Button variant="outline" onClick={handleSave} loading={upsert.isPending}>
            <Save className="h-4 w-4 mr-1" />
            Сохранить
          </Button>
          <Button onClick={handleSaveAndPrint} loading={upsert.isPending}>
            <Printer className="h-4 w-4 mr-1" />
            Сохранить и распечатать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
