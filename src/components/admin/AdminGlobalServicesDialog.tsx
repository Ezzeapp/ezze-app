import { useState, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus, Trash2, Pencil, X, Check, Search, Scissors,
  Upload, Download, AlertCircle, ChevronDown, ChevronRight,
} from 'lucide-react'
import {
  useGlobalServices,
  useCreateGlobalService,
  useUpdateGlobalService,
  useDeleteGlobalService,
  useBulkImportGlobalServices,
} from '@/hooks/useGlobalCatalogs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/shared/Toaster'
import { cn } from '@/lib/utils'
import { SERVICES_SEED, SERVICES_SEED_JSON_EXAMPLE, SERVICES_SEED_CSV_EXAMPLE } from '@/data/services-seed'
import type { GlobalService } from '@/types'

interface Props { open: boolean; onClose: () => void }

type Tab = 'browse' | 'import'

const EMPTY_SVC_FORM = { name: '', duration_min: '', price: '' }

export function AdminGlobalServicesDialog({ open, onClose }: Props) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('browse')
  const { data: allServices } = useGlobalServices()

  const totalCategories = useMemo(() => {
    if (!allServices) return 0
    return new Set(allServices.map((s) => s.category)).size
  }, [allServices])

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent mobileFullscreen className="max-w-2xl sm:h-[90vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5" />
              {t('admin.globalServicesTitle')}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {totalCategories} {t('admin.statCategories')} · {allServices?.length ?? 0} {t('admin.statServices')}
            </p>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex border-b px-6 shrink-0">
            {(['browse', 'import'] as Tab[]).map((tb) => (
              <button
                key={tb}
                type="button"
                onClick={() => setTab(tb)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  tab === tb
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {t(`admin.tab${tb.charAt(0).toUpperCase() + tb.slice(1)}`)}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {tab === 'browse' && <BrowseServicesTab />}
            {tab === 'import' && <ImportServicesTab onDone={() => setTab('browse')} />}
          </div>

          <DialogFooter className="px-6 pb-6 pt-2 shrink-0 border-t">
            <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Browse tab ────────────────────────────────────────────────────────────────
function BrowseServicesTab() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const { data: services, isLoading } = useGlobalServices()
  const createService = useCreateGlobalService()
  const updateService = useUpdateGlobalService()
  const deleteService = useDeleteGlobalService()

  // Category state
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [pendingCats, setPendingCats] = useState<string[]>([])
  const [editCat, setEditCat] = useState<{ old: string; name: string } | null>(null)
  const [deleteCatName, setDeleteCatName] = useState<string | null>(null)

  // Service state
  const [newSvcCat, setNewSvcCat] = useState<string | null>(null)
  const [newSvcForm, setNewSvcForm] = useState(EMPTY_SVC_FORM)
  const [editSvcId, setEditSvcId] = useState<string | null>(null)
  const [editSvcForm, setEditSvcForm] = useState(EMPTY_SVC_FORM)
  const [deleteSvcId, setDeleteSvcId] = useState<string | null>(null)

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

  const allCats = useMemo(() => {
    const existing = Object.keys(grouped)
    return [...existing, ...pendingCats.filter(p => !existing.includes(p))]
  }, [grouped, pendingCats])

  // ── Category handlers ──────────────────────────────────────────────────────
  const handleAddCat = () => {
    const name = newCatName.trim()
    if (!name || allCats.includes(name)) return
    setPendingCats(prev => [...prev, name])
    setExpandedCat(name)
    setNewSvcCat(name)
    setNewCatName('')
  }

  const handleRenameCat = async () => {
    if (!editCat?.name.trim() || editCat.name === editCat.old) { setEditCat(null); return }
    const items = grouped[editCat.old] ?? []
    try {
      await Promise.all(items.map(s =>
        updateService.mutateAsync({ id: s.id, data: { category: editCat.name.trim() } })
      ))
      toast.success(t('common.saved'))
    } catch { toast.error(t('common.saveError')) }
    setEditCat(null)
  }

  const handleDeleteCat = async () => {
    if (!deleteCatName) return
    const items = grouped[deleteCatName] ?? []
    try {
      await Promise.all(items.map(s => deleteService.mutateAsync(s.id)))
      setPendingCats(prev => prev.filter(p => p !== deleteCatName))
      toast.success(t('catalog.serviceDeleted'))
    } catch { toast.error(t('common.deleteError')) }
    setDeleteCatName(null)
  }

  // ── Service handlers ───────────────────────────────────────────────────────
  const handleAddSvc = async (cat: string) => {
    if (!newSvcForm.name.trim()) return
    try {
      await createService.mutateAsync({
        name: newSvcForm.name.trim(),
        category: cat,
        duration_min: newSvcForm.duration_min ? Number(newSvcForm.duration_min) : undefined,
        price: newSvcForm.price ? Number(newSvcForm.price) : 0,
      })
      setPendingCats(prev => prev.filter(p => p !== cat))
      setNewSvcForm(EMPTY_SVC_FORM)
      setNewSvcCat(null)
      toast.success(t('catalog.serviceCreated'))
    } catch { toast.error(t('common.saveError')) }
  }

  const handleUpdateSvc = async () => {
    if (!editSvcId || !editSvcForm.name.trim()) return
    try {
      await updateService.mutateAsync({
        id: editSvcId,
        data: {
          name: editSvcForm.name.trim(),
          duration_min: editSvcForm.duration_min ? Number(editSvcForm.duration_min) : undefined,
        },
      })
      setEditSvcId(null)
      toast.success(t('common.saved'))
    } catch { toast.error(t('common.saveError')) }
  }

  const handleDeleteSvc = async () => {
    if (!deleteSvcId) return
    try {
      await deleteService.mutateAsync(deleteSvcId)
      setDeleteSvcId(null)
      toast.success(t('catalog.serviceDeleted'))
    } catch { toast.error(t('common.deleteError')) }
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('catalog.searchServices')}
          className="pl-9"
        />
      </div>

      {/* Add category input */}
      {!search && (
        <div className="flex gap-2">
          <Input
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder={t('catalog.newCategoryPlaceholder')}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCat()}
            className="flex-1"
          />
          <Button
            type="button" size="icon"
            onClick={handleAddCat}
            disabled={!newCatName.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && allCats.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">
          {search ? t('catalog.noResults') : t('catalog.servicesEmpty')}
        </p>
      )}

      {/* Categories list */}
      <div className="space-y-2">
        {!isLoading && allCats.map((cat) => {
          const items = grouped[cat] ?? []
          const isExpanded = expandedCat === cat
          const isEditingCat = editCat?.old === cat

          return (
            <div key={cat} className="border rounded-xl overflow-hidden">
              {/* Category header row */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30">
                <button
                  type="button"
                  onClick={() => setExpandedCat(isExpanded ? null : cat)}
                  className="flex items-center gap-2 flex-1 text-left min-w-0"
                >
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  }
                  {isEditingCat ? (
                    <Input
                      value={editCat.name}
                      onChange={(e) => setEditCat({ ...editCat, name: e.target.value })}
                      className="h-7 text-sm"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameCat()
                        if (e.key === 'Escape') setEditCat(null)
                      }}
                    />
                  ) : (
                    <span className="font-medium text-sm truncate">{cat}</span>
                  )}
                  <Badge variant="secondary" className="text-xs ml-1 shrink-0">{items.length}</Badge>
                </button>

                <div className="flex gap-1 shrink-0">
                  {isEditingCat ? (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={handleRenameCat} loading={updateService.isPending}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => setEditCat(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => { setEditCat({ old: cat, name: cat }) }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        onClick={() => setDeleteCatName(cat)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Expanded: services list */}
              {isExpanded && (
                <div className="divide-y">
                  {items.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 px-4 py-2 group">
                      {editSvcId === s.id ? (
                        <>
                          <Input
                            value={editSvcForm.name}
                            onChange={(e) => setEditSvcForm({ ...editSvcForm, name: e.target.value })}
                            className="h-7 text-sm flex-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateSvc()
                              if (e.key === 'Escape') setEditSvcId(null)
                            }}
                          />
                          <Input
                            type="number" min={0}
                            value={editSvcForm.duration_min}
                            onChange={(e) => setEditSvcForm({ ...editSvcForm, duration_min: e.target.value })}
                            placeholder="мин"
                            className="h-7 text-sm w-16"
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={handleUpdateSvc} loading={updateService.isPending}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => setEditSvcId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm">{s.name}</span>
                          {s.duration_min != null && s.duration_min > 0 && (
                            <span className="text-xs text-muted-foreground shrink-0">{s.duration_min} мин</span>
                          )}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Button size="icon" variant="ghost" className="h-6 w-6"
                              onClick={() => {
                                setEditSvcId(s.id)
                                setEditSvcForm({
                                  name: s.name,
                                  duration_min: s.duration_min != null ? String(s.duration_min) : '',
                                  price: s.price != null ? String(s.price) : '',
                                })
                              }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                              onClick={() => setDeleteSvcId(s.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Add service row */}
                  {newSvcCat === cat ? (
                    <div className="flex items-center gap-2 px-4 py-2">
                      <Input
                        value={newSvcForm.name}
                        onChange={(e) => setNewSvcForm({ ...newSvcForm, name: e.target.value })}
                        placeholder={t('catalog.serviceNamePlaceholder')}
                        className="h-7 text-sm flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddSvc(cat)
                          if (e.key === 'Escape') { setNewSvcCat(null); setNewSvcForm(EMPTY_SVC_FORM) }
                        }}
                      />
                      <Input
                        type="number" min={0}
                        value={newSvcForm.duration_min}
                        onChange={(e) => setNewSvcForm({ ...newSvcForm, duration_min: e.target.value })}
                        placeholder="мин"
                        className="h-7 text-sm w-16"
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => handleAddSvc(cat)} loading={createService.isPending}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => { setNewSvcCat(null); setNewSvcForm(EMPTY_SVC_FORM) }}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setNewSvcCat(cat); setNewSvcForm(EMPTY_SVC_FORM) }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t('catalog.addService')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground pt-2">
        {t('catalog.totalItems', { count: services?.length ?? 0 })}
      </p>

      <ConfirmDialog
        open={!!deleteCatName}
        onClose={() => setDeleteCatName(null)}
        onConfirm={handleDeleteCat}
        loading={deleteService.isPending}
        title={t('catalog.categoryDeleteConfirm')}
      />
      <ConfirmDialog
        open={!!deleteSvcId}
        onClose={() => setDeleteSvcId(null)}
        onConfirm={handleDeleteSvc}
        loading={deleteService.isPending}
        title={t('catalog.serviceDeleteConfirm')}
      />
    </div>
  )
}

// ── Import tab ────────────────────────────────────────────────────────────────
function ImportServicesTab({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const bulkImport = useBulkImportGlobalServices()
  const [text, setText] = useState('')
  const [format, setFormat] = useState<'json' | 'csv' | 'lines'>('json')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Array<{ category: string; name: string; duration_min?: number; price?: number }> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const parseInput = (raw: string) => {
    const str = raw.trim()
    if (!str) return null
    try {
      if (format === 'json') {
        const data = JSON.parse(str)
        if (!Array.isArray(data)) throw new Error('Expected array')
        return data.map((d: any) => ({
          category: String(d.category ?? ''),
          name: String(d.name ?? ''),
          duration_min: d.duration_min != null ? Number(d.duration_min) : undefined,
          price: d.price != null ? Number(d.price) : undefined,
        })).filter((d) => d.name)
      }
      if (format === 'csv') {
        return str.split('\n')
          .map((line) => line.trim()).filter(Boolean)
          .map((line) => {
            const parts = line.split(',')
            return {
              category: (parts[0] ?? '').trim(),
              name: (parts[1] ?? '').trim(),
              duration_min: parts[2] ? Number(parts[2].trim()) : undefined,
              price: parts[3] ? Number(parts[3].trim()) : undefined,
            }
          })
          .filter((d) => d.name)
      }
      if (format === 'lines') {
        return str.split('\n')
          .map((line) => line.trim()).filter(Boolean)
          .map((name) => ({ category: t('catalog.importDefaultCategory'), name }))
      }
    } catch (e: any) {
      setError(e.message)
      return null
    }
    return null
  }

  const handlePreview = () => {
    setError(null)
    const parsed = parseInput(text)
    if (!parsed || parsed.length === 0) { setError(t('admin.importParseError')); return }
    setPreview(parsed)
  }

  const handleImport = async () => {
    if (!preview) return
    try {
      const count = await bulkImport.mutateAsync(preview)
      toast.success(t('admin.importSuccess', { count }))
      setText(''); setPreview(null)
      onDone()
    } catch { toast.error(t('common.saveError')) }
  }

  const handleSeedLoad = () => {
    bulkImport.mutateAsync(SERVICES_SEED).then((n) => {
      toast.success(t('admin.importSuccess', { count: n }))
      onDone()
    }).catch(() => toast.error(t('common.saveError')))
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setText(ev.target?.result as string)
      if (file.name.endsWith('.csv')) setFormat('csv')
      else if (file.name.endsWith('.json')) setFormat('json')
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-4">
      {/* Seed block */}
      <div className="rounded-xl border-2 border-dashed border-primary/30 p-4 space-y-2 bg-primary/5">
        <p className="text-sm font-medium">{t('admin.seedTitle')}</p>
        <p className="text-xs text-muted-foreground">
          {t('admin.seedDesc', { count: SERVICES_SEED.length })}
        </p>
        <Button type="button" variant="default" size="sm" onClick={handleSeedLoad} loading={bulkImport.isPending}>
          <Download className="h-4 w-4 mr-2" />
          {t('admin.loadSeed')}
        </Button>
      </div>

      <div className="relative flex items-center">
        <div className="flex-1 border-t" />
        <span className="px-3 text-xs text-muted-foreground">{t('admin.orImport')}</span>
        <div className="flex-1 border-t" />
      </div>

      {/* Format selector */}
      <div className="space-y-2">
        <Label>{t('admin.importFormat')}</Label>
        <div className="flex gap-2">
          {(['json', 'csv', 'lines'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                format === f
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
          {format === 'json' && SERVICES_SEED_JSON_EXAMPLE}
          {format === 'csv' && SERVICES_SEED_CSV_EXAMPLE}
          {format === 'lines' && 'Стрижка мужская\nОкрашивание\nМаникюр'}
        </p>
      </div>

      {/* File upload */}
      <div className="flex gap-2">
        <input ref={fileRef} type="file" accept=".json,.csv,.txt" className="sr-only" onChange={handleFile} />
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4 mr-2" />
          {t('admin.uploadFile')}
        </Button>
      </div>

      {/* Paste area */}
      <div className="space-y-2">
        <Label>{t('admin.pasteArea')}</Label>
        <Textarea
          rows={8}
          value={text}
          onChange={(e) => { setText(e.target.value); setPreview(null); setError(null) }}
          placeholder={
            format === 'json' ? SERVICES_SEED_JSON_EXAMPLE
            : format === 'csv' ? SERVICES_SEED_CSV_EXAMPLE
            : 'Стрижка мужская\nОкрашивание\nМаникюр'
          }
          className="font-mono text-xs"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="rounded-xl border p-3 space-y-2">
          <p className="text-sm font-medium">{t('admin.previewTitle', { count: preview.length })}</p>
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {preview.slice(0, 50).map((item, i) => (
              <div key={i} className="text-xs text-muted-foreground flex gap-2">
                <span className="text-foreground font-medium">{item.category || '—'}</span>
                <span>→</span>
                <span>{item.name}</span>
                {item.duration_min != null && <span className="opacity-60">{item.duration_min}мин</span>}
                {item.price != null && <span className="opacity-60">{item.price}</span>}
              </div>
            ))}
            {preview.length > 50 && (
              <p className="text-xs text-muted-foreground">... и ещё {preview.length - 50}</p>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {!preview ? (
          <Button type="button" onClick={handlePreview} disabled={!text.trim()}>
            {t('admin.previewBtn')}
          </Button>
        ) : (
          <>
            <Button type="button" onClick={handleImport} loading={bulkImport.isPending}>
              {t('admin.importBtn', { count: preview.length })}
            </Button>
            <Button type="button" variant="outline" onClick={() => setPreview(null)}>
              {t('common.cancel')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
