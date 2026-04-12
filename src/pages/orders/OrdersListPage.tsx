import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ClipboardList, Loader2, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { useCleaningOrders } from '@/hooks/useCleaningOrders'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/orders/OrderStatusBadge'
import type { OrderStatus } from '@/hooks/useCleaningOrders'
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

export function OrdersListPage() {
  const navigate = useNavigate()
  const symbol = useCurrencySymbol()

  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [myOnly, setMyOnly] = useState(false)

  const { data, isLoading } = useCleaningOrders({
    status,
    search,
    assignedToMe: myOnly,
    page,
    perPage: 20,
  })

  const orders = data?.orders ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 20)

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Заказы"
        description={total > 0 ? `${total} заказов` : undefined}
      >
        <Button onClick={() => navigate('/orders/new')} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Новый заказ
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-4 pb-20 lg:pb-4 space-y-4">

        {/* Поиск + фильтр "мои" */}
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
            {orders.map(order => (
              <button
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                className="w-full text-left rounded-xl border bg-card hover:bg-accent/50 transition-colors p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{order.number}</span>
                      <OrderStatusBadge status={order.status} />
                      <PaymentStatusBadge status={order.payment_status} />
                    </div>
                    {order.client && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        {[order.client.first_name, order.client.last_name].filter(Boolean).join(' ')}
                        {order.client.phone && ` · ${order.client.phone}`}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{dayjs(order.created_at).format('DD.MM.YYYY')}</span>
                      {order.ready_date && (
                        <span>Срок: {dayjs(order.ready_date).format('DD.MM')}</span>
                      )}
                      {order.assigned_to_profile && (
                        <span>Исп.: {order.assigned_to_profile.display_name}</span>
                      )}
                    </div>
                  </div>
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
            ))}
          </div>
        )}

        {/* Пагинация */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              Назад
            </Button>
            <span className="flex items-center px-3 text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Далее
            </Button>
          </div>
        )}

      </div>
    </div>
  )
}
