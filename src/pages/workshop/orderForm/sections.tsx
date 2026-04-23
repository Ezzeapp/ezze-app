import { useMemo, useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check, Search, UserPlus, X, Eye, EyeOff, Zap, AlarmClock,
  Smartphone, Tablet, Laptop, Monitor, Tv, Headphones, Watch,
  WashingMachine, Refrigerator, Microwave, Wind, AirVent,
  Footprints, Bike, Sofa, Package, Loader2, type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/components/shared/Toaster'
import { cn } from '@/lib/utils'
import { useClientWorkshopDevices, type WorkshopItemType, type WorkshopPriority } from '@/hooks/useWorkshopOrders'
import { useCreateClient } from '@/hooks/useClients'
import { WorkshopPhotosUploader } from '../WorkshopPhotosUploader'
import { faultTemplatesFor, hasImeiField } from './faultTemplates'
import dayjs from 'dayjs'

const ICON_MAP: Record<string, LucideIcon> = {
  Smartphone, Tablet, Laptop, Monitor, Tv, Headphones, Watch,
  WashingMachine, Refrigerator, Microwave, Wind, AirVent,
  Footprints, Bike, Sofa, Package,
}
function iconFor(name: string | null): LucideIcon {
  if (!name) return Package
  return ICON_MAP[name] ?? Package
}

export const COMPLETENESS_KEYS = ['charger', 'cable', 'box', 'case', 'glass', 'sim', 'sdcard', 'stylus', 'remote'] as const
export type CompletenessKey = typeof COMPLETENESS_KEYS[number]

// ── Numbered section card ───────────────────────────────────────────────────
export function SectionCard({
  step, title, done, action, children, className,
}: {
  step: number
  title: string
  done: boolean
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-xl border bg-card overflow-hidden', className)}>
      <header className="flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-3.5 border-b">
        <span
          className={cn(
            'grid place-items-center w-6 h-6 rounded-full text-[11px] font-semibold transition-colors shrink-0',
            done
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {done ? <Check className="h-3 w-3" strokeWidth={3} /> : step}
        </span>
        <h3 className="font-semibold text-sm flex-1">{title}</h3>
        {action}
      </header>
      <div className="p-4 sm:p-5 space-y-4">{children}</div>
    </section>
  )
}

// ── Device type tiles ───────────────────────────────────────────────────────
export function ItemTypeTiles({
  itemTypes, value, onChange,
}: {
  itemTypes: WorkshopItemType[]
  value: string
  onChange: (id: string) => void
}) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const active = useMemo(() => itemTypes.filter(x => x.active), [itemTypes])
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return active
    return active.filter(x =>
      x.name.toLowerCase().includes(needle) ||
      (x.category ?? '').toLowerCase().includes(needle),
    )
  }, [active, q])

  return (
    <div className="space-y-2">
      {active.length > 8 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-9 text-xs pl-9"
            placeholder={t('workshop.form.searchTypesPlaceholder')}
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
      )}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
        {filtered.map(x => {
          const Icon = iconFor(x.icon)
          const selected = x.id === value
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => onChange(x.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 transition-all min-h-[76px]',
                'hover:border-primary/50 hover:bg-accent/40',
                selected
                  ? 'border-primary bg-primary/10 ring-1 ring-primary'
                  : 'border-border bg-card',
              )}
            >
              <Icon
                className={cn('h-6 w-6 transition-colors', selected ? 'text-primary' : 'text-muted-foreground')}
                strokeWidth={1.5}
              />
              <span className={cn('text-xs text-center leading-tight line-clamp-2', selected && 'font-semibold')}>
                {x.name}
              </span>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-xs text-muted-foreground py-4">—</div>
        )}
      </div>
    </div>
  )
}

