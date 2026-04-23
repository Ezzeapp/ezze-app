import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, MapPin, CalendarRange, Loader2, Truck, ArrowDown, ArrowUp, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { cn, formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import dayjs from 'dayjs'

interface DeliveryOrder {
  id: string
  number: string
  status: string
  order_type: string
  total_amount: number
  pickup_date: string | null
  delivery_date: string | null
  visit_address: string | null
  client: { first_name: string; last_name: string | null; phone: string | null } | null
}

function useDeliveryOrders(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['cleaning_delivery', dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from('cleaning_orders')
        .select('id, number, status, order_type, total_amount, pickup_date, delivery_date, visit_address, client:clients(first_name, last_name, phone)')
        .or('pickup_date.not.is.null,delivery_date.not.is.null')
        .not('status', 'in', '("cancelled","paid")')
        .order('pickup_date', { ascending: true, nullsFirst: false })
      if (dateFrom) q = q.gte('pickup_date', dateFrom)
      if (dateTo) q = q.lte('delivery_date', dateTo)
      const { data } = await q
      return (data ?? []) as unknown as DeliveryOrder[]
    },
  })
}

function groupByDate(orders: DeliveryOrder[], field: 'pickup_date' | 'delivery_date'): Record<string, DeliveryOrder[]> {
  const groups: Record<string, DeliveryOrder[]> = {}
  for (const o of orders) {
    const d = o[field]
    if (!d) continue
    const key = dayjs(d).format('YYYY-MM-DD')
    ;(groups[key] ??= []).push(o)
  }
  return groups
}

function OrderCard({ order, onNavigate }: { order: DeliveryOrder; onNavigate: (id: string) => void }) {
  const symbol = useCurrencySymbol()
  const clientName = order.client ? [order.client.first_name, order.client.last_name].filter(Boolean).join(' ') : 'Без клиента'

  return (
    <div
      className="rounded-xl border bg-card p-3 hover:bg-accent/40 cursor-pointer transition-colors"
      onClick={() => onNavigate(order.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{order.number}</span>
            <OrderStatusBadge status={order.status as any} />
          </div>
          <p className="text-sm mt-0.5">{clientName}</p>
          {order.visit_address && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {order.visit_address}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {order.client?.phone && (
            <a
              href={`tel:${order.client.phone}`}
              onClick={e => e.stopPropagation()}
              className="h-8 w-8 rounded-full bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 flex items-center justify-center transition-colors"
              title="Позвонить"
            >
              <Phone className="h-3.5 w-3.5" />
            </a>
          )}
          {order.visit_address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(order.visit_address)}`}
              target="_blank"
              rel="noopener"
              onClick={e => e.stopPropagation()}
              className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center transition-colors"
              title="Открыть на карте"
            >
              <MapPin className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
        <span>{formatCurrency(order.total_amount)} {symbol}</span>
        <span>{order.order_type}</span>
      </div>
    </div>
  )
}

export function DeliveryPage() {
  const navigate = useNavigate()
  const [dateFrom, setDateFrom] = useState(dayjs().format('YYYY-MM-DD'))
  const [dateTo, setDateTo] = useState(dayjs().add(7, 'day').format('YYYY-MM-DD'))
  const [showFilter, setShowFilter] = useState(false)

  const { data: orders = [], isLoading } = useDeliveryOrders(dateFrom, dateTo)

  const pickupGroups = groupByDate(orders, 'pickup_date')
  const deliveryGroups = groupByDate(orders, 'delivery_date')

  const pickupCount = orders.filter(o => o.pickup_date).length
  const deliveryCount = orders.filter(o => o.delivery_date).length

  return (
    <div className="space-y-4">
      <PageHeader title="Доставка и забор" description={`Забор: ${pickupCount} · Доставка: ${deliveryCount}`}>
        <Button
          variant={showFilter ? 'default' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowFilter(v => !v)}
        >
          <CalendarRange className="h-4 w-4" />
        </Button>
      </PageHeader>

      {showFilter && (
        <div className="flex items-end gap-3 flex-wrap rounded-xl border bg-muted/30 p-3">
          <div className="space-y-1">
            <Label className="text-xs">От</Label>
            <DateInput value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">До</Label>
            <DateInput value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 h-8 text-sm" />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : orders.length === 0 ? (
        <EmptyState icon={Truck} title="Нет заказов с доставкой" description="Заказы с датой забора/доставки появятся здесь" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pickup */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <ArrowDown className="h-4 w-4 text-blue-500" />
              Забор ({pickupCount})
            </h2>
            <div className="space-y-4">
              {Object.entries(pickupGroups).sort().map(([date, items]) => (
                <div key={date}>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 px-1">
                    {dayjs(date).format('DD MMMM, dd')}
                  </p>
                  <div className="space-y-1.5">
                    {items.map(o => <OrderCard key={o.id} order={o} onNavigate={id => navigate(`/orders/${id}`)} />)}
                  </div>
                </div>
              ))}
              {pickupCount === 0 && <p className="text-sm text-muted-foreground text-center py-4">Нет заборов</p>}
            </div>
          </div>

          {/* Delivery */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <ArrowUp className="h-4 w-4 text-green-500" />
              Доставка ({deliveryCount})
            </h2>
            <div className="space-y-4">
              {Object.entries(deliveryGroups).sort().map(([date, items]) => (
                <div key={date}>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 px-1">
                    {dayjs(date).format('DD MMMM, dd')}
                  </p>
                  <div className="space-y-1.5">
                    {items.map(o => <OrderCard key={o.id} order={o} onNavigate={id => navigate(`/orders/${id}`)} />)}
                  </div>
                </div>
              ))}
              {deliveryCount === 0 && <p className="text-sm text-muted-foreground text-center py-4">Нет доставок</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
