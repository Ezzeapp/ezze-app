import { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, MoreVertical, Trash2, Edit, Clock, DollarSign, Tags, X, Pencil, Download, Search, Square, CheckSquare, Check, ChevronsUpDown, ArrowUpDown } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useServicesPage, useServices, useServiceCategories, useServicesNoCatCount, useCreateService, useUpdateService, useDeleteService, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/useServices'
import { PaginationBar } from '@/components/shared/PaginationBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { toast } from '@/components/shared/Toaster'
import { ServiceMaterialsTab } from '@/components/services/ServiceMaterialsTab'
import { ImportServicesDialog } from '@/components/services/ImportServicesDialog'
import { PlanLimitBanner } from '@/components/shared/PlanLimitBanner'
import { formatCurrency, formatDuration } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { useProfileIcon } from '@/hooks/useProfileIcon'
import { usePlanLimitCheck } from '@/hooks/useAppSettings'
import { useFeature } from '@/hooks/useFeatureFlags'
import type { Service, ServiceCategory } from '@/types'

const DURATION_PRESETS = [15, 30, 45, 60]

const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#64748b', '#78716c',
]

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  duration_min: z.number().min(5).max(480),
  price: z.number().min(0),
  price_max: z.number().optional(),
  category: z.string().optional(),
  is_active: z.boolean(),
  is_bookable: z.boolean(),
})
type FormValues = z.infer<typeof schema>

