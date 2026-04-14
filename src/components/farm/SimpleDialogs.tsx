import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  useUpsertAnimalGroup, useUpsertField, useUpsertFeedStock, useAddFeedConsumption,
  useAddProduction, useAddFarmExpense, useAddAnimalEvent, useFeedStock, useAnimals,
  useAnimalGroups,
} from '@/hooks/farm/useFarmData'
import type {
  AnimalGroup, Field as FieldRec, FeedStockItem, ProductionRecord, FarmExpense,
  AnimalEvent, AnimalSpecies, ProductionType, FarmExpenseCategory, FeedUnit,
} from '@/types/farm'
import { ANIMAL_SPECIES_LIST } from '@/types/farm'

interface BaseProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  farmId: string
}

// ── Группа животных ──────────────────────────────────────────────
export function AnimalGroupDialog({ open, onOpenChange, farmId, initial }: BaseProps & { initial?: Partial<AnimalGroup> | null }) {
  const { t } = useTranslation()
  const upsert = useUpsertAnimalGroup()
  const [f, setF] = useState<Partial<AnimalGroup>>({})
  useEffect(() => { if (open) setF(initial ?? { species: 'cattle' }) }, [open, initial])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial?.id ? t('farm.common.edit') : t('farm.common.add')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Row label={t('farm.groups.fields.name')}><Input value={f.name ?? ''} onChange={e => setF({...f, name: e.target.value})} /></Row>
          <Row label={t('farm.animals.species')}>
            <Select value={f.species} onValueChange={v => setF({...f, species: v as AnimalSpecies})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ANIMAL_SPECIES_LIST.map(s => <SelectItem key={s.value} value={s.value}>{t(s.labelKey)}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <Row label={t('farm.groups.fields.location')}><Input value={f.location ?? ''} onChange={e => setF({...f, location: e.target.value})} /></Row>
          <Row label={t('farm.groups.fields.notes')}><Textarea rows={2} value={f.notes ?? ''} onChange={e => setF({...f, notes: e.target.value})} /></Row>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('farm.common.cancel')}</Button>
          <Button disabled={!f.name || !f.species || upsert.isPending} onClick={async () => {
            await upsert.mutateAsync({ id: f.id, farm_id: farmId, name: f.name!, species: f.species!, purpose: f.purpose ?? null, location: f.location ?? null, notes: f.notes ?? null })
            onOpenChange(false)
          }}>{t('farm.common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Поле ─────────────────────────────────────────────────────────
export function FieldDialog({ open, onOpenChange, farmId, initial }: BaseProps & { initial?: Partial<FieldRec> | null }) {
  const { t } = useTranslation()
  const upsert = useUpsertField()
  const [f, setF] = useState<Partial<FieldRec>>({})
  useEffect(() => { if (open) setF(initial ?? { status: 'idle' }) }, [open, initial])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial?.id ? t('farm.common.edit') : t('farm.common.add')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Row label={t('farm.fields.fields.name')}><Input value={f.name ?? ''} onChange={e => setF({...f, name: e.target.value})} /></Row>
          <Row label={t('farm.fields.fields.areaHa')}><Input type="number" step="0.01" value={f.area_ha ?? ''} onChange={e => setF({...f, area_ha: Number(e.target.value)})} /></Row>
          <Row label={t('farm.fields.fields.soilType')}><Input value={f.soil_type ?? ''} onChange={e => setF({...f, soil_type: e.target.value})} /></Row>
          <Row label={t('farm.fields.fields.status')}>
            <Select value={f.status ?? 'idle'} onValueChange={v => setF({...f, status: v as FieldRec['status']})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['idle','sown','growing','harvested'] as const).map(s => <SelectItem key={s} value={s}>{t(`farm.fields.status.${s}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <Row label={t('farm.fields.fields.currentCrop')}><Input value={f.current_crop ?? ''} onChange={e => setF({...f, current_crop: e.target.value})} /></Row>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('farm.common.cancel')}</Button>
          <Button disabled={!f.name || !f.area_ha || upsert.isPending} onClick={async () => {
            await upsert.mutateAsync({ id: f.id, farm_id: farmId, name: f.name!, area_ha: Number(f.area_ha), soil_type: f.soil_type ?? null, status: f.status ?? 'idle', current_crop: f.current_crop ?? null, notes: f.notes ?? null })
            onOpenChange(false)
          }}>{t('farm.common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Склад корма (позиция) ────────────────────────────────────────
export function FeedStockDialog({ open, onOpenChange, farmId, initial }: BaseProps & { initial?: Partial<FeedStockItem> | null }) {
  const { t } = useTranslation()
  const upsert = useUpsertFeedStock()
  const [f, setF] = useState<Partial<FeedStockItem>>({})
  useEffect(() => { if (open) setF(initial ?? { unit: 'kg', source: 'purchased', quantity: 0, cost_per_unit: 0 }) }, [open, initial])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial?.id ? t('farm.common.edit') : t('farm.common.add')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Row label={t('farm.feed.fields.name')}><Input value={f.name ?? ''} onChange={e => setF({...f, name: e.target.value})} /></Row>
          <Row label={t('farm.feed.fields.unit')}>
            <Select value={f.unit ?? 'kg'} onValueChange={v => setF({...f, unit: v as FeedUnit})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(['kg','t','l','bale'] as const).map(u => <SelectItem key={u} value={u}>{t(`farm.feed.unit.${u}`)}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <Row label={t('farm.feed.fields.quantity')}><Input type="number" step="0.01" value={f.quantity ?? 0} onChange={e => setF({...f, quantity: Number(e.target.value)})} /></Row>
          <Row label={t('farm.feed.fields.costPerUnit')}><Input type="number" step="0.01" value={f.cost_per_unit ?? 0} onChange={e => setF({...f, cost_per_unit: Number(e.target.value)})} /></Row>
          <Row label={t('farm.feed.fields.source')}>
            <Select value={f.source ?? 'purchased'} onValueChange={v => setF({...f, source: v as 'own'|'purchased'})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(['own','purchased'] as const).map(s => <SelectItem key={s} value={s}>{t(`farm.feed.source.${s}`)}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <Row label={t('farm.feed.fields.lowStockThreshold')}><Input type="number" step="0.01" value={f.low_stock_threshold ?? ''} onChange={e => setF({...f, low_stock_threshold: e.target.value ? Number(e.target.value) : null})} /></Row>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('farm.common.cancel')}</Button>
          <Button disabled={!f.name || upsert.isPending} onClick={async () => {
            await upsert.mutateAsync({ id: f.id, farm_id: farmId, name: f.name!, unit: f.unit ?? 'kg', quantity: Number(f.quantity ?? 0), cost_per_unit: Number(f.cost_per_unit ?? 0), source: f.source ?? 'purchased', low_stock_threshold: f.low_stock_threshold ?? null, notes: f.notes ?? null })
            onOpenChange(false)
          }}>{t('farm.common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Списание корма ───────────────────────────────────────────────
export function FeedConsumptionDialog({ open, onOpenChange, farmId }: BaseProps) {
  const { t } = useTranslation()
  const { data: stock } = useFeedStock(farmId)
  const { data: groups } = useAnimalGroups(farmId)
  const { data: animals } = useAnimals(farmId)
  const add = useAddFeedConsumption()
  const [feedId, setFeedId] = useState<string>('')
  const [groupId, setGroupId] = useState<string>('')
  const [animalId, setAnimalId] = useState<string>('')
  const [qty, setQty] = useState<number>(0)
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0,10))
  useEffect(() => { if (open) { setFeedId(''); setGroupId(''); setAnimalId(''); setQty(0); setDate(new Date().toISOString().slice(0,10)) } }, [open])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('farm.feed.addConsumption')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Row label={t('farm.feed.fields.name')}>
            <Select value={feedId} onValueChange={setFeedId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{(stock ?? []).map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.quantity} {t(`farm.feed.unit.${s.unit}`)})</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <Row label={t('farm.groups.title')}>
            <Select value={groupId} onValueChange={v => { setGroupId(v); setAnimalId('') }}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{(groups ?? []).map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <Row label={t('farm.animals.title')}>
            <Select value={animalId} onValueChange={v => { setAnimalId(v); setGroupId('') }}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{(animals ?? []).map(a => <SelectItem key={a.id} value={a.id}>{a.tag} {a.name ? `(${a.name})` : ''}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <Row label={t('farm.feed.fields.quantity')}><Input type="number" step="0.01" value={qty} onChange={e => setQty(Number(e.target.value))} /></Row>
          <Row label={t('farm.common.from')}><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Row>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('farm.common.cancel')}</Button>
          <Button disabled={!feedId || !qty || add.isPending} onClick={async () => {
            await add.mutateAsync({ farm_id: farmId, feed_id: feedId, group_id: groupId || null, animal_id: animalId || null, quantity: qty, date })
            onOpenChange(false)
          }}>{t('farm.common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Продукция (молоко/яйца/мясо и т.д.) ──────────────────────────
export function ProductionDialog({ open, onOpenChange, farmId }: BaseProps) {
  const { t } = useTranslation()
  const { data: groups } = useAnimalGroups(farmId)
  const { data: animals } = useAnimals(farmId)
  const add = useAddProduction()
  const [f, setF] = useState<Partial<ProductionRecord>>({ type: 'milk', quantity: 0, date: new Date().toISOString().slice(0,10) })
  useEffect(() => { if (open) setF({ type: 'milk', quantity: 0, date: new Date().toISOString().slice(0,10) }) }, [open])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('farm.production.add')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Row label={t('farm.production.fields.type')}>
            <Select value={f.type} onValueChange={v => setF({...f, type: v as ProductionType})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(['milk','eggs','meat','wool','honey','offspring'] as const).map(p => <SelectItem key={p} value={p}>{t(`farm.production.type.${p}`)}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <Row label={t('farm.production.fields.quantity')}><Input type="number" step="0.01" value={f.quantity ?? 0} onChange={e => setF({...f, quantity: Number(e.target.value)})} /></Row>
          <Row label={t('farm.production.fields.date')}><Input type="date" value={f.date ?? ''} onChange={e => setF({...f, date: e.target.value})} /></Row>
          <Row label={t('farm.animals.title')}>
            <Select value={f.animal_id ?? ''} onValueChange={v => setF({...f, animal_id: v || null, group_id: null})}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{(animals ?? []).map(a => <SelectItem key={a.id} value={a.id}>{a.tag}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <Row label={t('farm.groups.title')}>
            <Select value={f.group_id ?? ''} onValueChange={v => setF({...f, group_id: v || null, animal_id: null})}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{(groups ?? []).map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <Row label={t('farm.production.fields.quality')}><Input value={f.quality ?? ''} onChange={e => setF({...f, quality: e.target.value})} /></Row>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('farm.common.cancel')}</Button>
          <Button disabled={!f.quantity || add.isPending} onClick={async () => {
            await add.mutateAsync({ farm_id: farmId, type: f.type!, quantity: Number(f.quantity), date: f.date!, animal_id: f.animal_id ?? null, group_id: f.group_id ?? null, quality: f.quality ?? null })
            onOpenChange(false)
          }}>{t('farm.common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Расход фермы ─────────────────────────────────────────────────
export function FarmExpenseDialog({ open, onOpenChange, farmId }: BaseProps) {
  const { t } = useTranslation()
  const add = useAddFarmExpense()
  const { data: groups } = useAnimalGroups(farmId)
  const { data: animals } = useAnimals(farmId)
  const [f, setF] = useState<Partial<FarmExpense>>({ category: 'feed', amount: 0, date: new Date().toISOString().slice(0,10) })
  useEffect(() => { if (open) setF({ category: 'feed', amount: 0, date: new Date().toISOString().slice(0,10) }) }, [open])
  const CATEGORIES: FarmExpenseCategory[] = ['feed','veterinary','salary','utilities','fuel','rent','repair','equipment','seeds','fertilizer','transport','other']
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('farm.expenses.add')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Row label={t('farm.expenses.fields.category')}>
            <Select value={f.category} onValueChange={v => setF({...f, category: v as FarmExpenseCategory})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{t(`farm.expenses.category.${c}`)}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <Row label={t('farm.expenses.fields.amount')}><Input type="number" step="0.01" value={f.amount ?? 0} onChange={e => setF({...f, amount: Number(e.target.value)})} /></Row>
          <Row label={t('farm.expenses.fields.date')}><Input type="date" value={f.date ?? ''} onChange={e => setF({...f, date: e.target.value})} /></Row>
          <Row label={t('farm.expenses.fields.description')}><Input value={f.description ?? ''} onChange={e => setF({...f, description: e.target.value})} /></Row>
          <Row label={t('farm.animals.title')}>
            <Select value={f.animal_id ?? ''} onValueChange={v => setF({...f, animal_id: v || null, group_id: null})}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{(animals ?? []).map(a => <SelectItem key={a.id} value={a.id}>{a.tag}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <Row label={t('farm.groups.title')}>
            <Select value={f.group_id ?? ''} onValueChange={v => setF({...f, group_id: v || null, animal_id: null})}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{(groups ?? []).map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('farm.common.cancel')}</Button>
          <Button disabled={!f.amount || add.isPending} onClick={async () => {
            await add.mutateAsync({ farm_id: farmId, category: f.category!, amount: Number(f.amount), date: f.date!, description: f.description ?? null, animal_id: f.animal_id ?? null, group_id: f.group_id ?? null })
            onOpenChange(false)
          }}>{t('farm.common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Событие животного (взвешивание/вакцинация/лечение и т.д.) ────
export function AnimalEventDialog({ open, onOpenChange, farmId, animalId }: BaseProps & { animalId: string }) {
  const { t } = useTranslation()
  const add = useAddAnimalEvent()
  const [f, setF] = useState<Partial<AnimalEvent>>({ event_type: 'weighing', event_date: new Date().toISOString() })
  useEffect(() => { if (open) setF({ event_type: 'weighing', event_date: new Date().toISOString() }) }, [open])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('farm.animals.addEvent')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Row label={t('farm.animals.fields.tag')}>
            <Select value={f.event_type} onValueChange={v => setF({...f, event_type: v as AnimalEvent['event_type']})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(['weighing','vaccination','treatment','exam','mating','pregnancy','birth','transfer','note'] as const).map(e => <SelectItem key={e} value={e}>{t(`farm.eventType.${e}`)}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <Row label={t('farm.production.fields.date')}>
            <Input type="datetime-local" value={(f.event_date ?? '').slice(0,16)} onChange={e => setF({...f, event_date: new Date(e.target.value).toISOString()})} />
          </Row>
          {f.event_type === 'weighing' && (
            <Row label={t('farm.animals.fields.currentWeight')}>
              <Input type="number" step="0.01" value={f.weight_kg ?? ''} onChange={e => setF({...f, weight_kg: Number(e.target.value)})} />
            </Row>
          )}
          <Row label={t('farm.expenses.fields.amount')}>
            <Input type="number" step="0.01" value={f.cost ?? ''} onChange={e => setF({...f, cost: e.target.value ? Number(e.target.value) : null})} />
          </Row>
          <Row label={t('farm.animals.fields.notes')}>
            <Textarea rows={2} value={f.notes ?? ''} onChange={e => setF({...f, notes: e.target.value})} />
          </Row>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('farm.common.cancel')}</Button>
          <Button disabled={add.isPending} onClick={async () => {
            await add.mutateAsync({ farm_id: farmId, animal_id: animalId, event_type: f.event_type!, event_date: f.event_date!, weight_kg: f.weight_kg ?? null, cost: f.cost ?? null, notes: f.notes ?? null })
            onOpenChange(false)
          }}>{t('farm.common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>
}
