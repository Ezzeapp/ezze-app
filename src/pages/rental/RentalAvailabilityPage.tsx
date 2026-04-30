import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays, ChevronLeft, ChevronRight, KeyRound, Plus, Search, X,
} from 'lucide-react'
import { useRentalItems } from '@/hooks/useRentalItems'
import { useRentalBookings } from '@/hooks/useRentalBookings'
import { useClients } from '@/hooks/useClients'
import {
  RENTAL_CATEGORY_LABELS,
  type RentalBooking, type RentalBookingStatus, type RentalCategory,
} from '@/types/rental'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ── Константы и утилиты ───────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000

const STATUS_BLOCK_COLORS: Record<RentalBookingStatus, string> = {
  pending:   'bg-amber-200 border-amber-400 text-amber-900 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-100',
  confirmed: 'bg-blue-200 border-blue-400 text-blue-900 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-100',
  active:    'bg-green-200 border-green-500 text-green-900 dark:bg-green-900/40 dark:border-green-600 dark:text-green-100',
  returned:  'bg-gray-200 border-gray-400 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300',
  cancelled: 'bg-rose-100 border-rose-300 text-rose-700 line-through dark:bg-rose-900/30 dark:border-rose-700 dark:text-rose-200',
  overdue:   'bg-red-300 border-red-600 text-red-900 dark:bg-red-900/50 dark:border-red-600 dark:text-red-100',
}

/** Дата в начале дня (00:00:00) в локальной TZ. */
function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

function fmtDateShort(d: Date): string {
  return d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' })
}

function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString('ru', { month: 'long', year: 'numeric' })
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
}

// ── Главная ───────────────────────────────────────────────────────────────────

const RANGE_OPTIONS = [
  { days: 7,  label: '1 нед' },
  { days: 14, label: '2 нед' },
  { days: 30, label: '1 мес' },
  { days: 60, label: '2 мес' },
] as const

