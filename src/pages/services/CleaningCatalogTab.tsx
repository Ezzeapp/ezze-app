import { useState, useMemo, useRef } from 'react'
import { Plus, Trash2, Loader2, X, Download, Search, Check } from 'lucide-react'
import { useCleaningItemTypes, useUpsertItemType, useDeleteItemType } from '@/hooks/useCleaningItemTypes'
import type { CleaningItemType } from '@/hooks/useCleaningItemTypes'
import { ORDER_TYPE_LABELS } from '@/hooks/useCleaningOrders'
import type { OrderType } from '@/hooks/useCleaningOrders'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { toast } from '@/components/shared/Toaster'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useGlobalServices } from '@/hooks/useGlobalCatalogs'

// ── Category detection ──────────────────────────────────────────────────────
const CARPET_KW    = ['кв.м', 'ковёр', 'ковр']
const FURNITURE_KW = ['диван', 'кресло', 'матрас', 'пуф', 'угловой']
const SHOES_KW     = ['сапог', 'ботин', 'кроссов', 'туфл', 'сандал', 'обувь']
const CURTAINS_KW  = ['штор', 'тюл', 'занавес', 'ламбрек']
const BEDDING_KW   = ['одеял', 'подушк', 'постел', 'простын', 'наволочк', 'пеленк']

function detectCategory(name: string): OrderType {
  const n = name.toLowerCase()
  if (CARPET_KW.some(k => n.includes(k))) return 'carpet'
  if (FURNITURE_KW.some(k => n.includes(k))) return 'furniture'
  if (SHOES_KW.some(k => n.includes(k))) return 'shoes'
  if (CURTAINS_KW.some(k => n.includes(k))) return 'curtains'
  if (BEDDING_KW.some(k => n.includes(k))) return 'bedding'
  return 'clothing'
}

// ── Badge colors per category ───────────────────────────────────────────────
const CATEGORY_BADGE_CLASSES: Record<OrderType, string> = {
  clothing:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  carpet:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  furniture: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  shoes:     'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  curtains:  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  bedding:   'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
}

function CategoryBadge({ category }: { category: OrderType }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', CATEGORY_BADGE_CLASSES[category])}>
      {ORDER_TYPE_LABELS[category]}
    </span>
  )
}

// ── Add dialog ──────────────────────────────────────────────────────────────
interface AddDialogProps {
  open: boolean
  onClose: () => void
  maxSortOrder: number
}

