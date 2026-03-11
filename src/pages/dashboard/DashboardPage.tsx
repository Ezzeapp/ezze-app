import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Users, Package, TrendingUp, Clock, ArrowRight, Globe, CalendarRange, UsersRound } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { useAppointments } from '@/hooks/useAppointments'
import { useClients } from '@/hooks/useClients'
import { useServices } from '@/hooks/useServices'
import { useInventory } from '@/hooks/useInventory'
import { useCurrency } from '@/hooks/useCurrency'
import { useProfileIcon } from '@/hooks/useProfileIcon'
import { useAllServiceMaterials } from '@/hooks/useServiceMaterials'
import { useMyTeam, useTeamMembers } from '@/hooks/useTeam'
import { formatCurrency } from '@/lib/utils'
import { FeatureGate } from '@/components/shared/FeatureGate'
import dayjs from 'dayjs'

type Period = 'today' | '3days' | 'week' | 'month' | 'quarter' | 'year' | 'custom'

interface PeriodOption { key: Period; labelKey: string }
const PERIODS: PeriodOption[] = [
  { key: 'today',   labelKey: 'analytics.periodToday'   },
  { key: '3days',   labelKey: 'analytics.period3Days'   },
  { key: 'week',    labelKey: 'analytics.periodWeek'    },
  { key: 'month',   labelKey: 'analytics.periodMonth'   },
  { key: 'quarter', labelKey: 'analytics.periodQuarter' },
  { key: 'year',    labelKey: 'analytics.periodYear'    },
]

function getPeriodRange(period: Period, customStart?: string, customEnd?: string): { start: string; end: string } {
  const now = dayjs()
  switch (period) {
    case 'today':
      return { start: now.format('YYYY-MM-DD'), end: now.format('YYYY-MM-DD') }
    case '3days':
      return { start: now.subtract(2, 'day').format('YYYY-MM-DD'), end: now.format('YYYY-MM-DD') }
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
    case 'custom':
      return { start: customStart || now.format('YYYY-MM-DD'), end: customEnd || now.format('YYYY-MM-DD') }
  }
}

function getPrevPeriodRange(period: Period): { start: string; end: string } {
  const now = dayjs()
  switch (period) {
    case 'today':
      return { start: now.subtract(1, 'day').format('YYYY-MM-DD'), end: now.subtract(1, 'day').format('YYYY-MM-DD') }
    case '3days':
      return { start: now.subtract(5, 'day').format('YYYY-MM-DD'), end: now.subtract(3, 'day').format('YYYY-MM-DD') }
    case 'week':
      return { start: now.subtract(1, 'week').startOf('isoWeek').format('YYYY-MM-DD'), end: now.subtract(1, 'week').endOf('isoWeek').format('YYYY-MM-DD') }
    case 'month':
      return { start: now.subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), end: now.subtract(1, 'month').endOf('month').format('YYYY-MM-DD') }
    case 'quarter': {
      const q = Math.floor(now.month() / 3)
      const prevQStart = now.month((q - 1) * 3).startOf('month')
      return { start: prevQStart.format('YYYY-MM-DD'), end: prevQStart.add(2, 'month').endOf('month').format('YYYY-MM-DD') }
    }
    case 'year':
      return { start: now.subtract(1, 'year').startOf('year').format('YYYY-MM-DD'), end: now.subtract(1, 'year').endOf('year').format('YYYY-MM-DD') }
    case 'custom':
    default:
      return { start: now.subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), end: now.subtract(1, 'month').endOf('month').format('YYYY-MM-DD') }
  }
}

