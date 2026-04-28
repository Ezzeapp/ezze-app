import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, MapPin, CalendarRange, Loader2, Truck, ArrowDown, ArrowUp, Printer, Map as MapIcon, List as ListIcon, Route } from 'lucide-react'
import { DeliverySlipModal, type DeliverySlipData } from '@/components/orders/DeliverySlipModal'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { cn, formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { PRODUCT } from '@/lib/config'
import { geocodeAddress, buildYandexRouteUrl } from '@/lib/geocode'
import dayjs from 'dayjs'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ── Иконки маркеров (синий — забор, зелёный — доставка) ──────────────────────
const pickupIcon = L.divIcon({
  className: 'custom-pin',
  html: `<div style="background:#3b82f6;width:32px;height:32px;border-radius:50%;border:4px solid white;box-shadow:0 4px 12px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px">↓</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})
const deliveryIcon = L.divIcon({
  className: 'custom-pin',
  html: `<div style="background:#10b981;width:32px;height:32px;border-radius:50%;border:4px solid white;box-shadow:0 4px 12px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px">↑</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

interface DeliveryOrder {
  id: string
  number: string
  status: string
  order_type: string
  total_amount: number
  prepaid_amount: number
  created_at: string
  notes: string | null
  pickup_date: string | null
  delivery_date: string | null
  visit_address: string | null
  visit_lat: number | null
  visit_lon: number | null
  client: { first_name: string; last_name: string | null; phone: string | null } | null
  items: { item_type_name: string; price: number; color: string | null; brand: string | null; defects: string | null }[]
}

function useDeliveryOrders(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['cleaning_delivery', PRODUCT, dateFrom, dateTo],
    queryFn: async () => {
      // Берём из БД все «активные» заказы с любой из дат забора/доставки.
      // Диапазон дат применяем на клиенте — PostgREST не умеет аккуратно
      // комбинировать `or=(and(...),and(...))` для двух полей одновременно.
      const { data } = await supabase
        .from('cleaning_orders')
        .select('id, number, status, order_type, total_amount, prepaid_amount, created_at, notes, pickup_date, delivery_date, visit_address, visit_lat, visit_lon, client:clients(first_name, last_name, phone), items:cleaning_order_items(item_type_name, price, color, brand, defects)')
        .eq('product', PRODUCT)
        .or('pickup_date.not.is.null,delivery_date.not.is.null')
        .not('status', 'in', '("cancelled","paid")')
        .order('pickup_date', { ascending: true, nullsFirst: false })

      const all = (data ?? []) as unknown as DeliveryOrder[]
      if (!dateFrom && !dateTo) return all

      const inRange = (d: string | null) => {
        if (!d) return false
        if (dateFrom && d < dateFrom) return false
        if (dateTo && d > dateTo) return false
        return true
      }
      return all.filter(o => inRange(o.pickup_date) || inRange(o.delivery_date))
    },
  })
}

function orderToSlip(o: DeliveryOrder): DeliverySlipData {
  return {
    number:         o.number,
    created_at:     o.created_at,
    client:         o.client,
    items:          o.items ?? [],
    total_amount:   o.total_amount,
    prepaid_amount: o.prepaid_amount,
    pickup_date:    o.pickup_date,
    delivery_date:  o.delivery_date,
    visit_address:  o.visit_address,
    notes:          o.notes,
  }
}

// ── Карточка заказа в timeline ────────────────────────────────────────────────
function TimelineOrderCard({
  order, kind, onNavigate, onPrint,
}: {
  order: DeliveryOrder
  kind: 'pickup' | 'delivery'
  onNavigate: (id: string) => void
  onPrint: (o: DeliveryOrder) => void
}) {
  const symbol = useCurrencySymbol()
  const clientName = order.client ? [order.client.first_name, order.client.last_name].filter(Boolean).join(' ') : 'Без клиента'
  const isPickup = kind === 'pickup'
  const accent = isPickup
    ? { border: 'border-blue-500',    icon: 'bg-blue-100 text-blue-700',       price: 'text-blue-700',    arrow: ArrowDown }
    : { border: 'border-emerald-500', icon: 'bg-emerald-100 text-emerald-700', price: 'text-emerald-700', arrow: ArrowUp }
  const Arrow = accent.arrow

  return (
    <div
      className={cn(
        'bg-white dark:bg-card border-l-4 rounded-r-xl shadow-sm p-3 hover:shadow-md transition flex items-start gap-3 cursor-pointer',
        accent.border
      )}
      onClick={() => onNavigate(order.id)}
    >
      <div className={cn('w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0', accent.icon)}>
        <Arrow className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-bold text-sm">{order.number}</span>
          <OrderStatusBadge status={order.status as any} />
        </div>
        <div className="text-sm font-medium">{clientName}</div>
        {order.visit_address && (
          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{order.visit_address}</span>
          </div>
        )}
        <div className={cn('text-xs font-mono font-bold mt-1', accent.price)}>
          {formatCurrency(order.total_amount)} {symbol} · {order.order_type}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <button
          onClick={e => { e.stopPropagation(); onPrint(order) }}
          className="h-9 w-9 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center transition-colors"
          title="Печать накладной"
        >
          <Printer className="h-4 w-4" />
        </button>
        {order.client?.phone && (
          <a
            href={`tel:${order.client.phone}`}
            onClick={e => e.stopPropagation()}
            className="h-9 w-9 rounded-full bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 flex items-center justify-center transition-colors"
            title="Позвонить"
          >
            <Phone className="h-4 w-4" />
          </a>
        )}
        {order.visit_address && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(order.visit_address)}`}
            target="_blank"
            rel="noopener"
            onClick={e => e.stopPropagation()}
            className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center transition-colors"
            title="Открыть на карте"
          >
            <MapPin className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  )
}

// ── Timeline view ─────────────────────────────────────────────────────────────
function TimelineView({
  orders, onNavigate, onPrint,
}: {
  orders: DeliveryOrder[]
  onNavigate: (id: string) => void
  onPrint: (o: DeliveryOrder) => void
}) {
  // Группируем все события (забор/доставка) по дням, отсортированы по дате
  type Event = { order: DeliveryOrder; kind: 'pickup' | 'delivery'; date: string }
  const events: Event[] = []
  for (const o of orders) {
    if (o.pickup_date) events.push({ order: o, kind: 'pickup',   date: o.pickup_date })
    if (o.delivery_date) events.push({ order: o, kind: 'delivery', date: o.delivery_date })
  }
  events.sort((a, b) => a.date.localeCompare(b.date))

  const today = dayjs().format('YYYY-MM-DD')
  const groups: Record<string, Event[]> = {}
  for (const ev of events) {
    const key = dayjs(ev.date).format('YYYY-MM-DD')
    ;(groups[key] ??= []).push(ev)
  }
  const dayKeys = Object.keys(groups).sort()

  if (dayKeys.length === 0) {
    return <EmptyState icon={Truck} title="Нет заказов с доставкой" description="Заказы с датой забора/доставки появятся здесь" />
  }

  return (
    <div className="relative pl-8">
      <div className="absolute left-3 top-2 bottom-2 w-px bg-gradient-to-b from-blue-200 via-emerald-200 to-emerald-200 dark:from-blue-900 dark:via-emerald-900 dark:to-emerald-900" />
      {dayKeys.map(day => {
        const isToday = day === today
        const dayLabel = dayjs(day).format('D MMMM, dd')
        return (
          <div key={day} className="mb-6">
            <div className="relative mb-3">
              <div className={cn(
                'absolute -left-6 top-0 w-6 h-6 rounded-full border-4 border-background shadow flex items-center justify-center',
                isToday ? 'bg-blue-600' : 'bg-muted-foreground/30'
              )}>
                <span className="text-white text-[10px] font-bold">{dayjs(day).format('D')}</span>
              </div>
              <div className={cn('text-sm font-bold', isToday ? 'text-blue-700 dark:text-blue-400' : 'text-foreground')}>
                {dayLabel}{isToday && ' · сегодня'}
              </div>
            </div>
            <div className="space-y-2 ml-2">
              {groups[day].map((ev, i) => (
                <TimelineOrderCard
                  key={`${ev.order.id}-${ev.kind}-${i}`}
                  order={ev.order}
                  kind={ev.kind}
                  onNavigate={onNavigate}
                  onPrint={onPrint}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Map view ──────────────────────────────────────────────────────────────────
function MapView({
  orders, onNavigate,
}: {
  orders: DeliveryOrder[]
  onNavigate: (id: string) => void
}) {
  const symbol = useCurrencySymbol()
  const qc = useQueryClient()
  const [geocoding, setGeocoding] = useState(false)

  const withCoords = useMemo(
    () => orders.filter(o => o.visit_lat != null && o.visit_lon != null),
    [orders]
  )
  const withoutCoords = useMemo(
    () => orders.filter(o => o.visit_address && (o.visit_lat == null || o.visit_lon == null)),
    [orders]
  )

  // Авто-геокодирование адресов без координат (по одному, чтобы не превышать лимит Nominatim)
  useEffect(() => {
    if (withoutCoords.length === 0) return
    let cancelled = false

    async function run() {
      setGeocoding(true)
      for (const o of withoutCoords) {
        if (cancelled) break
        if (!o.visit_address) continue
        const coords = await geocodeAddress(o.visit_address)
        if (coords) {
          await supabase
            .from('cleaning_orders')
            .update({ visit_lat: coords.lat, visit_lon: coords.lon })
            .eq('id', o.id)
        }
        // Лимит Nominatim ~1 req/sec
        await new Promise(r => setTimeout(r, 1100))
      }
      if (!cancelled) {
        setGeocoding(false)
        qc.invalidateQueries({ queryKey: ['cleaning_delivery'] })
      }
    }
    run()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withoutCoords.length])

  // Центр карты — среднее по координатам или дефолт Ташкент
  const center: [number, number] = withCoords.length > 0
    ? [
        withCoords.reduce((s, o) => s + (o.visit_lat ?? 0), 0) / withCoords.length,
        withCoords.reduce((s, o) => s + (o.visit_lon ?? 0), 0) / withCoords.length,
      ]
    : [41.2995, 69.2401] // Ташкент по умолчанию

  // Точки для маршрута
  const routePoints = withCoords
    .filter(o => o.pickup_date || o.delivery_date)
    .map(o => ({ lat: o.visit_lat as number, lon: o.visit_lon as number }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 h-[calc(100vh-280px)] min-h-[500px]">
      <div className="rounded-xl border overflow-hidden relative">
        <MapContainer
          center={center}
          zoom={withCoords.length > 0 ? 12 : 11}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {withCoords.map(o => {
            const isPickup = !!o.pickup_date && !o.delivery_date
            return (
              <Marker
                key={o.id}
                position={[o.visit_lat as number, o.visit_lon as number]}
                icon={isPickup ? pickupIcon : deliveryIcon}
              >
                <Popup>
                  <div className="space-y-1">
                    <div className="font-bold">{o.number}</div>
                    <div className="text-xs">{o.client ? [o.client.first_name, o.client.last_name].filter(Boolean).join(' ') : 'Без клиента'}</div>
                    <div className="text-xs text-gray-500">{o.visit_address}</div>
                    <div className="text-xs font-mono font-bold">{formatCurrency(o.total_amount)} {symbol}</div>
                    <button
                      onClick={() => onNavigate(o.id)}
                      className="mt-1 w-full px-2 py-1 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                    >
                      Открыть заказ
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>

        {(geocoding || withoutCoords.length > 0) && (
          <div className="absolute top-3 right-3 z-[1000] bg-white/95 dark:bg-card rounded-lg shadow-md px-3 py-2 text-xs flex items-center gap-2">
            {geocoding && <Loader2 className="h-3 w-3 animate-spin" />}
            {geocoding ? 'Определяем адреса...' : `${withoutCoords.length} адресов без координат`}
          </div>
        )}

        {routePoints.length >= 2 && (
          <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 dark:bg-card rounded-lg shadow-md p-3 max-w-xs">
            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Маршрут</div>
            <div className="text-sm font-bold mt-0.5">{routePoints.length} точек</div>
            <a
              href={buildYandexRouteUrl(routePoints)}
              target="_blank"
              rel="noopener"
              className="mt-2 inline-flex items-center gap-1.5 px-3 h-8 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
            >
              <Route className="h-3 w-3" /> Открыть в Яндекс.Картах
            </a>
          </div>
        )}
      </div>

      {/* Список рядом — компактный */}
      <div className="overflow-y-auto space-y-2 pr-1">
        {orders.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Нет заказов</p>
        )}
        {orders.map(o => {
          const isPickup = !!o.pickup_date && !o.delivery_date
          return (
            <div
              key={o.id}
              onClick={() => onNavigate(o.id)}
              className={cn(
                'bg-white dark:bg-card border rounded-xl p-3 cursor-pointer transition',
                isPickup ? 'hover:border-blue-400' : 'hover:border-emerald-400'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-sm">{o.number}</span>
                <OrderStatusBadge status={o.status as any} />
              </div>
              <div className="text-xs">{o.client ? [o.client.first_name, o.client.last_name].filter(Boolean).join(' ') : 'Без клиента'}</div>
              {o.visit_address && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{o.visit_address}</span>
                  {o.visit_lat == null && (
                    <span className="text-[10px] text-amber-600 ml-auto shrink-0">не на карте</span>
                  )}
                </div>
              )}
              <div className={cn('text-[11px] font-mono font-bold mt-1', isPickup ? 'text-blue-700' : 'text-emerald-700')}>
                {formatCurrency(o.total_amount)} {symbol}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function DeliveryContent({ showHeader = false }: { showHeader?: boolean }) {
  const navigate = useNavigate()
  const [dateFrom, setDateFrom] = useState(dayjs().format('YYYY-MM-DD'))
  const [dateTo, setDateTo] = useState(dayjs().add(7, 'day').format('YYYY-MM-DD'))
  const [showFilter, setShowFilter] = useState(false)
  const [view, setView] = useState<'timeline' | 'map'>('timeline')

  const [slipOrder, setSlipOrder] = useState<DeliveryOrder | null>(null)

  const { data: orders = [], isLoading } = useDeliveryOrders(dateFrom, dateTo)

  const pickupCount = orders.filter(o => o.pickup_date).length
  const deliveryCount = orders.filter(o => o.delivery_date).length

  return (
    <div className="space-y-4">
      {showHeader ? (
        <PageHeader title="Доставка и забор" description={`Забор: ${pickupCount} · Доставка: ${deliveryCount}`}>
          <div className="flex items-center gap-1.5">
            <Button
              variant={showFilter ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowFilter(v => !v)}
            >
              <CalendarRange className="h-4 w-4" />
            </Button>
          </div>
        </PageHeader>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold">
              <ArrowDown className="h-3 w-3" /> Забор: {pickupCount}
            </div>
            <div className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              <ArrowUp className="h-3 w-3" /> Доставка: {deliveryCount}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Переключатель Список / Карта */}
            <div className="inline-flex bg-muted rounded-xl p-1 gap-0.5">
              <button
                onClick={() => setView('timeline')}
                className={cn(
                  'flex items-center gap-1.5 px-3 h-7 rounded-lg font-semibold text-xs transition-colors',
                  view === 'timeline' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:bg-background/60'
                )}
              >
                <ListIcon className="h-3.5 w-3.5" /> Список
              </button>
              <button
                onClick={() => setView('map')}
                className={cn(
                  'flex items-center gap-1.5 px-3 h-7 rounded-lg font-semibold text-xs transition-colors',
                  view === 'map' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:bg-background/60'
                )}
              >
                <MapIcon className="h-3.5 w-3.5" /> Карта
              </button>
            </div>
            <Button
              variant={showFilter ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowFilter(v => !v)}
            >
              <CalendarRange className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

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
      ) : view === 'timeline' ? (
        <TimelineView
          orders={orders}
          onNavigate={id => navigate(`/orders/${id}`)}
          onPrint={setSlipOrder}
        />
      ) : (
        <MapView
          orders={orders}
          onNavigate={id => navigate(`/orders/${id}`)}
        />
      )}

      {slipOrder && (
        <DeliverySlipModal data={orderToSlip(slipOrder)} onClose={() => setSlipOrder(null)} />
      )}
    </div>
  )
}

export function DeliveryPage() {
  return <DeliveryContent showHeader />
}