export function RentalAvailabilityPage() {
  const navigate = useNavigate()
  const { data: items = [], isLoading: loadingItems } = useRentalItems()
  const { data: bookings = [], isLoading: loadingBookings } = useRentalBookings()
  const { data: clients = [] } = useClients()

  const [rangeDays, setRangeDays] = useState<number>(14)
  const [startDate, setStartDate] = useState<Date>(() => startOfDay(new Date()))
  const [search, setSearch]       = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const days = useMemo(() => {
    const arr: Date[] = []
    for (let i = 0; i < rangeDays; i++) arr.push(addDays(startDate, i))
    return arr
  }, [startDate, rangeDays])

  const endDate = useMemo(() => addDays(startDate, rangeDays), [startDate, rangeDays])

  const clientById = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients])

  // Объекты, отфильтрованные по поиску/категории
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(it => {
      if (!it.active) return false
      if (it.status === 'retired') return false
      if (categoryFilter !== 'all' && it.category !== categoryFilter) return false
      if (q && !`${it.name} ${it.brand ?? ''} ${it.model ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, search, categoryFilter])

  // Категории, присутствующие у объектов
  const availableCategories = useMemo(() => {
    const set = new Set<string>()
    items.forEach(i => { if (i.category) set.add(i.category) })
    return Array.from(set)
  }, [items])

  // Брони пересекающиеся с диапазоном
  const visibleBookings = useMemo(() => {
    const startMs = startDate.getTime()
    const endMs   = endDate.getTime()
    return bookings.filter(b => {
      if (b.status === 'cancelled') return false
      const bStart = new Date(b.start_at).getTime()
      const bEnd   = new Date(b.end_at).getTime()
      return bStart < endMs && bEnd > startMs
    })
  }, [bookings, startDate, endDate])

  // Группировка броней по объекту
  const bookingsByItem = useMemo(() => {
    const map = new Map<string, RentalBooking[]>()
    for (const b of visibleBookings) {
      const arr = map.get(b.item_id) ?? []
      arr.push(b)
      map.set(b.item_id, arr)
    }
    return map
  }, [visibleBookings])

  // ── Расчёт позиции/ширины блока в днях, относительно startDate ──
  const blockGeometry = (b: RentalBooking) => {
    const startMs = startDate.getTime()
    const endMs   = endDate.getTime()
    const bStart  = Math.max(new Date(b.start_at).getTime(), startMs)
    const bEnd    = Math.min(new Date(b.end_at).getTime(),   endMs)
    const left    = ((bStart - startMs) / DAY_MS) * 100 / rangeDays
    const widthPct = ((bEnd - bStart) / DAY_MS) * 100 / rangeDays
    const truncatedLeft  = new Date(b.start_at).getTime() < startMs
    const truncatedRight = new Date(b.end_at).getTime() > endMs
    return { leftPct: left, widthPct, truncatedLeft, truncatedRight }
  }

  // ── Обработчики ──
  const shift = (delta: number) => setStartDate(addDays(startDate, delta))
  const goToday = () => setStartDate(startOfDay(new Date()))

  const handleEmptySlotClick = (itemId: string, day: Date) => {
    const start = new Date(day)
    start.setHours(10, 0, 0, 0)  // дефолтное время 10:00
    const end = new Date(day)
    end.setDate(end.getDate() + 1)
    end.setHours(10, 0, 0, 0)
    const params = new URLSearchParams({
      itemId,
      start: start.toISOString(),
      end: end.toISOString(),
    })
    navigate(`/rental/bookings/new?${params.toString()}`)
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Календарь доступности</h1>
          <Badge variant="secondary" className="ml-1">{filteredItems.length} объ.</Badge>
        </div>
        <Button size="sm" onClick={() => navigate('/rental/bookings/new')}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Новая бронь
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск объекта..."
            className="w-full h-9 pl-8 pr-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Range buttons */}
        <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.days}
              onClick={() => setRangeDays(opt.days)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                rangeDays === opt.days
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Date nav */}
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" onClick={() => shift(-rangeDays)} className="h-9 w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={goToday}>
            Сегодня
          </Button>
          <Button size="icon" variant="outline" onClick={() => shift(rangeDays)} className="h-9 w-9">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Category tabs */}
      {availableCategories.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none mb-3">
          <button
            onClick={() => setCategoryFilter('all')}
            className={cn(
              'shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border',
              categoryFilter === 'all'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-muted'
            )}
          >
            Все
          </button>
          {availableCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                'shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border',
                categoryFilter === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              )}
            >
              {RENTAL_CATEGORY_LABELS[cat as RentalCategory] ?? cat}
            </button>
          ))}
        </div>
      )}

      {/* Period header label */}
      <div className="text-sm text-muted-foreground mb-2 capitalize">
        {fmtMonthYear(startDate)}
        {!isSameMonth(startDate, addDays(endDate, -1)) && ` – ${fmtMonthYear(addDays(endDate, -1))}`}
      </div>

      {/* Loading */}
      {(loadingItems || loadingBookings) && (
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loadingItems && !loadingBookings && filteredItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed">
          <KeyRound className="h-10 w-10 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground mb-3">
            {items.length === 0 ? 'Каталог пуст. Добавьте объекты аренды.' : 'Ничего не найдено по фильтрам.'}
          </p>
          {items.length === 0 && (
            <Button size="sm" onClick={() => navigate('/rental/items')}>
              <KeyRound className="h-3.5 w-3.5 mr-1.5" />
              Перейти в каталог
            </Button>
          )}
        </div>
      )}

      {/* Gantt */}
      {!loadingItems && !loadingBookings && filteredItems.length > 0 && (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Header row: days */}
            <div className="flex border-b bg-muted/30 sticky top-0 z-10">
              <div className="w-56 shrink-0 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-r">
                Объект
              </div>
              <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${rangeDays}, 1fr)` }}>
                {days.map((d, idx) => {
                  const today = startOfDay(new Date()).getTime() === d.getTime()
                  const weekend = isWeekend(d)
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'text-center text-[10px] py-2 border-r last:border-r-0 select-none',
                        weekend && 'bg-muted/40',
                        today && 'bg-primary/10'
                      )}
                    >
                      <div className={cn('font-medium', today && 'text-primary')}>{d.getDate()}</div>
                      <div className="text-muted-foreground/70 uppercase">
                        {d.toLocaleDateString('ru', { weekday: 'short' }).slice(0, 2)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Rows */}
            {filteredItems.map(item => {
              const itemBookings = bookingsByItem.get(item.id) ?? []
              return (
                <div key={item.id} className="flex border-b last:border-b-0 group">
                  {/* Item label */}
                  <button
                    onClick={() => navigate('/rental/items')}
                    className="w-56 shrink-0 px-3 py-2.5 text-left border-r hover:bg-muted/50 transition-colors"
                    title="Открыть каталог"
                  >
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {(item.brand || item.model) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {[item.brand, item.model].filter(Boolean).join(' ')}
                        </p>
                      )}
                      {item.inventory_qty > 1 && (
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded px-1">
                          ×{item.inventory_qty}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Track */}
                  <div
                    className="flex-1 relative grid"
                    style={{ gridTemplateColumns: `repeat(${rangeDays}, 1fr)`, minHeight: '52px' }}
                  >
                    {/* Day cells (background + click target) */}
                    {days.map((d, idx) => {
                      const today = startOfDay(new Date()).getTime() === d.getTime()
                      const weekend = isWeekend(d)
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleEmptySlotClick(item.id, d)}
                          className={cn(
                            'border-r last:border-r-0 transition-colors',
                            weekend && 'bg-muted/30',
                            today && 'bg-primary/5',
                            'hover:bg-primary/10 cursor-cell'
                          )}
                          title={`${item.name} — ${d.toLocaleDateString('ru')}`}
                        />
                      )
                    })}

                    {/* Booking blocks (absolute) */}
                    {itemBookings.map(b => {
                      const { leftPct, widthPct, truncatedLeft, truncatedRight } = blockGeometry(b)
                      const client = b.client_id ? clientById.get(b.client_id) : null
                      const clientName = client
                        ? `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || (client.phone ?? '')
                        : 'Без клиента'
                      const start = new Date(b.start_at).toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                      const end   = new Date(b.end_at).toLocaleString('ru',   { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); navigate(`/rental/bookings/${b.id}`) }}
                          className={cn(
                            'absolute top-1.5 bottom-1.5 px-1.5 rounded border text-[10px] font-medium leading-tight overflow-hidden flex items-center hover:shadow-md transition-shadow z-[1]',
                            STATUS_BLOCK_COLORS[b.status],
                            truncatedLeft && 'rounded-l-none border-l-0',
                            truncatedRight && 'rounded-r-none border-r-0',
                          )}
                          style={{
                            left:  `${leftPct}%`,
                            width: `${Math.max(widthPct, 0.8)}%`,
                          }}
                          title={`${b.number} • ${clientName}\n${start} → ${end}`}
                        >
                          <span className="truncate">
                            {b.number} · {clientName}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      {!loadingItems && filteredItems.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {Object.entries(STATUS_BLOCK_COLORS).map(([k, cls]) => (
            <div key={k} className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded border', cls)}>
              <span className="capitalize">
                {k === 'pending' ? 'ожидает' : k === 'confirmed' ? 'подтв.' : k === 'active' ? 'в аренде' : k === 'returned' ? 'возвр.' : k === 'cancelled' ? 'отмен.' : 'просрочка'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
