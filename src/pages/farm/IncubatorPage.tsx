import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { Plus, Pencil, Trash2, Loader2, Egg, Clock, CheckCircle2 } from 'lucide-react'
import { useCurrentFarm, useIncubations, useDeleteIncubation } from '@/hooks/farm/useFarmData'
import { IncubationDialog } from '@/components/farm/ExtraDialogs'
import { FarmOnboarding } from '@/components/farm/FarmOnboarding'
import type { Incubation } from '@/types/farm'
import dayjs from 'dayjs'

export function IncubatorPage() {
  const { t } = useTranslation()
  const { data: farm, isLoading } = useCurrentFarm()
  const { data: incubations } = useIncubations(farm?.id)
  const del = useDeleteIncubation()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Incubation | null>(null)

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!farm) return <FarmOnboarding />

  const active = (incubations ?? []).filter(i => !i.actual_hatch_date)
  const done = (incubations ?? []).filter(i => i.actual_hatch_date)

  const totalLoaded = done.reduce((s, i) => s + i.eggs_loaded, 0)
  const totalHatched = done.reduce((s, i) => s + (i.eggs_hatched ?? 0), 0)
  const avgHatchRate = totalLoaded > 0 ? (totalHatched / totalLoaded) * 100 : 0

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader title={t('farm.incubator.title')}>
        <Button onClick={() => { setEditing(null); setOpen(true) }}><Plus className="h-4 w-4 mr-1" /> {t('farm.incubator.add')}</Button>
      </PageHeader>

      {done.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card><CardContent className="pt-5 pb-4">
            <p className="text-sm text-muted-foreground mb-1">{t('farm.incubator.totalLoaded')}</p>
            <p className="text-2xl font-bold">{totalLoaded}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4">
            <p className="text-sm text-muted-foreground mb-1">{t('farm.incubator.totalHatched')}</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalHatched}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4">
            <p className="text-sm text-muted-foreground mb-1">{t('farm.incubator.avgRate')}</p>
            <p className="text-2xl font-bold">{avgHatchRate.toFixed(1)}%</p>
          </CardContent></Card>
        </div>
      )}

      {(incubations ?? []).length === 0 && (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('farm.incubator.empty')}</CardContent></Card>
      )}

      {active.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('farm.incubator.active')}</h2>
          {active.map(i => {
            const daysLeft = dayjs(i.expected_hatch_date).diff(dayjs(), 'day')
            const totalDays = dayjs(i.expected_hatch_date).diff(dayjs(i.start_date), 'day') || 1
            const progress = Math.max(0, Math.min(100, ((totalDays - Math.max(0, daysLeft)) / totalDays) * 100))
            return (
              <Card key={i.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
                        <Egg className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="font-semibold">{i.eggs_loaded} {t('farm.common.pieces')}</p>
                        <p className="text-xs text-muted-foreground">{t(`farm.species.${i.species}`)} · {dayjs(i.start_date).format('DD.MM.YYYY')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{daysLeft > 0 ? `${daysLeft} ${t('farm.common.days')}` : t('farm.incubator.ready')}</Badge>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(i); setOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={async () => { if (confirm(t('farm.common.confirmDelete'))) await del.mutateAsync(i.id) }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{dayjs(i.start_date).format('DD.MM')}</span>
                    <span>{dayjs(i.expected_hatch_date).format('DD.MM')}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {done.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('farm.incubator.completed')}</h2>
          {done.map(i => {
            const rate = i.eggs_loaded > 0 ? ((i.eggs_hatched ?? 0) / i.eggs_loaded) * 100 : 0
            return (
              <Card key={i.id}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <div>
                      <p className="text-sm font-medium">{i.eggs_loaded} → {i.eggs_hatched ?? 0}</p>
                      <p className="text-xs text-muted-foreground">{dayjs(i.actual_hatch_date!).format('DD.MM.YYYY')} · {t(`farm.species.${i.species}`)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${rate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : rate >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {rate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(i); setOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={async () => { if (confirm(t('farm.common.confirmDelete'))) await del.mutateAsync(i.id) }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <IncubationDialog open={open} onOpenChange={setOpen} farmId={farm.id} initial={editing} />
    </div>
  )
}