// ── Device section ──────────────────────────────────────────────────────────
export function DeviceSection({
  itemTypes, itemTypeId, onTypeChange,
  brand, setBrand, model, setModel, serial, setSerial, imei, setImei,
  unlockCode, setUnlockCode,
}: {
  itemTypes: WorkshopItemType[]
  itemTypeId: string
  onTypeChange: (id: string) => void
  brand: string; setBrand: (v: string) => void
  model: string; setModel: (v: string) => void
  serial: string; setSerial: (v: string) => void
  imei: string; setImei: (v: string) => void
  unlockCode: string; setUnlockCode: (v: string) => void
}) {
  const { t } = useTranslation()
  const [showUnlock, setShowUnlock] = useState(false)
  const brandRef = useRef<HTMLInputElement>(null)
  const prevType = useRef(itemTypeId)

  useEffect(() => {
    if (itemTypeId && itemTypeId !== prevType.current) {
      setTimeout(() => brandRef.current?.focus(), 100)
      prevType.current = itemTypeId
    }
  }, [itemTypeId])

  const selected = itemTypes.find(x => x.id === itemTypeId)
  const showImei = hasImeiField(selected?.icon)
  const imeiInvalid = imei.length > 0 && imei.length !== 15

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs mb-1.5 block">{t('workshop.form.itemType')} *</Label>
        <ItemTypeTiles itemTypes={itemTypes} value={itemTypeId} onChange={onTypeChange} />
      </div>

      {itemTypeId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <Label className="text-xs">{t('workshop.form.brand')}</Label>
            <Input ref={brandRef} value={brand} onChange={e => setBrand(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t('workshop.form.model')}</Label>
            <Input value={model} onChange={e => setModel(e.target.value)} placeholder="iPhone 14 Pro" />
          </div>
          <div>
            <Label className="text-xs">{t('workshop.form.serial')}</Label>
            <Input className="font-mono" value={serial} onChange={e => setSerial(e.target.value)} />
          </div>
          {showImei && (
            <div>
              <Label className="text-xs">
                {t('workshop.form.imei')}
                {imei.length > 0 && (
                  <span className={cn('ml-2 font-mono', imeiInvalid ? 'text-destructive' : 'text-muted-foreground')}>
                    {imei.length}/15
                  </span>
                )}
              </Label>
              <Input
                className={cn('font-mono', imeiInvalid && 'border-destructive focus-visible:ring-destructive')}
                inputMode="numeric"
                maxLength={15}
                placeholder="15 цифр"
                value={imei}
                onChange={e => setImei(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <Label className="text-xs">{t('workshop.form.unlockCode')}</Label>
            <div className="relative">
              <Input
                type={showUnlock ? 'text' : 'password'}
                value={unlockCode}
                onChange={e => setUnlockCode(e.target.value)}
                placeholder={t('workshop.form.unlockCodePlaceholder')}
                autoComplete="off"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowUnlock(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showUnlock ? 'hide' : 'show'}
              >
                {showUnlock ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('workshop.form.unlockCodeHint')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Intake section ──────────────────────────────────────────────────────────
export function IntakeSection({
  selectedType,
  defect, setDefect, visible, setVisible,
  completenessItems, toggleCompleteness,
  completenessExtra, setCompletenessExtra,
  photos, setPhotos,
}: {
  selectedType: WorkshopItemType | undefined
  defect: string; setDefect: (v: string) => void
  visible: string; setVisible: (v: string) => void
  completenessItems: CompletenessKey[]
  toggleCompleteness: (k: CompletenessKey) => void
  completenessExtra: string; setCompletenessExtra: (v: string) => void
  photos: string[]; setPhotos: (v: string[]) => void
}) {
  const { t } = useTranslation()
  const templates = faultTemplatesFor(selectedType?.icon)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">{t('workshop.form.defect')} *</Label>
          <Textarea value={defect} onChange={e => setDefect(e.target.value)} rows={3} />
          {templates.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {templates.slice(0, 6).map(template => (
                <button
                  key={template}
                  type="button"
                  onClick={() => setDefect(template)}
                  className="px-2 py-1 rounded-md border border-dashed text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-accent/40 transition-colors"
                >
                  {template}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <Label className="text-xs">{t('workshop.form.visible')}</Label>
          <Textarea value={visible} onChange={e => setVisible(e.target.value)} rows={3} />
        </div>
      </div>

      <div>
        <Label className="text-xs">{t('workshop.form.completenessChecklist')}</Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {COMPLETENESS_KEYS.map(k => {
            const on = completenessItems.includes(k)
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleCompleteness(k)}
                className={cn(
                  'inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs transition-all',
                  on
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border text-foreground hover:bg-accent',
                )}
              >
                {on && <Check className="h-3 w-3" strokeWidth={3} />}
                {t(`workshop.form.completenessOptions.${k}`)}
              </button>
            )
          })}
        </div>
        <Input
          className="mt-2"
          placeholder={t('workshop.form.completenessExtra')}
          value={completenessExtra}
          onChange={e => setCompletenessExtra(e.target.value)}
        />
      </div>

      <div>
        <Label className="text-xs">{t('workshop.form.photos')}</Label>
        <WorkshopPhotosUploader photos={photos} onChange={setPhotos} />
      </div>
    </div>
  )
}

// ── Customer section (picker + history) ─────────────────────────────────────
export function CustomerSection({
  clients, clientId, setClientId,
  itemTypes, onPickDevice,
}: {
  clients: any[]
  clientId: string
  setClientId: (id: string) => void
  itemTypes: WorkshopItemType[]
  onPickDevice: (device: {
    item_type_id: string | null
    brand: string | null; model: string | null
    serial_number: string | null; imei: string | null
  }) => void
}) {
  return (
    <div className="space-y-3">
      <ClientPicker clients={clients} value={clientId} onChange={setClientId} />
      {clientId && (
        <ClientDevicesList
          clientId={clientId}
          itemTypes={itemTypes}
          onPickDevice={onPickDevice}
        />
      )}
    </div>
  )
}

function ClientPicker({
  clients, value, onChange,
}: {
  clients: any[]
  value: string
  onChange: (id: string) => void
}) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [showNew, setShowNew] = useState(false)
  const createClient = useCreateClient()
  const [newFirst, setNewFirst] = useState('')
  const [newLast, setNewLast] = useState('')
  const [newPhone, setNewPhone] = useState('')

  const selected = clients.find(c => c.id === value)
  const filtered = q
    ? clients.filter(c => {
        const full = `${c.first_name} ${c.last_name ?? ''} ${c.phone ?? ''}`.toLowerCase()
        return full.includes(q.toLowerCase())
      }).slice(0, 20)
    : clients.slice(0, 10)

  async function createNew() {
    if (!newFirst.trim()) return
    try {
      const c = await createClient.mutateAsync({
        first_name: newFirst.trim(),
        last_name: newLast.trim() || null,
        phone: newPhone.trim() || null,
      } as any)
      onChange(c.id)
      setShowNew(false); setNewFirst(''); setNewLast(''); setNewPhone('')
    } catch (e: any) {
      toast.error(e.message ?? 'Error')
    }
  }

  if (selected) {
    const initials = `${selected.first_name?.[0] ?? ''}${selected.last_name?.[0] ?? ''}`.toUpperCase()
    return (
      <div className="flex items-center gap-3 rounded-md border p-2.5 bg-muted/30">
        <div className="grid place-items-center w-9 h-9 rounded-full bg-primary/15 text-primary text-xs font-semibold">
          {initials || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            {selected.first_name} {selected.last_name ?? ''}
          </div>
          {selected.phone && (
            <div className="text-xs text-muted-foreground font-mono truncate">{selected.phone}</div>
          )}
        </div>
        <Button size="icon" variant="ghost" onClick={() => onChange('')} aria-label="clear">
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('workshop.form.clientPlaceholder')}
          className="pl-9"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>
      {filtered.length > 0 && (
        <div className="rounded-md border divide-y max-h-64 overflow-auto">
          {filtered.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onChange(c.id); setQ('') }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
            >
              <span className="truncate">
                {c.first_name} {c.last_name ?? ''}
              </span>
              {c.phone && (
                <span className="text-xs text-muted-foreground font-mono shrink-0">{c.phone}</span>
              )}
            </button>
          ))}
        </div>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => setShowNew(true)}>
        <UserPlus className="h-4 w-4 mr-1" /> {t('workshop.form.newClient')}
      </Button>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('workshop.form.newClient')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('workshop.form.firstName')} *</Label>
              <Input value={newFirst} onChange={e => setNewFirst(e.target.value)} autoFocus />
            </div>
            <div>
              <Label>{t('workshop.form.lastName')}</Label>
              <Input value={newLast} onChange={e => setNewLast(e.target.value)} />
            </div>
            <div>
              <Label>{t('workshop.form.phone')}</Label>
              <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+998..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>{t('workshop.detail.cancel')}</Button>
            <Button onClick={createNew} disabled={createClient.isPending || !newFirst.trim()}>
              {createClient.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('workshop.detail.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ClientDevicesList({
  clientId, itemTypes, onPickDevice,
}: {
  clientId: string
  itemTypes: WorkshopItemType[]
  onPickDevice: (device: any) => void
}) {
  const { t } = useTranslation()
  const { data: devices } = useClientWorkshopDevices(clientId)
  if (!devices || devices.length === 0) return null

  return (
    <div className="rounded-md bg-muted/30 p-3 text-sm">
      <div className="text-xs font-semibold text-muted-foreground mb-2">
        {t('workshop.form.clientHistory', { count: devices.length })}
      </div>
      <div className="space-y-1">
        {devices.slice(0, 5).map(d => {
          const t2 = itemTypes.find(x => x.id === d.item_type_id)
          const Icon = iconFor(t2?.icon ?? null)
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onPickDevice(d)}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-background transition-colors text-xs"
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
              <span className="flex-1 truncate">
                <span className="font-medium">{d.item_type_name}</span>
                {(d.brand || d.model) && (
                  <span className="text-muted-foreground"> · {[d.brand, d.model].filter(Boolean).join(' ')}</span>
                )}
                {d.serial_number && (
                  <span className="text-muted-foreground"> · S/N {d.serial_number}</span>
                )}
              </span>
              <span className="text-muted-foreground shrink-0">{dayjs(d.created_at).format('DD.MM.YY')}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Pricing section ─────────────────────────────────────────────────────────
export function PricingSection({
  priority, setPriority,
  diagnosticPrice, setDiagnosticPrice,
  estimated, setEstimated,
  prepaid, setPrepaid,
  readyDate, setReadyDate,
  warrantyDays, setWarrantyDays,
  currencySymbol,
}: {
  priority: WorkshopPriority; setPriority: (p: WorkshopPriority) => void
  diagnosticPrice: number; setDiagnosticPrice: (v: number) => void
  estimated: number | ''; setEstimated: (v: number | '') => void
  prepaid: number; setPrepaid: (v: number) => void
  readyDate: string; setReadyDate: (v: string) => void
  warrantyDays: number; setWarrantyDays: (v: number) => void
  currencySymbol: string
}) {
  const { t } = useTranslation()

  function presetReady(days: number) {
    setReadyDate(dayjs().add(days, 'day').format('YYYY-MM-DD'))
  }

  const activePreset = useMemo(() => {
    if (!readyDate) return null
    const diff = dayjs(readyDate).startOf('day').diff(dayjs().startOf('day'), 'day')
    return [1, 3, 7, 14].includes(diff) ? diff : null
  }, [readyDate])

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">{t('workshop.form.priority')}</Label>
        <PrioritySelector value={priority} onChange={setPriority} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">{t('workshop.form.diagnosticPrice')}</Label>
          <MoneyInput
            value={diagnosticPrice}
            onChange={v => setDiagnosticPrice(v ?? 0)}
            symbol={currencySymbol}
          />
        </div>
        <div>
          <Label className="text-xs">{t('workshop.form.estimated')}</Label>
          <MoneyInput
            value={estimated === '' ? null : estimated}
            onChange={v => setEstimated(v === null ? '' : v)}
            symbol={currencySymbol}
            allowEmpty
          />
        </div>
        <div>
          <Label className="text-xs">{t('workshop.form.prepaid')}</Label>
          <MoneyInput
            value={prepaid}
            onChange={v => setPrepaid(v ?? 0)}
            symbol={currencySymbol}
          />
        </div>
        <div>
          <Label className="text-xs">{t('workshop.form.readyDate')}</Label>
          <Input className="h-9" type="date" value={readyDate} onChange={e => setReadyDate(e.target.value)} />
        </div>
        <div className="col-span-2 flex flex-wrap gap-1">
          {[1, 3, 7, 14].map(d => (
            <button
              key={d}
              type="button"
              onClick={() => presetReady(d)}
              className={cn(
                'h-7 px-2.5 rounded-md border text-[11px] transition-all',
                activePreset === d
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-accent',
              )}
            >
              {t(`workshop.form.preset${d}d`)}
            </button>
          ))}
        </div>
        <div className="col-span-2">
          <Label className="text-xs">{t('workshop.form.warrantyDays')}</Label>
          <Input className="h-9" type="number" value={warrantyDays} onChange={e => setWarrantyDays(Number(e.target.value))} />
        </div>
      </div>
    </div>
  )
}

function PrioritySelector({ value, onChange }: {
  value: WorkshopPriority; onChange: (v: WorkshopPriority) => void
}) {
  const { t } = useTranslation()
  const opts: { k: WorkshopPriority; label: string; icon?: LucideIcon; tone: string }[] = [
    { k: 'normal',  label: t('workshop.form.priorityNormal'),  tone: '' },
    { k: 'urgent',  label: t('workshop.form.priorityUrgent'),  icon: AlarmClock, tone: 'data-[on=true]:bg-amber-500 data-[on=true]:text-white data-[on=true]:border-amber-500' },
    { k: 'express', label: t('workshop.form.priorityExpress'), icon: Zap,        tone: 'data-[on=true]:bg-red-500 data-[on=true]:text-white data-[on=true]:border-red-500' },
  ]
  return (
    <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
      {opts.map(o => {
        const on = value === o.k
        const Icon = o.icon
        return (
          <button
            key={o.k}
            type="button"
            data-on={on}
            onClick={() => onChange(o.k)}
            className={cn(
              'h-8 rounded-sm text-xs font-medium flex items-center justify-center gap-1 border border-transparent transition-all',
              on ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              o.tone,
            )}
          >
            {Icon && <Icon className="h-3 w-3" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function MoneyInput({ value, onChange, symbol, allowEmpty }: {
  value: number | null
  onChange: (v: number | null) => void
  symbol: string
  allowEmpty?: boolean
}) {
  return (
    <div className="relative">
      <Input
        type="number"
        className="h-9 pr-12 font-mono"
        value={value === null ? '' : value}
        onChange={e => {
          const v = e.target.value
          if (v === '' && allowEmpty) onChange(null)
          else onChange(Number(v) || 0)
        }}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        {symbol}
      </span>
    </div>
  )
}

// ── Notes + consent ─────────────────────────────────────────────────────────
export function NotesSection({
  notes, setNotes, consent, setConsent,
}: {
  notes: string; setNotes: (v: string) => void
  consent: boolean; setConsent: (v: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">{t('workshop.form.notes')}</Label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder={t('workshop.form.notesPlaceholder')}
        />
      </div>
      <label className="flex items-start gap-2 rounded-lg border bg-card p-3 cursor-pointer hover:bg-accent/30 transition-colors">
        <Checkbox
          checked={consent}
          onCheckedChange={v => setConsent(v === true)}
          className="mt-0.5"
        />
        <span className="text-xs leading-snug">{t('workshop.form.clientConsent')}</span>
      </label>
    </div>
  )
}
