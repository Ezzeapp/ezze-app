import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useAnimalGroups } from '@/hooks/farm/useFarmData'
import type { AnimalSpecies, AnimalSex, AnimalPurpose } from '@/types/farm'
import { ANIMAL_SPECIES_LIST } from '@/types/farm'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  farmId: string
}

export function BulkAnimalDialog({ open, onOpenChange, farmId }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: groups } = useAnimalGroups(farmId)

  const [count, setCount] = useState(10)
  const [prefix, setPrefix] = useState('A')
  const [startNum, setStartNum] = useState(1)
  const [padding, setPadding] = useState(3)
  const [species, setSpecies] = useState<AnimalSpecies>('poultry')
  const [sex, setSex] = useState<AnimalSex>('unknown')
  const [purpose, setPurpose] = useState<AnimalPurpose | ''>('')
  const [groupId, setGroupId] = useState<string>('')
  const [breed, setBreed] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [acqDate, setAcqDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [totalCost, setTotalCost] = useState<number>(0)
  const [weightKg, setWeightKg] = useState<number>(0)

  useEffect(() => {
    if (open) {
      setCount(10); setPrefix('A'); setStartNum(1); setPadding(3)
      setSpecies('poultry'); setSex('unknown'); setPurpose(''); setGroupId('')
      setBreed(''); setBirthDate(''); setAcqDate(new Date().toISOString().slice(0, 10))
      setTotalCost(0); setWeightKg(0)
    }
  }, [open])

  const perHeadCost = count > 0 ? totalCost / count : 0

  const mut = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('not authenticated')
      const rows = Array.from({ length: count }).map((_, i) => {
        const n = startNum + i
        const tag = `${prefix}-${String(n).padStart(padding, '0')}`
        return {
          farm_id: farmId,
          master_id: user.id,
          tag,
          species,
          sex,
          status: 'growing',
          purpose: purpose || null,
          group_id: groupId || null,
          breed: breed || null,
          birth_date: birthDate || null,
          acquisition_date: acqDate,
          acquisition_cost: perHeadCost || null,
          current_weight_kg: weightKg || null,
          species_attrs: {},
        }
      })
      const { error } = await supabase.from('animals').insert(rows)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['farm'] })
      onOpenChange(false)
    },
  })

  const previewFirst = `${prefix}-${String(startNum).padStart(padding, '0')}`
  const previewLast  = `${prefix}-${String(startNum + count - 1).padStart(padding, '0')}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('farm.bulk.title')}</DialogTitle>
          <p className="text-sm text-muted-foreground">{t('farm.bulk.subtitle')}</p>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Row label={t('farm.bulk.count')}>
              <Input type="number" min={1} max={10000} value={count} onChange={e => setCount(Math.max(1, Number(e.target.value)))} />
            </Row>
            <Row label={t('farm.animals.species')}>
              <Select value={species} onValueChange={v => setSpecies(v as AnimalSpecies)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ANIMAL_SPECIES_LIST.map(s => <SelectItem key={s.value} value={s.value}>{t(s.labelKey)}</SelectItem>)}</SelectContent>
              </Select>
            </Row>
          </div>

          <div className="border rounded-lg p-3 bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2">{t('farm.bulk.tagsFormat')}</p>
            <div className="grid grid-cols-3 gap-2">
              <Row label={t('farm.bulk.prefix')}>
                <Input value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="A" />
              </Row>
              <Row label={t('farm.bulk.startFrom')}>
                <Input type="number" min={1} value={startNum} onChange={e => setStartNum(Math.max(1, Number(e.target.value)))} />
              </Row>
              <Row label={t('farm.bulk.padding')}>
                <Input type="number" min={1} max={6} value={padding} onChange={e => setPadding(Math.max(1, Math.min(6, Number(e.target.value))))} />
              </Row>
            </div>
            <p className="text-xs mt-2">
              {t('farm.bulk.preview')}: <code className="font-mono bg-background px-1 rounded">{previewFirst}</code>
              {' … '}
              <code className="font-mono bg-background px-1 rounded">{previewLast}</code>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Row label={t('farm.animals.fields.breed')}>
              <Input value={breed} onChange={e => setBreed(e.target.value)} />
            </Row>
            <Row label={t('farm.animals.sex')}>
              <Select value={sex} onValueChange={v => setSex(v as AnimalSex)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">{t('farm.sex.female')}</SelectItem>
                  <SelectItem value="male">{t('farm.sex.male')}</SelectItem>
                  <SelectItem value="unknown">{t('farm.sex.unknown')}</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label={t('farm.animals.purpose')}>
              <Select value={purpose || ''} onValueChange={v => setPurpose((v || '') as AnimalPurpose | '')}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{(['dairy','meat','eggs','wool','breeding','mixed'] as AnimalPurpose[]).map(p => <SelectItem key={p} value={p}>{t(`farm.purpose.${p}`)}</SelectItem>)}</SelectContent>
              </Select>
            </Row>
            <Row label={t('farm.groups.title')}>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{(groups ?? []).map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </Row>
            <Row label={t('farm.animals.fields.birthDate')}>
              <Input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
            </Row>
            <Row label={t('farm.animals.fields.acquisitionDate')}>
              <Input type="date" value={acqDate} onChange={e => setAcqDate(e.target.value)} />
            </Row>
            <Row label={t('farm.bulk.totalCost')}>
              <Input type="number" step="0.01" value={totalCost} onChange={e => setTotalCost(Number(e.target.value))} />
            </Row>
            <Row label={t('farm.animals.fields.currentWeight')}>
              <Input type="number" step="0.01" value={weightKg} onChange={e => setWeightKg(Number(e.target.value))} />
            </Row>
          </div>

          {totalCost > 0 && count > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('farm.bulk.perHead')}: {perHeadCost.toFixed(0)}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('farm.common.cancel')}</Button>
          <Button disabled={count < 1 || !prefix || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {t('farm.bulk.create', { count })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>
}
