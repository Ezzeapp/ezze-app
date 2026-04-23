import { useTranslation } from 'react-i18next'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  SectionCard, DeviceSection, IntakeSection, CustomerSection,
  PricingSection, NotesSection,
} from './sections'
import { LiveReceipt } from './LiveReceipt'
import type { OrderFormHandle } from './useOrderFormState'

export function SplitLayout({ f, onCancel }: { f: OrderFormHandle; onCancel: () => void }) {
  const { t } = useTranslation()

  const estimatedNum = f.state.estimated === '' ? 0 : f.state.estimated
  const balance = Math.max(0, estimatedNum - f.state.prepaid)

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-5">
      {/* ── Left: form ───────────────────────────────────────── */}
      <div className="space-y-5 min-w-0 pb-24">
        <SectionCard step={1} title={t('workshop.form.sectionDevice')} done={!!f.state.itemTypeId}>
          <DeviceSection
            itemTypes={f.itemTypes}
            itemTypeId={f.state.itemTypeId}
            onTypeChange={f.onTypeChange}
            brand={f.state.brand} setBrand={v => f.patch({ brand: v })}
            model={f.state.model} setModel={v => f.patch({ model: v })}
            serial={f.state.serial} setSerial={v => f.patch({ serial: v })}
            imei={f.state.imei} setImei={v => f.patch({ imei: v })}
            unlockCode={f.state.unlockCode} setUnlockCode={v => f.patch({ unlockCode: v })}
          />
        </SectionCard>

        <SectionCard step={2} title={t('workshop.form.sectionIntake')} done={!!f.state.defect}>
          <IntakeSection
            selectedType={f.selectedType}
            defect={f.state.defect} setDefect={v => f.patch({ defect: v })}
            visible={f.state.visible} setVisible={v => f.patch({ visible: v })}
            completenessItems={f.state.completenessItems}
            toggleCompleteness={f.toggleCompleteness}
            completenessExtra={f.state.completenessExtra}
            setCompletenessExtra={v => f.patch({ completenessExtra: v })}
            photos={f.state.photos}
            setPhotos={v => f.patch({ photos: v })}
          />
        </SectionCard>

        <SectionCard step={3} title={t('workshop.form.sectionClient')} done={!!f.state.clientId}>
          <CustomerSection
            clients={f.clients}
            clientId={f.state.clientId}
            setClientId={v => f.patch({ clientId: v })}
            itemTypes={f.itemTypes}
            onPickDevice={f.pickClientDevice}
          />
        </SectionCard>

        <SectionCard step={4} title={t('workshop.form.sectionCost')} done={f.state.estimated !== '' || f.state.diagnosticPrice > 0}>
          <PricingSection
            priority={f.state.priority} setPriority={v => f.patch({ priority: v })}
            diagnosticPrice={f.state.diagnosticPrice} setDiagnosticPrice={v => f.patch({ diagnosticPrice: v })}
            estimated={f.state.estimated} setEstimated={v => f.patch({ estimated: v })}
            prepaid={f.state.prepaid} setPrepaid={v => f.patch({ prepaid: v })}
            readyDate={f.state.readyDate} setReadyDate={v => f.patch({ readyDate: v })}
            warrantyDays={f.state.warrantyDays} setWarrantyDays={v => f.patch({ warrantyDays: v })}
            currencySymbol={f.currencySymbol}
          />
        </SectionCard>

        <SectionCard step={5} title={t('workshop.form.sectionNotes')} done={f.state.consent}>
          <NotesSection
            notes={f.state.notes} setNotes={v => f.patch({ notes: v })}
            consent={f.state.consent} setConsent={v => f.patch({ consent: v })}
          />
        </SectionCard>
      </div>

      {/* ── Right: sticky live receipt ──────────────────────── */}
      <aside className="hidden lg:block">
        <div className="sticky top-4 h-[calc(100vh-2rem)]">
          <LiveReceipt
            orderNumber={f.nextNumber}
            selectedType={f.selectedType}
            brand={f.state.brand}
            model={f.state.model}
            serial={f.state.serial}
            imei={f.state.imei}
            defect={f.state.defect}
            visible={f.state.visible}
            completenessLabels={f.completenessLabels}
            customer={f.selectedClient}
            priority={f.state.priority}
            diagnosticPrice={f.state.diagnosticPrice}
            estimated={f.state.estimated}
            prepaid={f.state.prepaid}
            readyDate={f.state.readyDate}
            warrantyDays={f.state.warrantyDays}
            consent={f.state.consent}
            currencySymbol={f.currencySymbol}
          />
        </div>
      </aside>

      {/* ── Sticky summary bar (desktop) ─────────────────────── */}
      <div className="hidden lg:flex fixed bottom-0 left-0 right-0 z-10 border-t bg-background/95 backdrop-blur">
        <div className="max-w-[1400px] mx-auto w-full px-6 py-3 flex items-center gap-5">
          <Metric label={t('workshop.form.receiptDevice')} value={f.selectedType?.name ?? '—'} />
          <Metric
            label={t('workshop.form.estimated')}
            value={`${estimatedNum.toLocaleString('ru-RU')} ${f.currencySymbol}`}
            mono
          />
          <Metric
            label={t('workshop.form.prepaid')}
            value={`${f.state.prepaid.toLocaleString('ru-RU')} ${f.currencySymbol}`}
            mono
          />
          <Metric
            label={t('workshop.form.receiptBalance')}
            value={`${balance.toLocaleString('ru-RU')} ${f.currencySymbol}`}
            mono
            highlight
          />
          <div className="flex-1" />
          <Button variant="ghost" onClick={onCancel}>{t('workshop.form.cancel')}</Button>
          <Button onClick={f.submit} disabled={f.submitting || !f.canSubmit}>
            {f.submitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t('workshop.form.create')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, mono, highlight }: {
  label: string; value: string; mono?: boolean; highlight?: boolean
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={
        [
          mono ? 'font-mono' : '',
          highlight ? 'font-bold text-base text-foreground' : 'font-semibold text-sm',
        ].filter(Boolean).join(' ')
      }>{value}</span>
    </div>
  )
}
