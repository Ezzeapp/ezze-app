import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Loader2, Save, Search, UserPlus, X, Eye, EyeOff, Zap, AlarmClock,
  Smartphone, Tablet, Laptop, Monitor, Tv, Headphones, Watch,
  WashingMachine, Refrigerator, Microwave, Wind, AirVent,
  Footprints, Bike, Sofa, Package, type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { toast } from '@/components/shared/Toaster'
import {
  useCreateWorkshopOrder,
  useWorkshopItemTypes,
  useClientWorkshopDevices,
  usePeekWorkshopOrderNumber,
  type WorkshopItemType,
  type WorkshopPriority,
} from '@/hooks/useWorkshopOrders'
import { useClients, useCreateClient } from '@/hooks/useClients'
import { useAppSettings } from '@/hooks/useAppSettings'
import { WorkshopPhotosUploader } from './WorkshopPhotosUploader'
import { cn, getCurrencySymbol } from '@/lib/utils'
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

const COMPLETENESS_KEYS = ['charger','cable','box','case','glass','sim','sdcard','stylus','remote'] as const
type CompletenessKey = typeof COMPLETENESS_KEYS[number]

export function WorkshopOrderFormPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { data: itemTypes } = useWorkshopItemTypes()
  const { data: clients } = useClients()
  const { data: appSettings } = useAppSettings()
  const { data: nextNumber } = usePeekWorkshopOrderNumber()
  const createOrder = useCreateWorkshopOrder()

  const currencySymbol = getCurrencySymbol(appSettings?.default_currency ?? 'RUB')

  const [clientId, setClientId] = useState<string>('')
  const [itemTypeId, setItemTypeId] = useState<string>('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [serial, setSerial] = useState('')
  const [imei, setImei] = useState('')
  const [unlockCode, setUnlockCode] = useState('')
  const [showUnlock, setShowUnlock] = useState(false)
  const [defect, setDefect] = useState('')
  const [visible, setVisible] = useState('')
  const [completenessItems, setCompletenessItems] = useState<CompletenessKey[]>([])
  const [completenessExtra, setCompletenessExtra] = useState('')
  const [priority, setPriority] = useState<WorkshopPriority>('normal')
  const [diagnosticPrice, setDiagnosticPrice] = useState<number>(0)
  const [estimated, setEstimated] = useState<number | ''>('')
  const [prepaid, setPrepaid] = useState<number>(0)
  const [readyDate, setReadyDate] = useState('')
  const [warrantyDays, setWarrantyDays] = useState<number>(30)
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [consent, setConsent] = useState(false)

  const selectedType = itemTypes?.find(t => t.id === itemTypeId)

  function onTypeChange(id: string) {
    setItemTypeId(id)
    const t = itemTypes?.find(x => x.id === id)
    if (t) {
      setDiagnosticPrice(t.default_diagnostic_price)
      setWarrantyDays(t.default_warranty_days)
      if (!readyDate) {
        setReadyDate(dayjs().add(t.default_days, 'day').format('YYYY-MM-DD'))
      }
    }
  }

  function toggleCompleteness(k: CompletenessKey) {
    setCompletenessItems(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  }

  function presetReady(days: number) {
    setReadyDate(dayjs().add(days, 'day').format('YYYY-MM-DD'))
  }

  async function onSubmit() {
    if (!selectedType) {
      toast.error(t('workshop.form.itemTypePlaceholder'))
      return
    }
    try {
      const order = await createOrder.mutateAsync({
        client_id: clientId || null,
        item_type_id: itemTypeId,
        item_type_name: selectedType.name,
        brand: brand || null,
        model: model || null,
        serial_number: serial || null,
        imei: imei || null,
        device_unlock_code: unlockCode.trim() || null,
        defect_description: defect || null,
        visible_defects: visible || null,
        completeness: completenessExtra.trim() || null,
        completeness_items: completenessItems,
        priority,
        diagnostic_price: diagnosticPrice,
        estimated_cost: estimated === '' ? null : Number(estimated),
        prepaid_amount: prepaid,
        ready_date: readyDate || null,
        warranty_days: warrantyDays,
        notes: notes || null,
        photos,
        client_consent_at: consent ? new Date().toISOString() : null,
      })
      toast.success(t('workshop.form.created', { number: order.number }))
      navigate(`/orders/${order.id}`)
    } catch (e: any) {
      toast.error(e.message ?? 'Error')
    }
  }

  const saveBtn = (
    <Button onClick={onSubmit} disabled={createOrder.isPending || !itemTypeId} className="w-full sm:w-auto">
      {createOrder.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
      {t('workshop.form.create')}
    </Button>
  )

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto pb-24 lg:pb-6">
      <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> {t('workshop.detail.back')}
        </Button>
        {nextNumber && (
          <div className="text-xs text-muted-foreground">
            {t('workshop.form.nextNumber')}: <span className="font-mono font-semibold text-foreground">{nextNumber}</span>
          </div>
        )}
      </div>
      <PageHeader title={t('workshop.form.title')} description={t('workshop.form.subtitle')} />

      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 space-y-6 lg:space-y-0">
        {/* ── Левая колонка: устройство + приёмка ─────────────────────── */}
        <div className="space-y-6 min-w-0">
          <Section title={t('workshop.form.sectionDevice')}>
            <Label>{t('workshop.form.itemType')} *</Label>
            <ItemTypeTiles
              itemTypes={itemTypes ?? []}
              value={itemTypeId}
              onChange={onTypeChange}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <Label>{t('workshop.form.brand')}</Label>
                <Input value={brand} onChange={e => setBrand(e.target.value)} />
              </div>
              <div>
                <Label>{t('workshop.form.model')}</Label>
                <Input value={model} onChange={e => setModel(e.target.value)} />
              </div>
              <div>
                <Label>{t('workshop.form.serial')}</Label>
                <Input value={serial} onChange={e => setSerial(e.target.value)} />
              </div>
              <div>
                <Label>{t('workshop.form.imei')}</Label>
                <Input value={imei} onChange={e => setImei(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>{t('workshop.form.unlockCode')}</Label>
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
          </Section>

          <Section title={t('workshop.form.sectionIntake')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{t('workshop.form.defect')}</Label>
                <Textarea value={defect} onChange={e => setDefect(e.target.value)} rows={3} />
              </div>
              <div>
                <Label>{t('workshop.form.visible')}</Label>
                <Textarea value={visible} onChange={e => setVisible(e.target.value)} rows={3} />
              </div>
            </div>
            <div>
              <Label>{t('workshop.form.completenessChecklist')}</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {COMPLETENESS_KEYS.map(k => {
                  const on = completenessItems.includes(k)
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleCompleteness(k)}
                      className={cn(
                        'px-3 py-1.5 rounded-full border text-xs transition-all',
                        on
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border text-foreground hover:bg-accent'
                      )}
                    >
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
              <Label>{t('workshop.form.photos')}</Label>
              <WorkshopPhotosUploader photos={photos} onChange={setPhotos} />
            </div>
          </Section>
        </div>

        {/* ── Правая колонка: клиент + стоимость + заметки ─────────────── */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
          <Section title={t('workshop.form.sectionClient')}>
            <ClientPicker clients={clients ?? []} value={clientId} onChange={setClientId} />
            {clientId && (
              <ClientDevicesList
                clientId={clientId}
                onPickDevice={(d) => {
                  const tm = itemTypes?.find(x => x.id === d.item_type_id)
                  if (tm) onTypeChange(tm.id)
                  setBrand(d.brand ?? '')
                  setModel(d.model ?? '')
                  setSerial(d.serial_number ?? '')
                  setImei(d.imei ?? '')
                }}
              />
            )}
          </Section>

          <Section title={t('workshop.form.sectionCost')}>
            <div>
              <Label className="text-xs">{t('workshop.form.priority')}</Label>
              <PrioritySelector value={priority} onChange={setPriority} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{t('workshop.form.diagnosticPrice')}</Label>
                <MoneyInput value={diagnosticPrice} onChange={v => setDiagnosticPrice(v ?? 0)} symbol={currencySymbol} />
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
                <MoneyInput value={prepaid} onChange={v => setPrepaid(v ?? 0)} symbol={currencySymbol} />
              </div>
              <div>
                <Label className="text-xs">{t('workshop.form.readyDate')}</Label>
                <Input className="h-9" type="date" value={readyDate} onChange={e => setReadyDate(e.target.value)} />
              </div>
              <div className="col-span-2 flex flex-wrap gap-1">
                <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => presetReady(1)}>
                  {t('workshop.form.preset1d')}
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => presetReady(3)}>
                  {t('workshop.form.preset3d')}
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => presetReady(7)}>
                  {t('workshop.form.preset7d')}
                </Button>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">{t('workshop.form.warrantyDays')}</Label>
                <Input className="h-9" type="number" value={warrantyDays} onChange={e => setWarrantyDays(Number(e.target.value))} />
              </div>
            </div>
          </Section>

          <Section title={t('workshop.form.sectionNotes')}>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </Section>

          <label className="flex items-start gap-2 rounded-lg border bg-card p-3 cursor-pointer hover:bg-accent/30 transition-colors">
            <Checkbox
              checked={consent}
              onCheckedChange={(v) => setConsent(v === true)}
              className="mt-0.5"
            />
            <span className="text-xs leading-snug">{t('workshop.form.clientConsent')}</span>
          </label>

          {/* Desktop save button */}
          <div className="hidden lg:flex gap-2 justify-end">
            <Button variant="outline" onClick={() => navigate('/orders')}>{t('workshop.form.cancel')}</Button>
            {saveBtn}
          </div>
        </div>
      </div>

      {/* Mobile sticky save bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 border-t bg-background z-10 flex gap-2">
        <Button variant="outline" onClick={() => navigate('/orders')} className="flex-1">
          {t('workshop.form.cancel')}
        </Button>
        {saveBtn}
      </div>
    </div>
  )
}

// ── Сегментный контрол срочности ────────────────────────────────────────────
function PrioritySelector({ value, onChange }: {
  value: WorkshopPriority
  onChange: (v: WorkshopPriority) => void
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

// ── Денежный input с суффиксом валюты ──────────────────────────────────────
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
        className="h-9 pr-12"
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

// ── Плитки типов устройств с поиском ───────────────────────────────────────
function ItemTypeTiles({ itemTypes, value, onChange }: {
  itemTypes: WorkshopItemType[]
  value: string
  onChange: (id: string) => void
}) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const active = useMemo(() => itemTypes.filter(t => t.active), [itemTypes])
  const filtered = useMemo(() => {
    if (!q.trim()) return active
    const needle = q.trim().toLowerCase()
    return active.filter(t =>
      t.name.toLowerCase().includes(needle) ||
      (t.category ?? '').toLowerCase().includes(needle)
    )
  }, [active, q])

  return (
    <div className="space-y-2">
      {active.length > 8 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 text-xs pl-9"
            placeholder={t('workshop.form.searchTypesPlaceholder')}
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
      )}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
        {filtered.map(t => {
          const Icon = iconFor(t.icon)
          const selected = t.id === value
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 rounded-lg border p-3 transition-all',
                'hover:border-primary/50 hover:bg-accent/40',
                selected
                  ? 'border-primary bg-primary/10 ring-1 ring-primary'
                  : 'border-border bg-card'
              )}
            >
              <Icon className={cn('h-6 w-6', selected ? 'text-primary' : 'text-muted-foreground')} />
              <span className={cn('text-xs text-center leading-tight line-clamp-2', selected && 'font-semibold')}>
                {t.name}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h3 className="font-semibold text-sm">{title}</h3>
      {children}
    </div>
  )
}

// ── История устройств клиента ───────────────────────────────────────────────
function ClientDevicesList({ clientId, onPickDevice }: {
  clientId: string
  onPickDevice: (d: any) => void
}) {
  const { data: devices } = useClientWorkshopDevices(clientId)
  if (!devices || devices.length === 0) return null

  return (
    <div className="rounded-md bg-muted/30 p-3 mt-2 text-sm">
      <div className="text-xs font-semibold text-muted-foreground mb-2">
        Клиент уже приносил ({devices.length}):
      </div>
      <div className="space-y-1">
        {devices.slice(0, 5).map(d => (
          <button
            key={d.id}
            type="button"
            onClick={() => onPickDevice(d)}
            className="w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-background transition-colors text-xs"
          >
            <span>
              <span className="font-medium">{d.item_type_name}</span>
              {(d.brand || d.model) && <span className="text-muted-foreground"> · {[d.brand, d.model].filter(Boolean).join(' ')}</span>}
              {d.serial_number && <span className="text-muted-foreground"> · S/N {d.serial_number}</span>}
            </span>
            <span className="text-muted-foreground shrink-0">{dayjs(d.created_at).format('DD.MM.YY')}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Client picker с поиском и быстрым созданием ─────────────────────────────
function ClientPicker({ clients, value, onChange }: {
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
    : clients.slice(0, 20)

  async function createNew() {
    if (!newFirst.trim()) return
    try {
      const c = await createClient.mutateAsync({
        first_name: newFirst.trim(),
        last_name: newLast.trim() || null,
        phone: newPhone.trim() || null,
      } as any)
      onChange(c.id)
      toast.success(t('workshop.detail.save'))
      setShowNew(false); setNewFirst(''); setNewLast(''); setNewPhone('')
    } catch (e: any) {
      toast.error(e.message ?? 'Error')
    }
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border p-2 bg-muted/30">
        <div className="text-sm">
          <div className="font-medium">{selected.first_name} {selected.last_name ?? ''}</div>
          {selected.phone && <div className="text-xs text-muted-foreground">{selected.phone}</div>}
        </div>
        <Button size="icon" variant="ghost" onClick={() => onChange('')}>
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
      {(q || filtered.length <= 10) && filtered.length > 0 && (
        <div className="rounded-md border divide-y max-h-64 overflow-auto">
          {filtered.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onChange(c.id); setQ('') }}
              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left"
            >
              <span>{c.first_name} {c.last_name ?? ''}</span>
              {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
            </button>
          ))}
        </div>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => setShowNew(true)}>
        <UserPlus className="h-4 w-4 mr-1" /> Новый клиент
      </Button>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Новый клиент</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Имя *</Label>
              <Input value={newFirst} onChange={e => setNewFirst(e.target.value)} autoFocus />
            </div>
            <div>
              <Label>Фамилия</Label>
              <Input value={newLast} onChange={e => setNewLast(e.target.value)} />
            </div>
            <div>
              <Label>Телефон</Label>
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