function GrowthBadge({ value }: { value: number | null }) {
  if (value === null) return null
  const isPos = value >= 0
  return (
    <span className={`text-xs font-medium ${isPos ? 'text-emerald-600' : 'text-destructive'}`}>
      {isPos ? '↑' : '↓'} {Math.abs(Math.round(value))}%
    </span>
  )
}

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const currency = useCurrency()
  const ServiceIcon = useProfileIcon()
  const [period, setPeriod] = useState<Period>('today')
  // Кастомный период
  const [customStart, setCustomStart] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [customEnd, setCustomEnd] = useState(dayjs().format('YYYY-MM-DD'))
  const [customOpen, setCustomOpen] = useState(false)
  const customRef = useRef<HTMLDivElement>(null)

  // Закрытие попапа кастомного периода по клику снаружи
  useEffect(() => {
    if (!customOpen) return
    const handler = (e: MouseEvent) => {
      if (customRef.current && !customRef.current.contains(e.target as Node)) {
        setCustomOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [customOpen])

  const today = dayjs().format('YYYY-MM-DD')
  const todayStart = today
  const todayEnd = today

  const { start, end } = getPeriodRange(period, customStart, customEnd)
  const { start: prevStart, end: prevEnd } = getPrevPeriodRange(period)

  // Период — для метрик
  const { data: periodAppts, isLoading: loadingPeriod } = useAppointments(start, end)
  const { data: prevAppts } = useAppointments(prevStart, prevEnd)
  // Неделя — для ближайших записей (сегодня + завтра)
  const weekStart = dayjs().startOf('isoWeek').format('YYYY-MM-DD')
  const weekEnd = dayjs().endOf('isoWeek').format('YYYY-MM-DD')
  const { data: weekAppts, isLoading: loadingToday } = useAppointments(weekStart, weekEnd)
  // Сегодняшние записи берём из weekAppts (избегаем лишнего запроса)
  const todayAppts = useMemo(
    () => weekAppts?.filter(a => a.date === today),
    [weekAppts, today]
  )

  const { data: clients } = useClients()
  const { data: services } = useServices()
  const { data: inventory } = useInventory()
  const { data: allMaterials } = useAllServiceMaterials()

  // Данные команды (только для владельцев)
  const { data: myTeam } = useMyTeam()
  const { data: teamMembers = [] } = useTeamMembers(myTeam?.isOwner ? (myTeam.team?.id ?? '') : '')

  // Карта себестоимости: serviceId → сумма (кол-во × цена закупки)
  const serviceCostMap = useMemo(() => {
    const map: Record<string, number> = {}
    if (!allMaterials) return map
    for (const mat of allMaterials) {
      const cost = mat.quantity * (mat.expand?.inventory_item?.cost_price ?? 0)
      map[mat.service] = (map[mat.service] || 0) + cost
    }
    return map
  }, [allMaterials])

  // --- Метрики за период ---
  const metrics = useMemo(() => {
    const done = periodAppts?.filter(a => a.status === 'done') || []
    const revenue = done.reduce((s, a) => s + (a.price || 0), 0)
    const avgCheck = done.length > 0 ? revenue / done.length : 0
    const total = periodAppts?.length || 0
    const cancelled = periodAppts?.filter(a => a.status === 'cancelled').length || 0
    const noShow = periodAppts?.filter(a => a.status === 'no_show').length || 0
    const online = periodAppts?.filter(a => a.booked_via === 'online').length || 0
    const convRate = total > 0 ? Math.round((done.length / total) * 100) : 0

    const prevDone = prevAppts?.filter(a => a.status === 'done') || []
    const prevRevenue = prevDone.reduce((s, a) => s + (a.price || 0), 0)
    const prevTotal = prevAppts?.length || 0

    const revenueGrowth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null
    const totalGrowth = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null

    return { revenue, avgCheck, total, done: done.length, cancelled, noShow, online, convRate, revenueGrowth, totalGrowth }
  }, [periodAppts, prevAppts])

  // --- Прибыль и маржинальность ---
  const profitMetrics = useMemo(() => {
    const done = periodAppts?.filter(a => a.status === 'done') || []
    const totalCost = done.reduce((s, a) => {
      const apptSvcs = a.expand?.['appointment_services(appointment)'] as Array<{ service: string }> | undefined
      const svcIds = apptSvcs?.length ? apptSvcs.map(sv => sv.service) : (a.service ? [a.service] : [])
      return s + svcIds.reduce((sc, id) => sc + (serviceCostMap[id] || 0), 0)
    }, 0)
    const profit = metrics.revenue - totalCost
    const marginPct = metrics.revenue > 0 ? Math.round((profit / metrics.revenue) * 100) : 0
    const hasCostData = Object.keys(serviceCostMap).length > 0
    return { profit, marginPct, totalCost, hasCostData }
  }, [periodAppts, metrics.revenue, serviceCostMap])

  // --- Топ-5 услуг за период ---
  const topServices = useMemo(() => {
    if (!periodAppts) return []
    const counts: Record<string, { name: string; count: number; revenue: number }> = {}
    periodAppts.forEach(a => {
      const multiMatch = (a.notes || '').match(/^\[(.+)\]/)
      const names = multiMatch
        ? multiMatch[1].split(',').map(s => s.trim())
        : a.expand?.service?.name ? [a.expand.service.name] : []
      names.forEach(name => {
        if (!counts[name]) counts[name] = { name, count: 0, revenue: 0 }
        counts[name].count++
        if (a.status === 'done') counts[name].revenue += (a.price || 0) / names.length
      })
    })
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [periodAppts])

  // --- Топ клиентов ---
  const topClients = useMemo(() => {
    if (!periodAppts) return []
    const map: Record<string, { name: string; visits: number; revenue: number }> = {}
    periodAppts.filter(a => a.status === 'done').forEach(a => {
      const name = a.expand?.client
        ? `${a.expand.client.first_name} ${a.expand.client.last_name || ''}`.trim()
        : (a.client_name || t('analytics.guest'))
      if (!map[name]) map[name] = { name, visits: 0, revenue: 0 }
      map[name].visits++
      map[name].revenue += a.price || 0
    })
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 6)
  }, [periodAppts, t])

  // --- Статусы ---
  const statusData = useMemo(() => {
    const total = periodAppts?.length || 0
    if (total === 0) return []
    const scheduled = total - metrics.done - metrics.cancelled - metrics.noShow
    return [
      { key: 'done',      label: t('appointments.status.done'),      count: metrics.done,      pct: Math.round((metrics.done / total) * 100),      color: 'bg-emerald-500' },
      { key: 'scheduled', label: t('appointments.status.scheduled'), count: scheduled,          pct: Math.round((scheduled / total) * 100),          color: 'bg-primary' },
      { key: 'cancelled', label: t('appointments.status.cancelled'), count: metrics.cancelled, pct: Math.round((metrics.cancelled / total) * 100), color: 'bg-destructive' },
      { key: 'no_show',   label: t('appointments.status.no_show'),   count: metrics.noShow,    pct: Math.round((metrics.noShow / total) * 100),    color: 'bg-amber-500' },
    ].filter(s => s.count > 0)
  }, [periodAppts, metrics, t])

  // --- Новые клиенты за месяц ---
  const newClientsThisMonth = useMemo(() => {
    if (!clients) return 0
    return clients.filter(c => c.created && c.created.startsWith(dayjs().format('YYYY-MM'))).length
  }, [clients])

  // --- Ближайшие записи ---
  const upcomingAppts = useMemo(() => {
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD')
    return (todayAppts || [])
      .filter(a => a.status === 'scheduled' && a.start_time > dayjs().format('HH:mm'))
      .concat((weekAppts || []).filter(a => a.date === tomorrow && a.status === 'scheduled'))
      .slice(0, 5)
  }, [todayAppts, weekAppts])

  const lowStockItems = useMemo(
    () => inventory?.filter(i => i.min_quantity != null && i.quantity <= i.min_quantity) ?? [],
    [inventory]
  )

  const isLoading = loadingPeriod

  // Подпись периода под заголовком
  const periodLabel = (() => {
    const now = dayjs()
    switch (period) {
      case 'today':
        return now.format('D MMMM YYYY')
      case '3days':
        return `${now.subtract(2, 'day').format('D')}–${now.format('D MMMM YYYY')}`
      case 'week':
        return `${now.startOf('isoWeek').format('D MMM')} – ${now.endOf('isoWeek').format('D MMM YYYY')}`
      case 'month':
        return now.format('MMMM YYYY')
      case 'quarter': {
        const q = Math.floor(now.month() / 3)
        const qStart = now.month(q * 3).startOf('month')
        const qEnd = qStart.add(2, 'month').endOf('month')
        return `${qStart.format('MMM')} – ${qEnd.format('MMM YYYY')}`
      }
      case 'year':
        return now.format('YYYY')
      case 'custom':
        if (customStart === customEnd) return dayjs(customStart).format('D MMMM YYYY')
        return `${dayjs(customStart).format('D MMM')} – ${dayjs(customEnd).format('D MMM YYYY')}`
    }
  })()

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">{t('dashboard.title')}</h1>
            <p className="text-muted-foreground text-sm mt-0.5 capitalize">
              {dayjs().format('dddd, D MMMM YYYY')}
              <span className="mx-1.5 text-muted-foreground/40">·</span>
              <span className="text-foreground/70 font-medium">{periodLabel}</span>
            </p>
          </div>
        </div>

        {/* Переключатель периода — отдельная строка, всегда в блоке */}
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIODS.map(p => (
            <Button
              key={p.key}
              variant={period === p.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setPeriod(p.key); setCustomOpen(false) }}
            >
              {t(p.labelKey)}
            </Button>
          ))}

          {/* Кнопка произвольного периода */}
          <div className="relative" ref={customRef}>
            <Button
              variant={period === 'custom' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCustomOpen(v => !v)}
              className="flex items-center gap-1.5"
            >
              <CalendarRange className="h-3.5 w-3.5" />
              {period === 'custom'
                ? `${dayjs(customStart).format('D MMM')} – ${dayjs(customEnd).format('D MMM')}`
                : t('analytics.periodCustom')}
            </Button>

            {/* Дропдаун кастомного периода */}
            {customOpen && (
              <div className="absolute left-0 top-full mt-1.5 z-50 bg-white dark:bg-zinc-900 border border-border rounded-xl shadow-xl p-4 flex flex-col gap-3 w-56 backdrop-blur-none">
                <p className="text-xs font-semibold text-foreground">{t('analytics.periodCustom')}</p>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">{t('analytics.customFrom')}</label>
                  <input
                    type="date"
                    value={customStart}
                    max={customEnd}
                    onChange={e => setCustomStart(e.target.value)}
                    className="h-8 px-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary w-full"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">{t('analytics.customTo')}</label>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    max={today}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="h-8 px-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary w-full"
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => { setPeriod('custom'); setCustomOpen(false) }}
                >
                  {t('common.apply')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Метрики за период — 2 колонки на мобильном, 4 на md+ */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {/* Выручка */}
        <FeatureGate feature="analytics_revenue">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg p-1.5 sm:p-2 bg-amber-50 dark:bg-amber-950 shrink-0">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{t('analytics.revenue')}</p>
                {isLoading ? <Skeleton className="h-6 w-20 mt-0.5" /> : (
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <p className="text-lg sm:text-xl font-bold">
                      {new Intl.NumberFormat(i18n.language).format(metrics.revenue)}
                      <span className="text-xs font-medium text-muted-foreground ml-1">{currency}</span>
                    </p>
                    <GrowthBadge value={metrics.revenueGrowth} />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        </FeatureGate>

        {/* Всего записей */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg p-1.5 sm:p-2 bg-blue-50 dark:bg-blue-950 shrink-0">
                <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{t('analytics.totalAppts')}</p>
                {isLoading ? <Skeleton className="h-6 w-12 mt-0.5" /> : (
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <p className="text-lg sm:text-xl font-bold">{metrics.total}</p>
                    <GrowthBadge value={metrics.totalGrowth} />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Средний чек */}
        <FeatureGate feature="analytics_revenue">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg p-1.5 sm:p-2 bg-emerald-50 dark:bg-emerald-950 shrink-0">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{t('analytics.avgCheck')}</p>
                {isLoading ? <Skeleton className="h-6 w-20 mt-0.5" /> : (
                  <p className="text-lg sm:text-xl font-bold">
                    {new Intl.NumberFormat(i18n.language).format(Math.round(metrics.avgCheck))}
                    <span className="text-xs font-medium text-muted-foreground ml-1">{currency}</span>
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        </FeatureGate>

        {/* Конверсия */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg p-1.5 sm:p-2 bg-violet-50 dark:bg-violet-950 shrink-0">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{t('analytics.convRate')}</p>
                {isLoading ? <Skeleton className="h-6 w-12 mt-0.5" /> : (
                  <p className="text-lg sm:text-xl font-bold">{metrics.convRate}%</p>
                )}
                <p className="text-[11px] text-muted-foreground">{t('analytics.convRateHint')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Прибыль + Маржа */}
      <FeatureGate feature="analytics_revenue">
      <div className="grid gap-3 grid-cols-2">
        {/* Прибыль */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg p-1.5 sm:p-2 bg-emerald-50 dark:bg-emerald-950 shrink-0">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{t('analytics.profit')}</p>
                {isLoading ? <Skeleton className="h-6 w-20 mt-0.5" /> : (
                  <p className={`text-lg sm:text-xl font-bold ${profitMetrics.profit < 0 ? 'text-destructive' : ''}`}>
                    {new Intl.NumberFormat(i18n.language).format(profitMetrics.profit)}
                    <span className="text-xs font-medium text-muted-foreground ml-1">{currency}</span>
                  </p>
                )}
                {!profitMetrics.hasCostData && (
                  <p className="text-[11px] text-muted-foreground">{t('analytics.noCostData')}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Маржа */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg p-1.5 sm:p-2 bg-teal-50 dark:bg-teal-950 shrink-0">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-teal-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{t('analytics.margin')}</p>
                {isLoading ? <Skeleton className="h-6 w-12 mt-0.5" /> : (
                  <p className={`text-lg sm:text-xl font-bold ${profitMetrics.marginPct < 0 ? 'text-destructive' : ''}`}>
                    {profitMetrics.marginPct}%
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">{t('analytics.marginHint')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </FeatureGate>

      {/* Дополнительные метрики */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg p-1.5 sm:p-2 bg-violet-50 dark:bg-violet-950 shrink-0">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{t('dashboard.totalClients')}</p>
                <p className="text-lg sm:text-xl font-bold">{clients?.length || 0}</p>
                {newClientsThisMonth > 0 && (
                  <p className="text-[11px] text-emerald-600">+{newClientsThisMonth} {t('dashboard.thisMonth')}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg p-1.5 sm:p-2 bg-emerald-50 dark:bg-emerald-950 shrink-0">
                <ServiceIcon className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{t('dashboard.activeServices')}</p>
                <p className="text-lg sm:text-xl font-bold">{services?.filter(s => s.is_active).length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg p-1.5 sm:p-2 bg-sky-50 dark:bg-sky-950 shrink-0">
                <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-sky-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{t('dashboard.onlineBookings')}</p>
                <p className="text-lg sm:text-xl font-bold">{metrics.online}</p>
                <p className="text-[11px] text-muted-foreground">{t('analytics.periodMonth') === t('analytics.periodMonth') ? '' : ''}{period === 'month' ? t('dashboard.thisMonth') : ''}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg p-1.5 sm:p-2 bg-rose-50 dark:bg-rose-950 shrink-0">
                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-rose-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{t('dashboard.lowStock')}</p>
                <p className="text-lg sm:text-xl font-bold">{lowStockItems.length}</p>
                <p className="text-[11px] text-muted-foreground">{t('dashboard.positions')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ближайшие записи + Статусы */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Ближайшие записи */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t('dashboard.upcoming')}
              </CardTitle>
              <Link to="/calendar" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                {t('dashboard.allAppointments')} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loadingToday ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : upcomingAppts.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                {t('dashboard.noUpcoming')}
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingAppts.map(appt => {
                  const multiMatch = (appt.notes || '').match(/^\[(.+)\]/)
                  const svcName = multiMatch ? multiMatch[1] : (appt.expand?.service?.name || '—')
                  const clientName = appt.expand?.client
                    ? `${appt.expand.client.first_name} ${appt.expand.client.last_name || ''}`.trim()
                    : appt.client_name || t('dashboard.guestClient')
                  const isToday = appt.date === today
                  return (
                    <div key={appt.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-xs font-mono text-muted-foreground shrink-0">
                          {!isToday && <span className="text-primary mr-1">{dayjs(appt.date).format('D MMM')}</span>}
                          {appt.start_time.slice(0, 5)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{clientName}</p>
                          <p className="text-xs text-muted-foreground truncate">{svcName}</p>
                        </div>
                      </div>
                      {appt.price ? (
                        <span className="text-xs font-medium shrink-0 ml-2">{formatCurrency(appt.price, currency, i18n.language)}</span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Статусы записей */}
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
      </div>

      {/* Топ услуг + Топ клиентов */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Топ услуг */}
        <FeatureGate feature="analytics_revenue">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ServiceIcon className="h-4 w-4" />
                {t('dashboard.topServices')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : topServices.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">{t('analytics.noData')}</p>
            ) : (
              <div className="space-y-3">
                {topServices.map((svc, i) => {
                  const maxCount = topServices[0].count
                  return (
                    <div key={svc.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                          <span className="font-medium truncate">{svc.name}</span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
                          <span className="text-xs text-muted-foreground">{svc.count} {t('dashboard.times')}</span>
                          {svc.revenue > 0 && (
                            <span className="text-xs font-medium">{formatCurrency(svc.revenue, currency, i18n.language)}</span>
                          )}
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(svc.count / maxCount) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
        </FeatureGate>

        {/* Топ клиентов */}
        <FeatureGate feature="analytics_clients">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('analytics.topClients')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : topClients.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">{t('analytics.noData')}</p>
            ) : (
              <div className="space-y-1.5">
                {topClients.map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between p-2.5 rounded-lg border">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs text-muted-foreground w-4 shrink-0 font-mono">{i + 1}</span>
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
        </FeatureGate>
      </div>

      {/* Низкий склад */}
      {lowStockItems.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-600" />
              {t('dashboard.lowStock')}
              <Badge variant="warning" className="ml-auto">{lowStockItems.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {lowStockItems.slice(0, 6).map(item => (
                <div key={item.id} className="flex items-center justify-between p-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
                  <span className="text-sm font-medium truncate">{item.name}</span>
                  <span className="text-xs text-amber-700 dark:text-amber-300 font-mono shrink-0 ml-2">
                    {item.quantity} / {item.min_quantity} {item.unit}
                  </span>
                </div>
              ))}
            </div>
            {lowStockItems.length > 6 && (
              <Link to="/inventory" className="mt-2 block text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                {t('dashboard.showAll')} ({lowStockItems.length})
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Виджет команды (только для владельца) */}
      {myTeam?.isOwner && myTeam?.team && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <UsersRound className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{myTeam.team.name}</p>
                <p className="text-xs text-muted-foreground">
                  {teamMembers.length} {t('team.members').toLowerCase()}
                </p>
              </div>
              <Link
                to="/team"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                {t('dashboard.viewTeam')}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
