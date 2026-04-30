import { useEffect, useState, useMemo, useRef } from 'react'
import { Plus, Trash2, Loader2, X, Download, Search, Check, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { useCleaningItemTypes, useUpsertItemType, useDeleteItemType } from '@/hooks/useCleaningItemTypes'
import type { CleaningItemType } from '@/hooks/useCleaningItemTypes'
import { ORDER_TYPE_LABELS, useCleaningOrderTypesConfig } from '@/hooks/useCleaningOrders'
import type { CleaningOrderTypeConfig } from '@/hooks/useCleaningOrders'
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
import { useGlobalServices } from '@/hooks/useGlobalCatalogs'

// ── Keyword-based category suggest (used only as UX hint in AddDialog) ───────
const EXTRAS_KW    = ['срочн', 'доставк', 'выезд', 'дезодор', 'дезинф', 'упаковк', 'консервац', 'хранен', 'антимол', 'антиклещ', 'аромат', 'страховк']
const CARPET_KW    = ['кв.м', 'ковёр', 'ковр', 'палас']
const FURNITURE_KW = ['диван', 'кресло', 'матрас', 'пуф', 'угловой', 'банкетк', 'стул мягк', 'автосалон', 'автомоб', 'автокресл', 'изголов']
const SHOES_KW     = ['сапог', 'ботин', 'кроссов', 'туфл', 'сандал', 'обувь', 'угг', 'кед', 'мокасин', 'шлёпанц', 'шлепанц', 'эспадрил', 'балетк', 'тапк', 'унт', 'валенк']
const CURTAINS_KW  = ['штор', 'тюл', 'занавес', 'ламбрек', 'жалюзи', 'гардин', 'портьер', 'балдахин', 'плиссе']
const BEDDING_KW   = ['одеял', 'подушк', 'постел', 'простын', 'наволочк', 'пеленк', 'наматрасник', 'плед', 'покрывал', 'скатерт', 'салфетк', 'полотенц']

function suggestCategory(name: string): string {
  const n = name.toLowerCase()
  if (EXTRAS_KW.some(k => n.includes(k))) return 'extras'
  if (CARPET_KW.some(k => n.includes(k))) return 'carpet'
  if (FURNITURE_KW.some(k => n.includes(k))) return 'furniture'
  if (SHOES_KW.some(k => n.includes(k))) return 'shoes'
  if (CURTAINS_KW.some(k => n.includes(k))) return 'curtains'
  if (BEDDING_KW.some(k => n.includes(k))) return 'bedding'
  return 'clothing'
}

// ── Map global catalog category text → OrderType slug ───────────────────────
function mapGlobalCategoryToSlug(categoryText: string): string {
  const t = (categoryText || '').toLowerCase()
  if (t.includes('спецуслуг') || t.includes('доп. услуг')) return 'extras'
  if (t === 'ковры' || t.includes('ковр') || t.includes('палас')) return 'carpet'
  if (t.includes('мягк') || t.includes('диван') || t.includes('кресл') || t.includes('матрас') || t.includes('авто')) return 'furniture'
  if (t === 'обувь' || t.includes('ботин') || t.includes('кроссов') || t.includes('туфл') || t.includes('кед')) return 'shoes'
  if (t.includes('штор') || t.includes('тюл') || t.includes('занавес') || t.includes('гардин') || t.includes('портьер')) return 'curtains'
  if (t.includes('постел') || t.includes('одеял') || t.includes('подушк') || t.includes('плед') || t.includes('покрывал') || t.includes('детское бельё') || t.includes('текстиль для дома')) return 'bedding'
  return 'clothing'
}

// ── Badge colors per category ────────────────────────────────────────────────
const BADGE_COLORS: Record<string, string> = {
  clothing:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  carpet:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  furniture: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  shoes:     'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  curtains:  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  bedding:   'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  extras:    'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
}

function CategoryBadge({ category, label }: { category: string; label?: string }) {
  const cls = BADGE_COLORS[category] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  const text = label ?? ORDER_TYPE_LABELS[category] ?? category
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', cls)}>
      {text}
    </span>
  )
}

