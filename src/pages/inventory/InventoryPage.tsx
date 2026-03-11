import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Package, AlertTriangle, MoreVertical, Edit, Trash2, ArrowDownToLine, History, Download, X, Square, CheckSquare, Tags, Check, Pencil, ArrowUpDown } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import dayjs from 'dayjs'
import { useInventory, useInventoryPage, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem } from '@/hooks/useInventory'
import { PaginationBar } from '@/components/shared/PaginationBar'
import { useInventoryReceipts, useCreateReceipt } from '@/hooks/useInventoryReceipts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { toast } from '@/components/shared/Toaster'
import { ImportProductsDialog } from '@/components/inventory/ImportProductsDialog'
import { formatCurrency } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { useFeature } from '@/hooks/useFeatureFlags'
import type { InventoryItem } from '@/types'

const UNITS = ['pcs', 'ml', 'g', 'bottle', 'box', 'l', 'kg', 'pack']
const INV_CAT_PRESETS_KEY = 'ezze_inv_cat_presets'
const INV_CAT_COLORS_KEY = 'ezze_inv_cat_colors'
const CAT_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899','#64748b']

type SortKey = 'name' | 'category' | 'quantity' | 'status'

const itemSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  unit: z.string().optional(),
  quantity: z.number().min(0),
  min_quantity: z.number().min(0).optional(),
  cost_price: z.number().min(0).optional(),
  sell_price: z.number().min(0).optional(),
  supplier: z.string().optional(),
})
type ItemFormValues = z.infer<typeof itemSchema>

const receiptSchema = z.object({
  date: z.string().min(1),
  quantity: z.number().min(0.01),
  cost_price: z.number().min(0).optional(),
  supplier: z.string().optional(),
  note: z.string().optional(),
})
type ReceiptFormValues = z.infer<typeof receiptSchema>

function StockBadge({ quantity, minQuantity }: { quantity: number; minQuantity?: number }) {
  const { t } = useTranslation()
  if (quantity === 0) return <Badge variant="destructive">{t('inventory.outOfStock')}</Badge>
  if (minQuantity != null && quantity <= minQuantity) return <Badge variant="warning">{t('inventory.lowStock')}</Badge>
  return <Badge variant="success">{t('inventory.inStock')}</Badge>
}

