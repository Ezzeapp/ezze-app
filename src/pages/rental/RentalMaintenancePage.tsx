import { useEffect, useMemo, useState } from 'react'
import {
  Wrench, Plus, Trash2, Search, X, ChevronDown, AlertTriangle, CheckCircle2, Clock, Loader2,
} from 'lucide-react'
import {
  useRentalMaintenance, useUpsertRentalMaintenance, useDeleteRentalMaintenance,
} from '@/hooks/useRentalMaintenance'
import { useRentalItems } from '@/hooks/useRentalItems'
import type { RentalMaintenance, RentalItem } from '@/types/rental'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { toast } from '@/components/shared/Toaster'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

const TYPE_LABELS: Record<string, string> = {
  scheduled:  'Плановое ТО',
  repair:     'Ремонт',
  inspection: 'Осмотр',
  cleaning:   'Чистка',
  other:      'Прочее',
}

const TYPE_COLORS: Record<string, string> = {
  scheduled:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  repair:     'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  inspection: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  cleaning:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  other:      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

const STATUS_LABELS: Record<string, string> = {
  planned:     'Запланировано',
  in_progress: 'В работе',
  completed:   'Выполнено',
  cancelled:   'Отменено',
}

const STATUS_COLORS: Record<string, string> = {
  planned:     'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  completed:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled:   'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

function isOverdue(m: RentalMaintenance): boolean {
  if (m.status !== 'planned') return false
  if (!m.planned_at) return false
  return new Date(m.planned_at).getTime() < Date.now()
}

// ── Form ──────────────────────────────────────────────────────────────────────

interface FormProps {
  open: boolean
  onClose: () => void
  initial: RentalMaintenance | null
  items: RentalItem[]
  defaultItemId?: string
}

function MaintenanceFormDialog({ open, onClose, initial, items, defaultItemId }: FormProps) {
  const upsert = useUpsertRentalMaintenance()
  const isEdit = !!initial

  const [itemId, setItemId]         = useState(initial?.item_id ?? defaultItemId ?? '')
  const [type, setType]             = useState<RentalMaintenance['type']>(initial?.type ?? 'scheduled')
  const [title, setTitle]           = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [plannedAt, setPlannedAt]   = useState(initial?.planned_at?.slice(0, 16) ?? '')
  const [completedAt, setCompletedAt] = useState(initial?.completed_at?.slice(0, 16) ?? '')
  const [partsCost, setPartsCost]   = useState(String(initial?.parts_cost ?? '0'))
  const [laborCost, setLaborCost]   = useState(String(initial?.labor_cost ?? '0'))
  const [odometer, setOdometer]     = useState(String(initial?.odometer_at_service ?? ''))
  const [engineHours, setEngineHours] = useState(String(initial?.engine_hours_at_service ?? ''))
  const [contractor, setContractor] = useState(initial?.contractor ?? '')
  const [notes, setNotes]           = useState(initial?.notes ?? '')
  const [status, setStatus]         = useState<RentalMaintenance['status']>(initial?.status ?? 'planned')

  // Сброс при открытии
  useEffect(() => {
    if (!open) return
    if (initial) {
      setItemId(initial.item_id)
      setType(initial.type)
      setTitle(initial.title)
      setDescription(initial.description ?? '')
      setPlannedAt(initial.planned_at?.slice(0, 16) ?? '')
      setCompletedAt(initial.completed_at?.slice(0, 16) ?? '')
      setPartsCost(String(initial.parts_cost ?? '0'))
      setLaborCost(String(initial.labor_cost ?? '0'))
      setOdometer(String(initial.odometer_at_service ?? ''))
      setEngineHours(String(initial.engine_hours_at_service ?? ''))
      setContractor(initial.contractor ?? '')
      setNotes(initial.notes ?? '')
      setStatus(initial.status)
    } else {
      setItemId(defaultItemId ?? '')
      setType('scheduled')
      setTitle(''); setDescription('')
      setPlannedAt(''); setCompletedAt('')
      setPartsCost('0'); setLaborCost('0')
      setOdometer(''); setEngineHours(''); setContractor('')
      setNotes('')
      setStatus('planned')
    }
  }, [open, initial, defaultItemId])

  // Автомаркер completed_at когда статус → completed
  useEffect(() => {
    if (status === 'completed' && !completedAt) {
      const now = new Date()
      const off = now.getTimezoneOffset()
      setCompletedAt(new Date(now.getTime() - off * 60_000).toISOString().slice(0, 16))
    }
  }, [status, completedAt])

  const handleSubmit = async () => {
    if (!itemId) { toast.error('Выберите объект'); return }
    if (!title.trim()) { toast.error('Введите название работы'); return }
    const cost = (Number(partsCost) || 0) + (Number(laborCost) || 0)
    try {
      await upsert.mutateAsync({
        ...(initial?.id ? { id: initial.id } : {}),
        item_id: itemId,
        type,
        title: title.trim(),
        description: description.trim() || null,
        planned_at:   plannedAt   ? new Date(plannedAt).toISOString()   : null,
        completed_at: completedAt ? new Date(completedAt).toISOString() : null,
        parts_cost: Number(partsCost) || 0,
        labor_cost: Number(laborCost) || 0,
        cost,
        odometer_at_service:    odometer    ? Number(odometer)    : null,
        engine_hours_at_service: engineHours ? Number(engineHours) : null,
        contractor: contractor.trim() || null,
        notes: notes.trim() || null,
        status,
      })
      toast.success(isEdit ? 'Запись обновлена' : 'Запись добавлена')
      onClose()
    } catch (e) {
      console.error(e)
      toast.error('Ошибка сохранения')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редактировать ТО' : 'Запланировать ТО'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Объект *</Label>
            <div className="relative">
              <select
                value={itemId}
                onChange={e => setItemId(e.target.value)}
                className="w-full h-10 appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— выберите объект —</option>
                {items.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.name}{i.brand ? ` — ${i.brand}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Тип</Label>
              <div className="relative">
                <select
                  value={type}
                  onChange={e => setType(e.target.value as RentalMaintenance['type'])}
                  className="w-full h-10 appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Статус</Label>
              <div className="relative">
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as RentalMaintenance['status'])}
                  className="w-full h-10 appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Название работы *</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Замена масла, балансировка, осмотр перед сезоном..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Описание</Label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Что именно делается, какие работы включены..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Запланировано на</Label>
              <Input
                type="datetime-local"
                value={plannedAt}
                onChange={e => setPlannedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Выполнено</Label>
              <Input
                type="datetime-local"
                value={completedAt}
                onChange={e => setCompletedAt(e.target.value)}
              />
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Стоимость</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Запчасти</Label>
                <Input type="number" min={0} value={partsCost} onChange={e => setPartsCost(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Работа</Label>
                <Input type="number" min={0} value={laborCost} onChange={e => setLaborCost(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Пробег при ТО, км</Label>
              <Input type="number" min={0} value={odometer} onChange={e => setOdometer(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Моточасы при ТО</Label>
              <Input type="number" min={0} value={engineHours} onChange={e => setEngineHours(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Подрядчик</Label>
            <Input
              value={contractor}
              onChange={e => setContractor(e.target.value)}
              placeholder="Bosch Service, СТО на Лермонтова..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Заметки</Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSubmit} loading={upsert.isPending}>
            {isEdit ? 'Сохранить' : 'Добавить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function RentalMaintenancePage() {
  const { data: maintenance = [], isLoading } = useRentalMaintenance()
  const { data: items = [] } = useRentalItems()
  const deleteItem = useDeleteRentalMaintenance()
  const currencySymbol = useCurrencySymbol()

  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState<string>('all')
  const [editing, setEditing]             = useState<RentalMaintenance | null>(null)
  const [addOpen, setAddOpen]             = useState(false)
  const [deleteId, setDeleteId]           = useState<string | null>(null)

  const itemById = useMemo(() => new Map(items.map(i => [i.id, i])), [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return maintenance.filter(m => {
      if (statusFilter === 'overdue') {
        if (!isOverdue(m)) return false
      } else if (statusFilter !== 'all' && m.status !== statusFilter) {
        return false
      }
      if (!q) return true
      const item = itemById.get(m.item_id)
      return (
        m.title.toLowerCase().includes(q) ||
        (item?.name ?? '').toLowerCase().includes(q) ||
        (m.contractor ?? '').toLowerCase().includes(q)
      )
    })
  }, [maintenance, search, statusFilter, itemById])

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: maintenance.length,
      overdue: maintenance.filter(isOverdue).length,
    }
    for (const m of maintenance) c[m.status] = (c[m.status] || 0) + 1
    return c
  }, [maintenance])

  const totalCost = useMemo(
    () => maintenance.filter(m => m.status === 'completed').reduce((sum, m) => sum + (m.cost || 0), 0),
    [maintenance],
  )

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteItem.mutateAsync(deleteId)
      toast.success('Запись удалена')
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
          <Wrench className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Техническое обслуживание</h1>
          <Badge variant="secondary" className="ml-1">{maintenance.length}</Badge>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} disabled={items.length === 0}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Запланировать ТО
        </Button>
      </div>

      {/* Summary */}
      {maintenance.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Всего записей</p>
            <p className="text-xl font-semibold">{maintenance.length}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Запланировано</p>
            <p className="text-xl font-semibold">{counts.planned ?? 0}</p>
          </div>
          <div className={cn(
            'rounded-lg border p-3',
            (counts.overdue ?? 0) > 0 && 'border-rose-300 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800'
          )}>
            <p className="text-xs text-muted-foreground">Просрочено</p>
            <p className={cn('text-xl font-semibold', (counts.overdue ?? 0) > 0 && 'text-rose-600 dark:text-rose-400')}>
              {counts.overdue ?? 0}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Затрачено</p>
            <p className="text-xl font-semibold">{formatCurrency(totalCost)} {currencySymbol}</p>
          </div>
        </div>
      )}

      {/* Hint when no items */}
      {items.length === 0 && (
        <div className="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">Сначала добавьте объекты аренды</p>
            <p className="text-amber-700 dark:text-amber-300 text-xs mt-0.5">
              ТО привязывается к конкретному объекту.
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по работе, объекту, подрядчику..."
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
          { key: 'all',     label: 'Все' },
          { key: 'overdue', label: 'Просрочено' },
          ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ key: k, label: v })),
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
              statusFilter === tab.key
                ? 'bg-primary text-primary-foreground border-primary'
                : tab.key === 'overdue' && (counts.overdue ?? 0) > 0
                  ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-700 hover:bg-rose-100'
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
          <Wrench className="h-10 w-10 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground mb-3">
            {maintenance.length === 0
              ? 'Записей о ТО пока нет.'
              : 'Ничего не найдено по фильтрам.'}
          </p>
          {maintenance.length === 0 && items.length > 0 && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Запланировать первое ТО
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Объект</th>
                <th className="text-left p-3 font-medium">Работа</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Тип</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Дата</th>
                <th className="text-right p-3 font-medium">Стоимость</th>
                <th className="text-left p-3 font-medium">Статус</th>
                <th className="w-10 p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const item = itemById.get(m.item_id)
                const overdue = isOverdue(m)
                return (
                  <tr
                    key={m.id}
                    className={cn(
                      'border-t hover:bg-muted/30 cursor-pointer',
                      overdue && 'bg-rose-50/50 dark:bg-rose-900/10'
                    )}
                    onClick={() => setEditing(m)}
                  >
                    <td className="p-3">
                      <p className="font-medium truncate max-w-[180px]">{item?.name ?? '—'}</p>
                      {item?.brand && <p className="text-xs text-muted-foreground truncate">{item.brand} {item.model ?? ''}</p>}
                    </td>
                    <td className="p-3">
                      <p className="font-medium">{m.title}</p>
                      {m.contractor && <p className="text-xs text-muted-foreground">{m.contractor}</p>}
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium',
                        TYPE_COLORS[m.type]
                      )}>
                        {TYPE_LABELS[m.type]}
                      </span>
                    </td>
                    <td className="p-3 hidden sm:table-cell text-xs whitespace-nowrap">
                      {m.completed_at ? (
                        <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3" />
                          {new Date(m.completed_at).toLocaleDateString('ru')}
                        </span>
                      ) : m.planned_at ? (
                        <span className={cn('inline-flex items-center gap-1', overdue ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>
                          <Clock className="h-3 w-3" />
                          {new Date(m.planned_at).toLocaleDateString('ru')}
                          {overdue && <AlertTriangle className="h-3 w-3 ml-0.5" />}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {m.cost > 0 ? `${formatCurrency(m.cost)} ${currencySymbol}` : '—'}
                    </td>
                    <td className="p-3">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide',
                        STATUS_COLORS[m.status]
                      )}>
                        {STATUS_LABELS[m.status]}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteId(m.id) }}
                        className="text-muted-foreground hover:text-destructive"
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

      {/* Dialogs */}
      <MaintenanceFormDialog
        open={addOpen || !!editing}
        onClose={() => { setAddOpen(false); setEditing(null) }}
        initial={editing}
        items={items}
      />
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Удалить запись о ТО?"
        loading={deleteItem.isPending}
      />
    </div>
  )
}
