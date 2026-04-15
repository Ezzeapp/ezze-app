import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Loader2, Save, Search, UserPlus, X,
  Smartphone, Tablet, Laptop, Monitor, Tv, Headphones, Watch,
  WashingMachine, Refrigerator, Microwave, Wind, AirVent,
  Footprints, Bike, Sofa, Package, type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { toast } from '@/components/shared/Toaster'
import {
  useCreateWorkshopOrder,
  useWorkshopItemTypes,
  useClientWorkshopDevices,
  type WorkshopItemType,
} from '@/hooks/useWorkshopOrders'
import { useClients, useCreateClient } from '@/hooks/useClients'
import { WorkshopPhotosUploader } from './WorkshopPhotosUploader'
import { cn } from '@/lib/utils'
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

export function WorkshopOrderFormPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { data: itemTypes } = useWorkshopItemTypes()
  const { data: clients } = useClients()
  const createOrder = useCreateWorkshopOrder()

  const [clientId, setClientId] = useState<string>('')
  const [itemTypeId, setItemTypeId] = useState<string>('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [serial, setSerial] = useState('')
  const [imei, setImei] = useState('')
  const [defect, setDefect] = useState('')
  const [visible, setVisible] = useState('')
  const [completeness, setCompleteness] = useState('')
  const [diagnosticPrice, setDiagnosticPrice] = useState<number>(0)
  const [estimated, setEstimated] = useState<number | ''>('')
  const [prepaid, setPrepaid] = useState<number>(0)
  const [readyDate, setReadyDate] = useState('')
  const [warrantyDays, setWarrantyDays] = useState<number>(30)
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<string[]>([])

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
        defect_description: defect || null,
        visible_defects: visible || null,
        completeness: completeness || null,
        diagnostic_price: diagnosticPrice,
        estimated_cost: estimated === '' ? null : Number(estimated),
        prepaid_amount: prepaid,
        ready_date: readyDate || null,
        warranty_days: warrantyDays,
        notes: notes || null,
        photos,
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
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> {t('workshop.detail.back')}
        </Button>
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
              <Label>{t('workshop.form.completeness')}</Label>
              <Input value={completeness} onChange={e => setCompleteness(e.target.value)} />
            </div>
            <div>
              <Label>Фото устройства</Label>
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{t('workshop.form.diagnosticPrice')}</Label>
                <Input className="h-9" type="number" value={diagnosticPrice} onChange={e => setDiagnosticPrice(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">{t('workshop.form.estimated')}</Label>
                <Input className="h-9" type="number" value={estimated} onChange={e => setEstimated(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">{t('workshop.form.prepaid')}</Label>
                <Input className="h-9" type="number" value={prepaid} onChange={e => setPrepaid(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">{t('workshop.form.readyDate')}</Label>
                <Input className="h-9" type="date" value={readyDate} onChange={e => setReadyDate(e.target.value)} />
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

// ── Плитки типов устройств ──────────────────────────────────────────────────
function ItemTypeTiles({ itemTypes, value, onChange }: {
  itemTypes: WorkshopItemType[]
  value: string
  onChange: (id: string) => void
}) {
  const active = itemTypes.filter(t => t.active)
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
      {active.map(t => {
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
