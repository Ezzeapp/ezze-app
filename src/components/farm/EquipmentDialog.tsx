import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useUpsertEquipment, useAddMaintenance } from '@/hooks/farm/useFarmData'
import type { FarmEquipment, EquipmentMaintenance } from '@/types/farm'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  farmId: string
  initial?: Partial<FarmEquipment> | null
}

export function EquipmentDialog({ open, onOpenChange, farmId, initial }: Props) {
  const { t } = useTranslation()
  const upsert = useUpsertEquipment()
  const [f, setF] = useState<Partial<FarmEquipment>>({})
  useEffect(() => { if (open) setF(initial ?? { status: 'active' }) }, [open, initial])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial?.id ? t('farm.common.edit') : t('farm.equipment.add')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Row label={t('farm.equipment.fields.name')}><Input value={f.name ?? ''} onChange={e => setF({...f, name: e.target.value})} /></Row>
          <Row label={t('farm.equipment.fields.category')}><Input value={f.category ?? ''} onChange={e => setF({...f, category: e.target.value})} placeholder="трактор / комбайн / инкубатор" /></Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label={t('farm.equipment.fields.purchaseDate')}><Input type="date" value={f.purchase_date ?? ''} onChange={e => setF({...f, purchase_date: e.target.value})} /></Row>
            <Row label={t('farm.equipment.fields.purchaseCost')}><Input type="number" step="0.01" value={f.purchase_cost ?? ''} onChange={e => setF({...f, purchase_cost: e.target.value ? Number(e.target.value) : null})} /></Row>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Row label={t('farm.equipment.fields.usefulLifeMonths')}><Input type="number" value={f.useful_life_months ?? ''} onChange={e => setF({...f, useful_life_months: e.target.value ? Number(e.target.value) : null})} /></Row>
            <Row label={t('farm.equipment.fields.status')}>
              <Select value={f.status ?? 'active'} onValueChange={v => setF({...f, status: v as FarmEquipment['status']})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(['active','repair','decommissioned'] as const).map(s => <SelectItem key={s} value={s}>{t(`farm.equipment.status.${s}`)}</SelectItem>)}</SelectContent>
              </Select>
            </Row>
          </div>
          <Row label={t('farm.common.noData')}><Textarea rows={2} value={f.notes ?? ''} onChange={e => setF({...f, notes: e.target.value})} /></Row>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('farm.common.cancel')}</Button>
          <Button disabled={!f.name || upsert.isPending} onClick={async () => {
            await upsert.mutateAsync({
              id: f.id, farm_id: farmId, name: f.name!,
              category: f.category ?? null, purchase_date: f.purchase_date ?? null,
              purchase_cost: f.purchase_cost ?? null, useful_life_months: f.useful_life_months ?? null,
              status: f.status ?? 'active', notes: f.notes ?? null,
            })
            onOpenChange(false)
          }}>{t('farm.common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function MaintenanceDialog({ open, onOpenChange, farmId, equipmentId }: { open: boolean; onOpenChange: (v: boolean) => void; farmId: string; equipmentId: string }) {
  const { t } = useTranslation()
  const add = useAddMaintenance()
  const [f, setF] = useState<Partial<EquipmentMaintenance>>({ type: 'service', cost: 0, date: new Date().toISOString().slice(0, 10) })
  useEffect(() => { if (open) setF({ type: 'service', cost: 0, date: new Date().toISOString().slice(0, 10) }) }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('farm.equipment.maintenance.add')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Row label={t('farm.equipment.maintenance.fields.type')}>
            <Select value={f.type} onValueChange={v => setF({...f, type: v as EquipmentMaintenance['type']})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(['service','repair','fuel','insurance'] as const).map(x => <SelectItem key={x} value={x}>{t(`farm.equipment.maintenance.type.${x}`)}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label={t('farm.equipment.maintenance.fields.date')}><Input type="date" value={f.date ?? ''} onChange={e => setF({...f, date: e.target.value})} /></Row>
            <Row label={t('farm.equipment.maintenance.fields.cost')}><Input type="number" step="0.01" value={f.cost ?? 0} onChange={e => setF({...f, cost: Number(e.target.value)})} /></Row>
          </div>
          <Row label={t('farm.equipment.maintenance.fields.notes')}><Textarea rows={2} value={f.notes ?? ''} onChange={e => setF({...f, notes: e.target.value})} /></Row>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('farm.common.cancel')}</Button>
          <Button disabled={add.isPending} onClick={async () => {
            await add.mutateAsync({
              farm_id: farmId, equipment_id: equipmentId, type: f.type!, cost: Number(f.cost ?? 0),
              date: f.date!, notes: f.notes ?? null,
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
