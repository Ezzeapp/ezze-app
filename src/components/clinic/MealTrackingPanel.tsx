import { useState, useCallback, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { UtensilsCrossed, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { useClinicMealPlans, useClinicMealRecords, useCreateMealRecord, useUpdateMealRecord } from '@/hooks/useClinicNutrition'
import { toast } from '@/components/shared/Toaster'
import type { MealType, ClinicMealRecord } from '@/types'

interface MealTrackingPanelProps {
  date: string
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export function MealTrackingPanel({ date }: MealTrackingPanelProps) {
  const { t } = useTranslation()
  const { data: plans = [], isLoading: plansLoading } = useClinicMealPlans()
  const { data: records = [], isLoading: recordsLoading } = useClinicMealRecords(undefined, date)
  const createMut = useCreateMealRecord()
  const updateMut = useUpdateMealRecord()

  // Local state for menu_items per cell (plan_id + meal_type)
  const [menuDrafts, setMenuDrafts] = useState<Record<string, string>>({})

  // Build lookup: planId_mealType -> record
  const recordMap = useMemo(() => {
    const map = new Map<string, ClinicMealRecord>()
    records.forEach(r => {
      map.set(`${r.meal_plan_id}_${r.meal_type}`, r)
    })
    return map
  }, [records])

  // Sync drafts from records when records change
  useEffect(() => {
    const drafts: Record<string, string> = {}
    records.forEach(r => {
      drafts[`${r.meal_plan_id}_${r.meal_type}`] = r.menu_items ?? ''
    })
    setMenuDrafts(drafts)
  }, [records])

  const clientName = useCallback((plan: typeof plans[number]) =>
    [plan.hospitalization?.client?.first_name, plan.hospitalization?.client?.last_name].filter(Boolean).join(' ') || t('common.unknown'),
    [t],
  )

  // Filter to only active plans for this date
  const activePlans = useMemo(() =>
    plans.filter(p => {
      if (p.start_date > date) return false
      if (p.end_date && p.end_date < date) return false
      return true
    }),
    [plans, date],
  )

  const handleToggleServed = async (planId: string, mealType: MealType) => {
    const key = `${planId}_${mealType}`
    const existing = recordMap.get(key)

    try {
      if (existing) {
        await updateMut.mutateAsync({ id: existing.id, served: !existing.served })
      } else {
        await createMut.mutateAsync({
          meal_plan_id: planId,
          date,
          meal_type: mealType,
          served: true,
        })
      }
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const handleMenuBlur = async (planId: string, mealType: MealType) => {
    const key = `${planId}_${mealType}`
    const draft = menuDrafts[key] ?? ''
    const existing = recordMap.get(key)

    // Skip if nothing changed
    if (existing && (existing.menu_items ?? '') === draft) return
    if (!existing && !draft) return

    try {
      if (existing) {
        await updateMut.mutateAsync({ id: existing.id, menu_items: draft || null })
      } else {
        await createMut.mutateAsync({
          meal_plan_id: planId,
          date,
          meal_type: mealType,
          served: false,
          menu_items: draft || null,
        })
      }
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const isLoading = plansLoading || recordsLoading

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    )
  }

  if (activePlans.length === 0) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title={t('clinic.nutrition.noActivePlans')}
        description={t('clinic.nutrition.noActivePlansDesc')}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm border rounded-lg">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-2 font-medium">{t('clinic.nutrition.patient')}</th>
              {MEAL_TYPES.map(mt => (
                <th key={mt} className="text-center p-2 font-medium min-w-[140px]">
                  {t(`clinic.nutrition.meal_${mt}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activePlans.map(plan => (
              <tr key={plan.id} className="border-b last:border-b-0">
                <td className="p-2 font-medium whitespace-nowrap">
                  {clientName(plan)}
                  {plan.diet_table && (
                    <span className="block text-xs text-muted-foreground">
                      {t('clinic.nutrition.dietTable')} {plan.diet_table.number}
                    </span>
                  )}
                </td>
                {MEAL_TYPES.map(mt => {
                  const key = `${plan.id}_${mt}`
                  const rec = recordMap.get(key)
                  const served = rec?.served ?? false
                  return (
                    <td key={mt} className="p-2">
                      <div className="flex flex-col items-center gap-1">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={served}
                            onChange={() => handleToggleServed(plan.id, mt)}
                            className="h-4 w-4 rounded border-input accent-primary"
                          />
                          <span className="text-xs text-muted-foreground">
                            {t('clinic.nutrition.served')}
                          </span>
                        </label>
                        <Input
                          className="h-7 text-xs w-full"
                          placeholder={t('clinic.nutrition.menuItems')}
                          value={menuDrafts[key] ?? ''}
                          onChange={e => setMenuDrafts(prev => ({ ...prev, [key]: e.target.value }))}
                          onBlur={() => handleMenuBlur(plan.id, mt)}
                        />
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {activePlans.map(plan => (
          <Card key={plan.id}>
            <CardContent className="p-3">
              <p className="font-medium text-sm">{clientName(plan)}</p>
              {plan.diet_table && (
                <p className="text-xs text-muted-foreground mb-2">
                  {t('clinic.nutrition.dietTable')} {plan.diet_table.number} — {plan.diet_table.name}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {MEAL_TYPES.map(mt => {
                  const key = `${plan.id}_${mt}`
                  const rec = recordMap.get(key)
                  const served = rec?.served ?? false
                  return (
                    <div key={mt} className="border rounded-md p-2">
                      <p className="text-xs font-medium mb-1">{t(`clinic.nutrition.meal_${mt}`)}</p>
                      <label className="flex items-center gap-1.5 cursor-pointer mb-1">
                        <input
                          type="checkbox"
                          checked={served}
                          onChange={() => handleToggleServed(plan.id, mt)}
                          className="h-3.5 w-3.5 rounded border-input accent-primary"
                        />
                        <span className="text-xs text-muted-foreground">
                          {t('clinic.nutrition.served')}
                        </span>
                      </label>
                      <Input
                        className="h-7 text-xs"
                        placeholder={t('clinic.nutrition.menuItems')}
                        value={menuDrafts[key] ?? ''}
                        onChange={e => setMenuDrafts(prev => ({ ...prev, [key]: e.target.value }))}
                        onBlur={() => handleMenuBlur(plan.id, mt)}
                      />
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(createMut.isPending || updateMut.isPending) && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('common.saving')}
        </div>
      )}
    </div>
  )
}
