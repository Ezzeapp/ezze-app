import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, UtensilsCrossed, CalendarDays } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useClinicMealPlans } from '@/hooks/useClinicNutrition'
import { DietAssignDialog } from '@/components/clinic/DietAssignDialog'
import { MealTrackingPanel } from '@/components/clinic/MealTrackingPanel'
import type { ClinicMealPlan } from '@/types'

export function NutritionPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'plans' | 'tracking'>('plans')
  const [dietDialogOpen, setDietDialogOpen] = useState(false)
  const [trackingDate, setTrackingDate] = useState(() => new Date().toISOString().slice(0, 10))

  const { data: plans = [], isLoading } = useClinicMealPlans()

  const clientName = (plan: ClinicMealPlan) =>
    [plan.hospitalization?.client?.first_name, plan.hospitalization?.client?.last_name].filter(Boolean).join(' ') || t('common.unknown')

  return (
    <div className="container max-w-3xl mx-auto px-4 py-6">
      <PageHeader title={t('clinic.nutrition.title')}>
        {tab === 'plans' && (
          <Button className="gap-1.5" onClick={() => setDietDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('clinic.nutrition.assignDiet')}</span>
          </Button>
        )}
      </PageHeader>

      {/* Tab switcher */}
      <div className="flex border-b mb-4">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'plans'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('plans')}
        >
          <UtensilsCrossed className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
          {t('clinic.nutrition.tabPlans')}
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'tracking'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('tracking')}
        >
          <CalendarDays className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
          {t('clinic.nutrition.tabTracking')}
        </button>
      </div>

      {tab === 'plans' && (
        <>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
          ) : plans.length === 0 ? (
            <EmptyState
              icon={UtensilsCrossed}
              title={t('clinic.nutrition.emptyPlansTitle')}
              description={t('clinic.nutrition.emptyPlansDescription')}
              action={{ label: t('clinic.nutrition.assignDiet'), onClick: () => setDietDialogOpen(true) }}
            />
          ) : (
            <div className="space-y-3">
              {plans.map(plan => (
                <Card key={plan.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{clientName(plan)}</p>
                        {plan.diet_table && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t('clinic.nutrition.dietTable')} {plan.diet_table.number} — {plan.diet_table.name}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {plan.start_date}
                      </span>
                    </div>
                    {plan.special_instructions && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {plan.special_instructions}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'tracking' && (
        <>
          <div className="mb-4">
            <Input
              type="date"
              className="w-[180px] h-9"
              value={trackingDate}
              onChange={e => setTrackingDate(e.target.value)}
            />
          </div>
          <MealTrackingPanel date={trackingDate} />
        </>
      )}

      <DietAssignDialog open={dietDialogOpen} onOpenChange={setDietDialogOpen} />
    </div>
  )
}
