import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Search, Download, Check, Scissors, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useGlobalServices } from '@/hooks/useGlobalCatalogs'
import { useServiceCategories, SERVICES_KEY, CATEGORIES_KEY } from '@/hooks/useServices'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/shared/Toaster'
import { cn } from '@/lib/utils'
import type { GlobalService } from '@/types'

const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#64748b', '#78716c',
]

interface Props {
  open: boolean
  onClose: () => void
}

export function ImportServicesDialog({ open, onClose }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())

  const { data: services, isLoading } = useGlobalServices()
  const { data: myCategories } = useServiceCategories()

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

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? (services ?? []).filter(s =>
          s.name.toLowerCase().includes(q) || (s.category ?? '').toLowerCase().includes(q)
        )
      : (services ?? [])
    return filtered.reduce<Record<string, GlobalService[]>>((acc, s) => {
      const cat = s.category || t('catalog.noCategory')
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(s)
      return acc
    }, {})
  }, [services, t, search])

  const allFilteredServices = useMemo(() => Object.values(grouped).flat(), [grouped])

  const handleSelectAll = () => {
    if (allFilteredServices.length > 0 && selected.size === allFilteredServices.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allFilteredServices.map((s) => s.id)))
    }
  }

  const handleImport = async () => {
    if (!services || selected.size === 0 || !user) return
    setImporting(true)

    try {
      const toImport = services.filter(s => selected.has(s.id))

      // 1. Collect unique category names from selected services
      const uniqueCatNames = [...new Set(
        toImport.map(s => s.category).filter(Boolean) as string[]
      )]

      // 2. Build existing category name → id map (case-insensitive)
      const catMap: Record<string, string> = {}
      for (const cat of myCategories ?? []) {
        catMap[cat.name.toLowerCase()] = cat.id
      }

      // 3. Create missing categories in one batch insert
      const missingCats = uniqueCatNames.filter(name => !catMap[name.toLowerCase()])
      if (missingCats.length > 0) {
        const { data: newCats } = await supabase
          .from('service_categories')
          .insert(missingCats.map((name, i) => ({
            name,
            master_id: user.id,
            color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
          })))
          .select()
        for (const cat of newCats ?? []) {
          catMap[cat.name.toLowerCase()] = cat.id
        }
      }

      // 4. Bulk insert all services in one request
      const rows = toImport.map(s => ({
        name: s.name,
        description: s.description || null,
        duration_min: s.duration_min || 60,
        price: s.price || 0,
        is_active: true,
        is_bookable: true,
        master_id: user.id,
        category_id: s.category ? (catMap[s.category.toLowerCase()] ?? null) : null,
      }))

      const { data: created, error } = await supabase.from('services').insert(rows).select()

      if (error) throw error

      queryClient.invalidateQueries({ queryKey: [SERVICES_KEY] })
      queryClient.invalidateQueries({ queryKey: [CATEGORIES_KEY] })
      toast.success(t('catalog.importedServices', { count: created?.length ?? rows.length }))
    } catch {
      toast.error(t('common.saveError'))
    }

    setImporting(false)
    setSelected(new Set())
    onClose()
  }

  const allSelected = allFilteredServices.length > 0 && selected.size === allFilteredServices.length
  const isSearching = search.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent mobileFullscreen className="max-w-lg sm:h-[85vh] sm:max-h-[85vh] sm:min-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t('catalog.importServicesTitle')}
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-6 pb-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelected(new Set()) }}
              placeholder={t('catalog.searchServices')}
              className="pl-9"
            />
          </div>
        </div>

        {/* Select all */}
        {allFilteredServices.length > 0 && (
          <div className="px-6 pb-2 shrink-0 flex items-center justify-between border-b">
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

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-2">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && allFilteredServices.length === 0 && (
            <div className="text-center py-12 space-y-2">
              <Scissors className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                {search ? t('catalog.noResults') : t('catalog.globalServicesEmpty')}
              </p>
            </div>
          )}

          {!isLoading && Object.entries(grouped).map(([cat, items]) => {
            const isCollapsed = !isSearching && !expandedCats.has(cat)
            const catSelected = items.filter(s => selected.has(s.id)).length

            return (
              <div key={cat}>
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

                {!isCollapsed && (
                  <div className="space-y-1">
                    {items.map((s) => {
                      const isSelected = selected.has(s.id)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleSelect(s.id)}
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
                            <span className="text-sm font-medium">{s.name}</span>
                            {s.description && (
                              <span className="text-xs text-muted-foreground ml-2">{s.description}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                            {s.duration_min != null && <span>{s.duration_min} {t('services.minutes')}</span>}
                            {s.price != null && s.price > 0 && <span>{s.price}</span>}
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