export function InventoryPage() {
  const { t, i18n } = useTranslation()
  const hasGlobalProducts = useFeature('global_products_catalog')
  const currency = useCurrency()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [receiptItem, setReceiptItem] = useState<InventoryItem | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [catDialogOpen, setCatDialogOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [editCatValue, setEditCatValue] = useState('')
  const [deletingCat, setDeletingCat] = useState<string | null>(null)
  const [newCatInput, setNewCatInput] = useState('')
  const [catDialogSearch, setCatDialogSearch] = useState('')
  const [catPresets, setCatPresets] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(INV_CAT_PRESETS_KEY) || '[]') } catch { return [] }
  })
  const [catColors, setCatColors] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(INV_CAT_COLORS_KEY) || '{}') } catch { return {} }
  })

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 350)
    return () => clearTimeout(timer)
  }, [search])

  const pbSort = useMemo(() => {
    const prefix = sortAsc ? '' : '-'
    if (sortKey === 'quantity') return `${prefix}quantity`
    if (sortKey === 'category') return `${prefix}category`
    return `${prefix}name`
  }, [sortKey, sortAsc])

  // Полный список для статистики (кэшируется, staleTime 10 мин)
  const { data: allItems } = useInventory()
  // Постраничный список для таблицы
  const { data: pagedItems, isLoading } = useInventoryPage(debouncedSearch, page, 25, pbSort)
  const items = pagedItems?.items ?? []
  const totalItems = pagedItems?.totalItems ?? 0
  const totalPages = pagedItems?.totalPages ?? 1
  const create = useCreateInventoryItem()
  const update = useUpdateInventoryItem()
  const del = useDeleteInventoryItem()
  const createReceipt = useCreateReceipt()

  const { data: receipts } = useInventoryReceipts(historyDialogOpen ? receiptItem?.id : undefined)

  const lowStockCount = allItems?.filter((i) => i.min_quantity != null && i.quantity <= i.min_quantity).length || 0

  const inventoryStats = useMemo(() => {
    const all = allItems ?? []
    return {
      total: all.length,
      lowStock: all.filter(i => i.min_quantity != null && i.quantity > 0 && i.quantity <= i.min_quantity).length,
      outOfStock: all.filter(i => i.quantity === 0).length,
      totalValue: all.reduce((sum, i) => sum + i.quantity * (i.cost_price ?? 0), 0),
    }
  }, [allItems])

  // Уникальные категории из полного списка
  const categories = useMemo(() => {
    const cats = new Set<string>()
    allItems?.forEach((i) => { if (i.category) cats.add(i.category) })
    return Array.from(cats).sort()
  }, [allItems])

  // Все категории = из товаров + preset'ы из localStorage
  const allCategories = useMemo(() => {
    return Array.from(new Set([...categories, ...catPresets])).sort()
  }, [categories, catPresets])

  const saveCatPresets = (presets: string[]) => {
    setCatPresets(presets)
    localStorage.setItem(INV_CAT_PRESETS_KEY, JSON.stringify(presets))
  }
  const saveCatColors = (colors: Record<string, string>) => {
    setCatColors(colors)
    localStorage.setItem(INV_CAT_COLORS_KEY, JSON.stringify(colors))
  }
  const getCatColor = (cat: string) => catColors[cat] || '#64748b'

  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity === 0) return 'outOfStock'
    if (item.min_quantity != null && item.quantity <= item.min_quantity) return 'lowStock'
    return 'inStock'
  }

  // Для sortKey=status применяем клиентскую сортировку поверх серверной
  const filteredItems = useMemo(() => {
    if (sortKey !== 'status') return items
    return [...items].sort((a, b) => {
      const order = { outOfStock: 0, lowStock: 1, inStock: 2 }
      const cmp = order[getStockStatus(a)] - order[getStockStatus(b)]
      return sortAsc ? cmp : -cmp
    })
  }, [items, sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(true); setPage(1) }
  }

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: { quantity: 0, unit: 'pcs' },
  })

  // Category combobox — после useForm, чтобы watch был доступен
  const [catDropOpen, setCatDropOpen] = useState(false)
  const [newCatColor, setNewCatColor] = useState(CAT_COLORS[5])
  const catValue = watch('category') || ''
  const catSuggestions = useMemo(() => {
    if (!catValue.trim()) return allCategories
    return allCategories.filter(c => c.toLowerCase().includes(catValue.toLowerCase()))
  }, [allCategories, catValue])

  const { register: regR, handleSubmit: handleR, reset: resetR, formState: { errors: errR } } = useForm<ReceiptFormValues>({
    resolver: zodResolver(receiptSchema),
    defaultValues: { date: dayjs().format('YYYY-MM-DD'), quantity: 1 },
  })

  const openCreate = () => {
    setEditItem(null)
    reset({ quantity: 0, unit: 'pcs' })
    setDialogOpen(true)
  }

  const openEdit = (item: InventoryItem) => {
    setEditItem(item)
    reset({
      name: item.name,
      sku: item.sku || '',
      category: item.category || '',
      description: item.description || '',
      unit: item.unit || 'pcs',
      quantity: item.quantity,
      min_quantity: item.min_quantity,
      cost_price: item.cost_price,
      sell_price: item.sell_price,
      supplier: item.supplier || '',
    })
    setDialogOpen(true)
  }

  const openReceipt = (item: InventoryItem) => {
    setReceiptItem(item)
    resetR({
      date: dayjs().format('YYYY-MM-DD'),
      quantity: 1,
      cost_price: item.cost_price,
      supplier: item.supplier || '',
      note: '',
    })
    setReceiptDialogOpen(true)
  }

  const openHistory = (item: InventoryItem) => {
    setReceiptItem(item)
    setHistoryDialogOpen(true)
  }

  const onSubmit = async (values: ItemFormValues) => {
    try {
      if (editItem) {
        await update.mutateAsync({ id: editItem.id, data: values })
        toast.success(t('inventory.updated'))
      } else {
        await create.mutateAsync(values as any)
        toast.success(t('inventory.created'))
      }
      setDialogOpen(false)
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const onReceiptSubmit = async (values: ReceiptFormValues) => {
    if (!receiptItem) return
    try {
      await createReceipt.mutateAsync({ inventory_item_id: receiptItem.id, ...values })
      toast.success(t('inventory.receiptCreated'))
      setReceiptDialogOpen(false)
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await del.mutateAsync(deleteId)
      toast.success(t('inventory.deleted'))
      setDeleteId(null)
    } catch {
      toast.error(t('common.deleteError'))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const isAllSelected = useMemo(
    () => filteredItems.length > 0 && filteredItems.every(i => selectedIds.has(i.id)),
    [filteredItems, selectedIds]
  )
  const isSomeSelected = useMemo(
    () => filteredItems.some(i => selectedIds.has(i.id)),
    [filteredItems, selectedIds]
  )

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)))
    }
  }

  const handleBulkDelete = async () => {
    try {
      await Promise.all([...selectedIds].map(id => del.mutateAsync(id)))
      toast.success(t('inventory.deletedMultiple', { count: selectedIds.size }))
      setSelectedIds(new Set())
      setBulkDeleteOpen(false)
    } catch {
      toast.error(t('common.deleteError'))
    }
  }

  const handleAddCatPreset = () => {
    const name = newCatInput.trim()
    if (!name || allCategories.includes(name)) return
    saveCatPresets([...catPresets, name])
    setNewCatInput('')
    toast.success(t('inventory.categoryCreated'))
  }

  const handleRenameCategory = async (oldName: string, newName: string) => {
    const toUpdate = items?.filter((i) => i.category === oldName) ?? []
    try {
      await Promise.all(toUpdate.map((i) => update.mutateAsync({ id: i.id, data: { ...i, category: newName } })))
      if (catPresets.includes(oldName)) saveCatPresets(catPresets.map(p => p === oldName ? newName : p))
      toast.success(t('inventory.categoryRenamed'))
      setEditingCat(null)
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const handleDeleteCategory = async (name: string) => {
    const toUpdate = items?.filter((i) => i.category === name) ?? []
    try {
      await Promise.all(toUpdate.map((i) => update.mutateAsync({ id: i.id, data: { ...i, category: '' } })))
      if (catPresets.includes(name)) saveCatPresets(catPresets.filter(p => p !== name))
      toast.success(t('inventory.categoryDeleted'))
      setDeletingCat(null)
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 sticky top-0 z-10 bg-background -mx-3 px-3 lg:-mx-6 lg:px-6 -mt-4 pt-4 lg:-mt-6 lg:pt-6 pb-3 shadow-sm">
        {/* Row 1: title */}
        <h1 className="text-2xl font-semibold text-foreground">{t('nav.inventory')}</h1>

        {/* Bulk action bar */}
        {isSomeSelected && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/20">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {isAllSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              {isAllSelected ? t('common.deselectAll') : t('common.selectAll')}
            </button>
            <span className="text-xs text-muted-foreground">
              {t('inventory.selectedCount', { count: selectedIds.size })}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                {t('common.cancel')}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {t('common.delete')}
              </Button>
            </div>
          </div>
        )}

        {/* Row 2: search + buttons */}
        <div className="flex items-center gap-2">
          {!isLoading && (totalItems > 0 || !!debouncedSearch) && (
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={t('inventory.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch('')}>
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <Button variant="outline" size="icon" className="sm:hidden" onClick={() => setCatDialogOpen(true)}>
              <Tags className="h-4 w-4" />
            </Button>
            {hasGlobalProducts && (
              <Button variant="outline" size="icon" className="sm:hidden" onClick={() => setImportOpen(true)}>
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" className="hidden sm:flex" onClick={() => setCatDialogOpen(true)}>
              <Tags className="h-4 w-4 mr-2" />
              {t('inventory.manageCategories')}
            </Button>
            {hasGlobalProducts && (
              <Button variant="outline" className="hidden sm:flex" onClick={() => setImportOpen(true)}>
                <Download className="h-4 w-4 mr-2" />
                {t('catalog.fromCatalog')}
              </Button>
            )}
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('inventory.add')}</span>
            </Button>
          </div>
        </div>
      </div>

      {!isLoading && inventoryStats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Всего позиций</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{inventoryStats.total}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Категорий</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{categories.length}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Заканчивается</p>
            <p className="text-2xl font-bold text-amber-500 mt-1 tabular-nums">{inventoryStats.lowStock}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">На нуле</p>
            <p className="text-2xl font-bold text-destructive mt-1 tabular-nums">{inventoryStats.outOfStock}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Стоимость запасов</p>
            <p className="font-bold mt-1 leading-snug" style={{ fontSize: 'clamp(0.85rem, 4.5vw, 1.25rem)' }}>
              {new Intl.NumberFormat(i18n.language).format(inventoryStats.totalValue)}
              <span className="text-xs font-medium text-muted-foreground ml-1">{currency}</span>
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : totalItems === 0 && !debouncedSearch ? (
        <EmptyState icon={Package} title={t('inventory.empty')} action={{ label: t('inventory.add'), onClick: openCreate }} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{t('services.notFound')}</p>
          <button className="mt-2 text-xs text-primary hover:underline" onClick={() => setSearch('')}>
            {t('common.clearFilter')}
          </button>
        </div>
      ) : (
        <>
          {/* Карточный вид */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:hidden">
              {filteredItems.map((item) => {
                const isSelected = selectedIds.has(item.id)
                return (
                <div
                  key={item.id}
                  onClick={() => openEdit(item)}
                  className={`relative rounded-xl border bg-card hover:bg-accent/30 transition-colors cursor-pointer px-3 py-2.5 flex items-center gap-2 ${isSelected ? 'border-primary/60 bg-primary/5' : ''}`}
                >
                  {/* Чекбокс */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSelect(item.id) }}
                    className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors shrink-0"
                  >
                    {isSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                  </button>
                  {/* Основная инфо */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate leading-tight">{item.name}</p>
                    {item.category && (
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getCatColor(item.category) }} />
                        {item.category}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono tabular-nums text-sm font-semibold">
                        {item.quantity}
                        {item.unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{t(`inventory.units.${item.unit}`, { defaultValue: item.unit })}</span>}
                      </span>
                      {item.sell_price != null && (
                        <span className="text-xs text-muted-foreground">{formatCurrency(item.sell_price, currency, i18n.language)}</span>
                      )}
                    </div>
                  </div>
                  {/* Статус */}
                  <StockBadge quantity={item.quantity} minQuantity={item.min_quantity} />
                  {/* Меню */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openReceipt(item) }}>
                        <ArrowDownToLine className="mr-2 h-4 w-4 text-emerald-600" />
                        {t('inventory.receiptAdd')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openHistory(item) }}>
                        <History className="mr-2 h-4 w-4" />
                        {t('inventory.receiptHistory')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(item) }}>
                        <Edit className="mr-2 h-4 w-4" />{t('common.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(item.id) }}>
                        <Trash2 className="mr-2 h-4 w-4" />{t('common.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )})}
          </div>

          {/* Табличный вид */}
          <div className="rounded-xl border overflow-hidden hidden sm:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {/* Чекбокс "выделить все" */}
                  <th className="p-3 w-10">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                    >
                      {isAllSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                    </button>
                  </th>
                  <th className="text-left p-3 font-medium">
                    <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('name')}>
                      {t('inventory.name')}
                      <ArrowUpDown className={`h-3 w-3 ${sortKey === 'name' ? 'text-primary' : 'opacity-30'} ${sortKey === 'name' && !sortAsc ? 'rotate-180' : ''}`} />
                    </button>
                  </th>
                  <th className="text-left p-3 font-medium hidden sm:table-cell">
                    <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('category')}>
                      {t('inventory.category')}
                      <ArrowUpDown className={`h-3 w-3 ${sortKey === 'category' ? 'text-primary' : 'opacity-30'} ${sortKey === 'category' && !sortAsc ? 'rotate-180' : ''}`} />
                    </button>
                  </th>
                  {/* Десктоп: отдельные колонки кол-во и ед. изм. */}
                  <th className="text-right p-3 font-medium hidden sm:table-cell">
                    <button className="flex items-center gap-1 justify-end w-full hover:text-foreground transition-colors" onClick={() => toggleSort('quantity')}>
                      {t('inventory.quantity')}
                      <ArrowUpDown className={`h-3 w-3 ${sortKey === 'quantity' ? 'text-primary' : 'opacity-30'} ${sortKey === 'quantity' && !sortAsc ? 'rotate-180' : ''}`} />
                    </button>
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">{t('inventory.unit')}</th>
                  {/* Мобильный: объединённая колонка кол-во+ед.изм */}
                  <th className="text-right p-3 font-medium sm:hidden">
                    <button className="flex items-center gap-1 justify-end w-full hover:text-foreground transition-colors" onClick={() => toggleSort('quantity')}>
                      {t('inventory.quantity')}
                      <ArrowUpDown className={`h-3 w-3 ${sortKey === 'quantity' ? 'text-primary' : 'opacity-30'} ${sortKey === 'quantity' && !sortAsc ? 'rotate-180' : ''}`} />
                    </button>
                  </th>
                  {/* Статус */}
                  <th className="p-3 font-medium">
                    <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('status')}>
                      <span className="hidden sm:inline">{t('inventory.status')}</span>
                      <ArrowUpDown className={`h-3 w-3 ${sortKey === 'status' ? 'text-primary' : 'opacity-30'} ${sortKey === 'status' && !sortAsc ? 'rotate-180' : ''}`} />
                    </button>
                  </th>
                  <th className="text-right p-3 font-medium hidden lg:table-cell">{t('inventory.price')}</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const status = getStockStatus(item)
                  const dotColor = status === 'outOfStock' ? 'bg-destructive' : status === 'lowStock' ? 'bg-amber-500' : 'bg-emerald-500'
                  const unitLabel = item.unit ? t(`inventory.units.${item.unit}`, { defaultValue: item.unit }) : ''
                  const isSelected = selectedIds.has(item.id)
                  return (
                  <tr key={item.id} className={`border-t hover:bg-accent/40 transition-colors cursor-pointer ${isSelected ? 'bg-primary/5' : ''}`} onClick={() => openEdit(item)}>
                    {/* Чекбокс */}
                    <td className="p-3 w-10">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleSelect(item.id) }}
                        className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                      >
                        {isSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="p-3">
                      <p className="font-medium leading-tight">{item.name}</p>
                      {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                    </td>
                    <td className="p-3 text-muted-foreground hidden sm:table-cell">
                      {item.category ? (
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getCatColor(item.category) }} />
                          {item.category}
                        </span>
                      ) : '—'}
                    </td>
                    {/* Десктоп: кол-во отдельно */}
                    <td className="p-3 text-right font-mono tabular-nums hidden sm:table-cell">{item.quantity}</td>
                    <td className="p-3 text-left text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                      {unitLabel || '—'}
                    </td>
                    {/* Мобильный: кол-во + ед.изм вместе */}
                    <td className="p-3 text-right whitespace-nowrap sm:hidden">
                      <span className="font-mono tabular-nums">{item.quantity}</span>
                      {unitLabel && <span className="ml-1 text-xs text-muted-foreground">{unitLabel}</span>}
                    </td>
                    {/* Статус: десктоп — бейдж, мобильный — цветная точка */}
                    <td className="p-3">
                      <span className="sm:hidden">
                        <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
                      </span>
                      <span className="hidden sm:block">
                        <StockBadge quantity={item.quantity} minQuantity={item.min_quantity} />
                      </span>
                    </td>
                    <td className="p-3 text-right hidden lg:table-cell">
                      {item.sell_price ? formatCurrency(item.sell_price, currency, i18n.language) : '—'}
                    </td>
                    <td className="p-3 pr-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openReceipt(item) }}>
                            <ArrowDownToLine className="mr-2 h-4 w-4 text-emerald-600" />
                            {t('inventory.receiptAdd')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openHistory(item) }}>
                            <History className="mr-2 h-4 w-4" />
                            {t('inventory.receiptHistory')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(item) }}>
                            <Edit className="mr-2 h-4 w-4" />{t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(item.id) }}>
                            <Trash2 className="mr-2 h-4 w-4" />{t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        <PaginationBar page={page} totalPages={totalPages} totalItems={totalItems} perPage={25} onChange={setPage} />
        </>
      )}

      {/* Диалог: Добавить/Редактировать товар */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent mobileFullscreen>
          <DialogHeader>
            <DialogTitle>{editItem ? t('inventory.edit') : t('inventory.add')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('inventory.name')} *</Label>
                <Input {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{t('common.required')}</p>}
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input {...register('sku')} />
              </div>
              <div className="space-y-2">
                <Label>{t('inventory.category')}</Label>
                <div className="relative">
                  <input
                    {...register('category')}
                    autoComplete="off"
                    onFocus={() => setCatDropOpen(true)}
                    onBlur={() => setTimeout(() => setCatDropOpen(false), 150)}
                    placeholder={t('inventory.categoryNamePlaceholder')}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {catDropOpen && (catSuggestions.length > 0 || (catValue.trim() && !allCategories.map(c => c.toLowerCase()).includes(catValue.trim().toLowerCase()))) && (
                    <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
                      <div className="max-h-48 overflow-y-auto py-1">
                        {catSuggestions.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              setValue('category', cat, { shouldDirty: true })
                              setCatDropOpen(false)
                            }}
                          >
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getCatColor(cat) }} />
                            <span className="flex-1 text-left">{cat}</span>
                            <Check className={`h-3.5 w-3.5 shrink-0 ${catValue === cat ? 'text-primary' : 'opacity-0'}`} />
                          </button>
                        ))}
                        {catValue.trim() && !allCategories.map(c => c.toLowerCase()).includes(catValue.trim().toLowerCase()) && (
                          <div className="border-t px-3 py-2 space-y-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {CAT_COLORS.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  onMouseDown={(e) => { e.preventDefault(); setNewCatColor(color) }}
                                  className={`w-5 h-5 rounded-full shrink-0 transition-transform hover:scale-110 ${newCatColor === color ? 'ring-2 ring-offset-1 ring-primary scale-110' : ''}`}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                            <button
                              type="button"
                              className="flex items-center gap-2 text-sm text-primary"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                const newCat = catValue.trim()
                                saveCatPresets([...catPresets, newCat])
                                saveCatColors({ ...catColors, [newCat]: newCatColor })
                                setValue('category', newCat, { shouldDirty: true })
                                setCatDropOpen(false)
                                setNewCatColor(CAT_COLORS[5])
                              }}
                            >
                              <Plus className="h-3.5 w-3.5 shrink-0" />
                              {t('inventory.addCategory', { name: catValue.trim() })}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('inventory.unit')}</Label>
                <Select defaultValue={editItem?.unit || 'pcs'} onValueChange={(v) => setValue('unit', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => <SelectItem key={u} value={u}>{t(`inventory.units.${u}`, { defaultValue: u })}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('inventory.quantity')}</Label>
                <Input type="number" min={0} {...register('quantity', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>{t('inventory.minQuantity')}</Label>
                <Input type="number" min={0} {...register('min_quantity', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>{t('inventory.costPrice')}</Label>
                <Input type="number" min={0} {...register('cost_price', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>{t('inventory.sellPrice')}</Label>
                <Input type="number" min={0} {...register('sell_price', { valueAsNumber: true })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" loading={create.isPending || update.isPending}>{t('common.save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Диалог: Приход товара */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent mobileFullscreen>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-emerald-600" />
              {t('inventory.receipt')}: <span className="text-primary">{receiptItem?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleR(onReceiptSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('inventory.receiptDate')} *</Label>
                <Input type="date" {...regR('date')} />
                {errR.date && <p className="text-xs text-destructive">{t('common.required')}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t('inventory.receiptQty')} {receiptItem?.unit ? `(${receiptItem.unit})` : ''} *</Label>
                <Input type="number" min={0.01} step={0.01} {...regR('quantity', { valueAsNumber: true })} />
                {errR.quantity && <p className="text-xs text-destructive">{t('common.required')}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t('inventory.receiptPrice')}</Label>
                <Input type="number" min={0} step={0.01} {...regR('cost_price', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>{t('inventory.receiptSupplier')}</Label>
                <Input {...regR('supplier')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('inventory.receiptNote')}</Label>
              <Input {...regR('note')} />
            </div>

            <div className="rounded-lg bg-muted/50 p-3 flex justify-between text-sm">
              <span className="text-muted-foreground">{t('inventory.quantity')} ({t('inventory.inStock')}):</span>
              <span className="font-semibold">{receiptItem?.quantity} {receiptItem?.unit}</span>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReceiptDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" loading={createReceipt.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <ArrowDownToLine className="h-4 w-4 mr-2" />
                {t('inventory.receiptAdd')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Диалог: История приходов */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent mobileFullscreen className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {t('inventory.receiptHistory')}: <span className="text-primary">{receiptItem?.name}</span>
            </DialogTitle>
          </DialogHeader>

          {!receipts || receipts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <History className="h-8 w-8 opacity-40" />
              <p className="text-sm">{t('inventory.empty')}</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">{t('inventory.receiptDate')}</th>
                    <th className="text-right p-2 font-medium">{t('inventory.receiptQty')}</th>
                    <th className="text-right p-2 font-medium">{t('inventory.receiptPrice')}</th>
                    <th className="text-left p-2 font-medium hidden sm:table-cell">{t('inventory.receiptSupplier')}</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-muted/20">
                      <td className="p-2">{dayjs(r.date).format('DD.MM.YYYY')}</td>
                      <td className="p-2 text-right font-mono text-emerald-600 font-medium">
                        +{r.quantity} {receiptItem?.unit}
                      </td>
                      <td className="p-2 text-right">{r.cost_price ? formatCurrency(r.cost_price, currency, i18n.language) : '—'}</td>
                      <td className="p-2 text-muted-foreground hidden sm:table-cell">{r.supplier || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setHistoryDialogOpen(false)}>{t('common.cancel')}</Button>
            {receiptItem && (
              <Button type="button" onClick={() => { setHistoryDialogOpen(false); openReceipt(receiptItem) }}>
                <ArrowDownToLine className="h-4 w-4 mr-2" />
                {t('inventory.receiptAdd')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title={t('inventory.deleteConfirm')} loading={del.isPending} />

      <ConfirmDialog open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} onConfirm={handleBulkDelete}
        title={t('inventory.bulkDeleteConfirm', { count: selectedIds.size })} loading={del.isPending} />

      <ImportProductsDialog open={importOpen} onClose={() => setImportOpen(false)} />

      {/* Диалог: Категории */}
      <Dialog open={catDialogOpen} onOpenChange={(v) => { setCatDialogOpen(v); if (!v) setCatDialogSearch('') }}>
        <DialogContent mobileFullscreen className="max-w-md flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-4 w-4" />
              {t('inventory.manageCategories')}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col flex-1 min-h-0 gap-3">
            {/* Добавить новую категорию */}
            <div className="flex gap-2">
              <Input
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                placeholder={t('inventory.categoryNamePlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCatPreset()}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleAddCatPreset}
                disabled={!newCatInput.trim() || allCategories.includes(newCatInput.trim())}
                size="icon"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Поиск по категориям */}
            {allCategories.length > 4 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  value={catDialogSearch}
                  onChange={(e) => setCatDialogSearch(e.target.value)}
                  placeholder={t('inventory.search')}
                  className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {catDialogSearch && (
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setCatDialogSearch('')}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Список категорий */}
            <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
              {allCategories.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">{t('inventory.noCategories')}</p>
              )}
              {allCategories
                .filter(cat => !catDialogSearch || cat.toLowerCase().includes(catDialogSearch.toLowerCase()))
                .map((cat) => (
                <div key={cat} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors">
                  {editingCat === cat ? (
                    <>
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getCatColor(cat) }} />
                      <Input
                        value={editCatValue}
                        onChange={(e) => setEditCatValue(e.target.value)}
                        className="h-7 text-sm flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editCatValue.trim()) handleRenameCategory(cat, editCatValue.trim())
                          if (e.key === 'Escape') setEditingCat(null)
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                        disabled={!editCatValue.trim() || update.isPending}
                        onClick={() => editCatValue.trim() && handleRenameCategory(cat, editCatValue.trim())}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                        onClick={() => setEditingCat(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getCatColor(cat) }} />
                      <span className="flex-1 text-sm">{cat}</span>
                      <span className="text-xs text-muted-foreground shrink-0 min-w-[1.5rem] text-right">
                        {items?.filter(i => (i.category || '').toLowerCase() === cat.toLowerCase()).length ?? 0}
                      </span>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                        onClick={() => { setEditingCat(cat); setEditCatValue(cat) }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive"
                        onClick={() => setDeletingCat(cat)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>{t('common.cancel')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingCat}
        onClose={() => setDeletingCat(null)}
        onConfirm={() => deletingCat && handleDeleteCategory(deletingCat)}
        title={t('inventory.deleteConfirm')}
        loading={update.isPending}
      />
    </div>
  )
}
