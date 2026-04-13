import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, ClipboardList, Loader2, Filter,
  AlertTriangle, Trash2, LayoutList, Table2, Download, CalendarRange, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { toast } from '@/components/shared/Toaster'
import {
  useCleaningOrders,
  useOrdersStats,
  useDeleteOrder,
  ORDER_TYPE_ICONS,
  ORDER_TYPE_LABELS,
  type SortBy,
} from '@/hooks/useCleaningOrders'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/orders/OrderStatusBadge'
import type { OrderStatus, OrderType, PaymentStatus, CleaningOrder } from '@/hooks/useCleaningOrders'
import { formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import dayjs from 'dayjs'
import { cn } from '@/lib/utils'

const STATUS_TABS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all',         label: 'Все' },
  { value: 'received',    label: 'Принят' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'ready',       label: 'Готов' },
  { value: 'issued',      label: 'Выдан' },
  { value: 'paid',        label: 'Оплачен' },
  { value: 'cancelled',   label: 'Отменён' },
]

const NON_URGENT_STATUSES = ['issued', 'paid', 'cancelled']

// ── CSV-экспорт ────────────────────────────────────────────────────────────────
function exportCSV(orders: CleaningOrder[], symbol: string) {
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

// ── Диалог подтверждения удаления ─────────────────────────────────────────────
function DeleteConfirmDialog({ label, onConfirm, onClose, danger = false }: {
  label: string; onConfirm: () => void; onClose: () => void; danger?: boolean
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
          <p className="font-semibold">{danger ? '⚠️ Удалить все заказы?' : 'Удалить заказ?'}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {danger && <p className="text-xs text-red-500 font-medium">Это действие нельзя отменить!</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" size="sm" onClick={onClose}>Отмена</Button>
          <Button variant="destructive" className="flex-1" size="sm" onClick={onConfirm}>Удалить</Button>
        </div>
      </div>
    </div>
  )
}

// ── Таблица-вид ────────────────────────────────────────────────────────────────
function OrdersTable({ orders, symbol, onNavigate, onDelete, isOverdueMap, isDueTodayMap }: {
  orders: CleaningOrder[]
  symbol: string
  onNavigate: (id: string) => void
  onDelete: (id: string) => void
  isOverdueMap: Record<string, boolean>
  isDueTodayMap: Record<string, boolean>
}) {
  const totalAmount = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
  const totalPaid   = orders.reduce((s, o) => s + (o.paid_amount  ?? 0), 0)

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">№</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Тип</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Клиент</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Статус</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Оплата</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Сумма</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Оплачено</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Дата / Срок</th>
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
                : 'Без клиента'
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
                        Срок: {dayjs(order.ready_date).format('DD.MM')}
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
                  Итого: {orders.length} заказов
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
  const symbol = useCurrencySymbol()

  const [status,         setStatus]         = useState<OrderStatus | 'all'>('all')
  const [orderType,      setOrderType]      = useState<OrderType | 'all'>('all')
  const [paymentFilter,  setPaymentFilter]  = useState<PaymentStatus | 'all'>('all')
  const [search,         setSearch]         = useState('')
  const [page,           setPage]           = useState(1)
  const [myOnly,         setMyOnly]         = useState(false)
  const [sortBy,         setSortBy]         = useState<SortBy>('newest')
  const [viewMode,       setViewMode]       = useState<'cards' | 'table'>('cards')
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [dateFrom,       setDateFrom]       = useState('')
  const [dateTo,         setDateTo]         = useState('')

  const [deleteId,       setDeleteId]       = useState<string | null>(null)
  const [deleteAllOpen,  setDeleteAllOpen]  = useState(false)
  const { mutateAsync: deleteOrder } = useDeleteOrder()

  const hasDateFilter = !!dateFrom || !!dateTo

  const { data, isLoading } = useCleaningOrders({
    status,
    orderType,
    paymentStatus: paymentFilter,
    search,
    assignedToMe: myOnly,
    page,
    perPage: 20,
    sortBy,
    dateFrom,
    dateTo,
  })

  const { data: stats } = useOrdersStats()

  const orders     = data?.orders ?? []
  const total      = data?.total ?? 0
  const totalPages = Math.ceil(total / 20)

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
      toast.success('Заказ удалён')
      setDeleteId(null)
    } catch {
      toast.error('Ошибка удаления')
    }
  }

  async function handleDeleteAll() {
    try {
      for (const o of orders) { await deleteOrder(o.id) }
      toast.success(`Удалено ${orders.length} заказов`)
      setDeleteAllOpen(false)
    } catch {
      toast.error('Ошибка при удалении')
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

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Заказы"
        description={total > 0 ? `${total} заказов` : undefined}
      >
        <div className="flex items-center gap-1.5">
          {/* Период */}
          <Button
            variant="ghost" size="icon"
            className={cn('h-8 w-8', (showDateFilter || hasDateFilter) ? 'text-primary' : 'text-muted-foreground')}
            title="Фильтр по периоду"
            onClick={() => setShowDateFilter(v => !v)}
          >
            <CalendarRange className="h-4 w-4" />
          </Button>
          {/* CSV */}
          {orders.length > 0 && (
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Экспорт CSV"
              onClick={() => exportCSV(orders, symbol)}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          {/* Вид */}
          <Button
            variant="ghost" size="icon"
            className={cn('h-8 w-8', viewMode === 'table' ? 'text-primary' : 'text-muted-foreground')}
            title={viewMode === 'cards' ? 'Таблица' : 'Карточки'}
            onClick={() => setViewMode(v => v === 'cards' ? 'table' : 'cards')}
          >
            {viewMode === 'cards' ? <Table2 className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
          </Button>
          {/* Удалить все */}
          {orders.length > 0 && (
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              title="Удалить всё на странице"
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
            Новый заказ
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-4 pb-20 lg:pb-4 space-y-3">

        {/* Статистика */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <div className="shrink-0 flex flex-col gap-0.5 rounded-xl border bg-muted/50 px-3 py-2 min-w-[100px]">
            <span className="text-xs text-muted-foreground">Сегодня</span>
            <span className="text-sm font-semibold">{stats ? stats.total_today : '—'} зак.</span>
          </div>
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
            <span className="text-xs text-muted-foreground">Не оплачено</span>
            <span className={cn('text-sm font-semibold', stats && stats.unpaid_count > 0 ? 'text-orange-600 dark:text-orange-400' : '')}>
              {stats ? stats.unpaid_count : '—'} зак.
            </span>
            {stats && stats.unpaid_amount > 0 && (
              <span className="text-xs text-orange-500 dark:text-orange-400 leading-none">
                {formatCurrency(stats.unpaid_amount)} {symbol}
              </span>
            )}
          </button>
          <div className="shrink-0 flex flex-col gap-0.5 rounded-xl border bg-muted/50 px-3 py-2 min-w-[100px]">
            <span className="text-xs text-muted-foreground">За месяц</span>
            <span className="text-sm font-semibold">{stats ? stats.total_month : '—'} зак.</span>
          </div>
        </div>

        {/* Фильтр по периоду (раскрывается) */}
        {showDateFilter && (
          <div className="flex items-end gap-3 flex-wrap rounded-xl border bg-muted/30 p-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">С</Label>
              <Input
                type="date" value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1) }}
                className="w-36 h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">По</Label>
              <Input
                type="date" value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1) }}
                className="w-36 h-8 text-sm"
              />
            </div>
            {hasDateFilter && (
              <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={clearDateFilter}>
                <X className="h-3.5 w-3.5 mr-1" />
                Сбросить
              </Button>
            )}
          </div>
        )}

        {/* Основные фильтры */}
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по номеру или клиенту..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="pl-9"
            />
          </div>
          <Select value={sortBy} onValueChange={v => { setSortBy(v as SortBy); setPage(1) }}>
            <SelectTrigger className="w-[130px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">↓ Новые</SelectItem>
              <SelectItem value="oldest">↑ Старые</SelectItem>
              <SelectItem value="amount_desc">Сумма ↓</SelectItem>
              <SelectItem value="deadline_asc">Срок ↑</SelectItem>
            </SelectContent>
          </Select>
          <Select value={orderType} onValueChange={v => { setOrderType(v as OrderType | 'all'); setPage(1) }}>
            <SelectTrigger className="w-[130px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы</SelectItem>
              <SelectItem value="clothing">Одежда</SelectItem>
              <SelectItem value="carpet">Ковёр</SelectItem>
              <SelectItem value="furniture">Мебель</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={myOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setMyOnly(v => !v); setPage(1) }}
            className="shrink-0 h-10"
          >
            <Filter className="h-4 w-4 mr-1" />
            Мои
          </Button>
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

        {/* Список / Таблица */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Заказов нет"
            description="Создайте первый заказ при приёме вещей"
            action={{ label: 'Новый заказ', onClick: () => navigate('/orders/new') }}
          />
        ) : viewMode === 'table' ? (
          <OrdersTable
            orders={orders}
            symbol={symbol}
            onNavigate={id => navigate(`/orders/${id}`)}
            onDelete={id => setDeleteId(id)}
            isOverdueMap={isOverdueMap}
            isDueTodayMap={isDueTodayMap}
          />
        ) : (
          <div className="space-y-2">
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
                    title="Удалить заказ"
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
                          <span className="text-xs text-muted-foreground italic mt-0.5 block">Без клиента</span>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{dayjs(order.created_at).format('DD.MM.YYYY')}</span>
                          {order.ready_date && (
                            <span className={cn(
                              isOverdue  ? 'text-red-500 font-medium'    : '',
                              isDueToday ? 'text-orange-500 font-medium' : '',
                            )}>
                              Срок: {dayjs(order.ready_date).format('DD.MM')}
                            </span>
                          )}
                          {order.assigned_to_profile && (
                            <span>Исп.: {order.assigned_to_profile.display_name}</span>
                          )}
                          {itemsCount !== null && <span>· {itemsCount} изд.</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm">{formatCurrency(order.total_amount)} {symbol}</p>
                        {order.paid_amount > 0 && order.paid_amount < order.total_amount && (
                          <p className="text-xs text-muted-foreground">
                            Опл.: {formatCurrency(order.paid_amount)}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Пагинация */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Назад</Button>
            <span className="flex items-center px-3 text-sm text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Далее</Button>
          </div>
        )}

      </div>

      {deleteId && (
        <DeleteConfirmDialog
          label={`Заказ ${orders.find(o => o.id === deleteId)?.number ?? ''} будет удалён безвозвратно`}
          onConfirm={() => handleDeleteOne(deleteId)}
          onClose={() => setDeleteId(null)}
        />
      )}
      {deleteAllOpen && (
        <DeleteConfirmDialog
          label={`${orders.length} заказов на этой странице будут удалены`}
          onConfirm={handleDeleteAll}
          onClose={() => setDeleteAllOpen(false)}
          danger
        />
      )}
    </div>
  )
}
