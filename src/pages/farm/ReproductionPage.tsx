import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { Heart, Loader2, Baby, AlertTriangle, Clock, ChevronRight } from 'lucide-react'
import { useCurrentFarm, useReproduction, useAddAnimalEvent } from '@/hooks/farm/useFarmData'
import { FarmOnboarding } from '@/components/farm/FarmOnboarding'
import { SpeciesIcon } from '@/components/farm/SpeciesIcon'
import type { ReproStatus } from '@/lib/farm/reproduction'
import dayjs from 'dayjs'

const STATUS_VARIANT: Record<ReproStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  empty: 'outline', mated: 'secondary', pregnant: 'default',
  due_soon: 'default', overdue: 'destructive', immature: 'outline', unsupported: 'outline',
}
const STATUS_COLOR: Record<ReproStatus, string> = {
  empty: '', mated: '', pregnant: '',
  due_soon: 'border-amber-400',
  overdue: 'border-rose-500',
  immature: 'opacity-60', unsupported: 'opacity-60',
}

export function ReproductionPage() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const { data: farm, isLoading } = useCurrentFarm()
  const { data: rows } = useReproduction(farm?.id)
  const addEvent = useAddAnimalEvent()
  const [filter, setFilter] = useState<'all' | 'pregnant' | 'due_soon' | 'empty' | 'overdue'>('all')

  const counts = useMemo(() => {
    const c = { pregnant: 0, due_soon: 0, empty: 0, overdue: 0, total: 0 }
    ;(rows ?? []).forEach((r: any) => {
      if (r.status === 'unsupported' || r.status === 'immature') return
      c.total++
      if (r.status === 'pregnant' || r.status === 'mated') c.pregnant++
      else if (r.status === 'due_soon') c.due_soon++
      else if (r.status === 'overdue') c.overdue++
      else if (r.status === 'empty') c.empty++
    })
    return c
  }, [rows])

  const visible = (rows ?? []).filter((r: any) => {
    if (r.status === 'unsupported' || r.status === 'immature') return false
    if (filter === 'all') return true
    if (filter === 'pregnant') return r.status === 'pregnant' || r.status === 'mated'
    return r.status === filter
  })

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!farm) return <FarmOnboarding />

  async function recordMating(animalId: string) {
    await addEvent.mutateAsync({
      farm_id: farm!.id, animal_id: animalId, event_type: 'mating',
      event_date: new Date().toISOString(), notes: t('farm.reproduction.matingRecorded'),
    })
  }
  async function recordBirth(animalId: string) {
    await addEvent.mutateAsync({
      farm_id: farm!.id, animal_id: animalId, event_type: 'birth',
      event_date: new Date().toISOString(), notes: t('farm.reproduction.birthRecorded'),
    })
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader title={t('farm.reproduction.title')} description={t('farm.reproduction.subtitle')}>
        <Heart className="h-5 w-5 text-rose-500" />
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t('farm.reproduction.pregnant')} value={counts.pregnant} active={filter === 'pregnant'} onClick={() => setFilter(filter === 'pregnant' ? 'all' : 'pregnant')} />
        <StatCard label={t('farm.reproduction.dueSoon')}  value={counts.due_soon} color="text-amber-600 dark:text-amber-400" active={filter === 'due_soon'} onClick={() => setFilter(filter === 'due_soon' ? 'all' : 'due_soon')} />
        <StatCard label={t('farm.reproduction.overdue')}  value={counts.overdue} color="text-rose-600 dark:text-rose-400" active={filter === 'overdue'} onClick={() => setFilter(filter === 'overdue' ? 'all' : 'overdue')} />
        <StatCard label={t('farm.reproduction.empty')}    value={counts.empty} active={filter === 'empty'} onClick={() => setFilter(filter === 'empty' ? 'all' : 'empty')} />
      </div>

      {visible.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('farm.common.noData')}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {visible.map((r: any) => (
            <Card key={r.animal_id} className={STATUS_COLOR[r.status as ReproStatus]}>
              <CardContent className="py-3 flex items-center gap-3">
                <SpeciesIcon species={r.species} className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button className="font-semibold hover:underline" onClick={() => nav(`/farm/animals/${r.animal_id}`)}>
                      {r.tag}{r.name ? ` · ${r.name}` : ''}
                    </button>
                    <Badge variant={STATUS_VARIANT[r.status as ReproStatus]}>{t(`farm.reproduction.status.${r.status}`)}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                    {r.last_mating_date && <span><Heart className="h-3 w-3 inline mr-1" />{dayjs(r.last_mating_date).format('DD.MM.YYYY')}</span>}
                    {r.days_pregnant != null && <span>{t('farm.reproduction.daysPregnant', { days: r.days_pregnant })}</span>}
                    {r.expected_birth_date && (
                      <span className={r.status === 'overdue' ? 'text-rose-600 dark:text-rose-400 font-medium' : r.status === 'due_soon' ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
                        {r.status === 'overdue' ? <AlertTriangle className="h-3 w-3 inline mr-1" /> : <Clock className="h-3 w-3 inline mr-1" />}
                        {r.status === 'overdue'
                          ? t('farm.reproduction.overdueBy', { days: -r.days_until_birth })
                          : t('farm.reproduction.birthIn', { days: r.days_until_birth, date: dayjs(r.expected_birth_date).format('DD.MM') })}
                      </span>
                    )}
                  </div>
                </div>
                {(r.status === 'empty' || !r.status) ? (
                  <Button size="sm" variant="outline" onClick={() => recordMating(r.animal_id)}>
                    <Heart className="h-4 w-4 mr-1" /> {t('farm.reproduction.recordMating')}
                  </Button>
                ) : (r.status === 'pregnant' || r.status === 'due_soon' || r.status === 'overdue' || r.status === 'mated') ? (
                  <Button size="sm" variant="outline" onClick={() => recordBirth(r.animal_id)}>
                    <Baby className="h-4 w-4 mr-1" /> {t('farm.reproduction.recordBirth')}
                  </Button>
                ) : null}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color, active, onClick }: { label: string; value: number; color?: string; active?: boolean; onClick?: () => void }) {
  return (
    <Card className={`cursor-pointer transition-all ${active ? 'ring-2 ring-primary' : ''}`} onClick={onClick}>
      <CardContent className="pt-5 pb-4">
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold ${color ?? ''}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
