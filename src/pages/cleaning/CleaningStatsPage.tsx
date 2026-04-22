import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import { formatCurrency, cn } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2, CalendarRange, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { ORDER_TYPE_LABELS } from '@/hooks/useCleaningOrders'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/orders/OrderStatusBadge'
import type { OrderStatus, OrderType } from '@/hooks/useCleaningOrders'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  received:    '#6366f1',
  in_progress: '#f59e0b',
  ready:       '#10b981',
  issued:      '#8b5cf6',
  paid:        '#22c55e',
  cancelled:   '#ef4444',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash:     'Наличные',
  card:     'Карта',
  transfer: 'Перевод',
  mixed:    'Смешанная',
}

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  cash:     '#22c55e',
  card:     '#3b82f6',
  transfer: '#f59e0b',
  mixed:    '#8b5cf6',
}

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--background))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '13px',
}

const PERIOD_PRESETS = [
  { label: '7 дн',  days: 7 },
  { label: '30 дн', days: 30 },
  { label: '90 дн', days: 90 },
]

const ALL_STATUSES = [
  { value: 'all',         label: 'Все' },
  { value: 'received',    label: 'Принят' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'ready',       label: 'Готов' },
  { value: 'issued',      label: 'Выдан' },
  { value: 'paid',        label: 'Оплачен' },
  { value: 'cancelled',   label: 'Отменён' },
]

type StatTab = 'overview' | 'debts' | 'orders' | 'clients' | 'services' | 'finance'

const TABS: { id: StatTab; label: string }[] = [
  { id: 'overview',  label: 'Сводка' },
  { id: 'debts',     label: 'Задолженности' },
  { id: 'orders',    label: 'Заказы' },
  { id: 'clients',   label: 'Клиенты' },
  { id: 'services',  label: 'Услуги' },
  { id: 'finance',   label: 'Финансы' },
]

// ── Types ──────────────────────────────────────────────────────────────────────

type OrderRow = {
  id: string
  number: string
  status: string
  payment_status: string
  payment_method: string | null
  total_amount: number
  paid_amount: number
  created_at: string
  order_type: string
  client_id: string | null
  client: { id: string; first_name: string; last_name: string | null; phone: string | null } | null
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function SummaryCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-sm text-muted-foreground mb-1">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

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

function GenericTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const entry = payload[0]?.payload
  return (
    <div style={TOOLTIP_STYLE} className="p-2.5 shadow-lg">
      <p className="text-xs">{entry?.name ?? entry?.label}: <span className="font-medium">{payload[0]?.value}</span></p>
    </div>
  )
}