// ── Default category options (fallback when config not loaded) ────────────────
const DEFAULT_CAT_OPTIONS: CleaningOrderTypeConfig[] = [
  { slug: 'clothing',  label: 'Одежда',     icon: 'Shirt',      sort_order: 0, active: true },
  { slug: 'carpet',    label: 'Ковёр',      icon: 'LayoutGrid', sort_order: 1, active: true },
  { slug: 'furniture', label: 'Мебель',     icon: 'Sofa',       sort_order: 2, active: true },
  { slug: 'shoes',     label: 'Обувь',      icon: 'Footprints', sort_order: 3, active: true },
  { slug: 'curtains',  label: 'Шторы',      icon: 'Wind',       sort_order: 4, active: true },
  { slug: 'bedding',   label: 'Постельное', icon: 'BedDouble',  sort_order: 5, active: true },
  { slug: 'extras',    label: 'Доп. услуги', icon: 'Sparkles',  sort_order: 6, active: true },
]

// ── Add dialog ────────────────────────────────────────────────────────────────
interface AddDialogProps {
  open: boolean
  onClose: () => void
  maxSortOrder: number
  orderTypes: CleaningOrderTypeConfig[]
  categoriesByOrderType: Record<string, string[]>
}

function AddItemDialog({ open, onClose, maxSortOrder, orderTypes, categoriesByOrderType }: AddDialogProps) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [days, setDays] = useState('3')
  const [category, setCategory] = useState('clothing')
  const [subcategory, setSubcategory] = useState('')
  const upsert = useUpsertItemType()

  // Auto-suggest category from name
  const suggestedCategory = useMemo(() => suggestCategory(name), [name])

  const availableCategories = categoriesByOrderType[category] ?? []

  // Reset subcategory if it's not valid for the selected order type
  useEffect(() => {
    if (subcategory && !availableCategories.includes(subcategory)) {
      setSubcategory('')
    }
  }, [category, availableCategories, subcategory])

  const handleSubmit = async () => {
    if (!name.trim()) return
    try {
      await upsert.mutateAsync({
        name: name.trim(),
        default_price: Number(price) || 0,
        default_days: Number(days) || 3,
        sort_order: maxSortOrder + 1,
        category,
        subcategory: subcategory.trim() || undefined,
      })
      toast.success('Позиция добавлена')
      setName('')
      setPrice('')
      setDays('3')
      setCategory('clothing')
      setSubcategory('')
      onClose()
    } catch {
      toast.error('Ошибка сохранения')
    }
  }

  const handleClose = () => {
    setName('')
    setPrice('')
    setDays('3')
    setCategory('clothing')
    setSubcategory('')
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
              onChange={e => {
                const v = e.target.value
                setName(v)
                // Auto-update category when name changes
                setCategory(suggestCategory(v))
              }}
              placeholder="Например: Куртка зимняя"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Тип заказа</Label>
            <div className="relative">
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full h-9 appearance-none rounded-md border border-input bg-background px-3 pr-8 py-1 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {orderTypes.map(t => (
                  <option key={t.slug} value={t.slug}>{t.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
            {name.trim() && suggestedCategory !== category && (
              <p className="text-xs text-muted-foreground">
                Подсказка: «{orderTypes.find(t => t.slug === suggestedCategory)?.label ?? suggestedCategory}»
                {' '}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setCategory(suggestedCategory)}
                >
                  применить
                </button>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Категория</Label>
            <div className="relative">
              <select
                value={subcategory}
                onChange={e => setSubcategory(e.target.value)}
                disabled={availableCategories.length === 0}
                className="w-full h-9 appearance-none rounded-md border border-input bg-background px-3 pr-8 py-1 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="">Без категории</option>
                {availableCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
            {availableCategories.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Нет категорий для этого типа заказа. Категории заводит администратор Ezze.
              </p>
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

// ── Import from global catalog dialog ────────────────────────────────────────
interface ImportCleaningDialogProps {
  open: boolean
  onClose: () => void
  maxSortOrder: number
}

function ImportCleaningDialog({ open, onClose, maxSortOrder }: ImportCleaningDialogProps) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [slugFilter, setSlugFilter] = useState<string>('all')
  // expanded categories — по умолчанию пусто = все свёрнуты
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { data: globalServices = [], isLoading } = useGlobalServices()
  const upsert = useUpsertItemType()

  // Unique order-type slugs present in the catalog
  const availableSlugCats = useMemo(() => {
    const seen = new Set<string>()
    globalServices.forEach(s => {
      const slug = (s as any).order_type || mapGlobalCategoryToSlug(s.category || '')
      seen.add(slug)
    })
    return Array.from(seen)
  }, [globalServices])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return globalServices.filter(s => {
      const matchesSearch = !q || s.name.toLowerCase().includes(q)
      const slug = (s as any).order_type || mapGlobalCategoryToSlug(s.category || '')
      const matchesSlug = slugFilter === 'all' || slug === slugFilter
      return matchesSearch && matchesSlug
    })
  }, [globalServices, search, slugFilter])

  const grouped = useMemo(() =>
    filtered.reduce<Record<string, typeof filtered>>((acc, s) => {
      const cat = s.category || 'Другое'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(s)
      return acc
    }, {}),
    [filtered]
  )

  const allSelected = filtered.length > 0 && filtered.every(s => selected.has(s.id))
  const isSearching = search.trim().length > 0 || slugFilter !== 'all'

  const toggleExpanded = (cat: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

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
    const results = await Promise.allSettled(
      toImport.map((s, i) => {
        const categorySlug = (s as any).order_type || mapGlobalCategoryToSlug(s.category || '')
        return upsert.mutateAsync({
          name: s.name,
          default_price: s.price || 0,
          default_days: 3,
          sort_order: maxSortOrder + i + 1,
          category: categorySlug,
          subcategory: s.category || undefined,
        })
      })
    )
    const count = results.filter(r => r.status === 'fulfilled').length
    const errors = results.filter(r => r.status === 'rejected').length
    setImporting(false)
    if (count > 0) toast.success(`Добавлено позиций: ${count}`)
    if (errors > 0) toast.error('Некоторые позиции не добавились')
    setSelected(new Set())
    onClose()
  }

  const handleClose = () => {
    setSearch('')
    setSelected(new Set())
    setExpanded(new Set())
    setSlugFilter('all')
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
        <div className="px-6 pb-2 shrink-0">
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

        {/* Category filter */}
        {availableSlugCats.length > 1 && (
          <div className="px-6 pb-2 shrink-0 flex gap-1.5 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => { setSlugFilter('all'); setSelected(new Set()) }}
              className={cn(
                'shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                slugFilter === 'all'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              )}
            >
              Все
            </button>
            {availableSlugCats.map(slug => {
              const cfg = DEFAULT_CAT_OPTIONS.find(c => c.slug === slug)
              const label = cfg?.label ?? ORDER_TYPE_LABELS[slug] ?? slug
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => { setSlugFilter(slug); setSelected(new Set()) }}
                  className={cn(
                    'shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    slugFilter === slug
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted'
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}

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

          {!isLoading && Object.entries(grouped).map(([cat, items]) => {
            const isOpen = isSearching || expanded.has(cat)
            const selectedInCat = items.filter(s => selected.has(s.id)).length
            return (
              <div key={cat}>
                {/* Category header — click to expand/collapse */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(cat)}
                  className="w-full flex items-center justify-between py-2 px-1 hover:bg-muted/30 rounded-md transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    {isOpen
                      ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground rotate-180" />
                    }
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {cat}
                    </span>
                    <span className="text-xs text-muted-foreground/60">({items.length})</span>
                  </div>
                  {selectedInCat > 0 && (
                    <span className="text-xs font-medium text-primary">
                      {selectedInCat} выбрано
                    </span>
                  )}
                </button>

                {/* Items — visible only when expanded or searching */}
                {isOpen && (
                  <div className="space-y-1 mb-1">
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
                )}
              </div>
            )
          })}
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

// ── Inline editable cell ──────────────────────────────────────────────────────
interface EditCellProps {
  item: CleaningItemType
  field: 'name' | 'price' | 'days' | 'subcategory'
  editingCell: { id: string; field: 'name' | 'price' | 'days' | 'subcategory' } | null
  editingValue: string
  savingId: string | null
  onStartEdit: (item: CleaningItemType, field: 'name' | 'price' | 'days' | 'subcategory') => void
  onChangeValue: (v: string) => void
  onSave: () => void
  onCancel: () => void
  /** Допустимые значения категории — используются только при field='subcategory' */
  subcategoryOptions?: string[]
}

function EditCell({ item, field, editingCell, editingValue, savingId, onStartEdit, onChangeValue, onSave, onCancel, subcategoryOptions }: EditCellProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isEditing = editingCell?.id === item.id && editingCell?.field === field

  if (isEditing && field === 'subcategory') {
    const options = subcategoryOptions ?? []
    return (
      <select
        autoFocus
        className="w-full px-2 py-1 text-sm rounded border border-primary bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        value={editingValue}
        onChange={e => { onChangeValue(e.target.value); setTimeout(onSave, 0) }}
        onBlur={onSave}
        onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
      >
        <option value="">Без категории</option>
        {options.map(s => <option key={s} value={s}>{s}</option>)}
        {/* Если текущее значение не в списке (legacy) — показать его */}
        {editingValue && !options.includes(editingValue) && (
          <option value={editingValue}>{editingValue}</option>
        )}
      </select>
    )
  }

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
  const isSaving = savingId === item.id

  const displayValue = field === 'name'
    ? item.name
    : field === 'subcategory'
    ? (item.subcategory || '')
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

// ── Main component ────────────────────────────────────────────────────────────
export function CleaningCatalogTab() {
  const { data: items = [], isLoading } = useCleaningItemTypes()
  const { data: orderTypesConfig = DEFAULT_CAT_OPTIONS } = useCleaningOrderTypesConfig()
  const upsert = useUpsertItemType()
  const deleteItem = useDeleteItemType()
  const currencySymbol = useCurrencySymbol()

  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<'sort_order' | 'name' | 'price' | 'days'>('sort_order')
  const [sortAsc, setSortAsc] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'name' | 'price' | 'days' | 'subcategory' } | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [deletingAll, setDeletingAll] = useState(false)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  // Category counts based on stored category field
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    items.forEach(item => {
      const cat = item.category || 'clothing'
      counts[cat] = (counts[cat] || 0) + 1
    })
    return counts
  }, [items])

  // Available categories ordered by config sort_order
  const availableCategories = useMemo(() =>
    orderTypesConfig
      .filter(cfg => (categoryCounts[cfg.slug] || 0) > 0)
      .map(cfg => cfg.slug),
    [orderTypesConfig, categoryCounts]
  )

  // Filtered + searched + sorted items
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    let result = items.filter(item => {
      const matchesCat = categoryFilter === 'all' || (item.category || 'clothing') === categoryFilter
      const matchesSearch = !q || item.name.toLowerCase().includes(q)
      return matchesCat && matchesSearch
    })
    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name, 'ru')
      else if (sortKey === 'price') cmp = a.default_price - b.default_price
      else if (sortKey === 'days') cmp = a.default_days - b.default_days
      else cmp = a.sort_order - b.sort_order
      return sortAsc ? cmp : -cmp
    })
    return result
  }, [items, categoryFilter, search, sortKey, sortAsc])

  const maxSortOrder = useMemo(() =>
    items.reduce((max, item) => Math.max(max, item.sort_order), 0),
    [items]
  )

  // Категории из глобального справочника, сгруппированные по slug типа заказа.
  // Существующие subcategory мастера добавляются как fallback для legacy данных.
  const { data: globalServicesAll = [] } = useGlobalServices()
  const categoriesByOrderType = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    for (const s of globalServicesAll) {
      if (!s.category) continue
      const slug = (s as any).order_type || mapGlobalCategoryToSlug(s.category)
      if (!map[slug]) map[slug] = new Set()
      map[slug].add(s.category)
    }
    // Legacy: добавляем категории, которые мастер уже использует, к их order_type
    for (const item of items) {
      if (!item.subcategory) continue
      const slug = item.category || 'clothing'
      if (!map[slug]) map[slug] = new Set()
      map[slug].add(item.subcategory)
    }
    const result: Record<string, string[]> = {}
    for (const [slug, set] of Object.entries(map)) {
      result[slug] = Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
    }
    return result
  }, [globalServicesAll, items])

  const startEdit = (item: CleaningItemType, field: 'name' | 'price' | 'days' | 'subcategory') => {
    const value = field === 'name'
      ? item.name
      : field === 'subcategory'
      ? (item.subcategory || '')
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
    const currentValue = editingCell.field === 'name'
      ? item.name
      : editingCell.field === 'subcategory'
      ? (item.subcategory || '')
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
      category: item.category || 'clothing',
      subcategory: item.subcategory,
      default_price: item.default_price,
      default_days: item.default_days,
      sort_order: item.sort_order,
      product: item.product,
    }

    if (editingCell.field === 'name') payload.name = trimmed
    else if (editingCell.field === 'subcategory') payload.subcategory = trimmed || undefined
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

  const saveCategory = async (item: CleaningItemType, newCategory: string) => {
    setEditingCategoryId(null)
    if (newCategory === (item.category || 'clothing')) return
    setSavingId(item.id)
    try {
      await upsert.mutateAsync({
        id: item.id,
        name: item.name,
        category: newCategory,
        default_price: item.default_price,
        default_days: item.default_days,
        sort_order: item.sort_order,
        product: item.product,
      })
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

  const handleDeleteAll = async () => {
    if (items.length === 0) return
    setDeletingAll(true)
    const results = await Promise.allSettled(items.map(i => deleteItem.mutateAsync(i.id)))
    const deleted = results.filter(r => r.status === 'fulfilled').length
    setDeletingAll(false)
    setDeleteAllOpen(false)
    toast.success(`Удалено позиций: ${deleted}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  const SortIcon = ({ col }: { col: typeof sortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />
    return sortAsc
      ? <ChevronUp className="h-3 w-3 ml-1 text-primary" />
      : <ChevronDown className="h-3 w-3 ml-1 text-primary" />
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-xs order-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Поиск..."
            className="w-full h-9 pl-8 pr-3 text-base sm:text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
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
        <p className="text-sm text-muted-foreground hidden sm:block shrink-0 order-2">
          {filteredItems.length === items.length ? `${items.length} позиций` : `${filteredItems.length} из ${items.length}`}
        </p>
        <div className="flex items-center gap-2 shrink-0 order-3 ml-auto">
          {items.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteAllOpen(true)}
              disabled={deletingAll}
              title="Удалить все позиции"
            >
              <Trash2 className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Удалить все</span>
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Из справочника</span>
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Добавить</span>
          </Button>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => { setCategoryFilter('all'); setPage(1) }}
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
            categoryFilter === 'all'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:bg-muted'
          )}
        >
          Все ({items.length})
        </button>
        {availableCategories.map(cat => {
          const cfg = orderTypesConfig.find(c => c.slug === cat)
          const label = cfg?.label ?? ORDER_TYPE_LABELS[cat] ?? cat
          return (
            <button
              key={cat}
              onClick={() => { setCategoryFilter(cat); setPage(1) }}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
                categoryFilter === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              )}
            >
              {label} ({categoryCounts[cat]})
            </button>
          )
        })}
      </div>

      {/* Table */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed">
          <p className="text-sm text-muted-foreground">
            {search ? `Ничего не найдено по «${search}»` : 'Нет позиций в этой категории'}
          </p>
          <button
            className="mt-2 text-xs text-primary hover:underline"
            onClick={() => { setCategoryFilter('all'); setSearch('') }}
          >
            Сбросить фильтры
          </button>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">
                  <button onClick={() => toggleSort('name')} className="flex items-center hover:text-foreground">
                    Название<SortIcon col="name" />
                  </button>
                </th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Тип заказа</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Категория</th>
                <th className="text-left p-3 font-medium">
                  <button onClick={() => toggleSort('price')} className="flex items-center hover:text-foreground">
                    Цена ({currencySymbol})<SortIcon col="price" />
                  </button>
                </th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">
                  <button onClick={() => toggleSort('days')} className="flex items-center hover:text-foreground">
                    Дней<SortIcon col="days" />
                  </button>
                </th>
                <th className="w-10 p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(item => {
                const isDeleting = deletingId === item.id
                const isSaving = savingId === item.id
                const cfg = orderTypesConfig.find(c => c.slug === (item.category || 'clothing'))
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

                    {/* Category badge - click to edit */}
                    <td className="p-3 hidden sm:table-cell">
                      {editingCategoryId === item.id ? (
                        <div className="relative">
                          <select
                            autoFocus
                            value={item.category || 'clothing'}
                            onChange={e => saveCategory(item, e.target.value)}
                            onBlur={() => setEditingCategoryId(null)}
                            className="h-7 text-xs appearance-none rounded border border-primary bg-background px-2 pr-6 focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {orderTypesConfig.map(t => (
                              <option key={t.slug} value={t.slug}>{t.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                        </div>
                      ) : (
                        <button
                          onClick={() => !isSaving && !deletingId && setEditingCategoryId(item.id)}
                          title="Изменить категорию"
                          className="hover:opacity-80 transition-opacity"
                        >
                          <CategoryBadge category={item.category || 'clothing'} label={cfg?.label} />
                        </button>
                      )}
                    </td>

                    {/* Subcategory */}
                    <td className="p-3 hidden md:table-cell">
                      <EditCell
                        item={item}
                        field="subcategory"
                        editingCell={editingCell}
                        editingValue={editingValue}
                        savingId={savingId}
                        onStartEdit={startEdit}
                        onChangeValue={setEditingValue}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        subcategoryOptions={categoriesByOrderType[item.category || 'clothing'] ?? []}
                      />
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
                          className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30 mx-auto block"
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Pagination */}
      {Math.ceil(filteredItems.length / PAGE_SIZE) > 1 && (
        <div className="flex justify-center items-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-md border text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
          >
            Назад
          </button>
          <span className="text-sm text-muted-foreground">
            {page} / {Math.ceil(filteredItems.length / PAGE_SIZE)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(filteredItems.length / PAGE_SIZE)}
            className="px-3 py-1.5 rounded-md border text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
          >
            Далее
          </button>
        </div>
      )}

      <AddItemDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        maxSortOrder={maxSortOrder}
        orderTypes={orderTypesConfig}
        categoriesByOrderType={categoriesByOrderType}
      />

      <ImportCleaningDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        maxSortOrder={maxSortOrder}
      />

      <ConfirmDialog
        open={deleteAllOpen}
        onClose={() => setDeleteAllOpen(false)}
        onConfirm={handleDeleteAll}
        title={`Удалить все позиции (${items.length})? Действие необратимо.`}
        loading={deletingAll}
      />
    </div>
  )
}
