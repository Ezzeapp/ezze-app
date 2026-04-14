import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { Loader2, Beef, Bird, Wheat, Package, Milk, Egg, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { useCurrentFarm, useFarmDashboardStats, useAnimalCosts } from '@/hooks/farm/useFarmData'
import { FarmOnboarding } from '@/components/farm/FarmOnboarding'
import type { AnimalSpecies } from '@/types/farm'

function Metric({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between mb-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export function FarmDashboardPage() {
  const { t } = useTranslation()
  const symbol = useCurrencySymbol()
  const { data: farm, isLoading: loadingFarm } = useCurrentFarm()
  const { data: stats } = useFarmDashboardStats(farm?.id)
  const { data: costs } = useAnimalCosts(farm?.id)

  if (loadingFarm) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }
  if (!farm) return <FarmOnboarding />

  const bySpecies = stats?.animals_by_species ?? ({} as Record<AnimalSpecies, number>)
  const cattleCount = bySpecies.cattle ?? 0
  const poultryCount = bySpecies.poultry ?? 0

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader title={t('farm.dashboard.title')} description={farm.name} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric icon={Beef}    label={t('farm.dashboard.totalAnimals')} value={String(stats?.animals_total ?? 0)} sub={`${t('farm.species.cattle')}: ${cattleCount} · ${t('farm.species.poultry')}: ${poultryCount}`} />
        <Metric icon={Wheat}   label={t('farm.dashboard.totalFields')}  value={`${formatCurrency(stats?.fields_total_ha ?? 0)} ${t('farm.common.ha')}`} />
        <Metric icon={Package} label={t('farm.dashboard.feedStockValue')} value={`${formatCurrency(stats?.feed_stock_total_value ?? 0)} ${symbol}`} />
        <Metric icon={Wallet}  label={t('farm.dashboard.expenses30d')} value={`${formatCurrency(stats?.expenses_last_30d ?? 0)} ${symbol}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Metric icon={Milk} label={t('farm.production.type.milk')} value={`${formatCurrency(stats?.production_last_30d?.milk ?? 0)} ${t('farm.common.liters')}`} sub={t('farm.dashboard.production30d')} />
        <Metric icon={Egg}  label={t('farm.production.type.eggs')} value={`${formatCurrency(stats?.production_last_30d?.eggs ?? 0)} ${t('farm.common.pieces')}`} sub={t('farm.dashboard.production30d')} />
        <Metric icon={Bird} label={t('farm.production.type.meat')} value={`${formatCurrency(stats?.production_last_30d?.meat ?? 0)} ${t('farm.common.kg')}`} sub={t('farm.dashboard.production30d')} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t('farm.reports.costBreakdown')}</CardTitle></CardHeader>
        <CardContent>
          {(!costs || costs.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t('farm.common.noData')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-3">{t('farm.reports.columns.animal')}</th>
                    <th className="py-2 pr-3 text-right">{t('farm.reports.columns.acquisitionCost')}</th>
                    <th className="py-2 pr-3 text-right">{t('farm.reports.columns.feedCost')}</th>
                    <th className="py-2 pr-3 text-right">{t('farm.reports.columns.vetCost')}</th>
                    <th className="py-2 pr-3 text-right">{t('farm.reports.columns.overhead')}</th>
                    <th className="py-2 pr-3 text-right">{t('farm.reports.columns.totalCost')}</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.slice(0, 10).map(c => (
                    <tr key={c.animal_id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{c.tag}{c.name ? ` (${c.name})` : ''}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(c.acquisition_cost)}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(c.feed_cost)}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(c.veterinary_cost)}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(c.allocated_overhead)}</td>
                      <td className="py-2 pr-3 text-right font-semibold">{formatCurrency(c.total_cost)} {symbol}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
