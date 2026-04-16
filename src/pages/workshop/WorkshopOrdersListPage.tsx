import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Plus, Search, Wrench, Loader2, AlertTriangle, X, ClipboardList, Wallet,
  List, LayoutGrid, TrendingUp, Camera, User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  useWorkshopOrders,
  useWorkshopOrdersStats,
  useUpdateWorkshopStatus,
  type WorkshopOrderStatus,
  type WorkshopOrder,
} from '@/hooks/useWorkshopOrders'
import { toast } from '@/components/shared/Toaster'
import { formatCurrency, cn } from '@/lib/utils'
import dayjs from 'dayjs'

const STATUSES: WorkshopOrderStatus[] = [
  'received', 'diagnosing', 'waiting_approval', 'waiting_parts',
  'in_progress', 'ready', 'issued', 'paid', 'refused', 'cancelled',
]

// Колонки канбан — активные статусы (не показываем архивные)
const KANBAN_STATUSES: WorkshopOrderStatus[] = [
  'received', 'diagnosing', 'waiting_approval', 'waiting_parts',
  'in_progress', 'ready', 'issued',
]

type ViewMode = 'list' | 'board'

const STATUS_COLORS: Record<WorkshopOrderStatus, string> = {
  received:         'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  diagnosing:       'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  waiting_approval: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  waiting_parts:    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  in_progress:      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  ready:            'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  issued:           'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  paid:             'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  refused:          'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
  cancelled:        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

export function WorkshopOrdersListPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<WorkshopOrderStatus | 'all'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem('ws_view') as ViewMode) || 'board')

  const { data: stats } = useWorkshopOrdersStats()
  const { data, isLoading } = useWorkshopOrders({
    search,
    status: view === 'board' ? 'all' : status,
    dateFrom: view === 'list' ? dateFrom : undefined,
    dateTo:   view === 'list' ? dateTo   : undefined,
    perPage:  view === 'board' ? 200 : 50,
  })
  const orders = data?.orders ?? []

  function toggleView(v: ViewMode) {
    setView(v)
    localStorage.setItem('ws_view', v)
  }

  const unpaid = stats?.unpaid_amount ?? 0

  return (
    <div className="flex flex-col h-full min-h-0 px-4 sm:px-6 py-4 sm:py-5 gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('workshop.list.title')}</h1>
          <p className="hidden sm:block text-sm text-muted-foreground mt-0.5">{t('workshop.list.subtitle')}</p>
        </div>
        <Button onClick={() => navigate('/orders/new')}>
          <Plus className="h-4 w-4 mr-2" /> {t('workshop.list.newOrder')}
        </Button>
      </div>

      {/* Stats — содержательные метрики, не дублируют колонки канбана */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={ClipboardList}
          label={t('workshop.stats.today')}
          value={stats?.total_today ?? 0}
          sub={formatCurrency(stats?.revenue_today ?? 0)}
          color="blue"
        />
        <StatCard
          icon={TrendingUp}
          label="Средний чек"
          value={formatCurrency(stats?.avg_check ?? 0)}
          sub={`за месяц · ${stats?.total_month ?? 0} шт`}
          color="purple"
        />
        <StatCard
          icon={Wallet}
          label="К доплате"
          value={formatCurrency(unpaid)}
          sub={`${stats?.unpaid_count ?? 0} заказов`}
          color={unpaid > 0 ? 'amber' : 'emerald'}
        />
        <StatCard
          icon={AlertTriangle}
          label={t('workshop.stats.overdue')}
          value={stats?.overdue_count ?? 0}
          sub={t('workshop.stats.overdueHint')}
          color={(stats?.overdue_count ?? 0) > 0 ? 'red' : 'emerald'}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('workshop.list.searchPlaceholder')}
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {view === 'list' && (
          <>
            <Select value={status} onValueChange={v => setStatus(v as any)}>
              <SelectTrigger className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('workshop.list.allStatuses')}</SelectItem>
                {STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{t(`workshop.status.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="sm:w-40"
              aria-label="Дата с"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="sm:w-40"
              aria-label="Дата по"
            />
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo('') }}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </>
        )}

        <div className="inline-flex rounded-md border overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => toggleView('list')}
            className={cn('px-3 py-2 text-sm flex items-center gap-1',
              view === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
          >
            <List className="h-4 w-4" /> Список
          </button>
          <button
            type="button"
            onClick={() => toggleView('board')}
            className={cn('px-3 py-2 text-sm flex items-center gap-1',
              view === 'board' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
          >
            <LayoutGrid className="h-4 w-4" /> Доска
          </button>
        </div>
      </div>

      {/* Content — занимает остаток высоты, канбан скроллится внутри */}
      <div className={cn('min-h-0', view === 'board' ? 'flex-1 flex flex-col' : 'flex-1 overflow-y-auto')}>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title={t('workshop.list.empty')}
            description={t('workshop.list.emptyHint')}
            action={{ label: t('workshop.list.newOrder'), onClick: () => navigate('/orders/new') }}
          />
        ) : view === 'board' ? (
          <>
            <KanbanBoard
              orders={orders}
              onOpen={(id) => navigate(`/orders/${id}`)}
              onAdd={() => navigate('/orders/new')}
            />
            {(() => {
              const hidden = orders.filter(o => !KANBAN_STATUSES.includes(o.status)).length
              return hidden > 0 ? (
                <div className="mt-2 text-xs text-muted-foreground text-center shrink-0">
                  Ещё {hidden} заказов в архивных статусах (оплачен / отказ / отменён) — в режиме «Список».
                </div>
              ) : null
            })()}
          </>
        ) : (
          <>
            {/* Desktop — таблица */}
            <div className="hidden lg:block pb-4">
              <OrdersTable orders={orders} onOpen={(id) => navigate(`/orders/${id}`)} />
            </div>
            {/* Mobile — карточки */}
            <div className="lg:hidden space-y-2 pb-4">
              {orders.map(o => (
                <OrderRow key={o.id} order={o} onClick={() => navigate(`/orders/${o.id}`)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Канбан-доска с drag & drop ──────────────────────────────────────────────
function KanbanBoard({ orders, onOpen, onAdd }: {
  orders: WorkshopOrder[]
  onOpen: (id: string) => void
  onAdd: () => void
}) {
  const { t } = useTranslation()
  const updateStatus = useUpdateWorkshopStatus()
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<WorkshopOrderStatus | null>(null)

  const grouped = KANBAN_STATUSES.map(s => ({
    status: s,
    orders: orders.filter(o => o.status === s),
  }))

  async function handleDrop(newStatus: WorkshopOrderStatus) {
    const id = dragId
    setDragId(null)
    setDragOver(null)
    if (!id) return
    const order = orders.find(o => o.id === id)
    if (!order || order.status === newStatus) return
    try {
      await updateStatus.mutateAsync({ id, status: newStatus })
      toast.success(`${order.number} → ${t(`workshop.status.${newStatus}`)}`)
    } catch (e: any) {
      toast.error(e.message ?? 'Ошибка')
    }
  }

  return (
    <div
      className="grid gap-2 overflow-x-auto flex-1 min-h-0 pb-2"
      style={{
        gridAutoFlow: 'column',
        gridAutoColumns: 'minmax(200px, 1fr)',
      }}
    >
      {grouped.map(col => {
        const isOver = dragOver === col.status
        const sum = col.orders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
        return (
          <div
            key={col.status}
            className="flex flex-col min-h-0 min-w-0"
            onDragOver={(e) => {
              if (!dragId) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (dragOver !== col.status) setDragOver(col.status)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOver(prev => prev === col.status ? null : prev)
              }
            }}
            onDrop={(e) => {
              e.preventDefault()
              handleDrop(col.status)
            }}
          >
            <div className={cn(
              'rounded-t-lg border border-b-0 px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 shrink-0',
              STATUS_COLORS[col.status],
            )}>
              <span className="flex-1 truncate">{t(`workshop.status.${col.status}`)}</span>
              <span className="text-[11px] opacity-75 tabular-nums">{col.orders.length}</span>
              {col.status === 'received' && (
                <button
                  type="button"
                  onClick={onAdd}
                  className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  title={t('workshop.list.newOrder')}
                  aria-label={t('workshop.list.newOrder')}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className={cn(
              'rounded-b-lg border bg-muted/20 p-1.5 flex-1 min-h-0 overflow-y-auto space-y-1.5 transition-colors',
              isOver && 'bg-primary/10 border-primary ring-2 ring-primary/40',
            )}>
              {col.orders.map(o => (
                <KanbanCard
                  key={o.id}
                  order={o}
                  dragging={dragId === o.id}
                  onOpen={() => onOpen(o.id)}
                  onDragStart={() => setDragId(o.id)}
                  onDragEnd={() => { setDragId(null); setDragOver(null) }}
                />
              ))}
              {col.orders.length === 0 && (
                <div className={cn(
                  'text-center text-xs py-10 px-3 select-none rounded-md border border-dashed',
                  isOver
                    ? 'text-primary border-primary font-medium'
                    : 'text-muted-foreground/70 border-transparent',
                )}>
                  {isOver ? 'Отпустите, чтобы переместить' : dragId ? 'Перетащите сюда' : 'Пусто'}
                </div>
              )}
            </div>
            {sum > 0 && (
              <div className="text-[11px] text-muted-foreground text-center mt-1 shrink-0 tabular-nums">
                {formatCurrency(sum)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function KanbanCard({ order, dragging, onOpen, onDragStart, onDragEnd }: {
  order: WorkshopOrder
  dragging: boolean
  onOpen: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const device = [order.item_type_name, order.brand, order.model].filter(Boolean).join(' · ')
  const clientName = order.client ? `${order.client.first_name} ${order.client.last_name ?? ''}`.trim() : '—'
  const isArchived = ['issued', 'paid', 'cancelled', 'refused'].includes(order.status)

  const daysLeft = order.ready_date ? dayjs(order.ready_date).endOf('day').diff(dayjs(), 'day') : null
  const overdue = !!order.ready_date && !isArchived && dayjs(order.ready_date).isBefore(dayjs(), 'day')
  const urgent  = !!order.ready_date && !isArchived && !overdue && (daysLeft ?? 99) <= 1

  const photoCount = Array.isArray(order.photos) ? order.photos.length : 0
  const masterName = order.assigned_to_profile?.display_name

  // Платёжный чип
  const remaining = Math.max(0, (order.total_amount ?? 0) - (order.paid_amount ?? 0))
  let payChip: { label: string; cls: string } | null = null
  if (order.payment_status === 'paid') {
    payChip = { label: 'Оплачен', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' }
  } else if (order.payment_status === 'partial') {
    payChip = { label: `Частично · ${formatCurrency(remaining)}`, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' }
  } else if ((order.prepaid_amount ?? 0) > 0) {
    payChip = { label: `Предоплата · ${formatCurrency(order.prepaid_amount)}`, cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' }
  }

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', order.id)
    onDragStart()
  }

  let deadlineLabel: string | null = null
  let deadlineCls = 'text-muted-foreground'
  if (order.ready_date) {
    const dateStr = dayjs(order.ready_date).format('DD.MM')
    if (overdue) {
      deadlineLabel = `Просрочен · ${Math.abs(daysLeft ?? 0)} дн.`
      deadlineCls = 'text-red-600 dark:text-red-400 font-medium'
    } else if (daysLeft === 0) {
      deadlineLabel = `Сегодня · ${dateStr}`
      deadlineCls = 'text-amber-600 dark:text-amber-400 font-medium'
    } else if (daysLeft === 1) {
      deadlineLabel = `Завтра · ${dateStr}`
      deadlineCls = 'text-amber-600 dark:text-amber-400'
    } else {
      deadlineLabel = `Через ${daysLeft} дн. · ${dateStr}`
    }
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={() => { if (!dragging) onOpen() }}
      className={cn(
        'relative rounded-md border bg-card px-2 py-1.5 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/40 transition-all select-none',
        dragging && 'opacity-40 scale-95',
        overdue && 'border-l-[3px] border-l-red-500',
        !overdue && urgent && 'border-l-[3px] border-l-amber-500',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-[11px]">{order.number}</span>
        {(order.total_amount ?? 0) > 0 && (
          <span className="text-[11px] font-mono tabular-nums">{formatCurrency(order.total_amount)}</span>
        )}
      </div>

      <div className="text-xs mt-0.5 line-clamp-1 font-medium">{device || '—'}</div>
      <div className="text-[11px] text-muted-foreground line-clamp-1">{clientName}</div>

      {(payChip || photoCount > 0 || masterName) && (
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {payChip && (
            <span className={cn('text-[10px] px-1 py-px rounded', payChip.cls)}>{payChip.label}</span>
          )}
          {photoCount > 0 && (
            <span className="text-[10px] px-1 py-px rounded bg-muted text-muted-foreground inline-flex items-center gap-0.5">
              <Camera className="h-2.5 w-2.5" />{photoCount}
            </span>
          )}
          {masterName && (
            <span className="text-[10px] px-1 py-px rounded bg-muted text-muted-foreground inline-flex items-center gap-0.5 max-w-[90px]">
              <User className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{masterName}</span>
            </span>
          )}
        </div>
      )}

      {deadlineLabel && (
        <div className={cn('text-[11px] mt-1 flex items-center gap-1', deadlineCls)}>
          {overdue && <AlertTriangle className="h-3 w-3" />}
          {deadlineLabel}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: number | string; sub?: string; color: string
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400',
  }
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className={cn('h-3.5 w-3.5', colorMap[color])} />
        <span className="truncate">{label}</span>
      </div>
      <div className="text-xl font-bold truncate">{value}</div>
      {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
    </div>
  )
}

function OrdersTable({ orders, onOpen }: { orders: WorkshopOrder[]; onOpen: (id: string) => void }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="text-left font-medium px-3 py-2 w-24">№</th>
            <th className="text-left font-medium px-3 py-2 w-36">Статус</th>
            <th className="text-left font-medium px-3 py-2">Устройство</th>
            <th className="text-left font-medium px-3 py-2">Клиент</th>
            <th className="text-left font-medium px-3 py-2 hidden xl:table-cell">S/N</th>
            <th className="text-left font-medium px-3 py-2 hidden xl:table-cell">Мастер</th>
            <th className="text-left font-medium px-3 py-2 w-32">Срок</th>
            <th className="text-right font-medium px-3 py-2 w-32">Оплата</th>
            <th className="text-right font-medium px-3 py-2 w-32">Сумма</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o, idx) => {
            const isArchived = ['issued', 'paid', 'cancelled', 'refused'].includes(o.status)
            const overdue = !!o.ready_date && !isArchived && dayjs(o.ready_date).isBefore(dayjs(), 'day')
            const daysLeft = o.ready_date ? dayjs(o.ready_date).endOf('day').diff(dayjs(), 'day') : null
            const device = [o.item_type_name, o.brand, o.model].filter(Boolean).join(' · ') || '—'
            const clientName = o.client ? `${o.client.first_name} ${o.client.last_name ?? ''}`.trim() : '—'
            const remaining = Math.max(0, (o.total_amount ?? 0) - (o.paid_amount ?? 0))

            let deadlineLabel = '—'
            let deadlineCls = 'text-muted-foreground'
            if (o.ready_date) {
              const dateStr = dayjs(o.ready_date).format('DD.MM')
              if (overdue) {
                deadlineLabel = `${dateStr} · просрочен`
                deadlineCls = 'text-red-600 dark:text-red-400 font-medium'
              } else if (daysLeft === 0) {
                deadlineLabel = `${dateStr} · сегодня`
                deadlineCls = 'text-amber-600 dark:text-amber-400'
              } else if (daysLeft === 1) {
                deadlineLabel = `${dateStr} · завтра`
                deadlineCls = 'text-amber-600 dark:text-amber-400'
              } else {
                deadlineLabel = dateStr
              }
            }

            let payLabel = '—'
            let payCls = 'text-muted-foreground'
            if (o.payment_status === 'paid') {
              payLabel = 'Оплачен'
              payCls = 'text-green-600 dark:text-green-400'
            } else if (o.payment_status === 'partial') {
              payLabel = `−${formatCurrency(remaining)}`
              payCls = 'text-amber-600 dark:text-amber-400'
            } else if ((o.prepaid_amount ?? 0) > 0) {
              payLabel = `предоплата ${formatCurrency(o.prepaid_amount)}`
              payCls = 'text-sky-600 dark:text-sky-400'
            } else if ((o.total_amount ?? 0) > 0) {
              payLabel = 'Не оплачен'
              payCls = 'text-muted-foreground'
            }

            return (
              <tr
                key={o.id}
                onClick={() => onOpen(o.id)}
                className={cn(
                  'cursor-pointer hover:bg-accent/40 transition-colors',
                  idx > 0 && 'border-t',
                )}
              >
                <td className="px-3 py-2 font-semibold tabular-nums">{o.number}</td>
                <td className="px-3 py-2">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full inline-block', STATUS_COLORS[o.status])}>
                    {t(`workshop.status.${o.status}`)}
                  </span>
                </td>
                <td className="px-3 py-2 max-w-[240px]">
                  <div className="truncate">{device}</div>
                  {o.defect_description && (
                    <div className="text-xs text-muted-foreground truncate">{o.defect_description}</div>
                  )}
                </td>
                <td className="px-3 py-2 max-w-[180px] truncate">{clientName}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground hidden xl:table-cell font-mono">
                  {o.serial_number || '—'}
                </td>
                <td className="px-3 py-2 text-xs hidden xl:table-cell">
                  {o.assigned_to_profile?.display_name || <span className="text-muted-foreground">—</span>}
                </td>
                <td className={cn('px-3 py-2 text-xs whitespace-nowrap', deadlineCls)}>
                  {overdue && <AlertTriangle className="inline h-3 w-3 mr-0.5 -mt-0.5" />}
                  {deadlineLabel}
                </td>
                <td className={cn('px-3 py-2 text-right text-xs whitespace-nowrap', payCls)}>{payLabel}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(o.total_amount)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function OrderRow({ order, onClick }: { order: WorkshopOrder; onClick: () => void }) {
  const { t } = useTranslation()
  const client = order.client
  const clientName = client ? `${client.first_name} ${client.last_name ?? ''}`.trim() : t('workshop.detail.noClient')
  const device = [order.item_type_name, order.brand, order.model].filter(Boolean).join(' · ')
  const overdue = order.ready_date && dayjs(order.ready_date).isBefore(dayjs(), 'day')
    && !['issued', 'paid', 'cancelled', 'refused'].includes(order.status)

  return (
    <div
      onClick={onClick}
      className="rounded-lg border bg-card p-3 cursor-pointer hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{order.number}</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full', STATUS_COLORS[order.status])}>
              {t(`workshop.status.${order.status}`)}
            </span>
            {order.payment_status === 'paid' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                {t('workshop.status.paid').toLowerCase()}
              </span>
            )}
            {overdue && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {t('workshop.stats.overdue').toLowerCase()}
              </span>
            )}
          </div>
          <div className="text-sm text-foreground mt-1">{device || '—'}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {clientName}
            {order.serial_number && ` · S/N ${order.serial_number}`}
          </div>
          {order.defect_description && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {order.defect_description}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="font-semibold">{formatCurrency(order.total_amount)}</div>
          {order.paid_amount > 0 && order.paid_amount < order.total_amount && (
            <div className="text-xs text-muted-foreground">{formatCurrency(order.paid_amount)}</div>
          )}
          {order.ready_date && (
            <div className={cn('text-xs mt-1', overdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
              {dayjs(order.ready_date).format('DD.MM')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
