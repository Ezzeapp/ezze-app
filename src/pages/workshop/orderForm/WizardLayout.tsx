import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronLeft, ChevronRight, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DeviceSection, IntakeSection, CustomerSection,
  PricingSection, NotesSection,
} from './sections'
import { LiveReceipt } from './LiveReceipt'
import type { OrderFormHandle } from './useOrderFormState'

const STEP_KEY = 'workshop.form.wizard.step'

export function WizardLayout({ f, onCancel }: { f: OrderFormHandle; onCancel: () => void }) {
  const { t } = useTranslation()

  const [step, setStep] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem(STEP_KEY) ?? '0', 10)
    return Number.isFinite(saved) && saved >= 0 && saved < 5 ? saved : 0
  })

  useEffect(() => { localStorage.setItem(STEP_KEY, String(step)) }, [step])

  const steps = [
    {
      title: t('workshop.form.wizardStepDeviceTitle'),
      sub: t('workshop.form.wizardStepDeviceSub'),
      done: !!f.state.itemTypeId,
    },
    {
      title: t('workshop.form.wizardStepIntakeTitle'),
      sub: t('workshop.form.wizardStepIntakeSub'),
      done: !!f.state.defect,
    },
    {
      title: t('workshop.form.wizardStepClientTitle'),
      sub: t('workshop.form.wizardStepClientSub'),
      done: !!f.state.clientId,
    },
    {
      title: t('workshop.form.wizardStepCostTitle'),
      sub: t('workshop.form.wizardStepCostSub'),
      done: f.state.estimated !== '' || f.state.diagnosticPrice > 0,
    },
    {
      title: t('workshop.form.wizardStepConfirmTitle'),
      sub: t('workshop.form.wizardStepConfirmSub'),
      done: f.state.consent,
    },
  ] as const

  const isLast = step === steps.length - 1
  const canNext = steps[step].done

  const next = useCallback(() => setStep(s => Math.min(s + 1, steps.length - 1)), [steps.length])
  const prev = useCallback(() => setStep(s => Math.max(s - 1, 0)), [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return
      if (e.key === 'ArrowRight' && canNext && !isLast) next()
      if (e.key === 'ArrowLeft' && step > 0) prev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canNext, isLast, step, next, prev])

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-36 lg:pb-6">
      {/* Progress */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex items-center gap-1 min-w-max lg:grid lg:grid-cols-5 lg:gap-2 px-0.5">
          {steps.map((s, i) => {
            const active = i === step
            const doneBefore = s.done && i < step
            return (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg border text-left transition-all shrink-0 min-w-[140px] lg:min-w-0',
                  active && 'bg-primary/10 border-primary ring-1 ring-primary',
                  !active && doneBefore && 'bg-muted/40 border-border',
                  !active && !doneBefore && 'bg-background border-border text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'grid place-items-center w-6 h-6 rounded-full text-[11px] font-semibold shrink-0',
                    active && 'bg-primary text-primary-foreground',
                    !active && doneBefore && 'bg-primary/90 text-primary-foreground',
                    !active && !doneBefore && 'bg-muted text-muted-foreground',
                  )}
                >
                  {doneBefore ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold truncate">{s.title}</span>
                  <span className="block text-[10px] text-muted-foreground truncate">{s.sub}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Body */}
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        {step === 0 && (
          <StepHeader title={t('workshop.form.wizardStepDeviceTitle')} sub={t('workshop.form.wizardHintDevice')}>
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
          </StepHeader>
        )}

        {step === 1 && (
          <StepHeader title={t('workshop.form.wizardStepIntakeTitle')} sub={t('workshop.form.wizardHintIntake')}>
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
          </StepHeader>
        )}

        {step === 2 && (
          <StepHeader title={t('workshop.form.wizardStepClientTitle')} sub={t('workshop.form.wizardHintClient')}>
            <CustomerSection
              clients={f.clients}
              clientId={f.state.clientId}
              setClientId={v => f.patch({ clientId: v })}
              itemTypes={f.itemTypes}
              onPickDevice={f.pickClientDevice}
            />
          </StepHeader>
        )}

        {step === 3 && (
          <StepHeader title={t('workshop.form.wizardStepCostTitle')} sub={t('workshop.form.wizardHintCost')}>
            <PricingSection
              priority={f.state.priority} setPriority={v => f.patch({ priority: v })}
              diagnosticPrice={f.state.diagnosticPrice} setDiagnosticPrice={v => f.patch({ diagnosticPrice: v })}
              estimated={f.state.estimated} setEstimated={v => f.patch({ estimated: v })}
              prepaid={f.state.prepaid} setPrepaid={v => f.patch({ prepaid: v })}
              readyDate={f.state.readyDate} setReadyDate={v => f.patch({ readyDate: v })}
              warrantyDays={f.state.warrantyDays} setWarrantyDays={v => f.patch({ warrantyDays: v })}
              currencySymbol={f.currencySymbol}
            />
          </StepHeader>
        )}

        {step === 4 && (
          <StepHeader title={t('workshop.form.wizardStepConfirmTitle')} sub={t('workshop.form.wizardHintConfirm')}>
            <div className="grid md:grid-cols-[1fr_320px] gap-5">
              <NotesSection
                notes={f.state.notes} setNotes={v => f.patch({ notes: v })}
                consent={f.state.consent} setConsent={v => f.patch({ consent: v })}
              />
              <div className="md:max-h-[500px]">
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
            </div>
          </StepHeader>
        )}
      </div>

      {/* Nav — sits above app's bottom tab bar on mobile (bottom-16) */}
      <div className="fixed bottom-16 left-0 right-0 lg:static lg:bottom-auto z-20 border-t lg:border-none bg-background/95 lg:bg-transparent backdrop-blur lg:backdrop-blur-0 px-3 py-2 lg:p-0 flex items-center gap-2">
        {step === 0 ? (
          <Button variant="ghost" onClick={onCancel}>{t('workshop.form.cancel')}</Button>
        ) : (
          <Button variant="outline" onClick={prev}>
            <ChevronLeft className="h-4 w-4 mr-1" /> {t('workshop.form.wizardBack')}
          </Button>
        )}
        <div className="hidden sm:block flex-1 text-center text-xs text-muted-foreground">
          {t('workshop.form.wizardStep', { current: step + 1, total: steps.length })}
          <span className="hidden lg:inline ml-3 opacity-70">
            <Kbd>←</Kbd><Kbd>→</Kbd>
          </span>
        </div>
        <div className="sm:hidden flex-1" />
        {isLast ? (
          <Button onClick={f.submit} disabled={f.submitting || !f.canSubmit}>
            {f.submitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t('workshop.form.create')}
          </Button>
        ) : (
          <Button onClick={next} disabled={!canNext}>
            {t('workshop.form.wizardNext')} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}

function StepHeader({ title, sub, children }: {
  title: string; sub: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{sub}</p>
      </div>
      {children}
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid place-items-center w-5 h-5 rounded border bg-muted/50 text-[10px] font-mono mx-0.5">
      {children}
    </kbd>
  )
}
