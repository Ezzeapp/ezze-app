import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, TrendingUp, Clock, CheckCircle2, AlertTriangle, ClipboardList,
  Wrench, Package, CircleDollarSign,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PRODUCT } from '@/lib/config'
import { formatCurrency, cn } from '@/lib/utils'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import dayjs from 'dayjs'

type Period = 'today' | 'week' | 'month' | 'year' | 'all'

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Сегодня',
  week: '7 дней',
  month: 'Месяц',
  year: 'Год',
  all: 'Всё время',
}

function periodStart(p: Period): string | null {
  if (p === 'all') return null
  if (p === 'today') return dayjs().startOf('day').toISOString()
  if (p === 'week') return dayjs().subtract(7, 'day').toISOString()
  if (p === 'month') return dayjs().startOf('month').toISOString()
  if (p === 'year') return dayjs().startOf('year').toISOString()
  return null
}

export function WorkshopStatsPage() {
  useTranslation()
  const [period, setPeriod] = useState<Period>('month')
  const { data, isLoading } = useWorkshopStats(period)

  if (isLoading || !data) {
    return <div className="p-8 flex justify-center"><LoadingSpinner /></div>
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader title="Статистика" description="Показатели мастерской">
        <Select value={period} onValueChange={v => setPeriod(v as Period)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <SelectItem key={p} value={p}>{PERIOD_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Metric icon={ClipboardList} label="Принято заказов" value={data.total_orders} color="blue" />
        <Metric icon={CheckCircle2} label="Выдано" value={data.issued_count} color="emerald" />
        <Metric icon={AlertTriangle} label="Отказы" value={data.refused_count} color="red" />
        <Metric icon={Clock} label="В работе" value={data.active_count} color="purple" sub="сейчас" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Metric icon={CircleDollarSign} label="Выручка" value={formatCurrency(data.revenue)} color="emerald" raw />
        <Metric icon={Wrench} label="Работы" value={formatCurrency(data.works_revenue)} color="blue" raw />
        <Metric icon={Package} label="Запчасти" value={formatCurrency(data.parts_revenue)} color="orange" raw />
        <Metric icon={TrendingUp} label="Прибыль по запчастям" value={formatCurrency(data.parts_profit)} color="emerald" raw sub="sell − cost" />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Metric icon={CircleDollarSign} label="Средний чек" value={formatCurrency(data.avg_check)} color="blue" raw />
        <Metric icon={Clock} label="Среднее время ремонта" value={`${data.avg_repair_days.toFixed(1)} дн.`} color="purple" raw />
      </div>

      {/* Топ устройств */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Топ устройств</h3>
          </div>
          {data.top_devices.length === 0 ? (
            <div className="text-sm text-muted-foreground">—</div>
          ) : (
            <div className="space-y-2">
              {data.top_devices.map((d, idx) => {
                const max = data.top_devices[0].count
                return (
                  <div key={d.name} className="text-sm">
                    <div className="flex justify-between mb-0.5">
                      <span>{d.name}</span>
                      <span className="text-muted-foreground">{d.count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', idx === 0 ? 'bg-primary' : 'bg-primary/60')}
                        style={{ width: `${(d.count / max) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Статусы заказов</h3>
          </div>
          <div className="space-y-2">
            {data.by_status.map(s => {
              const max = Math.max(...data.by_status.map(x => x.count), 1)
              return (
                <div key={s.status} className="text-sm">
                  <div className="flex justify-between mb-0.5">
                    <span>{s.label}</span>
                    <span className="text-muted-foreground">{s.count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${(s.count / max) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ icon: Icon, label, value, color, sub, raw }: {
  icon: any; label: string; value: number | string; color: string; sub?: string; raw?: boolean
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    orange: 'text-orange-600 dark:text-orange-400',
  }
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className={cn('h-3.5 w-3.5', colorMap[color])} />
        <span className="truncate">{label}</span>
      </div>
      <div className={cn(raw ? 'text-lg font-semibold' : 'text-xl font-bold')}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

// ── Data hook ───────────────────────────────────────────────────────────────
interface WorkshopStats {
  total_orders: number
  issued_count: number
  refused_count: number
  active_count: number
  revenue: number
  works_revenue: number
  parts_revenue: number
  parts_profit: number
  avg_check: number
  avg_repair_days: number
  top_devices: { name: string; count: number }[]
  by_status: { status: string; label: string; count: number }[]
}

const STATUS_LABELS_SHORT: Record<string, string> = {
  received: 'Принят',
  diagnosing: 'Диагностика',
  waiting_approval: 'Ждём клиента',
  waiting_parts: 'Ждём запчасти',
  in_progress: 'В ремонте',
  ready: 'Готов',
  issued: 'Выдан',
  paid: 'Оплачен',
  refused: 'Отказ',
  cancelled: 'Отменён',
}

function useWorkshopStats(period: Period) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['workshop_stats', PRODUCT, period, user?.id],
    queryFn: async (): Promise<WorkshopStats> => {
      const start = periodStart(period)

      // Orders for the period
      let ordersQ = supabase
        .from('workshop_orders')
        .select('id, status, item_type_name, total_amount, works_amount, parts_amount, created_at, issued_at')
        .eq('product', PRODUCT)
      if (start) ordersQ = ordersQ.gte('created_at', start)
      const { data: ordersData } = await ordersQ
      const orders = ordersData ?? []

      const total_orders = orders.length
      const issued_count = orders.filter(o => ['issued', 'paid'].includes(o.status)).length
      const refused_count = orders.filter(o => o.status === 'refused').length
      const active_count = orders.filter(o => ['received', 'diagnosing', 'waiting_approval', 'waiting_parts', 'in_progress'].includes(o.status)).length

      const nonCancelled = orders.filter(o => !['cancelled', 'refused'].includes(o.status))
      const revenue = nonCancelled.reduce((s, o) => s + (o.total_amount ?? 0), 0)
      const works_revenue = nonCancelled.reduce((s, o) => s + (o.works_amount ?? 0), 0)
      const parts_revenue = nonCancelled.reduce((s, o) => s + (o.parts_amount ?? 0), 0)
      const avg_check = nonCancelled.length > 0 ? Math.round(revenue / nonCancelled.length) : 0

      // Среднее время ремонта (для выданных заказов)
      const issued = orders.filter(o => o.issued_at && ['issued', 'paid'].includes(o.status))
      const avg_repair_days = issued.length > 0
        ? issued.reduce((s, o) => s + dayjs(o.issued_at!).diff(dayjs(o.created_at), 'day', true), 0) / issued.length
        : 0

      // Топ устройств
      const deviceCount: Record<string, number> = {}
      orders.forEach(o => {
        const name = o.item_type_name || 'Другое'
        deviceCount[name] = (deviceCount[name] ?? 0) + 1
      })
      const top_devices = Object.entries(deviceCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([name, count]) => ({ name, count }))

      // По статусам
      const statusCount: Record<string, number> = {}
      orders.forEach(o => {
        statusCount[o.status] = (statusCount[o.status] ?? 0) + 1
      })
      const by_status = Object.entries(statusCount)
        .sort(([, a], [, b]) => b - a)
        .map(([status, count]) => ({ status, label: STATUS_LABELS_SHORT[status] ?? status, count }))

      // Прибыль по запчастям (sell - cost) — требует агрегации по parts
      const orderIds = orders.map(o => o.id)
      let parts_profit = 0
      if (orderIds.length > 0) {
        const { data: partsData } = await supabase
          .from('workshop_order_parts')
          .select('sell_price, cost_price, quantity')
          .in('order_id', orderIds)
        parts_profit = (partsData ?? []).reduce((s: number, p: any) =>
          s + ((p.sell_price ?? 0) - (p.cost_price ?? 0)) * (p.quantity ?? 1), 0)
      }

      return {
        total_orders, issued_count, refused_count, active_count,
        revenue, works_revenue, parts_revenue, parts_profit,
        avg_check, avg_repair_days,
        top_devices, by_status,
      }
    },
    enabled: !!user,
    staleTime: 30_000,
  })
}
