import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useUpsertPasture, useUpsertIncubation, useAnimalGroups } from '@/hooks/farm/useFarmData'
import type { Pasture, Incubation, AnimalSpecies } from '@/types/farm'

interface BaseProps { open: boolean; onOpenChange: (v: boolean) => void; farmId: string }

export function PastureDialog({ open, onOpenChange, farmId, initial }: BaseProps & { initial?: Partial<Pasture> | null }) {
  const { t } = useTranslation()
  const { data: groups } = useAnimalGroups(farmId)
  const upsert = useUpsertPasture()
  const [f, setF] = useState<Partial<Pasture>>({})
  useEffect(() => { if (open) setF(initial ?? {}) }, [open, initial])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial?.id ? t('farm.common.edit') : t('farm.pastures.add')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Row label={t('farm.pastures.fields.name')}><Input value={f.name ?? ''} onChange={e => setF({ ...f, name: e.target.value })} /></Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label={t('farm.pastures.fields.areaHa')}><Input type="number" step="0.01" value={f.area_ha ?? ''} onChange={e => setF({ ...f, area_ha: Number(e.target.value) })} /></Row>
            <Row label={t('farm.pastures.fields.capacityHeads')}><Input type="number" value={f.capacity_heads ?? ''} onChange={e => setF({ ...f, capacity_heads: e.target.value ? Number(e.target.value) : null })} /></Row>
          </div>
          <Row label={t('farm.pastures.fields.currentGroup')}>
            <Select value={f.current_group_id ?? ''} onValueChange={v => setF({ ...f, current_group_id: v || null })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{(groups ?? []).map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <Row label={t('farm.pastures.fields.notes')}><Textarea rows={2} value={f.notes ?? ''} onChange={e => setF({ ...f, notes: e.target.value })} /></Row>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('farm.common.cancel')}</Button>
          <Button disabled={!f.name || !f.area_ha || upsert.isPending} onClick={async () => {
            await upsert.mutateAsync({
              id: f.id, farm_id: farmId, name: f.name!, area_ha: Number(f.area_ha),
              capacity_heads: f.capacity_heads ?? null, current_group_id: f.current_group_id ?? null, notes: f.notes ?? null,
            })
            onOpenChange(false)
          }}>{t('farm.common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function IncubationDialog({ open, onOpenChange, farmId, initial }: BaseProps & { initial?: Partial<Incubation> | null }) {
  const { t } = useTranslation()
  const upsert = useUpsertIncubation()
  const [f, setF] = useState<Partial<Incubation>>({})

  useEffect(() => {
    if (open) {
      setF(initial ?? {
        species: 'poultry',
        eggs_loaded: 0,
        start_date: new Date().toISOString().slice(0, 10),
        expected_hatch_date: new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      })
    }
  }, [open, initial])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial?.id ? t('farm.common.edit') : t('farm.incubator.add')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Row label={t('farm.animals.species')}>
            <Select value={f.species} onValueChange={v => setF({ ...f, species: v as AnimalSpecies })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="poultry">{t('farm.species.poultry')}</SelectItem>
                <SelectItem value="other">{t('farm.species.other')}</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label={t('farm.incubator.fields.eggsLoaded')}><Input type="number" value={f.eggs_loaded ?? 0} onChange={e => setF({ ...f, eggs_loaded: Number(e.target.value) })} /></Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label={t('farm.incubator.fields.startDate')}><Input type="date" value={f.start_date ?? ''} onChange={e => setF({ ...f, start_date: e.target.value })} /></Row>
            <Row label={t('farm.incubator.fields.expectedHatchDate')}><Input type="date" value={f.expected_hatch_date ?? ''} onChange={e => setF({ ...f, expected_hatch_date: e.target.value })} /></Row>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Row label={t('farm.incubator.fields.actualHatchDate')}><Input type="date" value={f.actual_hatch_date ?? ''} onChange={e => setF({ ...f, actual_hatch_date: e.target.value || null })} /></Row>
            <Row label={t('farm.incubator.fields.eggsHatched')}><Input type="number" value={f.eggs_hatched ?? ''} onChange={e => setF({ ...f, eggs_hatched: e.target.value ? Number(e.target.value) : null })} /></Row>
          </div>
          <Row label={t('farm.common.noData')}><Textarea rows={2} value={f.notes ?? ''} onChange={e => setF({ ...f, notes: e.target.value })} /></Row>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('farm.common.cancel')}</Button>
          <Button disabled={!f.eggs_loaded || !f.start_date || !f.expected_hatch_date || upsert.isPending} onClick={async () => {
            await upsert.mutateAsync({
              id: f.id, farm_id: farmId, species: f.species!,
              eggs_loaded: Number(f.eggs_loaded), start_date: f.start_date!,
              expected_hatch_date: f.expected_hatch_date!, actual_hatch_date: f.actual_hatch_date ?? null,
              eggs_hatched: f.eggs_hatched ?? null, notes: f.notes ?? null,
            })
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
