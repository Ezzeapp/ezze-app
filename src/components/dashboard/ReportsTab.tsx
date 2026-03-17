import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, CalendarDays, CalendarRange, PieChartIcon } from 'lucide-react'
import { useAppointments } from '@/hooks/useAppointments'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/utils'
import { FeatureGate } from '@/components/shared/FeatureGate'
import dayjs from 'dayjs'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

type Period = 'month' | 'quarter' | 'year' | 'custom'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'month',   label: 'Месяц'   },
  { key: 'quarter', label: 'Квартал' },
  { key: 'year',    label: 'Год'     },
]

function getPeriodRange(period: Period, customStart: string, customEnd: string) {
  const now = dayjs()
  switch (period) {
    case 'month':
      return { start: now.startOf('month').format('YYYY-MM-DD'), end: now.endOf('month').format('YYYY-MM-DD') }
    case 'quarter': {
      const q = Math.floor(now.month() / 3)
      const qs = now.month(q * 3).startOf('month')
      return { start: qs.format('YYYY-MM-DD'), end: qs.add(2, 'month').endOf('month').format('YYYY-MM-DD') }
    }
    case 'year':
      return { start: now.startOf('year').format('YYYY-MM-DD'), end: now.endOf('year').format('YYYY-MM-DD') }
    case 'custom':
      return { start: customStart, end: customEnd }
  }
}

const STATUS_COLORS: Record<string, string> = {
  done:      '#22c55e',
  scheduled: '#6366f1',
  cancelled: '#ef4444',
  no_show:   '#f59e0b',
}

const PAYMENT_COLORS: Record<string, string> = {
  cash:     '#22c55e',
  card:     '#6366f1',
  transfer: '#06b6d4',
  other:    '#94a3b8',
}

