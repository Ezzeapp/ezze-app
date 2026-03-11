import { useState, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus, Trash2, Pencil, X, Check, Search, Package,
  Upload, Download, AlertCircle, ChevronDown, ChevronRight,
} from 'lucide-react'
import {
  useGlobalProducts,
  useCreateGlobalProduct,
  useUpdateGlobalProduct,
  useDeleteGlobalProduct,
  useBulkImportGlobalProducts,
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
import { PRODUCTS_SEED, PRODUCTS_SEED_JSON_EXAMPLE, PRODUCTS_SEED_CSV_EXAMPLE } from '@/data/products-seed'
import type { GlobalProduct } from '@/types'

interface Props { open: boolean; onClose: () => void }

type Tab = 'browse' | 'import'

const EMPTY_PROD_FORM = { name: '', unit: '', price: '' }

export function AdminGlobalProductsDialog({ open, onClose }: Props) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('browse')

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent mobileFullscreen className="max-w-2xl sm:h-[90vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t('admin.globalProductsTitle')}
            </DialogTitle>
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
            {tab === 'browse' && <BrowseProductsTab />}
            {tab === 'import' && <ImportProductsTab onDone={() => setTab('browse')} />}
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
function BrowseProductsTab() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const { data: products, isLoading } = useGlobalProducts()
  const createProduct = useCreateGlobalProduct()
  const updateProduct = useUpdateGlobalProduct()
  const deleteProduct = useDeleteGlobalProduct()

  // Category state
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [pendingCats, setPendingCats] = useState<string[]>([])
  const [editCat, setEditCat] = useState<{ old: string; name: string } | null>(null)
  const [deleteCatName, setDeleteCatName] = useState<string | null>(null)

  // Product state
  const [newProdCat, setNewProdCat] = useState<string | null>(null)
  const [newProdForm, setNewProdForm] = useState(EMPTY_PROD_FORM)
  const [editProdId, setEditProdId] = useState<string | null>(null)
  const [editProdForm, setEditProdForm] = useState(EMPTY_PROD_FORM)
  const [deleteProdId, setDeleteProdId] = useState<string | null>(null)

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
    setNewProdCat(name)
    setNewCatName('')
  }

  const handleRenameCat = async () => {
    if (!editCat?.name.trim() || editCat.name === editCat.old) { setEditCat(null); return }
    const items = grouped[editCat.old] ?? []
    try {
      await Promise.all(items.map(p =>
        updateProduct.mutateAsync({ id: p.id, data: { category: editCat.name.trim() } })
      ))
      toast.success(t('common.saved'))
    } catch { toast.error(t('common.saveError')) }
    setEditCat(null)
  }

  const handleDeleteCat = async () => {
    if (!deleteCatName) return
    const items = grouped[deleteCatName] ?? []
    try {
      await Promise.all(items.map(p => deleteProduct.mutateAsync(p.id)))
      setPendingCats(prev => prev.filter(p => p !== deleteCatName))
      toast.success(t('catalog.productDeleted'))
    } catch { toast.error(t('common.deleteError')) }
    setDeleteCatName(null)
  }

  // ── Product handlers ───────────────────────────────────────────────────────
  const handleAddProd = async (cat: string) => {
    if (!newProdForm.name.trim()) return
    try {
      await createProduct.mutateAsync({
        name: newProdForm.name.trim(),
        category: cat,
        unit: newProdForm.unit.trim() || undefined,
        price: newProdForm.price ? Number(newProdForm.price) : 0,
      })
      setPendingCats(prev => prev.filter(p => p !== cat))
      setNewProdForm(EMPTY_PROD_FORM)
      setNewProdCat(null)
      toast.success(t('catalog.productCreated'))
    } catch { toast.error(t('common.saveError')) }
  }

  const handleUpdateProd = async () => {
    if (!editProdId || !editProdForm.name.trim()) return
    try {
      await updateProduct.mutateAsync({
        id: editProdId,
        data: {
          name: editProdForm.name.trim(),
          unit: editProdForm.unit.trim() || undefined,
        },
      })
      setEditProdId(null)
      toast.success(t('common.saved'))
    } catch { toast.error(t('common.saveError')) }
  }

  const handleDeleteProd = async () => {
    if (!deleteProdId) return
    try {
      await deleteProduct.mutateAsync(deleteProdId)
      setDeleteProdId(null)
      toast.success(t('catalog.productDeleted'))
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
          placeholder={t('catalog.searchProducts')}
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
          <Button type="button" size="icon" onClick={handleAddCat} disabled={!newCatName.trim()}>
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
          {search ? t('catalog.noResults') : t('catalog.productsEmpty')}
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
              {/* Category header */}
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
                        onClick={handleRenameCat} loading={updateProduct.isPending}>
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
                        onClick={() => setEditCat({ old: cat, name: cat })}>
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

              {/* Expanded: products list */}
              {isExpanded && (
                <div className="divide-y">
                  {items.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 px-4 py-2 group">
                      {editProdId === p.id ? (
                        <>
                          <Input
                            value={editProdForm.name}
                            onChange={(e) => setEditProdForm({ ...editProdForm, name: e.target.value })}
                            className="h-7 text-sm flex-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateProd()
                              if (e.key === 'Escape') setEditProdId(null)
                            }}
                          />
                          <Input
                            value={editProdForm.unit}
                            onChange={(e) => setEditProdForm({ ...editProdForm, unit: e.target.value })}
                            placeholder="ед."
                            className="h-7 text-sm w-16"
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={handleUpdateProd} loading={updateProduct.isPending}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => setEditProdId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm">{p.name}</span>
                          {p.unit && (
                            <Badge variant="outline" className="text-xs font-normal shrink-0">{p.unit}</Badge>
                          )}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Button size="icon" variant="ghost" className="h-6 w-6"
                              onClick={() => {
                                setEditProdId(p.id)
                                setEditProdForm({
                                  name: p.name,
                                  unit: p.unit ?? '',
                                  price: p.price != null ? String(p.price) : '',
                                })
                              }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                              onClick={() => setDeleteProdId(p.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Add product row */}
                  {newProdCat === cat ? (
                    <div className="flex items-center gap-2 px-4 py-2">
                      <Input
                        value={newProdForm.name}
                        onChange={(e) => setNewProdForm({ ...newProdForm, name: e.target.value })}
                        placeholder={t('catalog.productNamePlaceholder')}
                        className="h-7 text-sm flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddProd(cat)
                          if (e.key === 'Escape') { setNewProdCat(null); setNewProdForm(EMPTY_PROD_FORM) }
                        }}
                      />
                      <Input
                        value={newProdForm.unit}
                        onChange={(e) => setNewProdForm({ ...newProdForm, unit: e.target.value })}
                        placeholder="ед."
                        className="h-7 text-sm w-16"
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => handleAddProd(cat)} loading={createProduct.isPending}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => { setNewProdCat(null); setNewProdForm(EMPTY_PROD_FORM) }}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setNewProdCat(cat); setNewProdForm(EMPTY_PROD_FORM) }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t('catalog.addProduct')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground pt-2">
        {t('catalog.totalItems', { count: products?.length ?? 0 })}
      </p>

      <ConfirmDialog
        open={!!deleteCatName}
        onClose={() => setDeleteCatName(null)}
        onConfirm={handleDeleteCat}
        loading={deleteProduct.isPending}
        title={t('catalog.categoryDeleteConfirm')}
      />
      <ConfirmDialog
        open={!!deleteProdId}
        onClose={() => setDeleteProdId(null)}
        onConfirm={handleDeleteProd}
        loading={deleteProduct.isPending}
        title={t('catalog.productDeleteConfirm')}
      />
    </div>
  )
}

// ── Import tab ────────────────────────────────────────────────────────────────
function ImportProductsTab({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const bulkImport = useBulkImportGlobalProducts()
  const [text, setText] = useState('')
  const [format, setFormat] = useState<'json' | 'csv' | 'lines'>('json')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Array<{ category: string; name: string; unit?: string; price?: number }> | null>(null)
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
          unit: d.unit != null ? String(d.unit) : undefined,
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
              unit: parts[2] ? parts[2].trim() : undefined,
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
    bulkImport.mutateAsync(PRODUCTS_SEED).then((n) => {
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
          {t('admin.seedDesc', { count: PRODUCTS_SEED.length })}
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
          {format === 'json' && PRODUCTS_SEED_JSON_EXAMPLE}
          {format === 'csv' && PRODUCTS_SEED_CSV_EXAMPLE}
          {format === 'lines' && 'Шампунь профессиональный\nКраска для волос\nГель-лак'}
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
            format === 'json' ? PRODUCTS_SEED_JSON_EXAMPLE
            : format === 'csv' ? PRODUCTS_SEED_CSV_EXAMPLE
            : 'Шампунь профессиональный\nКраска для волос\nГель-лак'
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
                {item.unit && <span className="opacity-60">{item.unit}</span>}
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
