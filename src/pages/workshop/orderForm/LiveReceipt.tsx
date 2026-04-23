import { useTranslation } from 'react-i18next'
import { Clipboard, Sparkles } from 'lucide-react'
import dayjs from 'dayjs'
import type { WorkshopItemType, WorkshopPriority } from '@/hooks/useWorkshopOrders'
import { cn } from '@/lib/utils'

export interface LiveReceiptProps {
  orderNumber?: string | null
  selectedType: WorkshopItemType | undefined
  brand: string
  model: string
  serial: string
  imei: string
  defect: string
  visible: string
  completenessLabels: string[]
  customer: { first_name?: string | null; last_name?: string | null; phone?: string | null } | null
  priority: WorkshopPriority
  diagnosticPrice: number
  estimated: number | ''
  prepaid: number
  readyDate: string
  warrantyDays: number
  consent: boolean
  currencySymbol: string
}

export function LiveReceipt(props: LiveReceiptProps) {
  const { t } = useTranslation()
  const {
    orderNumber, selectedType, brand, model, serial, imei,
    defect, visible, completenessLabels,
    customer, priority,
    diagnosticPrice, estimated, prepaid,
    readyDate, warrantyDays, consent,
    currencySymbol,
  } = props

  const estimatedNum = estimated === '' ? 0 : estimated
  const balance = Math.max(0, estimatedNum - prepaid)
  const today = dayjs().format('DD.MM.YYYY')

  const priorityLabel = t(`workshop.form.priority${priority[0].toUpperCase() + priority.slice(1)}` as any)
  const customerName = customer ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() : ''

  return (
    <div className="rounded-xl border bg-card overflow-hidden flex flex-col max-h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Clipboard className="h-3.5 w-3.5" strokeWidth={2} />
          {t('workshop.form.receiptTitle')}
        </h3>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
          <Sparkles className="h-2.5 w-2.5" />
          {t('workshop.form.receiptLive')}
        </span>
      </header>

      <div className="flex-1 overflow-auto p-5 space-y-4 text-sm">
        {/* Brand head */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b">
          <div>
            <h2 className="text-base font-semibold leading-tight">{t('workshop.form.receiptBrand')}</h2>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {t('workshop.form.receiptSubtitle')}
            </div>
          </div>
          <div className="text-right text-[11px] text-muted-foreground font-mono shrink-0">
            <div>№ <span className="text-foreground font-semibold">{orderNumber ?? '—'}</span></div>
            <div className="mt-0.5">{today}</div>
          </div>
        </div>

        <ReceiptGroup label={t('workshop.form.receiptClient')}>
          <Row label={t('workshop.form.receiptFio')} value={customerName} empty={!customerName} />
          <Row label={t('workshop.form.receiptPhone')} value={customer?.phone ?? ''} empty={!customer?.phone} mono />
        </ReceiptGroup>

        <ReceiptGroup label={t('workshop.form.receiptDevice')}>
          <Row label={t('workshop.form.receiptType')} value={selectedType?.name ?? ''} empty={!selectedType} />
          {(brand || model) && (
            <Row label={t('workshop.form.receiptModel')} value={[brand, model].filter(Boolean).join(' ')} />
          )}
          {serial && <Row label="S/N" value={serial} mono />}
          {imei && <Row label="IMEI" value={imei} mono />}
          <Row label={t('workshop.form.receiptDefect')} value={defect} empty={!defect} multiline />
          {visible && <Row label={t('workshop.form.receiptVisible')} value={visible} multiline />}
          {completenessLabels.length > 0 && (
            <Row label={t('workshop.form.receiptComplect')} value={completenessLabels.join(', ')} multiline />
          )}
        </ReceiptGroup>

        <ReceiptGroup label={t('workshop.form.receiptConditions')}>
          <Row label={t('workshop.form.priority')} value={priorityLabel} />
          <Row
            label={t('workshop.form.readyDate')}
            value={readyDate ? dayjs(readyDate).format('DD.MM.YYYY') : ''}
            empty={!readyDate}
          />
          <Row label={t('workshop.form.warrantyDays')} value={`${warrantyDays}`} mono />
        </ReceiptGroup>

        <ReceiptGroup label={t('workshop.form.receiptCalc')}>
          <Row label={t('workshop.form.diagnosticPrice')} value={money(diagnosticPrice, currencySymbol)} mono />
          <Row label={t('workshop.form.estimated')} value={money(estimatedNum, currencySymbol)} mono />
          <Row label={t('workshop.form.prepaid')} value={`− ${money(prepaid, currencySymbol)}`} mono />
          <div className="flex items-center justify-between pt-2 mt-2 border-t font-semibold">
            <span>{t('workshop.form.receiptBalance')}</span>
            <span className="font-mono text-base">{money(balance, currencySymbol)}</span>
          </div>
        </ReceiptGroup>
      </div>

      <footer className="flex items-center justify-between gap-2 px-5 py-3 border-t bg-muted/20 text-[11px] text-muted-foreground">
        <span>{t('workshop.form.receiptSignature')}</span>
        <span className={cn(consent && 'text-primary font-medium')}>
          {consent ? `✓ ${t('workshop.form.receiptConsentOk')}` : t('workshop.form.receiptConsentWait')}
        </span>
      </footer>
    </div>
  )
}

function ReceiptGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
        {label}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, value, empty, mono, multiline }: {
  label: string; value: string; empty?: boolean; mono?: boolean; multiline?: boolean
}) {
  return (
    <div className={cn('flex gap-3 text-xs', multiline ? 'flex-col gap-0.5' : 'justify-between items-baseline')}>
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn(
        'min-w-0',
        multiline ? 'text-foreground' : 'text-right truncate',
        mono && 'font-mono',
        empty && 'text-muted-foreground/60 italic',
      )}>
        {empty ? '—' : value}
      </span>
    </div>
  )
}

function money(n: number, symbol: string): string {
  return `${n.toLocaleString('ru-RU')} ${symbol}`
}