export function ReportsTab() {
  const { t, i18n } = useTranslation()
  const currency = useCurrency()

  const [period, setPeriod] = useState<Period>('month')
  const [customStart, setCustomStart] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [customEnd, setCustomEnd] = useState(dayjs().format('YYYY-MM-DD'))
  const today = dayjs().format('YYYY-MM-DD')

  const { start, end } = getPeriodRange(period, customStart, customEnd)
  const { data: appts, isLoading } = useAppointments(start, end)

  // Decide granularity based on range
  const daysDiff = dayjs(end).diff(dayjs(start), 'day')
  const groupBy: 'day' | 'week' | 'month' = daysDiff <= 35 ? 'day' : daysDiff <= 92 ? 'week' : 'month'

  // Revenue & count trend
  const trendData = useMemo(() => {
    const map: Record<string, { date: string; revenue: number; count: number }> = {}
    let cur = dayjs(start)
    const endDay = dayjs(end)
    while (cur.isBefore(endDay) || cur.isSame(endDay, 'day')) {
      let key: string
      let label: string
      if (groupBy === 'day') {
        key   = cur.format('YYYY-MM-DD')
        label = cur.format('D MMM')
      } else if (groupBy === 'week') {
        key   = cur.startOf('isoWeek').format('YYYY-MM-DD')
        label = `${cur.startOf('isoWeek').format('D')}–${cur.endOf('isoWeek').format('D MMM')}`
      } else {
        key   = cur.startOf('month').format('YYYY-MM')
        label = cur.format('MMM')
      }
      if (!map[key]) map[key] = { date: label, revenue: 0, count: 0 }
      cur = groupBy === 'month'
        ? cur.add(1, 'month').startOf('month')
        : groupBy === 'week'
          ? cur.add(1, 'week').startOf('isoWeek')
          : cur.add(1, 'day')
    }
    ;(appts || []).forEach(a => {
      let key: string
      if (groupBy === 'day')        key = a.date
      else if (groupBy === 'week')  key = dayjs(a.date).startOf('isoWeek').format('YYYY-MM-DD')
      else                          key = a.date.slice(0, 7)
      if (map[key]) {
        map[key].count++
        if (a.status === 'done') map[key].revenue += a.price || 0
      }
    })
    return Object.values(map)
  }, [appts, start, end, groupBy])

  // Status pie
  const statusPie = useMemo(() => {
    if (!appts || appts.length === 0) return []
    const counts: Record<string, number> = {}
    appts.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1 })
    return Object.entries(counts).map(([key, value]) => ({
      name:  t(`appointments.status.${key}`),
      value,
      color: STATUS_COLORS[key] || '#94a3b8',
    }))
  }, [appts, t])

  // Payment method pie
  const paymentPie = useMemo(() => {
    if (!appts) return []
    const done = appts.filter(a => a.status === 'done' && a.payment_method)
    if (done.length === 0) return []
    const counts: Record<string, number> = {}
    done.forEach(a => { counts[a.payment_method!] = (counts[a.payment_method!] || 0) + 1 })
    const labels: Record<string, string> = { cash: 'Наличные', card: 'Карта', transfer: 'Перевод', other: 'Другое' }
    return Object.entries(counts).map(([key, value]) => ({
      name:  labels[key] || key,
      value,
      color: PAYMENT_COLORS[key] || '#94a3b8',
    }))
  }, [appts])

  // Top services
  const topServices = useMemo(() => {
    if (!appts) return []
    const counts: Record<string, { name: string; count: number; revenue: number }> = {}
    appts.forEach(a => {
      const multiMatch = (a.notes || '').match(/^\[(.+)\]/)
      const names: string[] = multiMatch
        ? multiMatch[1].split(',').map((s: string) => s.trim())
        : a.expand?.service?.name ? [a.expand.service.name] : []
      names.forEach(name => {
        if (!counts[name]) counts[name] = { name, count: 0, revenue: 0 }
        counts[name].count++
        if (a.status === 'done') counts[name].revenue += (a.price || 0) / names.length
      })
    })
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 6)
  }, [appts])

  const totalRevenue = useMemo(
    () => (appts || []).filter(a => a.status === 'done').reduce((s, a) => s + (a.price || 0), 0),
    [appts]
  )
  const totalCount = appts?.length || 0
  const doneCount  = useMemo(() => (appts || []).filter(a => a.status === 'done').length, [appts])

  // Custom tooltip
  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-background border rounded-lg shadow-lg p-2.5 text-xs space-y-1">
        <p className="font-medium text-foreground">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color || p.fill }}>
            {p.name}:{' '}
            {p.dataKey === 'revenue'
              ? `${new Intl.NumberFormat(i18n.language).format(Math.round(p.value))} ${currency}`
              : p.value}
          </p>
        ))}
      </div>
    )
  }

  const axisStyle = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Period selector */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIODS.map(p => (
            <Button
              key={p.key}
              variant={period === p.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </Button>
          ))}
          <Button
            variant={period === 'custom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('custom')}
            className="flex items-center gap-1.5"
          >
            <CalendarRange className="h-3.5 w-3.5" />
            {period === 'custom'
              ? `${dayjs(customStart).format('D MMM')} – ${dayjs(customEnd).format('D MMM')}`
              : 'Период'}
          </Button>
        </div>
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">С</span>
            <input
              type="date" value={customStart} max={customEnd}
              onChange={e => setCustomStart(e.target.value)}
              className="h-8 px-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-xs text-muted-foreground">по</span>
            <input
              type="date" value={customEnd} min={customStart} max={today}
              onChange={e => setCustomEnd(e.target.value)}
              className="h-8 px-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <FeatureGate feature="analytics_revenue">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-muted-foreground">Выручка</p>
              {isLoading ? <Skeleton className="h-7 w-24 mt-1" /> : (
                <p className="text-xl font-bold mt-0.5">
                  {new Intl.NumberFormat(i18n.language).format(totalRevenue)}
                  <span className="text-xs font-medium text-muted-foreground ml-1">{currency}</span>
                </p>
              )}
            </CardContent>
          </Card>
        </FeatureGate>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs text-muted-foreground">Записей</p>
            {isLoading ? <Skeleton className="h-7 w-12 mt-1" /> : (
              <p className="text-xl font-bold mt-0.5">{totalCount}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs text-muted-foreground">Выполнено</p>
            {isLoading ? <Skeleton className="h-7 w-12 mt-1" /> : (
              <p className="text-xl font-bold mt-0.5">
                {doneCount}
                {totalCount > 0 && (
                  <span className="text-xs font-medium text-muted-foreground ml-1.5">
                    {Math.round((doneCount / totalCount) * 100)}%
                  </span>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue trend */}
      <FeatureGate feature="analytics_revenue">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Динамика выручки
              </CardTitle>
              {!isLoading && (
                <span className="text-sm font-semibold">
                  {new Intl.NumberFormat(i18n.language).format(totalRevenue)}
                  <span className="text-xs text-muted-foreground ml-1">{currency}</span>
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : trendData.every(d => d.revenue === 0) ? (
              <p className="text-muted-foreground text-sm text-center py-10">Нет данных за период</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={axisStyle} tickLine={false} axisLine={false}
                    tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone" dataKey="revenue" name="Выручка"
                    stroke="#6366f1" fill="url(#revGrad)" strokeWidth={2} dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </FeatureGate>

      {/* Appointment count BarChart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Количество записей
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : trendData.every(d => d.count === 0) ? (
            <p className="text-muted-foreground text-sm text-center py-8">Нет данных за период</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={trendData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Записей" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Status + Payment pies */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Status breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="h-4 w-4" />
              Статусы записей
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : statusPie.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Нет данных за период</p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="shrink-0">
                  <ResponsiveContainer width={150} height={150}>
                    <PieChart>
                      <Pie data={statusPie} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={65}>
                        {statusPie.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any, n: any) => [v, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 w-full">
                  {statusPie.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: entry.color }} />
                        <span className="text-xs">{entry.name}</span>
                      </div>
                      <span className="text-xs font-semibold">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment methods */}
        <FeatureGate feature="analytics_revenue">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <PieChartIcon className="h-4 w-4" />
                Методы оплаты
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : paymentPie.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Нет данных<br/><span className="text-xs">Укажите метод оплаты при завершении записи</span></p>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="shrink-0">
                    <ResponsiveContainer width={150} height={150}>
                      <PieChart>
                        <Pie data={paymentPie} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={65}>
                          {paymentPie.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any, n: any) => [v, n]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 w-full">
                    {paymentPie.map((entry, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: entry.color }} />
                          <span className="text-xs">{entry.name}</span>
                        </div>
                        <span className="text-xs font-semibold">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </FeatureGate>
      </div>

      {/* Top services */}
      {(isLoading || topServices.length > 0) && (
        <FeatureGate feature="analytics_revenue">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Топ услуг</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
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
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-xs text-muted-foreground">{svc.count} раз</span>
                            {svc.revenue > 0 && (
                              <span className="text-xs font-semibold">
                                {formatCurrency(svc.revenue, currency, i18n.language)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${(svc.count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </FeatureGate>
      )}
    </div>
  )
}