function AddItemDialog({ open, onClose, maxSortOrder }: AddDialogProps) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [days, setDays] = useState('3')
  const upsert = useUpsertItemType()

  const detectedCategory = useMemo(() => detectCategory(name), [name])

  const handleSubmit = async () => {
    if (!name.trim()) return
    try {
      await upsert.mutateAsync({
        name: name.trim(),
        default_price: Number(price) || 0,
        default_days: Number(days) || 3,
        sort_order: maxSortOrder + 1,
      })
      toast.success('Позиция добавлена')
      setName('')
      setPrice('')
      setDays('3')
      onClose()
    } catch {
      toast.error('Ошибка сохранения')
    }
  }

  const handleClose = () => {
    setName('')
    setPrice('')
    setDays('3')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Добавить позицию</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Название *</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Например: Куртка зимняя"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
            {name.trim() && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Категория:</span>
                <CategoryBadge category={detectedCategory} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Цена</Label>
              <Input
                type="number"
                min={0}
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Дней</Label>
              <Input
                type="number"
                min={1}
                value={days}
                onChange={e => setDays(e.target.value)}
                placeholder="3"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={!name.trim()} loading={upsert.isPending}>
            Добавить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Import from global catalog dialog ───────────────────────────────────────
interface ImportCleaningDialogProps {
  open: boolean
  onClose: () => void
  maxSortOrder: number
}

function ImportCleaningDialog({ open, onClose, maxSortOrder }: ImportCleaningDialogProps) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)

  const { data: globalServices = [], isLoading } = useGlobalServices()
  const upsert = useUpsertItemType()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? globalServices.filter(s => s.name.toLowerCase().includes(q)) : globalServices
  }, [globalServices, search])

  const grouped = useMemo(() =>
    filtered.reduce<Record<string, typeof filtered>>((acc, s) => {
      const cat = s.category || 'Другое'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(s)
      return acc
    }, {}),
    [filtered]
  )

  const allSelected = filtered.length > 0 && selected.size === filtered.length

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleImport = async () => {
    if (selected.size === 0) return
    setImporting(true)
    const toImport = globalServices.filter(s => selected.has(s.id))
    let count = 0
    let errors = 0
    for (let i = 0; i < toImport.length; i++) {
      const s = toImport[i]
      try {
        await upsert.mutateAsync({
          name: s.name,
          default_price: s.price || 0,
          default_days: 3,
          sort_order: maxSortOrder + i + 1,
        })
        count++
      } catch {
        errors++
      }
    }
    setImporting(false)
    if (count > 0) toast.success(`Добавлено позиций: ${count}`)
    if (errors > 0) toast.error('Некоторые позиции не добавились')
    setSelected(new Set())
    onClose()
  }

  const handleClose = () => {
    setSearch('')
    setSelected(new Set())
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent mobileFullscreen className="max-w-lg sm:h-[85vh] sm:max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Импорт из справочника
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-6 pb-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(new Set()) }}
              placeholder="Поиск по позициям..."
              className="pl-9"
            />
          </div>
        </div>

        {/* Select all */}
        {filtered.length > 0 && (
          <div className="px-6 pb-2 shrink-0 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelected(allSelected ? new Set() : new Set(filtered.map(s => s.id)))}
              className="text-xs text-primary hover:underline"
            >
              {allSelected ? 'Снять выделение' : 'Выбрать все'}
            </button>
            {selected.size > 0 && (
              <Badge variant="secondary" className="text-xs">Выбрано: {selected.size}</Badge>
            )}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-2 border-t pt-2">
          {isLoading && (
            <div className="space-y-2 pt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 w-full rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">
                {search ? 'Ничего не найдено' : 'Справочник пуст'}
              </p>
            </div>
          )}

          {!isLoading && Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className="py-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{cat}</span>
              </div>
              <div className="space-y-1">
                {items.map(s => {
                  const isSelected = selected.has(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSelect(s.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors',
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
                      )}
                    >
                      <div className={cn(
                        'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                        isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                      )}>
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className="text-sm font-medium flex-1">{s.name}</span>
                      {s.price != null && s.price > 0 && (
                        <span className="text-xs text-muted-foreground shrink-0">{s.price}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="px-6 pb-6 pt-3 shrink-0 border-t">
          <Button variant="outline" onClick={handleClose}>Отмена</Button>
          <Button
            onClick={handleImport}
            disabled={selected.size === 0}
            loading={importing}
          >
            <Download className="h-4 w-4 mr-2" />
            Добавить выбранное ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Inline editable cell ────────────────────────────────────────────────────
interface EditCellProps {
  item: CleaningItemType
  field: 'name' | 'price' | 'days'
  editingCell: { id: string; field: 'name' | 'price' | 'days' } | null
  editingValue: string
  savingId: string | null
  onStartEdit: (item: CleaningItemType, field: 'name' | 'price' | 'days') => void
  onChangeValue: (v: string) => void
  onSave: () => void
  onCancel: () => void
}

function EditCell({ item, field, editingCell, editingValue, savingId, onStartEdit, onChangeValue, onSave, onCancel }: EditCellProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isEditing = editingCell?.id === item.id && editingCell?.field === field
  const isSaving = savingId === item.id

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        type={field === 'name' ? 'text' : 'number'}
        className="w-full px-2 py-1 text-sm rounded border border-primary bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        value={editingValue}
        onChange={e => onChangeValue(e.target.value)}
        onBlur={onSave}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); onSave() }
          if (e.key === 'Escape') onCancel()
        }}
      />
    )
  }

  const displayValue = field === 'name'
    ? item.name
    : field === 'price'
    ? String(item.default_price)
    : String(item.default_days)

  return (
    <div
      onClick={() => !isSaving && onStartEdit(item, field)}
      className={cn(
        'min-h-[1.75rem] px-1 rounded cursor-pointer hover:bg-muted/50 transition-colors flex items-center',
        isSaving && 'opacity-60 cursor-wait'
      )}
    >
      {isSaving && field === 'name' ? (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      ) : (
        <span className="text-sm">{displayValue}</span>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export function CleaningCatalogTab() {
  const { data: items = [], isLoading } = useCleaningItemTypes()
  const upsert = useUpsertItemType()
  const deleteItem = useDeleteItemType()
  const currencySymbol = useCurrencySymbol()

  const [categoryFilter, setCategoryFilter] = useState<OrderType | 'all'>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'name' | 'price' | 'days' } | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  // Detect categories for each item and build category counts
  const itemsWithCategory = useMemo(() =>
    items.map(item => ({ ...item, category: detectCategory(item.name) })),
    [items]
  )

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<OrderType, number>> = {}
    itemsWithCategory.forEach(item => {
      counts[item.category] = (counts[item.category] || 0) + 1
    })
    return counts
  }, [itemsWithCategory])

  const availableCategories = useMemo(() =>
    (['clothing', 'carpet', 'furniture', 'shoes', 'curtains', 'bedding'] as OrderType[])
      .filter(cat => (categoryCounts[cat] || 0) > 0),
    [categoryCounts]
  )

  const filteredItems = useMemo(() =>
    categoryFilter === 'all'
      ? itemsWithCategory
      : itemsWithCategory.filter(item => item.category === categoryFilter),
    [itemsWithCategory, categoryFilter]
  )

  const maxSortOrder = useMemo(() =>
    items.reduce((max, item) => Math.max(max, item.sort_order), 0),
    [items]
  )

  const startEdit = (item: CleaningItemType, field: 'name' | 'price' | 'days') => {
    const value = field === 'name'
      ? item.name
      : field === 'price'
      ? String(item.default_price)
      : String(item.default_days)
    setEditingCell({ id: item.id, field })
    setEditingValue(value)
  }

  const cancelEdit = () => {
    setEditingCell(null)
    setEditingValue('')
  }

  const saveEdit = async () => {
    if (!editingCell) return
    const item = items.find(i => i.id === editingCell.id)
    if (!item) { cancelEdit(); return }

    const trimmed = editingValue.trim()
    // Check if value actually changed
    const currentValue = editingCell.field === 'name'
      ? item.name
      : editingCell.field === 'price'
      ? String(item.default_price)
      : String(item.default_days)

    if (trimmed === currentValue || (trimmed === '' && editingCell.field === 'name')) {
      cancelEdit()
      return
    }

    const payload: Partial<CleaningItemType> & { name: string } = {
      id: item.id,
      name: item.name,
      default_price: item.default_price,
      default_days: item.default_days,
      sort_order: item.sort_order,
      product: item.product,
    }

    if (editingCell.field === 'name') payload.name = trimmed
    else if (editingCell.field === 'price') payload.default_price = Math.max(0, Number(trimmed) || 0)
    else if (editingCell.field === 'days') payload.default_days = Math.max(1, Number(trimmed) || 1)

    setEditingCell(null)
    setEditingValue('')
    setSavingId(item.id)
    try {
      await upsert.mutateAsync(payload)
    } catch {
      toast.error('Ошибка сохранения')
    } finally {
      setSavingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteItem.mutateAsync(id)
      toast.success('Позиция удалена')
    } catch {
      toast.error('Ошибка удаления')
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{items.length} позиций в каталоге</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Из справочника</span>
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Добавить
          </Button>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setCategoryFilter('all')}
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
            categoryFilter === 'all'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:bg-muted'
          )}
        >
          Все ({items.length})
        </button>
        {availableCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
              categoryFilter === cat
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-muted'
            )}
          >
            {ORDER_TYPE_LABELS[cat]} ({categoryCounts[cat]})
          </button>
        ))}
      </div>

      {/* Table */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed">
          <p className="text-sm text-muted-foreground">Нет позиций в этой категории</p>
          <button
            className="mt-2 text-xs text-primary hover:underline"
            onClick={() => setCategoryFilter('all')}
          >
            Показать все
          </button>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Название</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Категория</th>
                <th className="text-left p-3 font-medium">Цена ({currencySymbol})</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Дней</th>
                <th className="w-10 p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const isDeleting = deletingId === item.id
                const isSaving = savingId === item.id
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      'border-t transition-colors',
                      isDeleting && 'opacity-40',
                      isSaving && 'bg-muted/30'
                    )}
                  >
                    {/* Name */}
                    <td className="p-3 max-w-[200px]">
                      <EditCell
                        item={item}
                        field="name"
                        editingCell={editingCell}
                        editingValue={editingValue}
                        savingId={savingId}
                        onStartEdit={startEdit}
                        onChangeValue={setEditingValue}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                      />
                    </td>

                    {/* Category badge */}
                    <td className="p-3 hidden sm:table-cell">
                      <CategoryBadge category={item.category} />
                    </td>

                    {/* Price */}
                    <td className="p-3 w-28">
                      <EditCell
                        item={item}
                        field="price"
                        editingCell={editingCell}
                        editingValue={editingValue}
                        savingId={savingId}
                        onStartEdit={startEdit}
                        onChangeValue={setEditingValue}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                      />
                    </td>

                    {/* Days */}
                    <td className="p-3 w-20 hidden sm:table-cell">
                      <EditCell
                        item={item}
                        field="days"
                        editingCell={editingCell}
                        editingValue={editingValue}
                        savingId={savingId}
                        onStartEdit={startEdit}
                        onChangeValue={setEditingValue}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                      />
                    </td>

                    {/* Delete */}
                    <td className="p-3 w-10">
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
                      ) : (
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={!!deletingId || !!savingId}
                          className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
                          title="Удалить"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddItemDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        maxSortOrder={maxSortOrder}
      />

      <ImportCleaningDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        maxSortOrder={maxSortOrder}
      />
    </div>
  )
}
