import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Plus, Search, Wrench, Loader2, AlertTriangle, X, ClipboardList, Clock, CheckCircle2,
  List, LayoutGrid,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/shared/PageHeader'
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
  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem('ws_view') as ViewMode) || 'list')

  const { data: stats } = useWorkshopOrdersStats()
  const { data, isLoading } = useWorkshopOrders({
    search,
    status: view === 'board' ? 'all' : status,
    perPage: view === 'board' ? 200 : 50,
  })
  const orders = data?.orders ?? []

  function toggleView(v: ViewMode) {
    setView(v)
    localStorage.setItem('ws_view', v)
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader
        title={t('workshop.list.title')}
        description={t('workshop.list.subtitle')}
      >
        <Button onClick={() => navigate('/orders/new')}>
          <Plus className="h-4 w-4 mr-2" /> {t('workshop.list.newOrder')}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={ClipboardList} label={t('workshop.stats.today')} value={stats?.total_today ?? 0} sub={formatCurrency(stats?.revenue_today ?? 0)} color="blue" />
        <StatCard icon={Clock} label={t('workshop.stats.inProgress')} value={stats?.in_progress_count ?? 0} sub={t('workshop.stats.active')} color="purple" />
        <StatCard icon={CheckCircle2} label={t('workshop.stats.ready')} value={stats?.ready_count ?? 0} sub={t('workshop.stats.readyHint')} color="emerald" />
        <StatCard icon={AlertTriangle} label={t('workshop.stats.overdue')} value={stats?.overdue_count ?? 0} sub={t('workshop.stats.overdueHint')} color="red" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
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
          <Select value={status} onValueChange={v => setStatus(v as any)}>
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('workshop.list.allStatuses')}</SelectItem>
              {STATUSES.map(s => (
                <SelectItem key={s} value={s}>{t(`workshop.status.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="inline-flex rounded-md border overflow-hidden">
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
          <KanbanBoard orders={orders} onOpen={(id) => navigate(`/orders/${id}`)} />
          {(() => {
            const hidden = orders.filter(o => !KANBAN_STATUSES.includes(o.status)).length
            return hidden > 0 ? (
              <div className="mt-3 text-xs text-muted-foreground text-center">
                Ещё {hidden} заказов в архивных статусах (оплачен / отказ / отменён) — в режиме «Список».
              </div>
            ) : null
          })()}
        </>
      ) : (
        <div className="space-y-2">
          {orders.map(o => (
            <OrderRow key={o.id} order={o} onClick={() => navigate(`/orders/${o.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Канбан-доска с drag & drop ──────────────────────────────────────────────
function KanbanBoard({ orders, onOpen }: { orders: WorkshopOrder[]; onOpen: (id: string) => void }) {
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
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 sm:mx-0 px-4 sm:px-0">
      {grouped.map(col => {
        const isOver = dragOver === col.status
        return (
          <div
            key={col.status}
            className="flex-shrink-0 w-72"
            onDragOver={(e) => {
              if (!dragId) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (dragOver !== col.status) setDragOver(col.status)
            }}
            onDragLeave={(e) => {
              // Очищаем только когда действительно покинули колонку (а не перешли на ребёнка)
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
              'sticky top-0 rounded-t-lg border border-b-0 px-3 py-2 text-sm font-semibold flex items-center justify-between z-10',
              STATUS_COLORS[col.status],
            )}>
              <span>{t(`workshop.status.${col.status}`)}</span>
              <span className="text-xs opacity-75">{col.orders.length}</span>
            </div>
            <div className={cn(
              'rounded-b-lg border bg-muted/20 p-2 min-h-[60vh] space-y-2 transition-colors',
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
                <div className="text-center text-xs text-muted-foreground py-8 select-none">
                  {isOver ? 'Отпустите, чтобы переместить' : '—'}
                </div>
              )}
            </div>
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
  const overdue = order.ready_date && dayjs(order.ready_date).isBefore(dayjs(), 'day')
    && !['issued','paid','cancelled','refused'].includes(order.status)

  // отличаем клик от перетаскивания по dataTransfer
  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', order.id)
    onDragStart()
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={() => { if (!dragging) onOpen() }}
      className={cn(
        'rounded-md border bg-card p-2 cursor-grab active:cursor-grabbing hover:shadow-sm transition-all text-sm select-none',
        dragging && 'opacity-40 scale-95',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-xs">{order.number}</span>
        <span className="text-xs font-mono">{formatCurrency(order.total_amount)}</span>
      </div>
      <div className="text-xs mt-1 line-clamp-1">{device}</div>
      <div className="text-xs text-muted-foreground line-clamp-1">{clientName}</div>
      {order.ready_date && (
        <div className={cn('text-xs mt-1 flex items-center gap-1',
          overdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
          {overdue && <AlertTriangle className="h-3 w-3" />}
          {dayjs(order.ready_date).format('DD.MM')}
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
  }
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className={cn('h-3.5 w-3.5', colorMap[color])} />
        <span>{label}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
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
