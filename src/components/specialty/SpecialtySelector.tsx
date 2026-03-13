import { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Search, ChevronRight } from 'lucide-react'
import { useActivityTypes, useAllSpecialties } from '@/hooks/useSpecialties'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { getProfessionIcon } from '@/lib/professionIcon'
import type { ActivityType, Specialty } from '@/types'

interface Props {
  activityTypeId?: string
  specialtyId?: string
  onChange: (activityTypeId: string, specialtyId: string, activityTypeName: string, specialtyName: string) => void
  label?: string
  showActivityTypeName?: boolean
}

export function SpecialtySelector({ activityTypeId, specialtyId, onChange, label, showActivityTypeName = true }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const specListRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const [leftPct, setLeftPct] = useState(40)

  const { data: activityTypes, isLoading: loadingTypes } = useActivityTypes()
  const { data: allSpecialties, isLoading: loadingSpecs } = useAllSpecialties()

  const loading = loadingTypes || loadingSpecs

  // Find current display values
  const currentType = activityTypes?.find((t) => t.id === activityTypeId)
  const currentSpec = allSpecialties?.find((s) => s.id === specialtyId)

  // Auto-select category of currently selected specialty on open
  useEffect(() => {
    if (!open || !activityTypes || !currentSpec) return
    const type = activityTypes.find((t) => t.id === currentSpec.activity_type_id)
    if (type) setSelectedType(type)
  }, [open, activityTypes, currentSpec])

  // Reset search on close
  useEffect(() => {
    if (!open) {
      setSearch('')
    }
  }, [open])

  // Scroll selected specialty into view
  useEffect(() => {
    if (!open || !specialtyId || !specListRef.current) return
    const el = specListRef.current.querySelector(`[data-spec-id="${specialtyId}"]`)
    if (el) {
      setTimeout(() => el.scrollIntoView({ block: 'nearest' }), 50)
    }
  }, [open, selectedType, specialtyId])

  // Grouped by type (for two-panel view)
  const grouped = useMemo(() => {
    if (!activityTypes || !allSpecialties) return []
    return activityTypes.map((type) => ({
      type,
      specs: allSpecialties.filter((s) => s.activity_type_id === type.id),
    })).filter((g) => g.specs.length > 0)
  }, [activityTypes, allSpecialties])

  // Specs for right panel (filtered by selected type or search)
  const isSearching = search.trim().length > 0

  const searchResults = useMemo(() => {
    if (!isSearching || !allSpecialties) return []
    const q = search.toLowerCase()
    return allSpecialties.filter((s) => s.name.toLowerCase().includes(q))
  }, [allSpecialties, search, isSearching])

  const rightPanelSpecs = useMemo(() => {
    if (isSearching) return null // search mode — show flat list
    if (!selectedType) return null
    return allSpecialties?.filter((s) => s.activity_type_id === selectedType.id) ?? []
  }, [allSpecialties, selectedType, isSearching])

  const handleSelect = (spec: Specialty) => {
    const type = activityTypes?.find((t) => t.id === spec.activity_type_id)
    if (!type) return
    onChange(type.id, spec.id, type.name, spec.name)
    setOpen(false)
    setSearch('')
    setSelectedType(null)
  }

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    isDragging.current = true
    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const clientX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((clientX - rect.left) / rect.width) * 100
      setLeftPct(Math.min(65, Math.max(25, pct)))
    }
    const onUp = () => {
      isDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
  }

  const displayValue = currentSpec
    ? (showActivityTypeName && currentType?.name ? `${currentType.name} — ${currentSpec.name}` : currentSpec.name)
    : t('specialty.select')

  return (
    <>
      <div className="space-y-1">
        {label && <Label>{label}</Label>}
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between font-normal"
          onClick={() => setOpen(true)}
        >
          <span className={cn(!currentSpec && 'text-muted-foreground')}>{displayValue}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent mobileFullscreen className="max-w-2xl p-0 gap-0 overflow-hidden flex flex-col sm:max-h-[85vh]">
          {/* ── Header ── */}
          <div className="px-5 pt-5 pb-3 border-b space-y-3">
            <DialogHeader>
              <DialogTitle>{t('specialty.choose')}</DialogTitle>
            </DialogHeader>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                className="pl-9 h-9"
                placeholder={t('specialty.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* ── Body ── */}
          <div ref={containerRef} className="flex flex-1 overflow-hidden min-h-0">

            {/* ── Search results (flat list) ── */}
            {isSearching && (
              <div className="flex-1 overflow-y-auto p-2">
                {searchResults.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-10">{t('specialty.notFound')}</p>
                )}
                {searchResults.map((spec) => {
                  const isSelected = specialtyId === spec.id
                  const typeEntry = activityTypes?.find((t) => t.id === spec.activity_type_id)
                  const SpecIcon = getProfessionIcon(spec.name)
                  return (
                    <button
                      key={spec.id}
                      type="button"
                      onClick={() => handleSelect(spec)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors',
                        'hover:bg-muted/60',
                        isSelected && 'bg-primary/10 text-primary font-medium'
                      )}
                    >
                      <Check className={cn('h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                      <SpecIcon className={cn('h-4 w-4 shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="flex-1">{spec.name}</span>
                      {typeEntry && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {typeEntry.name}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* ── Two-panel layout ── */}
            {!isSearching && (
              <>
                {/* Left: categories */}
                <div style={{ width: `${leftPct}%` }} className="shrink-0 overflow-y-auto bg-muted/20">
                  {loading && (
                    <div className="p-2 space-y-1">
                      {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
                    </div>
                  )}
                  {!loading && grouped.map(({ type, specs }) => {
                    const isActive = selectedType?.id === type.id
                    const hasSelected = specs.some((s) => s.id === specialtyId)
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          setSelectedType(type)
                          if (specListRef.current) specListRef.current.scrollTop = 0
                        }}
                        className={cn(
                          'w-full flex items-center justify-between gap-1 px-3 py-3 text-sm text-left transition-colors border-b border-border/50 last:border-0',
                          isActive
                            ? 'bg-background font-semibold text-primary'
                            : 'hover:bg-muted/40 text-foreground'
                        )}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {hasSelected && !isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          )}
                          <span className="truncate">{type.name}</span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <span className="text-xs text-muted-foreground">{specs.length}</span>
                          <ChevronRight className={cn('h-3.5 w-3.5 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground/50')} />
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Drag divider */}
                <div
                  onMouseDown={startDrag}
                  onTouchStart={startDrag}
                  className="w-1 shrink-0 cursor-col-resize border-r border-border hover:border-primary/50 hover:bg-primary/10 active:bg-primary/20 transition-colors select-none"
                />

                {/* Right: specialties */}
                <div ref={specListRef} className="flex-1 overflow-y-auto p-2">
                  {/* Empty state — no category selected */}
                  {!selectedType && !loading && (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-2 px-4">
                      <ChevronRight className="h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">{t('specialty.selectCategory')}</p>
                    </div>
                  )}

                  {/* Loading skeletons */}
                  {loading && (
                    <div className="space-y-1">
                      {[1,2,3,4,5,6].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
                    </div>
                  )}

                  {/* Specialty list */}
                  {rightPanelSpecs?.map((spec) => {
                    const isSelected = specialtyId === spec.id
                    const SpecIcon = getProfessionIcon(spec.name)
                    return (
                      <button
                        key={spec.id}
                        data-spec-id={spec.id}
                        type="button"
                        onClick={() => handleSelect(spec)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors',
                          'hover:bg-muted/60',
                          isSelected && 'bg-primary/10 text-primary font-medium'
                        )}
                      >
                        <Check className={cn('h-4 w-4 shrink-0 transition-opacity', isSelected ? 'opacity-100' : 'opacity-0')} />
                        <SpecIcon className={cn('h-4 w-4 shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                        <span className="flex-1">{spec.name}</span>
                      </button>
                    )
                  })}

                  {rightPanelSpecs?.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-10">{t('specialty.empty')}</p>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
