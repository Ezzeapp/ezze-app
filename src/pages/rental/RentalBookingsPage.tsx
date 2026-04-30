import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, X, ClipboardList, ChevronDown, Trash2, AlertCircle,
} from 'lucide-react'
import { useRentalBookings, useDeleteRentalBooking } from '@/hooks/useRentalBookings'
import { useRentalItems } from '@/hooks/useRentalItems'
import { useClients } from '@/hooks/useClients'
import type { RentalBooking, RentalBookingStatus } from '@/types/rental'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { toast } from '@/components/shared/Toaster'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

const BOOKING_STATUS_LABELS: Record<RentalBookingStatus, string> = {
  pending:   'Ожидает',
  confirmed: 'Подтверждена',
  active:    'В аренде',
  returned:  'Возвращён',
  cancelled: 'Отменена',
  overdue:   'Просрочка',
}

const BOOKING_STATUS_COLORS: Record<RentalBookingStatus, string> = {
  pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  active:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  returned:  'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  overdue:   'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

function formatPeriod(startAt: string, endAt: string): string {
  const s = new Date(startAt)
  const e = new Date(endAt)
  const sameDay = s.toDateString() === e.toDateString()
  const fmt = (d: Date) => d.toLocaleString('ru', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
  if (sameDay) {
    const dateOnly = s.toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: '2-digit' })
    const timeS = s.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
    const timeE = e.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
    return `${dateOnly} ${timeS}–${timeE}`
  }
  return `${fmt(s)} → ${fmt(e)}`
}

export function RentalBookingsPage() {
  const navigate = useNavigate()
  const { data: bookings = [], isLoading } = useRentalBookings()
  const { data: items = [] } = useRentalItems()
  const { data: clients = [] } = useClients()
  const deleteBooking = useDeleteRentalBooking()
  const currencySymbol = useCurrencySymbol()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const itemById   = useMemo(() => new Map(items.map(i => [i.id, i])), [items])
  const clientById = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return bookings.filter(b => {
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter
      if (!matchesStatus) return false
      if (!q) return true
      const item = itemById.get(b.item_id)
      const client = b.client_id ? clientById.get(b.client_id) : null
      const clientName = client ? `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() : ''
      return (
        b.number.toLowerCase().includes(q) ||
        (item?.name ?? '').toLowerCase().includes(q) ||
        clientName.toLowerCase().includes(q) ||
        (client?.phone ?? '').toLowerCase().includes(q)
      )
    })
  }, [bookings, search, statusFilter, itemById, clientById])

  const counts: Record<string, number> = useMemo(() => {
    const c: Record<string, number> = { all: bookings.length }
    for (const b of bookings) c[b.status] = (c[b.status] || 0) + 1
    return c
  }, [bookings])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteBooking.mutateAsync(deleteId)
      toast.success('Бронь удалена')
    } catch {
      toast.error('Ошибка удаления')
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Брони</h1>
          <Badge variant="secondary" className="ml-1">{bookings.length}</Badge>
        </div>
        <Button size="sm" onClick={() => navigate('/rental/bookings/new')}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Новая бронь
        </Button>
      </div>

      {/* Empty hint when no items */}
      {items.length === 0 && (
        <div className="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">Сначала добавьте объекты аренды</p>
            <p className="text-amber-700 dark:text-amber-300 text-xs mt-0.5">
              Бронь нельзя создать без объекта.{' '}
              <button onClick={() => navigate('/rental/items')} className="underline font-medium">
                Перейти в каталог
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Search + status */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по номеру, объекту, клиенту..."
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
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none mb-4">
        {[
          { key: 'all', label: 'Все' },
          ...(Object.entries(BOOKING_STATUS_LABELS).map(([k, v]) => ({ key: k, label: v }))),
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
              statusFilter === tab.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-muted'
            )}
          >
            {tab.label} ({counts[tab.key] ?? 0})
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed">
          <ClipboardList className="h-10 w-10 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground mb-3">
            {bookings.length === 0
              ? 'Броней пока нет. Создайте первую.'
              : 'Ничего не найдено по фильтрам.'}
          </p>
          {bookings.length === 0 && items.length > 0 && (
            <Button size="sm" onClick={() => navigate('/rental/bookings/new')}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Новая бронь
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Номер</th>
                <th className="text-left p-3 font-medium">Объект</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Клиент</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Период</th>
                <th className="text-right p-3 font-medium">Сумма</th>
                <th className="text-left p-3 font-medium">Статус</th>
                <th className="w-10 p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const item = itemById.get(b.item_id)
                const client = b.client_id ? clientById.get(b.client_id) : null
                const clientName = client
                  ? `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || client.phone || '—'
                  : '—'
                return (
                  <tr
                    key={b.id}
                    className="border-t hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/rental/bookings/${b.id}`)}
                  >
                    <td className="p-3 font-mono text-xs">{b.number}</td>
                    <td className="p-3">
                      <p className="font-medium truncate max-w-[180px]">{item?.name ?? '—'}</p>
                      {item?.brand && <p className="text-xs text-muted-foreground truncate">{item.brand} {item.model ?? ''}</p>}
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <p className="truncate max-w-[140px]">{clientName}</p>
                      {client?.phone && <p className="text-xs text-muted-foreground">{client.phone}</p>}
                    </td>
                    <td className="p-3 hidden sm:table-cell text-xs whitespace-nowrap">
                      {formatPeriod(b.start_at, b.end_at)}
                    </td>
                    <td className="p-3 text-right font-medium whitespace-nowrap">
                      {formatCurrency(b.total_amount || b.base_price)} {currencySymbol}
                    </td>
                    <td className="p-3">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide',
                        BOOKING_STATUS_COLORS[b.status]
                      )}>
                        {BOOKING_STATUS_LABELS[b.status]}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteId(b.id) }}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Удалить бронь?"
        loading={deleteBooking.isPending}
      />
    </div>
  )
}