function exportCSV(orders: OrderRow[], symbol: string) {
  const headers = ['Номер', 'Тип', 'Клиент', 'Статус', `Сумма (${symbol})`, `Оплачено (${symbol})`, 'Дата']
  const rows = orders.map(o => [
    o.number,
    ORDER_TYPE_LABELS[o.order_type as OrderType] ?? o.order_type,
    o.client ? `${o.client.first_name} ${o.client.last_name || ''}`.trim() : 'Без клиента',
    o.status,
    o.total_amount,
    o.paid_amount,
    dayjs(o.created_at).format('DD.MM.YYYY'),
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `orders-${dayjs().format('YYYY-MM-DD')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Orders tab ─────────────────────────────────────────────────────────────────

const ORDERS_PER_PAGE = 50

function OrdersTab({ orders: allOrders, symbol }: { orders: OrderRow[]; symbol: string }) {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const filtered = statusFilter === 'all' ? allOrders : allOrders.filter(o => o.status === statusFilter)
  const totalPages = Math.ceil(filtered.length / ORDERS_PER_PAGE)
  const paged = filtered.slice((page - 1) * ORDERS_PER_PAGE, page * ORDERS_PER_PAGE)
  const totalRevenue = filtered.reduce((s, o) => s + (o.total_amount ?? 0), 0)
  const totalPaid = filtered.reduce((s, o) => s + (o.paid_amount ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-1">
          {ALL_STATUSES.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setPage(1) }}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
                statusFilter === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => exportCSV(filtered, symbol)} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          CSV
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">№</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Тип</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Клиент</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Статус</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Оплата</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Сумма</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Оплачено</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Дата</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">Нет заказов за выбранный период</td>
                </tr>
              ) : (
                paged.map(order => {
                  const clientName = order.client
                    ? `${order.client.first_name} ${order.client.last_name || ''}`.trim()
                    : 'Без клиента'
                  return (
                    <tr
                      key={order.id}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/orders/${order.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{order.number}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{ORDER_TYPE_LABELS[order.order_type as OrderType] ?? order.order_type}</td>
                      <td className="px-4 py-3 max-w-[160px] truncate">{clientName}</td>
                      <td className="px-4 py-3"><OrderStatusBadge status={order.status as OrderStatus} /></td>
                      <td className="px-4 py-3"><PaymentStatusBadge status={order.payment_status as any} /></td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatCurrency(order.total_amount)} {symbol}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-muted-foreground">{formatCurrency(order.paid_amount)} {symbol}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{dayjs(order.created_at).format('DD.MM.YYYY')}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-muted/50 border-t font-medium">
                  <td colSpan={3} className="px-4 py-3 text-sm">Итого: {filtered.length} заказов</td>
                  <td colSpan={2} />
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrency(totalRevenue)} {symbol}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrency(totalPaid)} {symbol}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Страница {page} из {totalPages} · {filtered.length} заказов</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function CleaningStatsPage() {
  const { t } = useTranslation()
  const symbol = useCurrencySymbol()

  const [activeTab, setActiveTab] = useState<StatTab>('overview')
  const [days, setDays] = useState(30)
  const [customMode, setCustomMode] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const STATUS_LABELS: Record<string, string> = {
    received:    t('orders.status.received'),
    in_progress: t('orders.status.inProgress'),
    ready:       t('orders.status.ready'),
    issued:      t('orders.status.issued'),
    paid:        t('orders.status.paid'),
    cancelled:   t('orders.status.cancelled'),
  }

  // Date range
  const since = customMode && dateFrom
    ? dayjs(dateFrom).startOf('day').toISOString()
    : dayjs().subtract(days, 'day').startOf('day').toISOString()
  const until = customMode && dateTo
    ? dayjs(dateTo).endOf('day').toISOString()
    : dayjs().endOf('day').toISOString()
  const chartDays = customMode && dateFrom && dateTo
    ? Math.max(1, dayjs(dateTo).diff(dayjs(dateFrom), 'day') + 1)
    : customMode && dateFrom
    ? dayjs().diff(dayjs(dateFrom), 'day') + 1
    : days
  const qKey = customMode ? `custom-${dateFrom}-${dateTo}` : String(days)

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: ordersData, isLoading: loadingOrders } = useQuery({
    queryKey: ['cleaning_stats', 'orders_v2', qKey, PRODUCT],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cleaning_orders')
        .select('id, number, status, payment_status, payment_method, total_amount, paid_amount, created_at, order_type, client_id, client:clients(id, first_name, last_name, phone)')
        .eq('product', PRODUCT)
        .gte('created_at', since)
        .lte('created_at', until)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as OrderRow[]
    },
    staleTime: 60_000,
  })

  const { data: itemsData, isLoading: loadingItems } = useQuery({
    queryKey: ['cleaning_stats', 'items', qKey, PRODUCT],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cleaning_order_items')
        .select('item_type_name, order:cleaning_orders!inner(product, created_at, status)')
        .eq('order.product', PRODUCT)
        .gte('order.created_at', since)
        .lte('order.created_at', until)
      if (error) throw error
      return (data ?? []) as { item_type_name: string }[]
    },
    staleTime: 60_000,
  })

  const isLoading = loadingOrders || loadingItems
  const allOrders = ordersData ?? []
  const nonCancelled = allOrders.filter(o => o.status !== 'cancelled')

  // ── Derived metrics ───────────────────────────────────────────────────────────

  const revenue = nonCancelled.reduce((s, o) => s + (o.total_amount ?? 0), 0)
  const ordersCount = nonCancelled.length
  const avgCheck = ordersCount > 0 ? Math.round(revenue / ordersCount) : 0
  const unpaidAmount = nonCancelled
    .filter(o => o.payment_status !== 'paid')
    .reduce((s, o) => s + Math.max(0, (o.total_amount ?? 0) - (o.paid_amount ?? 0)), 0)
  const totalPaid = nonCancelled.reduce((s, o) => s + (o.paid_amount ?? 0), 0)

  // Daily revenue chart
  const startDate = customMode && dateFrom ? dayjs(dateFrom) : dayjs().subtract(days - 1, 'day')
  const dailyMap: Record<string, number> = {}
  for (let i = 0; i < chartDays; i++) {
    dailyMap[startDate.add(i, 'day').format('DD.MM')] = 0
  }
  nonCancelled.forEach(o => {
    const key = dayjs(o.created_at).format('DD.MM')
    if (key in dailyMap) dailyMap[key] += o.total_amount ?? 0
  })
  const dailyData = Object.entries(dailyMap).map(([date, value]) => ({ date, value, __symbol: symbol }))

  // Status pie
  const statusMap: Record<string, number> = {}
  allOrders.forEach(o => { statusMap[o.status] = (statusMap[o.status] ?? 0) + 1 })
  const statusData = Object.entries(statusMap).map(([name, value]) => ({
    name, label: STATUS_LABELS[name] ?? name, value, color: STATUS_COLORS[name] ?? '#94a3b8',
  }))

  // Top items by count
  const serviceMap: Record<string, number> = {}
  ;(itemsData ?? []).forEach(i => {
    const name = i.item_type_name || 'Без названия'
    serviceMap[name] = (serviceMap[name] ?? 0) + 1
  })
  const topServices = Object.entries(serviceMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  // Order type breakdown
  const typeMap: Record<string, { count: number; revenue: number }> = {}
  nonCancelled.forEach(o => {
    const tp = o.order_type || 'other'
    if (!typeMap[tp]) typeMap[tp] = { count: 0, revenue: 0 }
    typeMap[tp].count++
    typeMap[tp].revenue += o.total_amount ?? 0
  })
  const typeData = Object.entries(typeMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([type, { count, revenue: rev }]) => ({
      name: ORDER_TYPE_LABELS[type as OrderType] ?? type,
      count,
      revenue: rev,
      avgCheck: count > 0 ? Math.round(rev / count) : 0,
    }))

  // Payment method breakdown
  const methodMap: Record<string, { count: number; revenue: number }> = {}
  nonCancelled.forEach(o => {
    const m = o.payment_method || 'cash'
    if (!methodMap[m]) methodMap[m] = { count: 0, revenue: 0 }
    methodMap[m].count++
    methodMap[m].revenue += o.total_amount ?? 0
  })
  const methodData = Object.entries(methodMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([method, { count, revenue: rev }]) => ({
      name: PAYMENT_METHOD_LABELS[method] ?? method,
      method,
      count,
      revenue: rev,
      color: PAYMENT_METHOD_COLORS[method] ?? '#94a3b8',
    }))

  // Client aggregation
  const clientMap: Record<string, { name: string; phone: string | null; count: number; revenue: number; debt: number; lastOrder: string }> = {}
  nonCancelled.forEach(o => {
    if (!o.client_id || !o.client) return
    const id = o.client_id
    if (!clientMap[id]) {
      clientMap[id] = {
        name: `${o.client.first_name} ${o.client.last_name || ''}`.trim(),
        phone: o.client.phone ?? null,
        count: 0, revenue: 0, debt: 0,
        lastOrder: dayjs(o.created_at).format('DD.MM.YYYY'),
      }
    }
    clientMap[id].count++
    clientMap[id].revenue += o.total_amount ?? 0
    if (o.payment_status !== 'paid') {
      clientMap[id].debt += Math.max(0, (o.total_amount ?? 0) - (o.paid_amount ?? 0))
    }
  })
  const topClients = Object.values(clientMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 30)
  const clientsWithDebt = Object.values(clientMap)
    .filter(c => c.debt > 0)
    .sort((a, b) => b.debt - a.debt)

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <h1 className="text-2xl font-semibold">{t('cleaning.stats.title')}</h1>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {PERIOD_PRESETS.map(opt => (
            <button
              key={opt.days}
              onClick={() => { setDays(opt.days); setCustomMode(false) }}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                !customMode && days === opt.days
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => setCustomMode(v => !v)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1',
              customMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            Период
          </button>
        </div>
      </div>

      {/* Custom date range */}
      {customMode && (
        <div className="flex items-end gap-3 flex-wrap rounded-xl border bg-muted/30 px-4 py-3 mb-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('cleaning.period.from')}</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('cleaning.period.to')}</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 h-8 text-sm" />
          </div>
          {(dateFrom || dateTo) && (
            <p className="text-xs text-muted-foreground pb-1">
              {dateFrom && dateTo
                ? `${dayjs(dateFrom).format('DD.MM.YYYY')} — ${dayjs(dateTo).format('DD.MM.YYYY')}`
                : dateFrom ? `с ${dayjs(dateFrom).format('DD.MM.YYYY')}` : `по ${dayjs(dateTo).format('DD.MM.YYYY')}`}
            </p>
          )}
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex border-b overflow-x-auto scrollbar-none">
        {TABS.map(tabDef => (
          <button
            key={tabDef.id}
            onClick={() => setActiveTab(tabDef.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap shrink-0',
              activeTab === tabDef.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tabDef.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      <div className="mt-6">
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* ── Обзор ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard title={t('cleaning.stats.revenue')} value={`${formatCurrency(revenue)} ${symbol}`} />
                <SummaryCard title={t('cleaning.stats.orders')} value={String(ordersCount)} />
                <SummaryCard title={t('cleaning.stats.avgCheck')} value={`${formatCurrency(avgCheck)} ${symbol}`} />
                <SummaryCard title={t('cleaning.stats.unpaid')} value={`${formatCurrency(unpaidAmount)} ${symbol}`} />
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t('cleaning.stats.revenueByDay')}</CardTitle>
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
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval={chartDays <= 7 ? 0 : chartDays <= 30 ? 4 : 9} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}к` : String(v)} />
                      <Tooltip content={<RevenueTooltip />} />
                      <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#colorRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Топ услуг — компактная таблица */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t('cleaning.stats.topServices')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {topServices.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">{t('cleaning.stats.noData')}</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Позиция</th>
                            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Кол-во</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topServices.slice(0, 6).map((row, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="px-4 py-2">{row.name}</td>
                              <td className="px-4 py-2 text-right font-medium">{row.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>

                {/* Статусы заказов — компактная таблица */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t('cleaning.stats.orderStatuses')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {statusData.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">{t('cleaning.stats.noData')}</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Статус</th>
                            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Заказов</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statusData.map((row, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                                  {row.label}
                                </div>
                              </td>
                              <td className="px-4 py-2 text-right font-medium">{row.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ── Задолженности ── */}
          {activeTab === 'debts' && (
            <div className="space-y-4">
              {/* Итоговые карточки */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <SummaryCard
                  title="Общий долг"
                  value={`${formatCurrency(unpaidAmount)} ${symbol}`}
                />
                <SummaryCard
                  title="Клиентов с долгом"
                  value={String(clientsWithDebt.length)}
                />
                <SummaryCard
                  title="Заказов не оплачено"
                  value={String(nonCancelled.filter(o => o.payment_status !== 'paid').length)}
                />
              </div>

              {clientsWithDebt.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                  <p className="text-base font-medium">Долгов нет</p>
                  <p className="text-sm mt-1">Все заказы за выбранный период оплачены</p>
                </div>
              ) : (
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Клиенты с задолженностью</CardTitle>
                    <button
                      onClick={() => {
                        const rows = clientsWithDebt.map(c => [c.name, c.phone ?? '—', c.debt].join(','))
                        const csv = [`Клиент,Телефон,Долг (${symbol})`, ...rows].join('\n')
                        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url; a.download = 'debts.csv'; a.click()
                        URL.revokeObjectURL(url)
                      }}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      CSV
                    </button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">#</th>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Клиент</th>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Телефон</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Заказов</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Сумма долга</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Последний заказ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientsWithDebt.map((c, i) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="px-4 py-2.5 text-muted-foreground text-xs">{i + 1}</td>
                              <td className="px-4 py-2.5 font-medium">{c.name}</td>
                              <td className="px-4 py-2.5 text-muted-foreground">{c.phone ?? '—'}</td>
                              <td className="px-4 py-2.5 text-right">{c.count}</td>
                              <td className="px-4 py-2.5 text-right text-destructive font-semibold whitespace-nowrap">
                                {formatCurrency(c.debt)} {symbol}
                              </td>
                              <td className="px-4 py-2.5 text-right text-muted-foreground whitespace-nowrap">{c.lastOrder}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t bg-muted/50 font-medium">
                            <td colSpan={4} className="px-4 py-2.5 text-sm">{clientsWithDebt.length} клиентов</td>
                            <td className="px-4 py-2.5 text-right text-destructive whitespace-nowrap">
                              {formatCurrency(unpaidAmount)} {symbol}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ── Заказы ── */}
          {activeTab === 'orders' && (
            <OrdersTab orders={allOrders} symbol={symbol} />
          )}

          {/* ── Клиенты ── */}
          {activeTab === 'clients' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <SummaryCard title="Клиентов с заказами" value={String(Object.keys(clientMap).length)} />
                <SummaryCard title="Заказов без клиента" value={String(nonCancelled.filter(o => !o.client_id).length)} />
                <SummaryCard title="Клиентов с долгом" value={String(clientsWithDebt.length)} />
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Топ клиентов по выручке</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {topClients.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Нет данных</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">#</th>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Клиент</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Заказов</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Выручка</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Долг</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topClients.map((c, i) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="px-4 py-2.5 text-muted-foreground text-xs">{i + 1}</td>
                              <td className="px-4 py-2.5">
                                <p className="font-medium">{c.name}</p>
                                {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                              </td>
                              <td className="px-4 py-2.5 text-right">{c.count}</td>
                              <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap">{formatCurrency(c.revenue)} {symbol}</td>
                              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                {c.debt > 0
                                  ? <span className="text-destructive font-medium">{formatCurrency(c.debt)} {symbol}</span>
                                  : <span className="text-muted-foreground">—</span>
                                }
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
          )}

          {/* ── Услуги ── */}
          {activeTab === 'services' && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">По типу заказа</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {typeData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Нет данных</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Тип</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Заказов</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Выручка</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Средний чек</th>
                          </tr>
                        </thead>
                        <tbody>
                          {typeData.map((row, i) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="px-4 py-2.5 font-medium">{row.name}</td>
                              <td className="px-4 py-2.5 text-right">{row.count}</td>
                              <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap">{formatCurrency(row.revenue)} {symbol}</td>
                              <td className="px-4 py-2.5 text-right text-muted-foreground whitespace-nowrap">{formatCurrency(row.avgCheck)} {symbol}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Топ позиций по количеству</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {topServices.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Нет данных</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">#</th>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Позиция</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Кол-во</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topServices.map((row, i) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="px-4 py-2.5 text-muted-foreground text-xs">{i + 1}</td>
                              <td className="px-4 py-2.5 font-medium">{row.name}</td>
                              <td className="px-4 py-2.5 text-right">{row.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Финансы ── */}
          {activeTab === 'finance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard title="Выручка" value={`${formatCurrency(revenue)} ${symbol}`} />
                <SummaryCard title="Оплачено" value={`${formatCurrency(totalPaid)} ${symbol}`} />
                <SummaryCard title="Долг" value={`${formatCurrency(unpaidAmount)} ${symbol}`} />
                <SummaryCard
                  title="Оплачено заказов"
                  value={`${nonCancelled.filter(o => o.payment_status === 'paid').length} из ${ordersCount}`}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">По способу оплаты</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {methodData.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Нет данных</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Способ</th>
                              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Заказов</th>
                              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Выручка</th>
                            </tr>
                          </thead>
                          <tbody>
                            {methodData.map((row, i) => (
                              <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                                    {row.name}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-right">{row.count}</td>
                                <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap">{formatCurrency(row.revenue)} {symbol}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Распределение оплат</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {methodData.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Нет данных</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={methodData} cx="50%" cy="50%" outerRadius={80} dataKey="revenue" labelLine={false}>
                            {methodData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                          </Pie>
                          <Legend />
                          <Tooltip formatter={(value: any) => [`${formatCurrency(Number(value) || 0)} ${symbol}`, 'Выручка']} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

            </div>
          )}
        </>
      )}
      </div>
    </div>
  )
}
