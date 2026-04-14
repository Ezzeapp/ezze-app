import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useUpsertAnimal, useAnimalGroups } from '@/hooks/farm/useFarmData'
import type { Animal, AnimalSpecies, AnimalSex, AnimalStatus, AnimalPurpose } from '@/types/farm'
import { ANIMAL_SPECIES_LIST } from '@/types/farm'
import { PhotoPicker } from '@/components/farm/PhotoPicker'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  farmId: string
  initial?: Partial<Animal> | null
}

const SEX_LIST: AnimalSex[] = ['female', 'male', 'unknown']
const STATUS_LIST: AnimalStatus[] = ['growing', 'dairy', 'meat', 'breeding', 'sold', 'slaughtered', 'dead']
const PURPOSE_LIST: AnimalPurpose[] = ['dairy', 'meat', 'eggs', 'wool', 'breeding', 'mixed']

export function AnimalDialog({ open, onOpenChange, farmId, initial }: Props) {
  const { t } = useTranslation()
  const { data: groups } = useAnimalGroups(farmId)
  const upsert = useUpsertAnimal()
  const [form, setForm] = useState<Partial<Animal>>({})

  useEffect(() => {
    if (open) setForm(initial ?? { species: 'cattle', sex: 'unknown', status: 'growing' })
  }, [open, initial])

  const set = <K extends keyof Animal>(k: K, v: Animal[K] | null | undefined) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.tag || !form.species) return
    await upsert.mutateAsync({
      id: form.id,
      farm_id: farmId,
      tag: form.tag,
      name: form.name ?? null,
      species: form.species,
      breed: form.breed ?? null,
      sex: form.sex ?? 'unknown',
      status: form.status ?? 'growing',
      purpose: form.purpose ?? null,
      group_id: form.group_id ?? null,
      birth_date: form.birth_date ?? null,
      acquisition_date: form.acquisition_date ?? null,
      acquisition_cost: form.acquisition_cost ?? null,
      current_weight_kg: form.current_weight_kg ?? null,
      photo_url: form.photo_url ?? null,
      notes: form.notes ?? null,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? t('farm.animals.edit') : t('farm.animals.add')}</DialogTitle>
        </DialogHeader>
        <div className="mb-2">
          <PhotoPicker
            value={form.photo_url}
            onChange={(p) => set('photo_url', p)}
            subPath={`farm/animals/${form.id ?? form.tag ?? 'new'}`}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('farm.animals.fields.tag')}>
            <Input value={form.tag ?? ''} onChange={e => set('tag', e.target.value)} placeholder="A-123" />
          </Field>
          <Field label={t('farm.animals.fields.name')}>
            <Input value={form.name ?? ''} onChange={e => set('name', e.target.value)} />
          </Field>
          <Field label={t('farm.animals.species')}>
            <Select value={form.species} onValueChange={v => set('species', v as AnimalSpecies)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ANIMAL_SPECIES_LIST.map(s => (
                  <SelectItem key={s.value} value={s.value}>{t(s.labelKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('farm.animals.fields.breed')}>
            <Input value={form.breed ?? ''} onChange={e => set('breed', e.target.value)} />
          </Field>
          <Field label={t('farm.animals.sex')}>
            <Select value={form.sex ?? 'unknown'} onValueChange={v => set('sex', v as AnimalSex)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEX_LIST.map(s => <SelectItem key={s} value={s}>{t(`farm.sex.${s}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('farm.animals.status')}>
            <Select value={form.status ?? 'growing'} onValueChange={v => set('status', v as AnimalStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_LIST.map(s => <SelectItem key={s} value={s}>{t(`farm.status.${s}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('farm.animals.purpose')}>
            <Select value={form.purpose ?? ''} onValueChange={v => set('purpose', (v || null) as AnimalPurpose)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {PURPOSE_LIST.map(p => <SelectItem key={p} value={p}>{t(`farm.purpose.${p}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('farm.groups.title')}>
            <Select value={form.group_id ?? ''} onValueChange={v => set('group_id', v || null)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {(groups ?? []).map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('farm.animals.fields.birthDate')}>
            <Input type="date" value={form.birth_date ?? ''} onChange={e => set('birth_date', e.target.value)} />
          </Field>
          <Field label={t('farm.animals.fields.acquisitionDate')}>
            <Input type="date" value={form.acquisition_date ?? ''} onChange={e => set('acquisition_date', e.target.value)} />
          </Field>
          <Field label={t('farm.animals.fields.acquisitionCost')}>
            <Input type="number" value={form.acquisition_cost ?? ''} onChange={e => set('acquisition_cost', e.target.value ? Number(e.target.value) : null)} />
          </Field>
          <Field label={t('farm.animals.fields.currentWeight')}>
            <Input type="number" value={form.current_weight_kg ?? ''} onChange={e => set('current_weight_kg', e.target.value ? Number(e.target.value) : null)} />
          </Field>
          <div className="col-span-2">
            <Label className="text-xs">{t('farm.animals.fields.notes')}</Label>
            <Textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('farm.common.cancel')}</Button>
          <Button onClick={handleSave} disabled={!form.tag || upsert.isPending}>{t('farm.common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}
