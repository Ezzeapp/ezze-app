import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { TrendingUp, Users, Scissors, CalendarDays, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppointments, getAppointmentServices } from '@/hooks/useAppointments'
import { useServices } from '@/hooks/useServices'
import { useClients } from '@/hooks/useClients'
import { formatCurrency } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import dayjs from 'dayjs'

type Period = 'week' | 'month' | 'quarter' | 'year'

interface PeriodOption {
  key: Period
  labelKey: string
}

const PERIODS: PeriodOption[] = [
  { key: 'week',    labelKey: 'analytics.periodWeek'    },
  { key: 'month',   labelKey: 'analytics.periodMonth'   },
  { key: 'quarter', labelKey: 'analytics.periodQuarter' },
  { key: 'year',    labelKey: 'analytics.periodYear'    },
]

function getPeriodRange(period: Period): { start: string; end: string } {
  const now = dayjs()
  switch (period) {
    case 'week':
      return { start: now.startOf('isoWeek').format('YYYY-MM-DD'), end: now.endOf('isoWeek').format('YYYY-MM-DD') }
    case 'month':
      return { start: now.startOf('month').format('YYYY-MM-DD'), end: now.endOf('month').format('YYYY-MM-DD') }
    case 'quarter': {
      const q = Math.floor(now.month() / 3)
      const qStart = now.month(q * 3).startOf('month')
      return { start: qStart.format('YYYY-MM-DD'), end: qStart.add(2, 'month').endOf('month').format('YYYY-MM-DD') }
    }
    case 'year':
      return { start: now.startOf('year').format('YYYY-MM-DD'), end: now.endOf('year').format('YYYY-MM-DD') }
  }
}

function getPrevPeriodRange(period: Period): { start: string; end: string } {
  const now = dayjs()
  switch (period) {
    case 'week':
      return {
        start: now.subtract(1, 'week').startOf('isoWeek').format('YYYY-MM-DD'),
        end:   now.subtract(1, 'week').endOf('isoWeek').format('YYYY-MM-DD'),
      }
    case 'month':
      return {
        start: now.subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
        end:   now.subtract(1, 'month').endOf('month').format('YYYY-MM-DD'),
      }
    case 'quarter': {
      const q = Math.floor(now.month() / 3)
      const prevQStart = now.month((q - 1) * 3).startOf('month')
      return {
        start: prevQStart.format('YYYY-MM-DD'),
        end:   prevQStart.add(2, 'month').endOf('month').format('YYYY-MM-DD'),
      }
    }
    case 'year':
      return {
        start: now.subtract(1, 'year').startOf('year').format('YYYY-MM-DD'),
        end:   now.subtract(1, 'year').endOf('year').format('YYYY-MM-DD'),
      }
  }
}

/** Мини-бар-чарт без внешних зависимостей */
function BarChart({ data, maxVal, color = 'bg-primary' }: {
  data: { label: string; value: number; isToday?: boolean }[]
  maxVal: number
  color?: string
}) {
  return (
    <div className="flex items-end gap-1 h-28">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div className="w-full flex flex-col justify-end" style={{ height: 88 }}>
            {d.value > 0 ? (
              <div
                className={`w-full rounded-t-sm ${color} ${d.isToday ? 'opacity-100' : 'opacity-70'}`}
                style={{ height: Math.max((d.value / maxVal) * 88, 4) }}
              />
            ) : (
              <div className="w-full rounded-t-sm bg-muted/40" style={{ height: 4 }} />
            )}
          </div>
          <span className={`text-[9px] sm:text-[10px] truncate w-full text-center font-medium ${d.isToday ? 'text-primary' : 'text-muted-foreground'}`}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  )
}

