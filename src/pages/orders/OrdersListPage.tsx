import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, ClipboardList, Loader2, Filter,
  AlertTriangle, Trash2, ArrowUpDown, ArrowDownUp,
  TrendingDown, CalendarClock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import type { OrderStatus, OrderType, PaymentStatus } from '@/hooks/useCleaningOrders'
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
]

const SORT_OPTIONS: { value: SortBy; label: string; Icon: React.ElementType }[] = [
  { value: 'newest',       label: 'Новые',  Icon: ArrowDownUp },
  { value: 'oldest',       label: 'Старые', Icon: ArrowUpDown },
  { value: 'amount_desc',  label: 'Сумма ↓', Icon: TrendingDown },
  { value: 'deadline_asc', label: 'Срок ↑',  Icon: CalendarClock },
]

const NON_URGENT_STATUSES = ['issued', 'paid', 'cancelled']

// ── Диалог подтверждения удаления ─────────────────────────────────────────────
function DeleteConfirmDialog({ label, onConfirm, onClose, danger = false }: {
  label: string
  onConfirm: () => void
  onClose: () => void
  danger?: boolean
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
          {danger && (
            <p className="text-xs text-red-500 font-medium">Это действие нельзя отменить!</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" size="sm" onClick={onClose}>Отмена</Button>
          <Button variant="destructive" className="flex-1" size="sm" onClick={onConfirm}>
            Удалить
          </Button>
        </div>
      </div>
    </div>
  )
}

export function OrdersListPage() {
  const navigate = useNavigate()
  const symbol = useCurrencySymbol()

  const [status,        setStatus]        = useState<OrderStatus | 'all'>('all')
  const [orderType,     setOrderType]     = useState<OrderType | 'all'>('all')
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'all'>('all')
  const [search,        setSearch]        = useState('')
  const [page,          setPage]          = useState(1)
  const [myOnly,        setMyOnly]        = useState(false)
  const [sortBy,        setSortBy]        = useState<SortBy>('newest')

  // Удаление
  const [deleteId,      setDeleteId]      = useState<string | null>(null)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const { mutateAsync: deleteOrder, isPending: deleting } = useDeleteOrder()

  const { data, isLoading } = useCleaningOrders({
    status,
    orderType,
    paymentStatus: paymentFilter,
    search,
    assignedToMe: myOnly,
    page,
    perPage: 20,
    sortBy,
  })

  const { data: stats } = useOrdersStats()

  const orders     = data?.orders ?? []
  const total      = data?.total ?? 0
  const totalPages = Math.ceil(total / 20)

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

  // Переключить фильтр по неоплаченным
  function toggleUnpaidFilter() {
    setPaymentFilter(v => v === 'unpaid' ? 'all' : 'unpaid')
    setPage(1)
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Заказы"
        description={total > 0 ? `${total} заказов` : undefined}
      >
        <div className="flex items-center gap-2">
          {orders.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
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

      <div className="flex-1 overflow-y-auto px-4 pb-20 lg:pb-4 space-y-4">

        {/* Статистика */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {/* Сегодня */}
          <div className="shrink-0 flex flex-col gap-0.5 rounded-xl border bg-muted/50 px-3 py-2 min-w-[100px]">
            <span className="text-xs text-muted-foreground">Сегодня</span>
            <span className="text-sm font-semibold">
              {stats ? stats.total_today : '—'} зак.
            </span>
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
            <span className="text-xs text-muted-foreground">Не оплачено</span>
            <span
              className={cn(
                'text-sm font-semibold',
                stats && stats.unpaid_count > 0 ? 'text-orange-600 dark:text-orange-400' : ''
              )}
            >
              {stats ? stats.unpaid_count : '—'} зак.
            </span>
            {stats && stats.unpaid_amount > 0 && (
              <span className="text-xs text-orange-500 dark:text-orange-400 leading-none">
                {formatCurrency(stats.unpaid_amount)} {symbol}
              </span>
            )}
          </button>

          {/* За месяц */}
          <div className="shrink-0 flex flex-col gap-0.5 rounded-xl border bg-muted/50 px-3 py-2 min-w-[100px]">
            <span className="text-xs text-muted-foreground">За месяц</span>
            <span className="text-sm font-semibold">
              {stats ? stats.total_month : '—'} зак.
            </span>
          </div>
        </div>

        {/* Поиск + фильтры */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по номеру или клиенту..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="pl-9"
            />
          </div>
          <Button
            variant={myOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setMyOnly(v => !v); setPage(1) }}
            className="shrink-0"
          >
            <Filter className="h-4 w-4 mr-1" />
            Мои
          </Button>
        </div>

        {/* Сортировка */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setSortBy(opt.value); setPage(1) }}
              className={cn(
                'shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                sortBy === opt.value
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              <opt.Icon className="h-3 w-3" />
              {opt.label}
            </button>
          ))}
        </div>

        {/* Фильтр по типу */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {(['all', 'clothing', 'carpet', 'furniture'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setOrderType(t); setPage(1) }}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                orderType === t
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {t === 'all'
                ? 'Все типы'
                : (() => {
                    const Icon = ORDER_TYPE_ICONS[t as OrderType]
                    return (
                      <span className="flex items-center gap-1">
                        <Icon className="h-3.5 w-3.5" />
                        {ORDER_TYPE_LABELS[t as OrderType]}
                      </span>
                    )
                  })()
              }
            </button>
          ))}
        </div>

        {/* Табы статусов */}
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

        {/* Список */}
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
        ) : (
          <div className="space-y-2">
            {orders.map(order => {
              const isOverdue =
                !!order.ready_date &&
                dayjs(order.ready_date).isBefore(dayjs(), 'day') &&
                !NON_URGENT_STATUSES.includes(order.status)

              const isDueToday =
                !isOverdue &&
                !!order.ready_date &&
                dayjs(order.ready_date).isSame(dayjs(), 'day') &&
                !NON_URGENT_STATUSES.includes(order.status)

              const itemsCount = order.items?.length ?? null

              return (
                <div
                  key={order.id}
                  className={cn(
                    'relative group rounded-xl border bg-card transition-colors',
                    isOverdue
                      ? 'border-l-4 border-l-red-500'
                      : isDueToday
                      ? 'border-l-4 border-l-orange-400'
                      : 'border-l-4 border-l-transparent'
                  )}
                >
                  {/* Кнопка удаления */}
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
                        {/* Номер + статусы */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {(() => {
                            const Icon = ORDER_TYPE_ICONS[order.order_type ?? 'clothing']
                            return <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          })()}
                          <span className="font-semibold text-sm">{order.number}</span>
                          <OrderStatusBadge status={order.status} />
                          <PaymentStatusBadge status={order.payment_status} />
                          {isOverdue && (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          )}
                        </div>

                        {/* Клиент */}
                        {order.client ? (
                          <p className="text-sm text-muted-foreground mt-0.5 truncate">
                            {[order.client.first_name, order.client.last_name]
                              .filter(Boolean)
                              .join(' ')}
                            {order.client.phone && ` · ${order.client.phone}`}
                          </p>
                        ) : (
                          <span className="text-xs text-muted-foreground italic mt-0.5 block">
                            Без клиента
                          </span>
                        )}

                        {/* Дата + срок + исполнитель + изделия */}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{dayjs(order.created_at).format('DD.MM.YYYY')}</span>
                          {order.ready_date && (
                            <span
                              className={cn(
                                isOverdue
                                  ? 'text-red-500 font-medium'
                                  : isDueToday
                                  ? 'text-orange-500 font-medium'
                                  : ''
                              )}
                            >
                              Срок: {dayjs(order.ready_date).format('DD.MM')}
                            </span>
                          )}
                          {order.assigned_to_profile && (
                            <span>Исп.: {order.assigned_to_profile.display_name}</span>
                          )}
                          {itemsCount !== null && (
                            <span>· {itemsCount} изд.</span>
                          )}
                        </div>
                      </div>

                      {/* Сумма */}
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm">
                          {formatCurrency(order.total_amount)} {symbol}
                        </p>
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
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Назад
            </Button>
            <span className="flex items-center px-3 text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Далее
            </Button>
          </div>
        )}

      </div>

      {/* Диалог удаления одного заказа */}
      {deleteId && (
        <DeleteConfirmDialog
          label={`Заказ ${orders.find(o => o.id === deleteId)?.number ?? ''} будет удалён безвозвратно`}
          onConfirm={() => handleDeleteOne(deleteId)}
          onClose={() => setDeleteId(null)}
        />
      )}

      {/* Диалог удаления всех заказов на странице */}
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
