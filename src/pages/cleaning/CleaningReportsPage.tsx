import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import { formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/orders/OrderStatusBadge'
import { Download, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ORDER_TYPE_LABELS, ORDER_TYPE_ICONS } from '@/hooks/useCleaningOrders'
import type { OrderStatus, OrderType, CleaningOrder } from '@/hooks/useCleaningOrders'
import dayjs from 'dayjs'

const ALL_STATUSES: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all',         label: 'Все'       },
  { value: 'received',    label: 'Принят'    },
  { value: 'in_progress', label: 'В работе'  },
  { value: 'ready',       label: 'Готов'     },
  { value: 'issued',      label: 'Выдан'     },
  { value: 'paid',        label: 'Оплачен'   },
  { value: 'cancelled',   label: 'Отменён'   },
]

const PER_PAGE = 50

function exportCSV(orders: CleaningOrder[], symbol: string) {
  const headers = ['Номер', 'Тип', 'Клиент', 'Статус', `Сумма (${symbol})`, `Оплачено (${symbol})`, 'Дата']
  const rows = orders.map(o => [
    o.number,
    ORDER_TYPE_LABELS[o.order_type] ?? o.order_type,
    o.client
      ? `${o.client.first_name} ${o.client.last_name || ''}`.trim()
      : 'Без клиента',
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

export function CleaningReportsPage() {
  const navigate = useNavigate()
  const symbol = useCurrencySymbol()

  const [dateFrom, setDateFrom] = useState(() => dayjs().startOf('month').format('YYYY-MM-DD'))
  const [dateTo, setDateTo] = useState(() => dayjs().format('YYYY-MM-DD'))
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['cleaning_reports', dateFrom, dateTo, statusFilter, page, PRODUCT],
    queryFn: async () => {
      let q = supabase
        .from('cleaning_orders')
        .select('*, client:clients(id, first_name, last_name, phone)', { count: 'exact' })
        .eq('product', PRODUCT)
        .gte('created_at', dateFrom + 'T00:00:00')
        .lte('created_at', dateTo + 'T23:59:59')
        .order('created_at', { ascending: false })
        .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)

      if (statusFilter !== 'all') {
        q = q.eq('status', statusFilter)
      }

      const { data: rows, error, count } = await q
      if (error) throw error
      return { orders: (rows ?? []) as CleaningOrder[], total: count ?? 0 }
    },
    staleTime: 30_000,
  })

  // All matching orders for totals + export (no pagination)
  const { data: allData } = useQuery({
    queryKey: ['cleaning_reports_all', dateFrom, dateTo, statusFilter, PRODUCT],
    queryFn: async () => {
      let q = supabase
        .from('cleaning_orders')
        .select('*, client:clients(id, first_name, last_name, phone)')
        .eq('product', PRODUCT)
        .gte('created_at', dateFrom + 'T00:00:00')
        .lte('created_at', dateTo + 'T23:59:59')
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        q = q.eq('status', statusFilter)
      }

      const { data: rows, error } = await q
      if (error) throw error
      return (rows ?? []) as CleaningOrder[]
    },
    staleTime: 30_000,
  })

  const orders = data?.orders ?? []
  const totalCount = data?.total ?? 0
  const allOrders = allData ?? []
  const totalPages = Math.ceil(totalCount / PER_PAGE)

  const totalRevenue = allOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
  const totalPaid = allOrders.reduce((s, o) => s + (o.paid_amount ?? 0), 0)

  const handleFilterChange = () => {
    setPage(1)
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader title="Отчёты">
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCSV(allOrders, symbol)}
          disabled={allOrders.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          CSV
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label htmlFor="dateFrom">С</Label>
          <DateInput
            id="dateFrom"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); handleFilterChange() }}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dateTo">По</Label>
          <DateInput
            id="dateTo"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); handleFilterChange() }}
            className="w-40"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {ALL_STATUSES.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setPage(1) }}
              className={
                statusFilter === opt.value
                  ? 'px-3 py-1.5 text-xs font-medium rounded-full bg-primary text-primary-foreground'
                  : 'px-3 py-1.5 text-xs font-medium rounded-full bg-muted text-muted-foreground hover:text-foreground'
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
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
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    Заказов за выбранный период нет
                  </td>
                </tr>
              ) : (
                <>
                  {orders.map(order => {
                    const TypeIcon = ORDER_TYPE_ICONS[order.order_type as OrderType]
                    const clientName = order.client
                      ? `${order.client.first_name} ${order.client.last_name || ''}`.trim()
                      : 'Без клиента'
                    return (
                      <tr
                        key={order.id}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => navigate(`/orders/${order.id}`)}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {order.number}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {TypeIcon && <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />}
                            <span className="whitespace-nowrap">
                              {ORDER_TYPE_LABELS[order.order_type as OrderType] ?? order.order_type}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 max-w-[160px] truncate">{clientName}</td>
                        <td className="px-4 py-3">
                          <OrderStatusBadge status={order.status as OrderStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <PaymentStatusBadge status={order.payment_status} />
                        </td>
                        <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                          {formatCurrency(order.total_amount)} {symbol}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-muted-foreground">
                          {formatCurrency(order.paid_amount)} {symbol}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {dayjs(order.created_at).format('DD.MM.YYYY')}
                        </td>
                      </tr>
                    )
                  })}
                </>
              )}
            </tbody>
            {!isLoading && allOrders.length > 0 && (
              <tfoot>
                <tr className="bg-muted/50 border-t font-medium">
                  <td colSpan={3} className="px-4 py-3">
                    Итого: {totalCount} заказов
                  </td>
                  <td colSpan={2} />
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {formatCurrency(totalRevenue)} {symbol}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {formatCurrency(totalPaid)} {symbol}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Страница {page} из {totalPages} · {totalCount} заказов
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
