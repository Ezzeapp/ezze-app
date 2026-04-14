import { useTranslation } from 'react-i18next'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { Loader2, Beef, Wheat, Package, Milk, Wallet, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { useCurrentFarm, useFarmDashboardStats, useAnimalCosts, useFeedConversion } from '@/hooks/farm/useFarmData'
import { FarmOnboarding } from '@/components/farm/FarmOnboarding'
import type { AnimalSpecies, FarmExpenseCategory } from '@/types/farm'
import dayjs from 'dayjs'

const CATEGORY_COLORS: Record<FarmExpenseCategory, string> = {
  feed: '#10b981', veterinary: '#f59e0b', salary: '#6366f1', utilities: '#8b5cf6',
  fuel: '#ef4444', rent: '#14b8a6', repair: '#f97316', equipment: '#ec4899',
  seeds: '#22c55e', fertilizer: '#84cc16', transport: '#06b6d4', other: '#94a3b8',
}

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--background))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
}

function Metric({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: string; sub?: string; accent?: 'revenue' | 'expense' }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between mb-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${accent === 'revenue' ? 'text-emerald-500' : accent === 'expense' ? 'text-rose-500' : 'text-muted-foreground'}`} />
        </div>
        <p className={`text-2xl font-bold ${accent === 'revenue' ? 'text-emerald-600 dark:text-emerald-400' : accent === 'expense' ? 'text-rose-600 dark:text-rose-400' : ''}`}>{value}</p>
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
  const { data: fcr } = useFeedConversion(farm?.id, 60)

  if (loadingFarm) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!farm) return <FarmOnboarding />

  const bySpecies = stats?.animals_by_species ?? ({} as Record<AnimalSpecies, number>)
  const cattleCount = bySpecies.cattle ?? 0
  const poultryCount = bySpecies.poultry ?? 0
  const netMargin = (stats?.revenue_last_30d ?? 0) - (stats?.expenses_last_30d ?? 0)

  // Daily chart — формат
  const daily = (stats?.daily_series ?? []).map(d => ({ ...d, label: dayjs(d.date).format('DD.MM') }))

  // Топ-10 животных по марже
  const topMargin = (costs ?? []).slice(0, 10).map(c => ({
    name: c.tag + (c.name ? ` · ${c.name}` : ''),
    margin: c.margin,
    revenue: c.revenue,
    cost: c.total_cost,
  }))

  // Структура расходов
  const expBreakdown = Object.entries(stats?.expenses_by_category ?? {})
    .map(([cat, value]) => ({ name: t(`farm.expenses.category.${cat}`), cat, value }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value)

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader title={t('farm.dashboard.title')} description={farm.name} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric icon={Beef}        label={t('farm.dashboard.totalAnimals')}  value={String(stats?.animals_total ?? 0)} sub={`${t('farm.species.cattle')}: ${cattleCount} · ${t('farm.species.poultry')}: ${poultryCount}`} />
        <Metric icon={Wheat}       label={t('farm.dashboard.totalFields')}   value={`${formatCurrency(stats?.fields_total_ha ?? 0)} ${t('farm.common.ha')}`} />
        <Metric icon={Package}     label={t('farm.dashboard.feedStockValue')} value={`${formatCurrency(stats?.feed_stock_total_value ?? 0)} ${symbol}`} />
        <Metric icon={TrendingUp}  label={t('farm.dashboard.netMargin30d')}  value={`${formatCurrency(netMargin)} ${symbol}`} accent={netMargin >= 0 ? 'revenue' : 'expense'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Metric icon={Wallet} label={t('farm.dashboard.revenue30d')}  value={`${formatCurrency(stats?.revenue_last_30d ?? 0)} ${symbol}`} accent="revenue" />
        <Metric icon={Wallet} label={t('farm.dashboard.expenses30d')} value={`${formatCurrency(stats?.expenses_last_30d ?? 0)} ${symbol}`} accent="expense" />
        <Metric icon={Milk}   label={`${t('farm.production.type.milk')} / ${t('farm.production.type.eggs')}`} value={`${formatCurrency(stats?.production_last_30d?.milk ?? 0)} ${t('farm.common.liters')} · ${formatCurrency(stats?.production_last_30d?.eggs ?? 0)} ${t('farm.common.pieces')}`} />
      </div>

      {/* Доход / Расход по дням */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t('farm.dashboard.revenueVsExpense')}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={daily} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}к` : String(v)} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: any, n: any) => [formatCurrency(Number(v)), n === 'revenue' ? t('farm.dashboard.revenue30d') : t('farm.dashboard.expenses30d')]) as any} />
              <Legend formatter={(v: string) => v === 'revenue' ? t('farm.dashboard.revenue30d') : t('farm.dashboard.expenses30d')} />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#rev)" />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#exp)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Топ по марже */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t('farm.dashboard.topMargin')}</CardTitle></CardHeader>
          <CardContent>
            {topMargin.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('farm.common.noData')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topMargin} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false}
                    tickFormatter={(v: number) => v >= 1000 || v <= -1000 ? `${(v / 1000).toFixed(0)}к` : String(v)} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: any) => [formatCurrency(Number(v)), t('farm.reports.columns.margin')]) as any} />
                  <Bar dataKey="margin" radius={[0, 4, 4, 0]}>
                    {topMargin.map((d, idx) => <Cell key={idx} fill={d.margin >= 0 ? '#10b981' : '#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Структура расходов */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t('farm.dashboard.expenseBreakdown')}</CardTitle></CardHeader>
          <CardContent>
            {expBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('farm.common.noData')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={expBreakdown} cx="50%" cy="50%" outerRadius={90} dataKey="value" labelLine={false}>
                    {expBreakdown.map((e, idx) => <Cell key={idx} fill={CATEGORY_COLORS[e.cat as FarmExpenseCategory] ?? '#94a3b8'} />)}
                  </Pie>
                  <Legend formatter={(v: string) => v} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: any) => [`${formatCurrency(Number(v))} ${symbol}`, '']) as any} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* FCR по мясным/откормочным группам */}
      {(fcr ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t('farm.dashboard.fcrTitle')}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">{t('farm.dashboard.fcrSubtitle')}</p>
            <div className="space-y-2">
              {(fcr ?? []).map((g: any) => {
                const rating = g.fcr == null ? null : g.fcr < 2 ? 'text-emerald-600 dark:text-emerald-400' : g.fcr < 4 ? '' : g.fcr < 8 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                return (
                  <div key={g.group_id} className="flex items-center justify-between text-sm border-b last:border-0 py-2">
                    <div>
                      <span className="font-medium">{g.group_name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{t(`farm.species.${g.species}`)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-muted-foreground">{g.feed_kg.toFixed(0)} {t('farm.common.kg')} → {g.gain_kg.toFixed(0)} {t('farm.common.kg')}</span>
                      {g.fcr == null
                        ? <span className="text-xs text-muted-foreground">—</span>
                        : <span className={`font-bold text-lg ${rating}`}>{g.fcr.toFixed(2)}</span>
                      }
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Таблица себестоимости */}
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
                    <th className="py-2 pr-3 text-right">{t('farm.reports.columns.feedCost')}</th>
                    <th className="py-2 pr-3 text-right">{t('farm.reports.columns.vetCost')}</th>
                    <th className="py-2 pr-3 text-right">{t('farm.reports.columns.totalCost')}</th>
                    <th className="py-2 pr-3 text-right">{t('farm.reports.columns.revenue')}</th>
                    <th className="py-2 pr-3 text-right">{t('farm.reports.columns.margin')}</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.slice(0, 10).map(c => (
                    <tr key={c.animal_id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{c.tag}{c.name ? ` (${c.name})` : ''}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(c.feed_cost)}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(c.veterinary_cost)}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(c.total_cost)}</td>
                      <td className="py-2 pr-3 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(c.revenue)}</td>
                      <td className={`py-2 pr-3 text-right font-semibold ${c.margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {formatCurrency(c.margin)} {symbol}
                      </td>
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