// ── Categories management dialog ──────────────────────────────────────────
function CategoriesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { data: categories } = useServiceCategories()
  const { data: allServices } = useServices()
  const createCat = useCreateCategory()
  const updateCat = useUpdateCategory()
  const deleteCat = useDeleteCategory()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[5])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [listSearch, setListSearch] = useState('')

  const catCount = useMemo(() => {
    const map: Record<string, number> = {}
    allServices?.forEach((s) => { if (s.category) map[s.category] = (map[s.category] || 0) + 1 })
    return map
  }, [allServices])

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await createCat.mutateAsync({ name: newName.trim(), color: newColor })
      setNewName('')
      toast.success(t('services.categoryCreated'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return
    try {
      await updateCat.mutateAsync({ id, data: { name: editName.trim() } })
      setEditingId(null)
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteCat.mutateAsync(deleteId)
      setDeleteId(null)
      toast.success(t('services.categoryDeleted'))
    } catch {
      toast.error(t('common.deleteError'))
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent mobileFullscreen className="max-w-md max-sm:flex max-sm:flex-col max-sm:justify-start">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-4 w-4" />
              {t('services.manageCategories')}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 max-sm:flex-1 max-sm:min-h-0">
            {/* Create new */}
            <div className="space-y-2 shrink-0">
              <Label>{t('services.categoryName')}</Label>
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('services.categoryNamePlaceholder')}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={handleCreate}
                  loading={createCat.isPending}
                  disabled={!newName.trim()}
                  size="icon"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {/* Color picker */}
              <div className="flex gap-1.5 flex-wrap">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: newColor === c ? 'white' : 'transparent',
                      outline: newColor === c ? `2px solid ${c}` : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Поиск по категориям */}
            {(categories?.length ?? 0) > 3 && (
              <div className="relative shrink-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={t('services.search')}
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                />
                {listSearch && (
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setListSearch('')}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* List */}
            <div className="space-y-1 overflow-y-auto max-h-60 max-sm:max-h-none max-sm:flex-1">
              {categories?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{t('services.noCategoriesYet')}</p>
              )}
              {categories
                ?.filter((cat: ServiceCategory) => !listSearch.trim() || cat.name.toLowerCase().includes(listSearch.toLowerCase()))
                .map((cat: ServiceCategory) => (
                <div key={cat.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color || '#64748b' }}
                  />
                  {editingId === cat.id ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 text-sm flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdate(cat.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => handleUpdate(cat.id)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm">{cat.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0 min-w-[1.5rem] text-right">
                        {catCount[cat.id] || 0}
                      </span>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                        onClick={() => { setEditingId(cat.id); setEditName(cat.name) }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive"
                        onClick={() => setDeleteId(cat.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
              {listSearch.trim() && categories?.filter((c: ServiceCategory) => c.name.toLowerCase().includes(listSearch.toLowerCase())).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{t('services.notFound')}</p>
              )}
            </div>
          </div>

          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t('services.categoryDeleteConfirm')}
        loading={deleteCat.isPending}
      />
    </>
  )
}

type SortKey = 'name' | 'price' | 'duration' | 'category'

// ── Main page ──────────────────────────────────────────────────────────────
export function ServicesPage() {
  const { t, i18n } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editService, setEditService] = useState<Service | null>(null)
  const [activeTab, setActiveTab] = useState('main')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [catDialogOpen, setCatDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  // Переключатель "перейти к материалам после сохранения"
  const [goToMaterials, setGoToMaterials] = useState(false)
  // Категория — поиск в диалоге
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [catSearch, setCatSearch] = useState('')
  const [catOpen, setCatOpen] = useState(false)
  const [selectedCatId, setSelectedCatId] = useState<string>('__none__')
  const [inlineCatColor, setInlineCatColor] = useState(CATEGORY_COLORS[5])
  const catDropRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!catOpen) return
    const handler = (e: MouseEvent) => {
      if (catDropRef.current && !catDropRef.current.contains(e.target as Node)) setCatOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [catOpen])

  useEffect(() => {
    const id = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 350)
    return () => clearTimeout(id)
  }, [search])

  const pbSort = useMemo(() => {
    const prefix = sortAsc ? '' : '-'
    if (sortKey === 'price') return `${prefix}price`
    if (sortKey === 'duration') return `${prefix}duration_min`
    return `${prefix}name`
  }, [sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(true); setPage(1) }
  }

  const hasGlobalServices = useFeature('global_services_catalog')
  const hasServiceMaterials = useFeature('service_materials')
  const currency = useCurrency()
  const ServiceIcon = useProfileIcon()
  const { data: pagedServices, isLoading } = useServicesPage(debouncedSearch, page, 25, pbSort)
  const services = pagedServices?.items ?? []
  const totalItems = pagedServices?.totalItems ?? 0
  const totalPages = pagedServices?.totalPages ?? 1
  const serviceCount = totalItems
  const { isReached: serviceLimitReached } = usePlanLimitCheck('services', serviceCount)
  const { data: categories } = useServiceCategories()
  const { data: noCatCount } = useServicesNoCatCount()
  const create = useCreateService()
  const update = useUpdateService()
  const del = useDeleteService()
  const createCat = useCreateCategory()

  const categoryMap = useMemo(
    () => new Map((categories ?? []).map(c => [c.id, c])),
    [categories]
  )
  const getCategoryById = (id: string | undefined): ServiceCategory | undefined =>
    id ? categoryMap.get(id) : undefined

  const [priceDisplay, setPriceDisplay] = useState('')
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { is_active: true, is_bookable: true, duration_min: 60, price: 0 },
  })

  const isActive = watch('is_active')
  const isBookable = watch('is_bookable')
  const duration = watch('duration_min')

  const openCreate = () => {
    setEditService(null)
    reset({ is_active: true, is_bookable: true, duration_min: 60, price: 0, name: '', description: '', category: '__none__' })
    setPriceDisplay('')
    setSelectedCatId('__none__')
    setCatSearch('')
    setActiveTab('main')
    setGoToMaterials(false)
    setDialogOpen(true)
  }

  const openEdit = (s: Service) => {
    setEditService(s)
    const price = s.price ?? 0
    reset({
      name: s.name,
      description: s.description || '',
      duration_min: s.duration_min,
      price,
      price_max: s.price_max,
      category: s.category || '__none__',
      is_active: s.is_active,
      is_bookable: s.is_bookable,
    })
    setPriceDisplay(price > 0 ? String(price) : '')
    setSelectedCatId(s.category || '__none__')
    setCatSearch('')
    setActiveTab('main')
    setDialogOpen(true)
  }

  const onSubmit = async (values: FormValues) => {
    try {
      const submitData = { ...values, category: selectedCatId === '__none__' ? '' : selectedCatId }
      if (editService) {
        await update.mutateAsync({ id: editService.id, data: submitData })
        toast.success(t('services.updated'))
        setDialogOpen(false)
      } else {
        const created = await create.mutateAsync(submitData as any)
        toast.success(t('services.created'))
        if (goToMaterials) {
          // Остаёмся в диалоге, переключаемся в режим редактирования → вкладка Материалы
          setEditService(created)
          setActiveTab('materials')
        } else {
          setDialogOpen(false)
        }
      }
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await del.mutateAsync(deleteId)
      toast.success(t('services.deleted'))
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
    () => services.length > 0 && services.every(s => selectedIds.has(s.id)),
    [services, selectedIds]
  )
  const isSomeSelected = useMemo(
    () => services.some(s => selectedIds.has(s.id)),
    [services, selectedIds]
  )

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(services.map(s => s.id)))
    }
  }

  const handleBulkDelete = async () => {
    try {
      await Promise.all([...selectedIds].map(id => del.mutateAsync(id)))
      toast.success(t('services.deletedMultiple', { count: selectedIds.size }))
      setSelectedIds(new Set())
      setBulkDeleteOpen(false)
    } catch {
      toast.error(t('common.deleteError'))
    }
  }

  const serviceStats = useMemo(() => ({
    total: totalItems,
    categories: categories?.length ?? 0,
  }), [totalItems, categories])

  return (
    <div className="space-y-6">
      <div className="space-y-2 sticky top-0 z-10 bg-background -mx-3 px-3 lg:-mx-6 lg:px-6 -mt-4 pt-4 lg:-mt-6 lg:pt-6 pb-3 shadow-sm">
        {/* Row 1: title */}
        <h1 className="text-2xl font-semibold text-foreground">{t('nav.services')}</h1>

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
              {t('services.selectedCount', { count: selectedIds.size })}
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
          {!isLoading && (totalItems > 0 || debouncedSearch) && (
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={t('services.search')}
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
            {hasGlobalServices && (
              <Button variant="outline" size="icon" className="sm:hidden" onClick={() => setImportOpen(true)}>
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" className="hidden sm:flex" onClick={() => setCatDialogOpen(true)}>
              <Tags className="h-4 w-4 mr-2" />
              {t('services.manageCategories')}
            </Button>
            {hasGlobalServices && (
              <Button variant="outline" className="hidden sm:flex" onClick={() => setImportOpen(true)}>
                <Download className="h-4 w-4 mr-2" />
                {t('catalog.fromCatalog')}
              </Button>
            )}
            <Button onClick={openCreate} disabled={serviceLimitReached}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('services.add')}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Plan limit banner */}
      <PlanLimitBanner limitKey="services" count={serviceCount} entityKey="services" />

      {!isLoading && serviceStats.total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Всего услуг</p>
            <p className="text-2xl font-bold mt-1">{serviceStats.total}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Категорий</p>
            <p className="text-2xl font-bold mt-1">{serviceStats.categories}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Без категории</p>
            <p className={`text-2xl font-bold mt-1 ${noCatCount ? 'text-amber-500' : ''}`}>{noCatCount ?? '—'}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : totalItems === 0 && !debouncedSearch ? (
        <EmptyState icon={ServiceIcon} title={t('services.empty')} action={{ label: t('services.add'), onClick: openCreate }} />
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{t('services.notFound')}</p>
          <button className="mt-2 text-xs text-primary hover:underline" onClick={() => setSearch('')}>{t('common.clearFilter')}</button>
        </div>
      ) : (
        <>
        {/* Grid/Card view — на мобильном всегда, на десктопе только в grid-режиме */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 sm:hidden">
          {services.map((service) => {
            const cat = service.category ? getCategoryById(service.category) : undefined
            const isSelected = selectedIds.has(service.id)
            return (
              <div
                key={service.id}
                onClick={() => openEdit(service)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-card hover:bg-accent/30 transition-colors cursor-pointer ${!service.is_active ? 'opacity-60' : ''} ${isSelected ? 'border-primary/60 bg-primary/5' : ''}`}
              >
                {/* Чекбокс */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleSelect(service.id) }}
                  className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors shrink-0"
                >
                  {isSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                </button>
                {/* Левая часть */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{service.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {service.is_bookable
                      ? <Badge variant="success" className="text-xs shrink-0">{t('services.online')}</Badge>
                      : <Badge variant="secondary" className="text-xs shrink-0">{t('services.offline')}</Badge>}
                    {!service.is_active && <Badge variant="secondary" className="text-xs shrink-0">{t('services.inactive')}</Badge>}
                    {cat && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#64748b' }} />
                        <span className="max-w-[70px] truncate">{cat.name}</span>
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5 shrink-0">
                      <Clock className="h-3 w-3" />{formatDuration(service.duration_min, t)}
                    </span>
                    <span className="text-xs font-medium shrink-0">{formatCurrency(service.price, currency, i18n.language)}</span>
                  </div>
                </div>
                {/* Меню */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(service) }}>
                      <Edit className="mr-2 h-4 w-4" />{t('common.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(service.id) }}>
                      <Trash2 className="mr-2 h-4 w-4" />{t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          })}
        </div>
        {/* List/Table view — только на десктопе (≥sm) */}
        <div className="rounded-xl border overflow-hidden hidden sm:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 w-10">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="flex items-center text-muted-foreground hover:text-primary transition-colors"
                  >
                    {isAllSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                  </button>
                </th>
                <th className="text-left p-3 font-medium">
                  <button type="button" onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    {t('services.name')}<ArrowUpDown className={`h-3 w-3 shrink-0 ${sortKey === 'name' ? 'text-primary' : 'opacity-30'}`} />
                  </button>
                </th>
                <th className="text-left p-3 font-medium">
                  <button type="button" onClick={() => toggleSort('category')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    {t('services.category')}<ArrowUpDown className={`h-3 w-3 shrink-0 ${sortKey === 'category' ? 'text-primary' : 'opacity-30'}`} />
                  </button>
                </th>
                <th className="text-left p-3 font-medium">
                  <button type="button" onClick={() => toggleSort('duration')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    {t('services.duration')}<ArrowUpDown className={`h-3 w-3 shrink-0 ${sortKey === 'duration' ? 'text-primary' : 'opacity-30'}`} />
                  </button>
                </th>
                <th className="text-left p-3 font-medium">
                  <button type="button" onClick={() => toggleSort('price')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    {t('services.price')}<ArrowUpDown className={`h-3 w-3 shrink-0 ${sortKey === 'price' ? 'text-primary' : 'opacity-30'}`} />
                  </button>
                </th>
                <th className="p-3 font-medium">{t('services.status')}</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => {
                const cat = service.category ? getCategoryById(service.category) : undefined
                const isSelected = selectedIds.has(service.id)
                return (
                  <tr
                    key={service.id}
                    className={`border-t hover:bg-accent/40 transition-colors cursor-pointer ${!service.is_active ? 'opacity-60' : ''} ${isSelected ? 'bg-primary/5' : ''}`}
                    onClick={() => openEdit(service)}
                  >
                    <td className="p-3 w-10">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleSelect(service.id) }}
                        className="flex items-center text-muted-foreground hover:text-primary transition-colors"
                      >
                        {isSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="p-3">
                      <p className="font-medium leading-tight">{service.name}</p>
                    </td>
                    <td className="p-3">
                      {cat ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#64748b' }} />
                          <span className="truncate">{cat.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        {formatDuration(service.duration_min, t)}
                      </span>
                    </td>
                    <td className="p-3 font-medium whitespace-nowrap">
                      {formatCurrency(service.price, currency, i18n.language)}
                      {service.price_max ? ` — ${formatCurrency(service.price_max, currency, i18n.language)}` : ''}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-0.5 items-start">
                        {!service.is_active && <Badge variant="secondary" className="text-xs">{t('services.inactive')}</Badge>}
                        {service.is_bookable
                          ? <Badge variant="success" className="text-xs">{t('services.online')}</Badge>
                          : <Badge variant="secondary" className="text-xs">{t('services.offline')}</Badge>}
                      </div>
                    </td>
                    <td className="p-3 w-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(service) }}>
                            <Edit className="mr-2 h-4 w-4" />{t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(service.id) }}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent mobileFullscreen className="max-w-lg overflow-y-auto max-sm:flex max-sm:flex-col">
          <DialogHeader>
            <DialogTitle>{editService ? t('services.edit') : t('services.add')}</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="max-sm:flex-1 max-sm:flex max-sm:flex-col max-sm:overflow-hidden">
            <TabsList className="w-full shrink-0">
              <TabsTrigger value="main" className="flex-1">{t('services.name')}</TabsTrigger>
              {hasServiceMaterials && (
                <TabsTrigger value="materials" className="flex-1">{t('services.materialsTab')}</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="main" className="max-sm:flex-1 max-sm:overflow-y-auto max-sm:pb-2">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-3">
                <div className="space-y-2">
                  <Label>{t('services.name')} *</Label>
                  <Input {...register('name')} />
                  {errors.name && <p className="text-xs text-destructive">{t('common.required')}</p>}
                </div>
                <div className="space-y-2">
                  <Label>{t('services.description')}</Label>
                  <Textarea rows={2} {...register('description')} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('services.duration')} ({t('services.minutes')})</Label>
                    <div className="flex items-center gap-1.5">
                      {DURATION_PRESETS.map((d) => (
                        <button
                          key={d} type="button"
                          onClick={() => setValue('duration_min', d, { shouldDirty: true })}
                          className={`px-2 py-1 rounded text-xs border transition-colors shrink-0 ${duration === d ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/50'}`}
                        >
                          {d}
                        </button>
                      ))}
                      <Input type="number" min={5} {...register('duration_min', { valueAsNumber: true })} className="min-w-0" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('services.price')}</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={priceDisplay}
                      onKeyDown={(e) => {
                        if (
                          !/^\d$/.test(e.key) &&
                          !['Backspace','Delete','Tab','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key) &&
                          !e.ctrlKey && !e.metaKey
                        ) {
                          e.preventDefault()
                        }
                      }}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '')
                        setPriceDisplay(digits)
                        setValue('price', digits === '' ? 0 : Number(digits), { shouldValidate: true, shouldDirty: true })
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t('services.category')}</Label>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => { setDialogOpen(false); setCatDialogOpen(true) }}
                    >
                      {t('services.manageCategories')}
                    </button>
                  </div>
                  {/* Кастомный селект с поиском */}
                  <div className="relative" ref={catDropRef}>
                    <button
                      type="button"
                      onClick={() => { setCatOpen(v => !v); setCatSearch('') }}
                      className="w-full h-9 px-3 flex items-center gap-2 rounded-md border border-input bg-background text-sm text-left hover:bg-accent/30 transition-colors"
                    >
                      {selectedCatId !== '__none__' && getCategoryById(selectedCatId) ? (
                        <>
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getCategoryById(selectedCatId)?.color || '#64748b' }} />
                          <span className="flex-1 truncate">{getCategoryById(selectedCatId)?.name}</span>
                        </>
                      ) : (
                        <span className="flex-1 text-muted-foreground">{t('services.noCategory')}</span>
                      )}
                      <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-50" />
                    </button>
                    {catOpen && (
                      <div className="absolute left-0 top-full mt-1 z-50 w-full bg-white dark:bg-zinc-900 border border-border rounded-xl shadow-xl overflow-hidden">
                        {/* Поиск */}
                        <div className="p-2 border-b">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                            <input
                              autoFocus
                              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                              placeholder={t('services.search')}
                              value={catSearch}
                              onChange={e => setCatSearch(e.target.value)}
                            />
                          </div>
                        </div>
                        {/* Список */}
                        <div className="max-h-44 overflow-y-auto py-1">
                          {/* Без категории */}
                          {!catSearch.trim() && (
                            <button type="button"
                              onClick={() => { setSelectedCatId('__none__'); setValue('category', '__none__', { shouldDirty: true }); setCatOpen(false) }}
                              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent/50 transition-colors
                                ${selectedCatId === '__none__' ? 'bg-primary/8 text-primary font-medium' : 'text-muted-foreground'}`}>
                              {t('services.noCategory')}
                            </button>
                          )}
                          {(categories ?? [])
                            .filter(c => !catSearch.trim() || c.name.toLowerCase().includes(catSearch.toLowerCase()))
                            .map(c => (
                              <button key={c.id} type="button"
                                onClick={() => { setSelectedCatId(c.id); setValue('category', c.id, { shouldDirty: true }); setCatOpen(false) }}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent/50 transition-colors
                                  ${selectedCatId === c.id ? 'bg-primary/8 text-primary font-medium' : ''}`}>
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color || '#64748b' }} />
                                {c.name}
                              </button>
                            ))
                          }
                          {catSearch.trim() && (categories ?? []).filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase())).length === 0 && (
                            <div className="border-t px-3 py-2 space-y-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {CATEGORY_COLORS.map((color) => (
                                  <button
                                    key={color}
                                    type="button"
                                    onClick={() => setInlineCatColor(color)}
                                    className={`w-5 h-5 rounded-full shrink-0 transition-transform hover:scale-110 ${inlineCatColor === color ? 'ring-2 ring-offset-1 ring-primary scale-110' : ''}`}
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                              <button
                                type="button"
                                className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                                onClick={async () => {
                                  try {
                                    const created = await createCat.mutateAsync({ name: catSearch.trim(), color: inlineCatColor })
                                    setSelectedCatId(created.id)
                                    setValue('category', created.id, { shouldDirty: true })
                                    setCatOpen(false)
                                    setCatSearch('')
                                    setInlineCatColor(CATEGORY_COLORS[5])
                                  } catch { /* ignore */ }
                                }}
                              >
                                <Plus className="h-3.5 w-3.5 shrink-0" />
                                {t('inventory.addCategory', { name: catSearch.trim() })}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label>{t('services.active')}</Label>
                  <Switch checked={isActive} onCheckedChange={(v) => setValue('is_active', v, { shouldDirty: true })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>{t('services.onlineBooking')}</Label>
                  <Switch checked={isBookable} onCheckedChange={(v) => setValue('is_bookable', v, { shouldDirty: true })} />
                </div>

                {!editService && hasServiceMaterials && (
                  <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2.5 bg-muted/30">
                    <div className="space-y-0.5">
                      <Label className="text-sm">{t('services.addMaterialsAfterSave')}</Label>
                      <p className="text-xs text-muted-foreground">{t('services.addMaterialsAfterSaveHint')}</p>
                    </div>
                    <Switch checked={goToMaterials} onCheckedChange={setGoToMaterials} />
                  </div>
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
                  <Button type="submit" loading={create.isPending || update.isPending}>{t('common.save')}</Button>
                </DialogFooter>
              </form>
            </TabsContent>

            {hasServiceMaterials && <TabsContent value="materials" className="pt-3 max-sm:flex-1 max-sm:overflow-y-auto max-sm:pb-2">
              {editService ? (
                <>
                  <ServiceMaterialsTab serviceId={editService.id} />
                  <DialogFooter className="mt-4">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
                  </DialogFooter>
                </>
              ) : (
                <div className="py-8 flex flex-col items-center gap-3 text-center">
                  <p className="text-sm text-muted-foreground">{t('services.saveThenMaterials')}</p>
                  <Button type="button" onClick={() => setActiveTab('main')}>
                    {t('services.goToMain')}
                  </Button>
                </div>
              )}
            </TabsContent>}
          </Tabs>
        </DialogContent>
      </Dialog>

      <CategoriesDialog open={catDialogOpen} onClose={() => setCatDialogOpen(false)} />
      <ImportServicesDialog open={importOpen} onClose={() => setImportOpen(false)} />

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title={t('services.deleteConfirm')} loading={del.isPending} />

      <ConfirmDialog open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} onConfirm={handleBulkDelete}
        title={t('services.bulkDeleteConfirm', { count: selectedIds.size })} loading={del.isPending} />
    </div>
  )
}
