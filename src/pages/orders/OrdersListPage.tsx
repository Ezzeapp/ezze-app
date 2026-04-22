import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Plus, Search, ClipboardList, Loader2,
  AlertTriangle, Trash2, Download, CalendarRange, X,
  ArrowUpDown, ArrowUp, ArrowDown, List, Columns3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { toast } from '@/components/shared/Toaster'
import {
  useCleaningOrders,
  useOrdersStats,
  useDeleteOrder,
  ORDER_TYPE_ICONS,
  ORDER_TYPE_LABELS,
  ORDERS_KEY,
  type SortBy,
} from '@/hooks/useCleaningOrders'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/orders/OrderStatusBadge'
import type { OrderStatus, OrderType, PaymentStatus, CleaningOrder } from '@/hooks/useCleaningOrders'
import { formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import dayjs from 'dayjs'
import { cn } from '@/lib/utils'

const NON_URGENT_STATUSES = ['issued', 'paid', 'cancelled']

// ── CSV-экспорт ────────────────────────────────────────────────────────────────
function exportCSV(orders: CleaningOrder[], symbol: string, noClientLabel: string, colLabels: string[]) {
  const headers = colLabels.length === 7 ? colLabels : [
    '#', 'Type', 'Client', 'Status', `Amount (${symbol})`, `Paid (${symbol})`, 'Date',
  ]
  const rows = orders.map(o => [
    o.number,
    ORDER_TYPE_LABELS[o.order_type as OrderType] ?? o.order_type,
    o.client ? `${o.client.first_name} ${o.client.last_name || ''}`.trim() : noClientLabel,
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

// ── Диалог подтверждения удаления ─────────────────────────────────────────────
function DeleteConfirmDialog({ label, onConfirm, onClose, danger = false, confirmDeleteAllLabel, confirmDeleteLabel, cantUndoLabel, cancelLabel, deleteLabel }: {
  label: string
  onConfirm: () => void
  onClose: () => void
  danger?: boolean
  confirmDeleteAllLabel: string
  confirmDeleteLabel: string
  cantUndoLabel: string
  cancelLabel: string
  deleteLabel: string
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl shadow-2xl p-6 w-72 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <Trash2 className="h-6 w-6 text-red-600" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="font-semibold">{danger ? confirmDeleteAllLabel : confirmDeleteLabel}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {danger && <p className="text-xs text-red-500 font-medium">{cantUndoLabel}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" size="sm" onClick={onClose}>{cancelLabel}</Button>
          <Button variant="destructive" className="flex-1" size="sm" onClick={onConfirm}>{deleteLabel}</Button>
        </div>
      </div>
    </div>
  )
}

// ── Иконка сортировки ─────────────────────────────────────────────────────────
function SortIndicator({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30 ml-1" />
  return asc
    ? <ArrowUp   className="h-3 w-3 text-primary ml-1" />
    : <ArrowDown className="h-3 w-3 text-primary ml-1" />
}

// ── Канбан-вид ─────────────────────────────────────────────────────────────────

const KANBAN_COLS: { value: OrderStatus; label: string; accent: string; header: string }[] = [
  { value: 'received',    label: 'Принят',     accent: 'border-t-blue-400',    header: 'bg-blue-50 dark:bg-blue-950/30' },
  { value: 'in_progress', label: 'В работе',   accent: 'border-t-yellow-400',  header: 'bg-yellow-50 dark:bg-yellow-950/30' },
  { value: 'ready',       label: 'Готов',      accent: 'border-t-green-400',   header: 'bg-green-50 dark:bg-green-950/30' },
  { value: 'issued',      label: 'Выдан',      accent: 'border-t-purple-400',  header: 'bg-purple-50 dark:bg-purple-950/30' },
  { value: 'paid',        label: 'Оплачен',    accent: 'border-t-emerald-400', header: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { value: 'cancelled',   label: 'Отменён',    accent: 'border-t-gray-400',    header: 'bg-gray-50 dark:bg-gray-950/30' },
]

function KanbanView({ orders, symbol, onNavigate, isOverdueMap, isDueTodayMap, t }: {
  orders: CleaningOrder[]
  symbol: string
  onNavigate: (id: string) => void
  isOverdueMap: Record<string, boolean>
  isDueTodayMap: Record<string, boolean>
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const qc = useQueryClient()
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const dragCounter = useRef<Record<string, number>>({})

  const grouped = KANBAN_COLS.reduce((acc, col) => {
    acc[col.value] = orders.filter(o => o.status === col.value)
    return acc
  }, {} as Record<string, CleaningOrder[]>)

  async function handleDrop(newStatus: OrderStatus) {
    if (!dragId) return
    const order = orders.find(o => o.id === dragId)
    if (!order || order.status === newStatus) { setDragId(null); setOverCol(null); return }
    try {
      await supabase.from('cleaning_orders').update({ status: newStatus }).eq('id', dragId)
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'list'] })
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'stats'] })
    } catch { /* ignore */ }
    setDragId(null); setOverCol(null)
    dragCounter.current = {}
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2" style={{ minHeight: 'min(300px, calc(100vh - 420px))' }}>
      {KANBAN_COLS.map(col => {
        const colOrders = grouped[col.value] ?? []
        return (
          <div
            key={col.value}
            className={cn(
              'flex flex-col rounded-xl border-2 border-t-4 min-w-[200px] w-[220px] flex-shrink-0 transition-colors',
              col.accent,
              overCol === col.value ? 'bg-accent/60 border-primary/40' : 'border-border/60 bg-background'
            )}
            onDragOver={e => { e.preventDefault() }}
            onDragEnter={e => {
              e.preventDefault()
              dragCounter.current[col.value] = (dragCounter.current[col.value] || 0) + 1
              setOverCol(col.value)
            }}
            onDragLeave={() => {
              dragCounter.current[col.value] = (dragCounter.current[col.value] || 1) - 1
              if (dragCounter.current[col.value] <= 0) {
                dragCounter.current[col.value] = 0
                setOverCol(prev => prev === col.value ? null : prev)
              }
            }}
            onDrop={() => handleDrop(col.value)}
          >
            {/* Заголовок колонки */}
            <div className={cn('px-3 py-2 rounded-t-lg flex items-center justify-between', col.header)}>
              <span className="text-xs font-semibold text-foreground">{col.label}</span>
              <span className="text-xs text-muted-foreground font-medium">{colOrders.length}</span>
            </div>

            {/* Карточки */}
            <div className="flex-1 p-2 space-y-1.5 min-h-[60px] overflow-y-auto" style={{ maxHeight: 'calc(100vh - 420px)' }}>
              {colOrders.map(order => {
                const TypeIcon  = ORDER_TYPE_ICONS[order.order_type as OrderType]
                const overdue   = isOverdueMap[order.id]
                const dueToday  = isDueTodayMap[order.id]
                const clientName = order.client
                  ? `${order.client.first_name} ${order.client.last_name || ''}`.trim()
                  : null
                return (
                  <div
                    key={order.id}
                    draggable
                    onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragId(order.id) }}
                    onDragEnd={() => { setDragId(null); setOverCol(null); dragCounter.current = {} }}
                    onClick={() => onNavigate(order.id)}
                    className={cn(
                      'p-2 rounded-lg border bg-card cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all select-none',
                      overdue   && 'border-l-2 border-l-red-500',
                      dueToday  && !overdue && 'border-l-2 border-l-orange-400',
                      dragId === order.id && 'opacity-40 scale-95',
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {TypeIcon && <TypeIcon className="h-3 w-3 text-muted-foreground shrink-0" />}
                      <span className="text-xs font-mono text-muted-foreground">{order.number}</span>
                      {overdue && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0 ml-auto" />}
                    </div>
                    {clientName && (
                      <p className="text-xs font-medium truncate">{clientName}</p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-semibold tabular-nums">{formatCurrency(order.total_amount)} {symbol}</span>
                      {order.ready_date && (
                        <span className={cn(
                          'text-xs',
                          overdue   ? 'text-red-500 font-medium'    : '',
                          dueToday  ? 'text-orange-500 font-medium' : 'text-muted-foreground',
                        )}>
                          {dayjs(order.ready_date).format('DD.MM')}
                        </span>
                      )}
                    </div>
                    <PaymentStatusBadge status={order.payment_status} />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Таблица-вид ────────────────────────────────────────────────────────────────
function OrdersTable({ orders, symbol, onNavigate, onDelete, isOverdueMap, isDueTodayMap, t, sortBy, onSort }: {
  orders: CleaningOrder[]
  symbol: string
  onNavigate: (id: string) => void
  onDelete: (id: string) => void
  isOverdueMap: Record<string, boolean>
  isDueTodayMap: Record<string, boolean>
  t: (key: string, opts?: Record<string, unknown>) => string
  sortBy: SortBy
  onSort: (col: 'date' | 'amount' | 'deadline') => void
}) {
  const totalAmount = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
  const totalPaid   = orders.reduce((s, o) => s + (o.paid_amount  ?? 0), 0)

  const dateActive     = sortBy === 'newest' || sortBy === 'oldest'
  const amountActive   = sortBy === 'amount_desc' || sortBy === 'amount_asc'
  const deadlineActive = sortBy === 'deadline_asc' || sortBy === 'deadline_desc'

  const thBtn = "flex items-center whitespace-nowrap hover:text-foreground transition-colors cursor-pointer select-none"

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                <button className={thBtn} onClick={() => onSort('date')}>
                  {t('orders.col.number')}
                  <SortIndicator active={dateActive} asc={sortBy === 'oldest'} />
                </button>
              </th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('orders.col.type')}</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('orders.col.client')}</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('orders.col.status')}</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('orders.col.payment')}</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">
                <button className={cn(thBtn, 'ml-auto')} onClick={() => onSort('amount')}>
                  {t('orders.col.amount')}
                  <SortIndicator active={amountActive} asc={sortBy === 'amount_asc'} />
                </button>
              </th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('orders.col.paid')}</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                <button className={thBtn} onClick={() => onSort('deadline')}>
                  {t('orders.col.date')}
                  <SortIndicator active={deadlineActive || dateActive} asc={sortBy === 'oldest' || sortBy === 'deadline_asc'} />
                </button>
              </th>
              <th className="px-2 py-2.5 w-8" />
            </tr>
          </thead>
          <tbody>
            {orders.map(order => {
              const TypeIcon  = ORDER_TYPE_ICONS[order.order_type as OrderType]
              const overdue   = isOverdueMap[order.id]
              const dueToday  = isDueTodayMap[order.id]
              const clientName = order.client
                ? `${order.client.first_name} ${order.client.last_name || ''}`.trim()
                : t('orders.noClient')
              return (
                <tr
                  key={order.id}
                  className={cn(
                    'border-b last:border-0 hover:bg-accent/40 cursor-pointer transition-colors group',
                    overdue  && 'border-l-2 border-l-red-500',
                    dueToday && !overdue && 'border-l-2 border-l-orange-400',
                  )}
                  onClick={() => onNavigate(order.id)}
                >
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      {overdue && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                      {order.number}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {TypeIcon && <TypeIcon className="h-4 w-4 text-muted-foreground" />}
                  </td>
                  <td className="px-3 py-2.5 max-w-[160px] truncate">
                    <span className={!order.client ? 'italic text-muted-foreground text-xs' : ''}>{clientName}</span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <OrderStatusBadge status={order.status as OrderStatus} />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <PaymentStatusBadge status={order.payment_status} />
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                    {formatCurrency(order.total_amount)} {symbol}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground">
                    {order.paid_amount > 0
                      ? <span className={order.paid_amount >= order.total_amount ? 'text-green-600 dark:text-green-400 font-medium' : 'text-orange-500'}>
                          {formatCurrency(order.paid_amount)}
                        </span>
                      : <span className="text-muted-foreground/50">—</span>
                    }
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    <div>{dayjs(order.created_at).format('DD.MM.YY')}</div>
                    {order.ready_date && (
                      <div className={cn(
                        overdue  ? 'text-red-500 font-medium'    : '',
                        dueToday ? 'text-orange-500 font-medium' : '',
                      )}>
                        {t('orders.deadline')} {dayjs(order.ready_date).format('DD.MM')}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    <button
                      onClick={e => { e.stopPropagation(); onDelete(order.id) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {/* Итоги */}
          {orders.length > 0 && (
            <tfoot>
              <tr className="bg-muted/50 border-t font-medium text-sm">
                <td colSpan={4} className="px-3 py-2.5 text-muted-foreground">
                  {t('orders.total', { count: orders.length })}
                </td>
                <td />
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {formatCurrency(totalAmount)} {symbol}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap text-green-600 dark:text-green-400">
                  {formatCurrency(totalPaid)} {symbol}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ── Главный компонент ──────────────────────────────────────────────────────────
export function OrdersListPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const symbol = useCurrencySymbol()

  const STATUS_TABS: { value: OrderStatus | 'all'; label: string }[] = [
    { value: 'all',         label: t('orders.status.all') },
    { value: 'received',    label: t('orders.status.received') },
    { value: 'in_progress', label: t('orders.status.inProgress') },
    { value: 'ready',       label: t('orders.status.ready') },
    { value: 'issued',      label: t('orders.status.issued') },
    { value: 'paid',        label: t('orders.status.paid') },
    { value: 'cancelled',   label: t('orders.status.cancelled') },
  ]

  const [status,         setStatus]         = useState<OrderStatus | 'all'>('all')
  const [orderType,      setOrderType]      = useState<OrderType | 'all'>('all')
  const [paymentFilter,  setPaymentFilter]  = useState<PaymentStatus | 'all'>('all')
  const [search,         setSearch]         = useState('')
  const [page,           setPage]           = useState(1)
  const [myOnly,         setMyOnly]         = useState(false)
  const [sortBy,         setSortBy]         = useState<SortBy>('newest')
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [dateFrom,       setDateFrom]       = useState('')
  const [dateTo,         setDateTo]         = useState('')

  const [deleteId,       setDeleteId]       = useState<string | null>(null)
  const [deleteAllOpen,  setDeleteAllOpen]  = useState(false)
  const [viewMode,       setViewMode]       = useState<'table' | 'kanban'>('table')
  const { mutateAsync: deleteOrder } = useDeleteOrder()

  const hasDateFilter = !!dateFrom || !!dateTo
  const isKanban = viewMode === 'kanban'

  const { data, isLoading } = useCleaningOrders({
    status:        isKanban ? 'all' : status,
    orderType,
    paymentStatus: isKanban ? 'all' : paymentFilter,
    search,
    assignedToMe: myOnly,
    page:         isKanban ? 1 : page,
    perPage:      isKanban ? 500 : 25,
    sortBy,
    dateFrom,
    dateTo,
  })

  const { data: stats } = useOrdersStats()

  const orders     = data?.orders ?? []
  const total      = data?.total ?? 0
  const totalPages = Math.ceil(total / 25)

  // Флаги срочности
  const isOverdueMap:  Record<string, boolean> = {}
  const isDueTodayMap: Record<string, boolean> = {}
  for (const order of orders) {
    const overdue =
      !!order.ready_date &&
      dayjs(order.ready_date).isBefore(dayjs(), 'day') &&
      !NON_URGENT_STATUSES.includes(order.status)
    const dueToday =
      !overdue &&
      !!order.ready_date &&
      dayjs(order.ready_date).isSame(dayjs(), 'day') &&
      !NON_URGENT_STATUSES.includes(order.status)
    isOverdueMap[order.id]  = overdue
    isDueTodayMap[order.id] = dueToday
  }

  async function handleDeleteOne(id: string) {
    try {
      await deleteOrder(id)
      toast.success(t('orders.deleted'))
      setDeleteId(null)
    } catch {
      toast.error(t('orders.deleteError'))
    }
  }

  async function handleDeleteAll() {
    try {
      for (const o of orders) { await deleteOrder(o.id) }
      toast.success(t('orders.deletedMultiple', { count: orders.length }))
      setDeleteAllOpen(false)
    } catch {
      toast.error(t('orders.deleteError'))
    }
  }

  function toggleUnpaidFilter() {
    setPaymentFilter(v => v === 'unpaid' ? 'all' : 'unpaid')
    setPage(1)
  }

  function clearDateFilter() {
    setDateFrom('')
    setDateTo('')
    setShowDateFilter(false)
    setPage(1)
  }

  function handleSort(col: 'date' | 'amount' | 'deadline') {
    setSortBy(prev => {
      if (col === 'date')     return prev === 'newest'      ? 'oldest'       : 'newest'
      if (col === 'amount')   return prev === 'amount_desc' ? 'amount_asc'   : 'amount_desc'
      if (col === 'deadline') return prev === 'deadline_asc'? 'deadline_desc': 'deadline_asc'
      return prev
    })
    setPage(1)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 lg:px-[18px] pt-4 lg:pt-6">
      <PageHeader
        title={t('nav.orders')}
        description={total > 0 ? `${total} ${t('orders.shortOrders')}` : undefined}
      >
        <div className="flex items-center gap-1.5">
          {/* Вид: таблица / канбан */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={cn('p-1.5 transition-colors', viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted')}
              title="Таблица"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={cn('p-1.5 transition-colors', viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted')}
              title="Канбан"
            >
              <Columns3 className="h-4 w-4" />
            </button>
          </div>
          {/* Период */}
          <Button
            variant="ghost" size="icon"
            className={cn('h-8 w-8', (showDateFilter || hasDateFilter) ? 'text-primary' : 'text-muted-foreground')}
            title={t('orders.filterPeriod')}
            onClick={() => setShowDateFilter(v => !v)}
          >
            <CalendarRange className="h-4 w-4" />
          </Button>
          {/* CSV */}
          {orders.length > 0 && (
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title={t('orders.exportCsv')}
              onClick={() => exportCSV(orders, symbol, t('orders.noClient'), [
                t('orders.col.number'), t('orders.col.type'), t('orders.col.client'),
                t('orders.col.status'), `${t('orders.col.amount')} (${symbol})`,
                `${t('orders.col.paid')} (${symbol})`, t('orders.col.date'),
              ])}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          {/* Удалить все */}
          {orders.length > 0 && (
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              title={t('orders.deleteAll')}
              onClick={() => setDeleteAllOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            onClick={() => navigate(window.innerWidth >= 1024 ? '/orders/pos' : '/orders/new')}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('orders.newOrder')}
          </Button>
        </div>
      </PageHeader>
      </div>

      <div className="flex-1 overflow-y-auto px-4 lg:px-[18px] pb-20 lg:pb-4 space-y-3">

        {/* Статистика */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none sticky top-0 z-10 bg-background py-2 -my-2">

          {/* Сегодня */}
          <div className="shrink-0 flex flex-col gap-0.5 rounded-xl border bg-muted/50 px-3 py-2 min-w-[105px]">
            <span className="text-xs text-muted-foreground">{t('orders.todayCount')}</span>
            <span className="text-sm font-semibold">{stats ? stats.total_today : '—'} {t('orders.shortOrders')}</span>
            {stats && stats.revenue_today > 0 && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 leading-none">
                {formatCurrency(stats.revenue_today)} {symbol}
              </span>
            )}
          </div>

          {/* Не оплачено — кликабельно */}
          <button
            onClick={toggleUnpaidFilter}
            className={cn(
              'shrink-0 flex flex-col gap-0.5 rounded-xl border px-3 py-2 min-w-[120px] text-left transition-all',
              paymentFilter === 'unpaid'
                ? 'ring-2 ring-orange-400 bg-orange-50 dark:bg-orange-950/20 border-orange-300 dark:border-orange-700'
                : stats && stats.unpaid_count > 0
                ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 hover:ring-1 hover:ring-orange-300'
                : 'bg-muted/50 hover:bg-muted/80'
            )}
          >
            <span className="text-xs text-muted-foreground">{t('orders.unpaid')}</span>
            <span className={cn('text-sm font-semibold', stats && stats.unpaid_count > 0 ? 'text-orange-600 dark:text-orange-400' : '')}>
              {stats ? stats.unpaid_count : '—'} {t('orders.shortOrders')}
            </span>
            {stats && stats.unpaid_amount > 0 && (
              <span className="text-xs text-orange-500 dark:text-orange-400 leading-none">
                {formatCurrency(stats.unpaid_amount)} {symbol}
              </span>
            )}
          </button>

          {/* За месяц */}
          <div className="shrink-0 flex flex-col gap-0.5 rounded-xl border bg-muted/50 px-3 py-2 min-w-[120px]">
            <span className="text-xs text-muted-foreground">{t('orders.monthCount')}</span>
            <span className="text-sm font-semibold">{stats ? stats.total_month : '—'} {t('orders.shortOrders')}</span>
            {stats && stats.revenue_month > 0 && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 leading-none">
                {formatCurrency(stats.revenue_month)} {symbol}
              </span>
            )}
          </div>

          {/* Средний чек */}
          <div className="shrink-0 flex flex-col gap-0.5 rounded-xl border bg-muted/50 px-3 py-2 min-w-[110px]">
            <span className="text-xs text-muted-foreground">{t('orders.avgCheck')}</span>
            <span className="text-sm font-semibold">
              {stats ? `${formatCurrency(stats.avg_check)} ${symbol}` : '—'}
            </span>
          </div>

          {/* К выдаче */}
          {stats && stats.ready_count > 0 && (
            <button
              onClick={() => { setStatus('ready'); setPage(1) }}
              className={cn(
                'shrink-0 flex flex-col gap-0.5 rounded-xl border px-3 py-2 min-w-[100px] text-left transition-all',
                status === 'ready'
                  ? 'ring-2 ring-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 border-indigo-300'
                  : 'bg-indigo-50/50 dark:bg-indigo-950/10 border-indigo-200 dark:border-indigo-800 hover:ring-1 hover:ring-indigo-300'
              )}
            >
              <span className="text-xs text-muted-foreground">{t('orders.readyForIssue')}</span>
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                {stats.ready_count} {t('orders.shortOrders')}
              </span>
            </button>
          )}

          {/* Просроченных */}
          {stats && stats.overdue_count > 0 && (
            <div className="shrink-0 flex flex-col gap-0.5 rounded-xl border bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 px-3 py-2 min-w-[110px]">
              <span className="text-xs text-muted-foreground">{t('orders.overdue')}</span>
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                {stats.overdue_count} {t('orders.shortOrders')}
              </span>
            </div>
          )}
        </div>

        {/* Фильтр по периоду (раскрывается) */}
        {showDateFilter && (
          <div className="flex items-end gap-3 flex-wrap rounded-xl border bg-muted/30 p-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t('cleaning.period.from')}</Label>
              <Input
                type="date" value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1) }}
                className="w-36 h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t('cleaning.period.to')}</Label>
              <Input
                type="date" value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1) }}
                className="w-36 h-8 text-sm"
              />
            </div>
            {hasDateFilter && (
              <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={clearDateFilter}>
                <X className="h-3.5 w-3.5 mr-1" />
                {t('common.clearFilter')}
              </Button>
            )}
          </div>
        )}

        {/* Поиск */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('orders.search')}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>

        {/* Статусы */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => { setStatus(tab.value); setPage(1) }}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                status === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Список / Таблица / Канбан */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={t('orders.emptyTitle')}
            description={t('orders.emptyDesc')}
            action={{ label: t('orders.newOrder'), onClick: () => navigate('/orders/new') }}
          />
        ) : isKanban ? (
          <KanbanView
            orders={orders}
            symbol={symbol}
            onNavigate={id => navigate(`/orders/${id}`)}
            isOverdueMap={isOverdueMap}
            isDueTodayMap={isDueTodayMap}
            t={t as (key: string, opts?: Record<string, unknown>) => string}
          />
        ) : (
          <>
            {/* Десктоп — таблица */}
            <div className="hidden lg:block">
              <OrdersTable
                orders={orders}
                symbol={symbol}
                onNavigate={id => navigate(`/orders/${id}`)}
                onDelete={id => setDeleteId(id)}
                isOverdueMap={isOverdueMap}
                isDueTodayMap={isDueTodayMap}
                t={t as (key: string, opts?: Record<string, unknown>) => string}
                sortBy={sortBy}
                onSort={handleSort}
              />
            </div>
            {/* Мобиль — карточки */}
            <div className="lg:hidden space-y-2">
            {orders.map(order => {
              const isOverdue  = isOverdueMap[order.id]
              const isDueToday = isDueTodayMap[order.id]
              const itemsCount = order.items?.length ?? null
              return (
                <div
                  key={order.id}
                  className={cn(
                    'relative group rounded-xl border bg-card transition-colors',
                    isOverdue   ? 'border-l-4 border-l-red-500'
                    : isDueToday ? 'border-l-4 border-l-orange-400'
                    : 'border-l-4 border-l-transparent'
                  )}
                >
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteId(order.id) }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-10"
                    title={t('orders.confirmDelete')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => navigate(`/orders/${order.id}`)}
                    className="w-full text-left p-4 hover:bg-accent/50 transition-colors rounded-xl pr-10"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {(() => {
                            const Icon = ORDER_TYPE_ICONS[order.order_type ?? 'clothing']
                            return <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          })()}
                          <span className="font-semibold text-sm">{order.number}</span>
                          <OrderStatusBadge status={order.status} />
                          <PaymentStatusBadge status={order.payment_status} />
                          {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                        </div>
                        {order.client ? (
                          <p className="text-sm text-muted-foreground mt-0.5 truncate">
                            {[order.client.first_name, order.client.last_name].filter(Boolean).join(' ')}
                            {order.client.phone && ` · ${order.client.phone}`}
                          </p>
                        ) : (
                          <span className="text-xs text-muted-foreground italic mt-0.5 block">{t('orders.noClient')}</span>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{dayjs(order.created_at).format('DD.MM.YYYY')}</span>
                          {order.ready_date && (
                            <span className={cn(
                              isOverdue  ? 'text-red-500 font-medium'    : '',
                              isDueToday ? 'text-orange-500 font-medium' : '',
                            )}>
                              {t('orders.deadline')} {dayjs(order.ready_date).format('DD.MM')}
                            </span>
                          )}
                          {order.assigned_to_profile && (
                            <span>{t('orders.executor')} {order.assigned_to_profile.display_name}</span>
                          )}
                          {itemsCount !== null && <span>· {itemsCount} {t('orders.shortItems')}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm">{formatCurrency(order.total_amount)} {symbol}</p>
                        {order.paid_amount > 0 && order.paid_amount < order.total_amount && (
                          <p className="text-xs text-muted-foreground">
                            {t('orders.paidShort')} {formatCurrency(order.paid_amount)}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              )
            })}
            </div>  {/* lg:hidden */}
          </>
        )}

        {/* Пагинация */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>{t('common.back')}</Button>
            <span className="flex items-center px-3 text-sm text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t('common.next')}</Button>
          </div>
        )}

      </div>

      {deleteId && (
        <DeleteConfirmDialog
          label={`${t('orders.confirmDelete').replace('?', '')} ${orders.find(o => o.id === deleteId)?.number ?? ''}`}
          onConfirm={() => handleDeleteOne(deleteId)}
          onClose={() => setDeleteId(null)}
          confirmDeleteAllLabel={t('orders.confirmDeleteAll')}
          confirmDeleteLabel={t('orders.confirmDelete')}
          cantUndoLabel={t('orders.cantUndo')}
          cancelLabel={t('common.cancel')}
          deleteLabel={t('common.delete')}
        />
      )}
      {deleteAllOpen && (
        <DeleteConfirmDialog
          label={t('orders.deletedMultiple', { count: orders.length })}
          onConfirm={handleDeleteAll}
          onClose={() => setDeleteAllOpen(false)}
          danger
          confirmDeleteAllLabel={t('orders.confirmDeleteAll')}
          confirmDeleteLabel={t('orders.confirmDelete')}
          cantUndoLabel={t('orders.cantUndo')}
          cancelLabel={t('common.cancel')}
          deleteLabel={t('common.delete')}
        />
      )}
    </div>
  )
}
