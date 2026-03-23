import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Download, Check, Package, ChevronDown, ChevronRight, Tag } from 'lucide-react'
import { useGlobalProducts } from '@/hooks/useGlobalCatalogs'
import { useCreateInventoryItem, useInventory } from '@/hooks/useInventory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/shared/Toaster'
import { cn } from '@/lib/utils'
import type { GlobalProduct } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
}

export function ImportProductsDialog({ open, onClose }: Props) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [targetCategory, setTargetCategory] = useState<string>('')

  const { data: products, isLoading } = useGlobalProducts()
  const { data: myItems } = useInventory()
  const createItem = useCreateInventoryItem()

  // Уникальные категории из существующего инвентаря пользователя
  const existingCategories = useMemo(() => {
    const cats = (myItems ?? []).map(i => i.category).filter(Boolean) as string[]
    return [...new Set(cats)].sort()
  }, [myItems])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  // Client-side grouping + filtering (case-insensitive for any script)
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? (products ?? []).filter(p =>
          p.name.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q)
        )
      : (products ?? [])
    return filtered.reduce<Record<string, GlobalProduct[]>>((acc, p) => {
      const cat = p.category || t('catalog.noCategory')
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(p)
      return acc
    }, {})
  }, [products, t, search])

  const allFilteredProducts = useMemo(() => Object.values(grouped).flat(), [grouped])

  const handleSelectAll = () => {
    if (allFilteredProducts.length > 0 && selected.size === allFilteredProducts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allFilteredProducts.map((p) => p.id)))
    }
  }

  const handleImport = async () => {
    if (!products || selected.size === 0) return
    setImporting(true)
    const toImport = products.filter((p) => selected.has(p.id))
    let count = 0
    let errors = 0
    for (const p of toImport) {
      try {
        await createItem.mutateAsync({
          name: p.name,
          description: p.description || undefined,
          category: targetCategory.trim() || p.category || undefined,
          unit: p.unit || undefined,
          quantity: 0,
          cost_price: p.price || undefined,
          sell_price: p.price || undefined,
        } as any)
        count++
      } catch {
        errors++
      }
    }
    setImporting(false)
    if (count > 0) toast.success(t('catalog.importedProducts', { count }))
    if (errors > 0) toast.error(t('common.saveError'))
    setSelected(new Set())
    onClose()
  }

  const allSelected = allFilteredProducts.length > 0 && selected.size === allFilteredProducts.length
  const isSearching = search.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent mobileFullscreen className="max-w-lg sm:h-[85vh] sm:max-h-[85vh] sm:min-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t('catalog.importProductsTitle')}
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-6 pb-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelected(new Set()) }}
              placeholder={t('catalog.searchProducts')}
              className="pl-9"
            />
          </div>
        </div>

        {/* Select all */}
        {allFilteredProducts.length > 0 && (
          <div className="px-6 pb-2 shrink-0 flex items-center justify-between">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-primary hover:underline"
            >
              {allSelected ? t('catalog.deselectAll') : t('catalog.selectAll')}
            </button>
            {selected.size > 0 && (
              <Badge variant="secondary" className="text-xs">{t('catalog.selectedCount', { count: selected.size })}</Badge>
            )}
          </div>
        )}

        {/* Category selector */}
        {allFilteredProducts.length > 0 && (
          <div className="px-6 pb-3 shrink-0 flex items-center gap-2 border-b">
            <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground shrink-0">{t('catalog.importToCategory')}:</span>
            <div className="flex-1 relative">
              <Input
                list="inv-categories-list"
                value={targetCategory}
                onChange={e => setTargetCategory(e.target.value)}
                placeholder={t('catalog.importCategoryPlaceholder')}
                className="h-7 text-xs pr-2"
              />
              {existingCategories.length > 0 && (
                <datalist id="inv-categories-list">
                  {existingCategories.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              )}
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-2">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && allFilteredProducts.length === 0 && (
            <div className="text-center py-12 space-y-2">
              <Package className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                {search ? t('catalog.noResults') : t('catalog.globalProductsEmpty')}
              </p>
            </div>
          )}

          {!isLoading && Object.entries(grouped).map(([cat, items]) => {
            const isCollapsed = !isSearching && !expandedCats.has(cat)
            const catSelected = items.filter(p => selected.has(p.id)).length

            return (
              <div key={cat}>
                {/* Category header */}
                <button
                  type="button"
                  onClick={() => !isSearching && toggleCat(cat)}
                  className={cn(
                    'w-full flex items-center gap-1.5 py-1.5 text-left',
                    !isSearching && 'hover:opacity-70 transition-opacity'
                  )}
                >
                  {isSearching ? null : isCollapsed
                    ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  }
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex-1">
                    {cat}
                  </span>
                  {catSelected > 0 && (
                    <Badge variant="secondary" className="text-xs">{catSelected}/{items.length}</Badge>
                  )}
                </button>

                {/* Items */}
                {!isCollapsed && (
                  <div className="space-y-1">
                    {items.map((p) => {
                      const isSelected = selected.has(p.id)
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleSelect(p.id)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors',
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-muted/30'
                          )}
                        >
                          <div className={cn(
                            'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                            isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                          )}>
                            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium">{p.name}</span>
                            {p.description && (
                              <span className="text-xs text-muted-foreground ml-2">{p.description}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {p.unit && (
                              <Badge variant="outline" className="text-xs font-normal">{p.unit}</Badge>
                            )}
                            {p.price != null && p.price > 0 && (
                              <span className="text-xs text-muted-foreground">{p.price}</span>
                            )}
                          </div>
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
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            onClick={handleImport}
            disabled={selected.size === 0}
            loading={importing}
          >
            <Download className="h-4 w-4 mr-2" />
            {t('catalog.importSelected', { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
