import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { AlertTriangle, AlertCircle, Info, CheckCircle2, Loader2, Sparkles, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  useCurrentFarm, useAnimals, useAnimalGroups, useFeedStock, useFeedConsumption,
  useProduction, useAnimalCosts, usePastures, useFields, useVetTasks,
} from '@/hooks/farm/useFarmData'
import { FarmOnboarding } from '@/components/farm/FarmOnboarding'
import { analyzeFarm, type Advice, type AdvicePriority } from '@/lib/farm/advisor'
import type { AnimalEvent } from '@/types/farm'

const ICON: Record<AdvicePriority, any> = { critical: AlertCircle, warning: AlertTriangle, info: Info, success: CheckCircle2 }
const COLOR: Record<AdvicePriority, string> = {
  critical: 'text-rose-600 dark:text-rose-400',
  warning:  'text-amber-600 dark:text-amber-400',
  info:     'text-sky-600 dark:text-sky-400',
  success:  'text-emerald-600 dark:text-emerald-400',
}
const BORDER: Record<AdvicePriority, string> = {
  critical: 'border-rose-400', warning: 'border-amber-400', info: 'border-sky-400', success: 'border-emerald-400',
}

export function AdvisorPage() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const { data: farm, isLoading } = useCurrentFarm()
  const { data: animals } = useAnimals(farm?.id)
  const { data: groups } = useAnimalGroups(farm?.id)
  const { data: feedStock } = useFeedStock(farm?.id)
  const { data: feedConsumption } = useFeedConsumption({ farmId: farm?.id })
  const { data: production } = useProduction({ farmId: farm?.id })
  const { data: costs } = useAnimalCosts(farm?.id)
  const { data: pastures } = usePastures(farm?.id)
  const { data: fields } = useFields(farm?.id)
  const { data: vetData } = useVetTasks(farm?.id)

  const { data: events } = useQuery({
    queryKey: ['farm', 'events-all', farm?.id],
    queryFn: async () => {
      if (!farm?.id) return []
      const { data, error } = await supabase.from('animal_events').select('*').eq('farm_id', farm.id)
      if (error) throw error
      return (data ?? []) as AnimalEvent[]
    },
    enabled: !!farm?.id,
    staleTime: 60_000,
  })

  const advices = useMemo((): Advice[] => {
    if (!farm) return []
    const overdueCount = (vetData?.tasks ?? []).filter((t: any) => t.overdue_days > 0).length
    return analyzeFarm({
      animals: animals ?? [],
      events: events ?? [],
      feedStock: feedStock ?? [],
      feedConsumption: feedConsumption ?? [],
      production: production ?? [],
      costs: costs ?? [],
      groups: groups ?? [],
      pastures: pastures ?? [],
      fields: fields ?? [],
      vetOverdueCount: overdueCount,
    })
  }, [farm, animals, events, feedStock, feedConsumption, production, costs, groups, pastures, fields, vetData])

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!farm) return <FarmOnboarding />

  const byPriority: Record<AdvicePriority, Advice[]> = { critical: [], warning: [], info: [], success: [] }
  advices.forEach(a => byPriority[a.priority].push(a))

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <PageHeader title={t('farm.advisor.title')} description={t('farm.advisor.subtitle')}>
        <Sparkles className="h-5 w-5 text-primary" />
      </PageHeader>

      {advices.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="font-semibold">{t('farm.advisor.allGood')}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">{t('farm.advisor.allGoodDetail')}</p>
          </CardContent>
        </Card>
      ) : (
        (['critical', 'warning', 'info', 'success'] as AdvicePriority[]).map(pri =>
          byPriority[pri].length > 0 && (
            <div key={pri} className="space-y-2">
              {byPriority[pri].map(a => {
                const Icon = ICON[a.priority]
                return (
                  <Card key={a.id} className={BORDER[a.priority]}>
                    <CardContent className="py-3 flex items-start gap-3">
                      <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${COLOR[a.priority]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <p className="font-semibold">{a.title}</p>
                          {a.metric && <Badge variant="outline" className="text-xs">{a.metric}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{a.detail}</p>
                        {a.action && (
                          <Button size="sm" variant="link" className="px-0 mt-1 h-auto" onClick={() => nav(a.action!.path)}>
                            {a.action.label} <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )
        )
      )}

      <p className="text-xs text-muted-foreground text-center mt-6">{t('farm.advisor.disclaimer')}</p>
    </div>
  )
}
