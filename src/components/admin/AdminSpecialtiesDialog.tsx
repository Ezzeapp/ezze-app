import { useState, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus, Trash2, Pencil, X, Check, ChevronDown, ChevronRight,
  Upload, Download, AlertCircle, BookOpen, Search,
} from 'lucide-react'
import {
  useActivityTypes, useAllSpecialties,
  useCreateActivityType, useUpdateActivityType, useDeleteActivityType,
  useCreateSpecialty, useUpdateSpecialty, useDeleteSpecialty,
  useBulkImportSpecialties,
} from '@/hooks/useSpecialties'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { toast } from '@/components/shared/Toaster'
import { cn } from '@/lib/utils'
import { SPECIALTIES_SEED, SEED_JSON_EXAMPLE, SEED_CSV_EXAMPLE } from '@/data/specialties-seed'
import type { ActivityType, Specialty } from '@/types'

interface Props { open: boolean; onClose: () => void }

type Tab = 'browse' | 'import'

export function AdminSpecialtiesDialog({ open, onClose }: Props) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('browse')

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent mobileFullscreen className="max-w-2xl sm:h-[90vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {t('admin.specialtiesTitle')}
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
          {tab === 'browse' && <BrowseTab />}
          {tab === 'import' && <ImportTab onDone={() => setTab('browse')} />}
        </div>

        <DialogFooter className="px-6 pb-6 pt-2 shrink-0 border-t">
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Browse tab ────────────────────────────────────────────────────────────────
function BrowseTab() {
  const { t } = useTranslation()
  const { data: activityTypes } = useActivityTypes()
  const { data: allSpecialties } = useAllSpecialties()

  const createType = useCreateActivityType()
  const updateType = useUpdateActivityType()
  const deleteType = useDeleteActivityType()
  const createSpec = useCreateSpecialty()
  const updateSpec = useUpdateSpecialty()
  const deleteSpec = useDeleteSpecialty()

  const [search, setSearch] = useState('')
  const [expandedType, setExpandedType] = useState<string | null>(null)

  const filteredTypes = useMemo(() => {
    if (!search.trim()) return activityTypes ?? []
    const q = search.toLowerCase()
    return (activityTypes ?? []).filter((type: ActivityType) =>
      type.name.toLowerCase().includes(q) ||
      (allSpecialties ?? []).filter(s => s.activity_type_id === type.id)
        .some(s => s.name.toLowerCase().includes(q))
    )
  }, [activityTypes, allSpecialties, search])

  // New type form
  const [newTypeName, setNewTypeName] = useState('')
  // Edit type
  const [editTypeId, setEditTypeId] = useState<string | null>(null)
  const [editTypeName, setEditTypeName] = useState('')
  // Delete type confirm
  const [deleteTypeId, setDeleteTypeId] = useState<string | null>(null)

  // New specialty
  const [newSpecType, setNewSpecType] = useState<string | null>(null)
  const [newSpecName, setNewSpecName] = useState('')
  // Edit specialty
  const [editSpecId, setEditSpecId] = useState<string | null>(null)
  const [editSpecName, setEditSpecName] = useState('')
  // Delete specialty confirm
  const [deleteSpecId, setDeleteSpecId] = useState<string | null>(null)

  const specsForType = (typeId: string) =>
    allSpecialties?.filter((s) => s.activity_type_id === typeId) ?? []

  const handleCreateType = async () => {
    if (!newTypeName.trim()) return
    try {
      await createType.mutateAsync({ name: newTypeName.trim(), icon: '' })
      setNewTypeName('')
      toast.success(t('admin.typeCreated'))
    } catch { toast.error(t('common.saveError')) }
  }

  const handleUpdateType = async (id: string) => {
    if (!editTypeName.trim()) return
    try {
      await updateType.mutateAsync({ id, data: { name: editTypeName.trim() } })
      setEditTypeId(null)
      toast.success(t('common.saved'))
    } catch { toast.error(t('common.saveError')) }
  }

  const handleDeleteType = async () => {
    if (!deleteTypeId) return
    try {
      await deleteType.mutateAsync(deleteTypeId)
      setDeleteTypeId(null)
      toast.success(t('admin.typeDeleted'))
    } catch { toast.error(t('common.deleteError')) }
  }

  const handleCreateSpec = async (typeId: string) => {
    if (!newSpecName.trim()) return
    try {
      await createSpec.mutateAsync({ activity_type_id: typeId, name: newSpecName.trim() })
      setNewSpecName('')
      setNewSpecType(null)
      toast.success(t('admin.specCreated'))
    } catch { toast.error(t('common.saveError')) }
  }

  const handleUpdateSpec = async (id: string) => {
    if (!editSpecName.trim()) return
    try {
      await updateSpec.mutateAsync({ id, data: { name: editSpecName.trim() } })
      setEditSpecId(null)
      toast.success(t('common.saved'))
    } catch { toast.error(t('common.saveError')) }
  }

  const handleDeleteSpec = async () => {
    if (!deleteSpecId) return
    try {
      await deleteSpec.mutateAsync(deleteSpecId)
      setDeleteSpecId(null)
      toast.success(t('admin.specDeleted'))
    } catch { toast.error(t('common.deleteError')) }
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.searchSpecialties')}
          className="pl-9"
        />
      </div>

      {/* Add new activity type */}
      {!search && (
        <div className="flex gap-2">
          <Input
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            placeholder={t('admin.newTypePlaceholder')}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateType()}
            className="flex-1"
          />
          <Button
            type="button" size="icon"
            onClick={handleCreateType}
            loading={createType.isPending}
            disabled={!newTypeName.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Counters */}
      {!search && (
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>{activityTypes?.length ?? 0} {t('admin.statTypes')}</span>
          <span>·</span>
          <span>{allSpecialties?.length ?? 0} {t('admin.statSpecialties')}</span>
        </div>
      )}

      {/* Activity types list */}
      <div className="space-y-2">
        {filteredTypes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">{t('catalog.noResults')}</p>
        )}
        {filteredTypes.map((type: ActivityType) => {
          const specs = specsForType(type.id)
          const displaySpecs = search.trim()
            ? specs.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
            : specs
          const isExpanded = search.trim() ? true : expandedType === type.id
          const isEditingType = editTypeId === type.id

          return (
            <div key={type.id} className="border rounded-xl overflow-hidden">
              {/* Type row */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30">
                <button
                  type="button"
                  onClick={() => setExpandedType(isExpanded ? null : type.id)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  }
                  {isEditingType ? (
                    <Input
                      value={editTypeName}
                      onChange={(e) => setEditTypeName(e.target.value)}
                      className="h-7 text-sm"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateType(type.id)
                        if (e.key === 'Escape') setEditTypeId(null)
                      }}
                    />
                  ) : (
                    <span className="font-medium text-sm">{type.name}</span>
                  )}
                  <Badge variant="secondary" className="text-xs ml-1">
                    {specs.length}
                  </Badge>
                </button>

                <div className="flex gap-1">
                  {isEditingType ? (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => handleUpdateType(type.id)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => setEditTypeId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => { setEditTypeId(type.id); setEditTypeName(type.name) }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        onClick={() => setDeleteTypeId(type.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Specialties */}
              {isExpanded && (
                <div className="divide-y">
                  {displaySpecs.map((spec: Specialty) => (
                    <div key={spec.id} className="flex items-center gap-2 px-4 py-2 group">
                      {editSpecId === spec.id ? (
                        <>
                          <Input
                            value={editSpecName}
                            onChange={(e) => setEditSpecName(e.target.value)}
                            className="h-7 text-sm flex-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateSpec(spec.id)
                              if (e.key === 'Escape') setEditSpecId(null)
                            }}
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => handleUpdateSpec(spec.id)}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => setEditSpecId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm">{spec.name}</span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" className="h-6 w-6"
                              onClick={() => { setEditSpecId(spec.id); setEditSpecName(spec.name) }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                              onClick={() => setDeleteSpecId(spec.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Add new specialty */}
                  {!search && newSpecType === type.id ? (
                    <div className="flex items-center gap-2 px-4 py-2">
                      <Input
                        value={newSpecName}
                        onChange={(e) => setNewSpecName(e.target.value)}
                        placeholder={t('admin.newSpecPlaceholder')}
                        className="h-7 text-sm flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateSpec(type.id)
                          if (e.key === 'Escape') { setNewSpecType(null); setNewSpecName('') }
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => handleCreateSpec(type.id)}
                        loading={createSpec.isPending}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => { setNewSpecType(null); setNewSpecName('') }}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : !search && (
                    <button
                      type="button"
                      onClick={() => { setNewSpecType(type.id); setNewSpecName('') }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t('admin.addSpec')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

      </div>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={!!deleteTypeId} onClose={() => setDeleteTypeId(null)}
        onConfirm={handleDeleteType} loading={deleteType.isPending}
        title={t('admin.typeDeleteConfirm')}
      />
      <ConfirmDialog
        open={!!deleteSpecId} onClose={() => setDeleteSpecId(null)}
        onConfirm={handleDeleteSpec} loading={deleteSpec.isPending}
        title={t('admin.specDeleteConfirm')}
      />
    </div>
  )
}

// ── Import tab ────────────────────────────────────────────────────────────────
function ImportTab({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const bulkImport = useBulkImportSpecialties()
  const [text, setText] = useState('')
  const [format, setFormat] = useState<'json' | 'csv' | 'lines'>('json')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Array<{ activity_type_name: string; name: string }> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const parseInput = (raw: string): Array<{ activity_type_name: string; name: string }> | null => {
    const str = raw.trim()
    if (!str) return null
    try {
      if (format === 'json') {
        const data = JSON.parse(str)
        if (!Array.isArray(data)) throw new Error('Expected array')
        return data.map((d: any) => ({
          activity_type_name: String(d.activity_type_name ?? d.category ?? ''),
          name: String(d.name ?? d.specialty ?? ''),
        })).filter((d) => d.activity_type_name && d.name)
      }
      if (format === 'csv') {
        return str.split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [cat, ...rest] = line.split(',')
            return { activity_type_name: cat.trim(), name: rest.join(',').trim() }
          })
          .filter((d) => d.activity_type_name && d.name)
      }
      if (format === 'lines') {
        return str.split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((name) => ({ activity_type_name: t('admin.importDefaultType'), name }))
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
    if (!parsed) { setError(t('admin.importParseError')); return }
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
    const count = bulkImport.mutateAsync(SPECIALTIES_SEED)
    count.then((n) => {
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
      {/* Load seed button */}
      <div className="rounded-xl border-2 border-dashed border-primary/30 p-4 space-y-2 bg-primary/5">
        <p className="text-sm font-medium">{t('admin.seedTitle')}</p>
        <p className="text-xs text-muted-foreground">{t('admin.seedDesc', { count: SPECIALTIES_SEED.length })}</p>
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
                format === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/50'
              )}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
          {format === 'json' && SEED_JSON_EXAMPLE}
          {format === 'csv' && SEED_CSV_EXAMPLE}
          {format === 'lines' && 'Парикмахер\nВизажист\nМассажист'}
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
          placeholder={format === 'json' ? SEED_JSON_EXAMPLE : format === 'csv' ? SEED_CSV_EXAMPLE : 'Парикмахер\nМассажист'}
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
                <span className="text-foreground font-medium">{item.activity_type_name}</span>
                <span>→</span>
                <span>{item.name}</span>
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