export function AnalyticsPage() {
  const { t, i18n } = useTranslation()
  const currency = useCurrency()
  const [period, setPeriod] = useState<Period>('month')

  const { start, end } = getPeriodRange(period)
  const { start: prevStart, end: prevEnd } = getPrevPeriodRange(period)

  const { data: appts, isLoading } = useAppointments(start, end)
  const { data: prevAppts } = useAppointments(prevStart, prevEnd)
  const { data: clients } = useClients()
  const { data: services = [] } = useServices()

  // --- Основные метрики ---
  const metrics = useMemo(() => {
    const done = appts?.filter(a => a.status === 'done') || []
    const revenue = done.reduce((s, a) => s + (a.price || 0), 0)
    const avgCheck = done.length > 0 ? revenue / done.length : 0
    const total = appts?.length || 0
    const cancelled = appts?.filter(a => a.status === 'cancelled').length || 0
    const noShow = appts?.filter(a => a.status === 'no_show').length || 0
    const online = appts?.filter(a => a.booked_via === 'online').length || 0
    const convRate = total > 0 ? Math.round((done.length / total) * 100) : 0

    // Предыдущий период
    const prevDone = prevAppts?.filter(a => a.status === 'done') || []
    const prevRevenue = prevDone.reduce((s, a) => s + (a.price || 0), 0)
    const prevTotal = prevAppts?.length || 0

    const revenueGrowth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null
    const totalGrowth = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null

    return { revenue, avgCheck, total, done: done.length, cancelled, noShow, online, convRate, revenueGrowth, totalGrowth }
  }, [appts, prevAppts])

  // --- Топ услуг ---
  const topServices = useMemo(() => {
    if (!appts) return []
    const counts: Record<string, { name: string; count: number; revenue: number; done: number }> = {}
    appts.forEach(a => {
      const names = getAppointmentServices(a, services).map(s => s.name)
      const isDone = a.status === 'done'
      names.forEach(name => {
        if (!counts[name]) counts[name] = { name, count: 0, revenue: 0, done: 0 }
        counts[name].count++
        if (isDone) {
          counts[name].done++
          counts[name].revenue += (a.price || 0) / names.length
        }
      })
    })
    return Object.values(counts).sort((a, b) => b.revenue - a.revenue).slice(0, 8)
  }, [appts])

  // --- Топ клиентов по выручке ---
  const topClients = useMemo(() => {
    if (!appts) return []
    const map: Record<string, { name: string; visits: number; revenue: number }> = {}
    appts.filter(a => a.status === 'done').forEach(a => {
      const name = a.expand?.client
        ? `${a.expand.client.first_name} ${a.expand.client.last_name || ''}`.trim()
        : (a.client_name || t('analytics.guest'))
      if (!map[name]) map[name] = { name, visits: 0, revenue: 0 }
      map[name].visits++
      map[name].revenue += a.price || 0
    })
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 8)
  }, [appts, t])

  // --- График по дням/неделям ---
  const chartData = useMemo(() => {
    if (period === 'week') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = dayjs(start).add(i, 'day')
        const ds = d.format('YYYY-MM-DD')
        const dayAppts = appts?.filter(a => a.date === ds) || []
        const revenue = dayAppts.filter(a => a.status === 'done').reduce((s, a) => s + (a.price || 0), 0)
        return {
          label: d.format('dd'),
          value: revenue,
          isToday: ds === dayjs().format('YYYY-MM-DD'),
        }
      })
    }
    if (period === 'month') {
      const daysInMonth = dayjs(start).daysInMonth()
      return Array.from({ length: daysInMonth }, (_, i) => {
        const d = dayjs(start).date(i + 1)
        const ds = d.format('YYYY-MM-DD')
        const dayAppts = appts?.filter(a => a.date === ds) || []
        const revenue = dayAppts.filter(a => a.status === 'done').reduce((s, a) => s + (a.price || 0), 0)
        return {
          label: String(i + 1),
          value: revenue,
          isToday: ds === dayjs().format('YYYY-MM-DD'),
        }
      })
    }
    // Квартал/год — по неделям
    const weeks: { label: string; value: number }[] = []
    let cur = dayjs(start).startOf('isoWeek')
    const endDay = dayjs(end)
    let wNum = 1
    while (cur.isBefore(endDay) || cur.isSame(endDay, 'day')) {
      const wEnd = cur.endOf('isoWeek')
      const weekAppts = appts?.filter(a => {
        const d = dayjs(a.date)
        return (d.isAfter(cur) || d.isSame(cur, 'day')) && (d.isBefore(wEnd) || d.isSame(wEnd, 'day'))
      }) || []
      const revenue = weekAppts.filter(a => a.status === 'done').reduce((s, a) => s + (a.price || 0), 0)
      weeks.push({ label: `W${wNum}`, value: revenue })
      cur = cur.add(1, 'week')
      wNum++
      if (weeks.length > 52) break
    }
    return weeks
  }, [appts, period, start, end])

  const maxChart = Math.max(...chartData.map(d => d.value), 1)

  // --- Статусы ---
  const statusData = useMemo(() => {
    const total = appts?.length || 0
    if (total === 0) return []
    return [
      { key: 'done',      label: t('appointments.status.done'),      count: metrics.done,      pct: Math.round((metrics.done / total) * 100),      color: 'bg-emerald-500' },
      { key: 'scheduled', label: t('appointments.status.scheduled'), count: total - metrics.done - metrics.cancelled - metrics.noShow, pct: Math.round(((total - metrics.done - metrics.cancelled - metrics.noShow) / total) * 100), color: 'bg-primary' },
      { key: 'cancelled', label: t('appointments.status.cancelled'), count: metrics.cancelled, pct: Math.round((metrics.cancelled / total) * 100), color: 'bg-destructive' },
      { key: 'no_show',   label: t('appointments.status.no_show'),   count: metrics.noShow,    pct: Math.round((metrics.noShow / total) * 100),    color: 'bg-amber-500' },
    ].filter(s => s.count > 0)
  }, [appts, metrics, t])

  function GrowthBadge({ value }: { value: number | null }) {
    if (value === null) return null
    const isPos = value >= 0
    return (
      <span className={`text-xs font-medium ${isPos ? 'text-emerald-600' : 'text-destructive'}`}>
        {isPos ? '↑' : '↓'} {Math.abs(Math.round(value))}%
      </span>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">{t('analytics.title')}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t('analytics.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PERIODS.map(p => (
            <Button
              key={p.key}
              variant={period === p.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p.key)}
            >
              {t(p.labelKey)}
            </Button>
          ))}
        </div>
      </div>

      {/* Метрики */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs text-muted-foreground">{t('analytics.revenue')}</p>
              {isLoading ? <Skeleton className="h-7 w-24" /> : (
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-lg sm:text-xl font-bold">{formatCurrency(metrics.revenue, currency, i18n.language)}</p>
                  <GrowthBadge value={metrics.revenueGrowth} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs text-muted-foreground">{t('analytics.totalAppts')}</p>
              {isLoading ? <Skeleton className="h-7 w-16" /> : (
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-lg sm:text-xl font-bold">{metrics.total}</p>
                  <GrowthBadge value={metrics.totalGrowth} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs text-muted-foreground">{t('analytics.avgCheck')}</p>
              {isLoading ? <Skeleton className="h-7 w-20" /> : (
                <p className="text-lg sm:text-xl font-bold">{formatCurrency(metrics.avgCheck, currency, i18n.language)}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs text-muted-foreground">{t('analytics.convRate')}</p>
              {isLoading ? <Skeleton className="h-7 w-16" /> : (
                <p className="text-lg sm:text-xl font-bold">{metrics.convRate}%</p>
              )}
              <p className="text-[11px] text-muted-foreground">{t('analytics.convRateHint')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* График выручки */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {t('analytics.revenueChart')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : (
            <BarChart data={chartData} maxVal={maxChart} color="bg-primary" />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Статусы */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {t('analytics.statusBreakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-8" />)}</div>
            ) : statusData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">{t('analytics.noData')}</p>
            ) : (
              <div className="space-y-3">
                {statusData.map(s => (
                  <div key={s.key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                        <span>{s.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs">{s.count} {t('analytics.pcs')}</span>
                        <span className="font-medium text-xs w-9 text-right">{s.pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${s.color} transition-all`} style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                ))}
                {/* Дополнительно: онлайн-записи */}
                {metrics.online > 0 && (
                  <div className="pt-2 border-t flex items-center justify-between text-sm text-muted-foreground">
                    <span>{t('analytics.onlineBookings')}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs">{metrics.online}</span>
                      <Badge variant="secondary" className="text-xs">{Math.round((metrics.online / (metrics.total || 1)) * 100)}%</Badge>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Топ услуг */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Scissors className="h-4 w-4" />
              {t('analytics.topServices')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8" />)}</div>
            ) : topServices.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">{t('analytics.noData')}</p>
            ) : (
              <div className="space-y-2">
                {topServices.map((svc, i) => {
                  const maxR = topServices[0].revenue || 1
                  return (
                    <div key={svc.name} className="space-y-0.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                          <span className="truncate font-medium">{svc.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-xs text-muted-foreground">{svc.done} {t('analytics.pcs')}</span>
                          <span className="text-xs font-semibold">{formatCurrency(svc.revenue, currency, i18n.language)}</span>
                        </div>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(svc.revenue / maxR) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Топ клиентов */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('analytics.topClients')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10" />)}</div>
          ) : topClients.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">{t('analytics.noData')}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {topClients.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-muted-foreground w-5 shrink-0 font-mono">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.visits} {t('analytics.visits')}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold shrink-0 ml-2">{formatCurrency(c.revenue, currency, i18n.language)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
