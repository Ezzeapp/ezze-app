import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { AlertTriangle, CalendarCheck, Loader2, Syringe, Stethoscope, Pill, ChevronRight } from 'lucide-react'
import { useCurrentFarm, useVetTasks, useAddAnimalEvent } from '@/hooks/farm/useFarmData'
import { FarmOnboarding } from '@/components/farm/FarmOnboarding'
import { SpeciesIcon } from '@/components/farm/SpeciesIcon'
import dayjs from 'dayjs'

const TYPE_ICON = { vaccination: Syringe, treatment: Pill, exam: Stethoscope }

export function VetCalendarPage() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const { data: farm, isLoading } = useCurrentFarm()
  const { data } = useVetTasks(farm?.id)
  const addEvent = useAddAnimalEvent()
  const [filter, setFilter] = useState<'all' | 'overdue' | 'soon' | 'upcoming'>('all')

  const tasks = data?.tasks ?? []
  const overdue = useMemo(() => tasks.filter((x: any) => x.overdue_days > 0), [tasks])
  const soon    = useMemo(() => tasks.filter((x: any) => x.overdue_days >= -7 && x.overdue_days <= 0), [tasks])
  const upcoming = useMemo(() => tasks.filter((x: any) => x.overdue_days < -7), [tasks])

  const visible = filter === 'overdue' ? overdue : filter === 'soon' ? soon : filter === 'upcoming' ? upcoming : tasks

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!farm) return <FarmOnboarding />

  async function markDone(task: any) {
    await addEvent.mutateAsync({
      farm_id: farm!.id,
      animal_id: task.animal_id,
      event_type: task.protocol.type,
      event_date: new Date().toISOString(),
      data: { protocol_name: task.protocol.name, name: task.protocol.name } as any,
      notes: task.protocol.name,
    })
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader title={t('farm.vet.title')} description={t('farm.vet.subtitle')} />

      <div className="grid grid-cols-3 gap-3">
        <Card className={filter === 'overdue' ? 'ring-2 ring-rose-400 cursor-pointer' : 'cursor-pointer'} onClick={() => setFilter(filter === 'overdue' ? 'all' : 'overdue')}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-muted-foreground">{t('farm.vet.overdue')}</p>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </div>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{overdue.length}</p>
          </CardContent>
        </Card>
        <Card className={filter === 'soon' ? 'ring-2 ring-amber-400 cursor-pointer' : 'cursor-pointer'} onClick={() => setFilter(filter === 'soon' ? 'all' : 'soon')}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-muted-foreground">{t('farm.vet.soon')}</p>
              <CalendarCheck className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{soon.length}</p>
          </CardContent>
        </Card>
        <Card className={filter === 'upcoming' ? 'ring-2 ring-primary cursor-pointer' : 'cursor-pointer'} onClick={() => setFilter(filter === 'upcoming' ? 'all' : 'upcoming')}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-muted-foreground">{t('farm.vet.upcoming')}</p>
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{upcoming.length}</p>
          </CardContent>
        </Card>
      </div>

      {visible.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{t('farm.vet.allDone')}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {visible.map((task: any, idx: number) => {
            const Icon = TYPE_ICON[task.protocol.type as 'vaccination' | 'treatment' | 'exam'] ?? Syringe
            const isOverdue = task.overdue_days > 0
            const isSoon = !isOverdue && task.overdue_days >= -7
            return (
              <Card key={`${task.animal_id}-${idx}`} className={isOverdue ? 'border-rose-400' : isSoon ? 'border-amber-400' : ''}>
                <CardContent className="py-3 flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${isOverdue ? 'bg-rose-100 dark:bg-rose-950/30' : isSoon ? 'bg-amber-100 dark:bg-amber-950/30' : 'bg-primary/10'}`}>
                    <Icon className={`h-5 w-5 ${isOverdue ? 'text-rose-600' : isSoon ? 'text-amber-600' : 'text-primary'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{task.protocol.name}</span>
                      <Badge variant="secondary">{t(`farm.eventType.${task.protocol.type}`)}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <SpeciesIcon species={task.species} className="h-3 w-3" />
                      <button className="hover:underline" onClick={(e) => { e.stopPropagation(); nav(`/farm/animals/${task.animal_id}`) }}>
                        {task.animal_tag}{task.animal_name ? ` · ${task.animal_name}` : ''}
                      </button>
                      <span>·</span>
                      <span>
                        {isOverdue
                          ? t('farm.vet.overdueBy', { days: task.overdue_days })
                          : task.overdue_days === 0
                            ? t('farm.vet.dueToday')
                            : t('farm.vet.dueIn', { days: -task.overdue_days })}
                      </span>
                      <span>·</span>
                      <span>{dayjs(task.due_date).format('DD.MM.YYYY')}</span>
                    </div>
                  </div>
                  <Button size="sm" variant={isOverdue ? 'default' : 'outline'} onClick={() => markDone(task)}>
                    {t('farm.vet.markDone')}
                  </Button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" onClick={() => nav(`/farm/animals/${task.animal_id}`)} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
