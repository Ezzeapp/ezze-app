import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import { formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import dayjs from 'dayjs'

const STATUS_COLORS: Record<string, string> = {
  received:    '#6366f1',
  in_progress: '#f59e0b',
  ready:       '#10b981',
  issued:      '#8b5cf6',
  paid:        '#22c55e',
  cancelled:   '#ef4444',
}

const STATUS_LABELS: Record<string, string> = {
  received:    'Принят',
  in_progress: 'В работе',
  ready:       'Готов',
  issued:      'Выдан',
  paid:        'Оплачен',
  cancelled:   'Отменён',
}

const PERIOD_OPTIONS = [
  { label: '7 дней',  days: 7 },
  { label: '30 дней', days: 30 },
  { label: '90 дней', days: 90 },
]

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--background))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '13px',
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-sm text-muted-foreground mb-1">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}

// Custom tooltip components (typed as any to avoid recharts v3 strict types)
function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const symbol = payload[0]?.payload?.__symbol ?? ''
  return (
    <div style={TOOLTIP_STYLE} className="p-2.5 shadow-lg">
      <p className="font-medium text-xs mb-1">{label}</p>
      <p className="text-xs text-primary">{formatCurrency(payload[0]?.value ?? 0)} {symbol}</p>
    </div>
  )
}

function ServicesTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={TOOLTIP_STYLE} className="p-2.5 shadow-lg">
      <p className="text-xs">{payload[0]?.payload?.name}: <span className="font-medium">{payload[0]?.value}</span></p>
    </div>
  )
}

function StatusTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const entry = payload[0]?.payload
  return (
    <div style={TOOLTIP_STYLE} className="p-2.5 shadow-lg">
      <p className="text-xs">{entry?.label ?? entry?.name}: <span className="font-medium">{entry?.value}</span></p>
    </div>
  )
}

export function CleaningStatsPage() {
  const [days, setDays] = useState(30)
  const symbol = useCurrencySymbol()

  const since = dayjs().subtract(days, 'day').startOf('day').toISOString()

  // ── Summary + daily revenue ───────────────────────────────────────────────
  const { data: ordersData, isLoading: loadingOrders } = useQuery({
    queryKey: ['cleaning_stats', 'orders', days, PRODUCT],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cleaning_orders')
        .select('status, payment_status, total_amount, paid_amount, created_at')
        .eq('product', PRODUCT)
        .gte('created_at', since)

      if (error) throw error
      return (data ?? []) as {
        status: string
        payment_status: string
        total_amount: number
        paid_amount: number
        created_at: string
      }[]
    },
    staleTime: 60_000,
  })

  // ── Top services ──────────────────────────────────────────────────────────
  const { data: itemsData, isLoading: loadingItems } = useQuery({
    queryKey: ['cleaning_stats', 'items', days, PRODUCT],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cleaning_order_items')
        .select('item_type_name, order:cleaning_orders!inner(product, created_at)')
        .eq('order.product', PRODUCT)
        .gte('order.created_at', since)

      if (error) throw error
      return (data ?? []) as { item_type_name: string }[]
    },
    staleTime: 60_000,
  })

  const isLoading = loadingOrders || loadingItems

  // ── Derived metrics ───────────────────────────────────────────────────────
  const nonCancelled = (ordersData ?? []).filter(o => o.status !== 'cancelled')
  const revenue = nonCancelled.reduce((s, o) => s + (o.total_amount ?? 0), 0)
  const ordersCount = nonCancelled.length
  const avgCheck = ordersCount > 0 ? revenue / ordersCount : 0
  const unpaidAmount = nonCancelled
    .filter(o => o.payment_status !== 'paid')
    .reduce((s, o) => s + Math.max(0, (o.total_amount ?? 0) - (o.paid_amount ?? 0)), 0)

  // Daily revenue chart data — inject symbol for custom tooltip
  const dailyMap: Record<string, number> = {}
  for (let i = days - 1; i >= 0; i--) {
    const key = dayjs().subtract(i, 'day').format('DD.MM')
    dailyMap[key] = 0
  }
  nonCancelled.forEach(o => {
    const key = dayjs(o.created_at).format('DD.MM')
    if (key in dailyMap) dailyMap[key] += o.total_amount ?? 0
  })
  const dailyData = Object.entries(dailyMap).map(([date, value]) => ({ date, value, __symbol: symbol }))

  // Status pie data
  const statusMap: Record<string, number> = {}
  ;(ordersData ?? []).forEach(o => {
    statusMap[o.status] = (statusMap[o.status] ?? 0) + 1
  })
  const statusData = Object.entries(statusMap).map(([name, value]) => ({
    name,
    label: STATUS_LABELS[name] ?? name,
    value,
    color: STATUS_COLORS[name] ?? '#94a3b8',
  }))

  // Top services
  const serviceMap: Record<string, number> = {}
  ;(itemsData ?? []).forEach(i => {
    const name = i.item_type_name || 'Без названия'
    serviceMap[name] = (serviceMap[name] ?? 0) + 1
  })
  const topServices = Object.entries(serviceMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }))

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader title="Статистика">
        {/* Period selector */}
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.days}
              onClick={() => setDays(opt.days)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                days === opt.days
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </PageHeader>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="Выручка"
              value={`${formatCurrency(revenue)} ${symbol}`}
            />
            <SummaryCard
              title="Заказов"
              value={String(ordersCount)}
            />
            <SummaryCard
              title="Средний чек"
              value={`${formatCurrency(avgCheck)} ${symbol}`}
            />
            <SummaryCard
              title="Не оплачено"
              value={`${formatCurrency(unpaidAmount)} ${symbol}`}
            />
          </div>

          {/* Revenue by day */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Выручка по дням</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    interval={days <= 7 ? 0 : days <= 30 ? 4 : 9}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}к` : String(v)}
                  />
                  <Tooltip content={<RevenueTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top services */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Популярные услуги</CardTitle>
              </CardHeader>
              <CardContent>
                {topServices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Нет данных</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={topServices}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<ServicesTooltip />} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Order status pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Статусы заказов</CardTitle>
              </CardHeader>
              <CardContent>
                {statusData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Нет данных</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        dataKey="value"
                        labelLine={false}
                      >
                        {statusData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Legend
                        formatter={(value: string) => {
                          const entry = statusData.find(d => d.name === value)
                          return entry?.label ?? value
                        }}
                      />
                      <Tooltip content={<StatusTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
