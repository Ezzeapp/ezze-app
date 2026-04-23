import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DateInput } from '@/components/ui/date-input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users, CalendarDays, TrendingUp, UserCheck,
  CalendarRange, BarChart2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import dayjs from 'dayjs'
import {
  AreaChart, Area, BarChart, Bar,
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

// ── Queries ────────────────────────────────────────────────────────────────────

async function fetchMastersCount() {
  const { count } = await supabase
    .from('master_profiles')
    .select('*', { count: 'exact', head: true })
  return count ?? 0
}

async function fetchTgClientsCount() {
  const { count } = await supabase
    .from('tg_clients')
    .select('*', { count: 'exact', head: true })
  return count ?? 0
}

async function fetchPeriodAppointments(start: string, end: string) {
  const { data } = await supabase
    .from('appointments')
    .select('id, date, status, price, master_id, created_at')
    .gte('date', start)
    .lte('date', end)
  return data || []
}

async function fetchTgClientsAll() {
  const { data } = await supabase
    .from('tg_clients')
    .select('id, created_at')
  return data || []
}

async function fetchTopMasters(start: string, end: string) {
  // Get appointments with master profile name
  const { data } = await supabase
    .from('appointments')
    .select('master_id, price, status, master_profiles!appointments_master_id_fkey(name, phone)')
    .gte('date', start)
    .lte('date', end)
    .eq('status', 'done')
  return data || []
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminReportsTab() {
  const today = dayjs().format('YYYY-MM-DD')

  const [period, setPeriod] = useState<Period>('month')
  const [customStart, setCustomStart] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [customEnd, setCustomEnd] = useState(dayjs().format('YYYY-MM-DD'))

  const { start, end } = getPeriodRange(period, customStart, customEnd)

  // Queries
  const { data: mastersCount = 0, isLoading: loadingMasters } = useQuery({
    queryKey: ['admin_reports', 'masters_count'],
    queryFn: fetchMastersCount,
  })

  const { data: tgClientsCount = 0, isLoading: loadingTgClients } = useQuery({
    queryKey: ['admin_reports', 'tg_clients_count'],
    queryFn: fetchTgClientsCount,
  })

  const { data: periodAppts = [], isLoading: loadingAppts } = useQuery({
    queryKey: ['admin_reports', 'appts', start, end],
    queryFn: () => fetchPeriodAppointments(start, end),
  })

  const { data: allTgClients = [], isLoading: loadingTgAll } = useQuery({
    queryKey: ['admin_reports', 'tg_clients_all'],
    queryFn: fetchTgClientsAll,
  })

  const { data: rawTopMasters = [], isLoading: loadingTopMasters } = useQuery({
    queryKey: ['admin_reports', 'top_masters', start, end],
    queryFn: () => fetchTopMasters(start, end),
  })

  const isLoading = loadingMasters || loadingTgClients || loadingAppts || loadingTgAll

  // KPI metrics
  const kpi = useMemo(() => {
    const done       = periodAppts.filter((a: any) => a.status === 'done')
    const revenue    = done.reduce((s: number, a: any) => s + (a.price || 0), 0)
    const totalCount = periodAppts.length
    const doneCount  = done.length
    const convRate   = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
    return { revenue, totalCount, doneCount, convRate }
  }, [periodAppts])

  // Appointments trend
  const daysDiff = dayjs(end).diff(dayjs(start), 'day')
  const groupBy: 'day' | 'week' | 'month' = daysDiff <= 35 ? 'day' : daysDiff <= 92 ? 'week' : 'month'

  const apptTrend = useMemo(() => {
    const map: Record<string, { date: string; count: number; revenue: number }> = {}
    let cur = dayjs(start)
    const endDay = dayjs(end)
    while (cur.isBefore(endDay) || cur.isSame(endDay, 'day')) {
      let key: string, label: string
      if (groupBy === 'day') {
        key = cur.format('YYYY-MM-DD'); label = cur.format('D MMM')
      } else if (groupBy === 'week') {
        key = cur.startOf('isoWeek').format('YYYY-MM-DD')
        label = `${cur.startOf('isoWeek').format('D')}–${cur.endOf('isoWeek').format('D MMM')}`
      } else {
        key = cur.startOf('month').format('YYYY-MM'); label = cur.format('MMM')
      }
      if (!map[key]) map[key] = { date: label, count: 0, revenue: 0 }
      cur = groupBy === 'month'
        ? cur.add(1, 'month').startOf('month')
        : groupBy === 'week' ? cur.add(1, 'week').startOf('isoWeek')
        : cur.add(1, 'day')
    }
    periodAppts.forEach((a: any) => {
      let key: string
      if (groupBy === 'day')       key = a.date
      else if (groupBy === 'week') key = dayjs(a.date).startOf('isoWeek').format('YYYY-MM-DD')
      else                         key = a.date.slice(0, 7)
      if (map[key]) {
        map[key].count++
        if (a.status === 'done') map[key].revenue += a.price || 0
      }
    })
    return Object.values(map)
  }, [periodAppts, start, end, groupBy])

  // TG clients registrations trend (last 12 weeks or 12 months depending on period)
  const tgTrend = useMemo(() => {
    const map: Record<string, { date: string; count: number }> = {}
    const rangeStart = daysDiff <= 92 ? dayjs(start).startOf('isoWeek') : dayjs(start).startOf('month')
    let cur = rangeStart
    const endDay = dayjs(end)
    while (cur.isBefore(endDay) || cur.isSame(endDay, 'day')) {
      const useWeek = daysDiff <= 92
      const key   = useWeek ? cur.startOf('isoWeek').format('YYYY-MM-DD') : cur.format('YYYY-MM')
      const label = useWeek
        ? `${cur.startOf('isoWeek').format('D')}–${cur.endOf('isoWeek').format('D MMM')}`
        : cur.format('MMM')
      if (!map[key]) map[key] = { date: label, count: 0 }
      cur = useWeek ? cur.add(1, 'week').startOf('isoWeek') : cur.add(1, 'month').startOf('month')
    }
    allTgClients.forEach((c: any) => {
      const created = c.created_at?.slice(0, 10)
      if (!created || created < start || created > end) return
      const useWeek = daysDiff <= 92
      const key = useWeek
        ? dayjs(created).startOf('isoWeek').format('YYYY-MM-DD')
        : created.slice(0, 7)
      if (map[key]) map[key].count++
    })
    return Object.values(map)
  }, [allTgClients, start, end, daysDiff])

  // Top masters
  const topMasters = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number }> = {}
    rawTopMasters.forEach((a: any) => {
      const id    = a.master_id
      const prof  = a.master_profiles as any
      const name  = prof?.name || prof?.phone || id?.slice(0, 8) || '—'
      if (!map[id]) map[id] = { name, count: 0, revenue: 0 }
      map[id].count++
      map[id].revenue += a.price || 0
    })
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 8)
  }, [rawTopMasters])

  const axisStyle = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' }

  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-background border rounded-lg shadow-lg p-2.5 text-xs space-y-1">
        <p className="font-medium">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color || p.fill }}>
            {p.name}: {p.dataKey === 'revenue'
              ? `${new Intl.NumberFormat('ru').format(Math.round(p.value))} сум`
              : p.value}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
            <DateInput
              value={customStart} max={customEnd}
              onChange={e => setCustomStart(e.target.value)}
              className="h-8 px-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-xs text-muted-foreground">по</span>
            <DateInput
              value={customEnd} min={customStart} max={today}
              onChange={e => setCustomEnd(e.target.value)}
              className="h-8 px-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg p-2 bg-violet-50 dark:bg-violet-950 shrink-0">
                <Users className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Мастеров</p>
                {loadingMasters
                  ? <Skeleton className="h-6 w-12 mt-0.5" />
                  : <p className="text-xl font-bold">{mastersCount}</p>
                }
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg p-2 bg-sky-50 dark:bg-sky-950 shrink-0">
                <UserCheck className="h-4 w-4 text-sky-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">TG клиентов</p>
                {loadingTgClients
                  ? <Skeleton className="h-6 w-12 mt-0.5" />
                  : <p className="text-xl font-bold">{tgClientsCount}</p>
                }
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg p-2 bg-blue-50 dark:bg-blue-950 shrink-0">
                <CalendarDays className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Записей</p>
                {isLoading
                  ? <Skeleton className="h-6 w-12 mt-0.5" />
                  : <p className="text-xl font-bold">{kpi.totalCount}</p>
                }
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg p-2 bg-amber-50 dark:bg-amber-950 shrink-0">
                <TrendingUp className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Выручка</p>
                {isLoading
                  ? <Skeleton className="h-6 w-20 mt-0.5" />
                  : <p className="text-xl font-bold">
                      {new Intl.NumberFormat('ru').format(kpi.revenue)}
                    </p>
                }
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Appointments trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Записи на платформе
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-52 w-full" />
          ) : apptTrend.every(d => d.count === 0) ? (
            <p className="text-muted-foreground text-sm text-center py-10">Нет записей за период</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={apptTrend} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="apptGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone" dataKey="count" name="Записей"
                  stroke="#6366f1" fill="url(#apptGrad)" strokeWidth={2} dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* TG Clients registrations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Регистрации в Telegram
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTgAll ? (
            <Skeleton className="h-44 w-full" />
          ) : tgTrend.every(d => d.count === 0) ? (
            <p className="text-muted-foreground text-sm text-center py-8">Нет регистраций за период</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={tgTrend} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Клиентов" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top masters */}
      {(loadingTopMasters || topMasters.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              Топ мастеров по выручке
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTopMasters ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {topMasters.map((m, i) => {
                  const maxRev = topMasters[0].revenue
                  return (
                    <div key={m.name + i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                          <span className="font-medium truncate">{m.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-xs text-muted-foreground">{m.count} записей</span>
                          <span className="text-xs font-semibold">
                            {new Intl.NumberFormat('ru').format(m.revenue)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: `${maxRev > 0 ? (m.revenue / maxRev) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
