import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/shared/PageHeader'
import { Plus, Search, Loader2, ChevronRight } from 'lucide-react'
import { useCurrentFarm, useAnimals, useAnimalGroups } from '@/hooks/farm/useFarmData'
import { SpeciesIcon } from '@/components/farm/SpeciesIcon'
import { AnimalDialog } from '@/components/farm/AnimalDialog'
import { BulkAnimalDialog } from '@/components/farm/BulkAnimalDialog'
import { FarmOnboarding } from '@/components/farm/FarmOnboarding'
import type { AnimalSpecies, AnimalStatus } from '@/types/farm'
import { ANIMAL_SPECIES_LIST } from '@/types/farm'
import dayjs from 'dayjs'

const STATUS_VARIANT: Record<AnimalStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  growing: 'secondary', dairy: 'default', meat: 'default', breeding: 'default',
  sold: 'outline', slaughtered: 'outline', dead: 'destructive',
}

export function AnimalsPage() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const { data: farm, isLoading } = useCurrentFarm()
  const [species, setSpecies] = useState<AnimalSpecies | ''>('')
  const [groupId, setGroupId] = useState('')
  const [status, setStatus] = useState<AnimalStatus | ''>('')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const { data: animals, isLoading: loadingA } = useAnimals(farm?.id, {
    species: species || undefined,
    groupId: groupId || undefined,
    status: status || undefined,
    search: search || undefined,
  })
  const { data: groups } = useAnimalGroups(farm?.id)

  const computeAge = (birth: string | null | undefined) => {
    if (!birth) return '—'
    const months = dayjs().diff(dayjs(birth), 'month')
    if (months < 12) return `${months} ${t('farm.common.months')}`
    return `${Math.floor(months / 12)} ${t('farm.common.years')}`
  }

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!farm) return <FarmOnboarding />

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <PageHeader title={t('farm.animals.title')}>
        <Button variant="outline" onClick={() => setBulkOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> {t('farm.bulk.title')}
        </Button>
        <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" /> {t('farm.animals.add')}
        </Button>
      </PageHeader>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder={t('farm.animals.search')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={species || '__all'} onValueChange={v => setSpecies(v === '__all' ? '' : v as AnimalSpecies)}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t('farm.animals.filterBySpecies')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">{t('farm.common.all')}</SelectItem>
            {ANIMAL_SPECIES_LIST.map(s => <SelectItem key={s.value} value={s.value}>{t(s.labelKey)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={groupId || '__all'} onValueChange={v => setGroupId(v === '__all' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t('farm.animals.filterByGroup')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">{t('farm.common.all')}</SelectItem>
            {(groups ?? []).map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status || '__all'} onValueChange={v => setStatus(v === '__all' ? '' : v as AnimalStatus)}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t('farm.animals.filterByStatus')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">{t('farm.common.all')}</SelectItem>
            {(['growing','dairy','meat','breeding','sold','slaughtered','dead'] as AnimalStatus[]).map(s => (
              <SelectItem key={s} value={s}>{t(`farm.status.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loadingA ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (animals ?? []).length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('farm.animals.empty')}</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(animals ?? []).map(a => (
            <Card key={a.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => nav(`/farm/animals/${a.id}`)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <SpeciesIcon species={a.species} className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{a.tag}</span>
                    {a.name && <span className="text-sm text-muted-foreground truncate">{a.name}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{a.breed ?? t(`farm.species.${a.species}`)}</span>
                    <span>·</span>
                    <span>{computeAge(a.birth_date)}</span>
                    {a.current_weight_kg && <><span>·</span><span>{a.current_weight_kg} {t('farm.common.kg')}</span></>}
                  </div>
                  <div className="mt-2"><Badge variant={STATUS_VARIANT[a.status]}>{t(`farm.status.${a.status}`)}</Badge></div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {farm && <AnimalDialog open={dialogOpen} onOpenChange={setDialogOpen} farmId={farm.id} initial={editing} />}
      {farm && <BulkAnimalDialog open={bulkOpen} onOpenChange={setBulkOpen} farmId={farm.id} />}
    </div>
  )
}
