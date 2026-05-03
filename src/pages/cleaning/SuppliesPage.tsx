import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, Search, X, Loader2, Trash2, ArrowDown, ArrowUp, Package, Download, AlertTriangle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { toast } from '@/components/shared/Toaster'
import { cn, formatCurrency } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useFeature } from '@/hooks/useFeatureFlags'
import { useSuppliesCategories } from '@/hooks/useSuppliesCategories'
import dayjs from 'dayjs'

interface Supply {
  id: string
  name: string
  category: string
  unit: string
  quantity: number
  min_quantity: number
  price_per_unit: number
  supplier: string | null
  notes: string | null
}


function useSupplies() {
  return useQuery({
    queryKey: ['cleaning_supplies'],
    queryFn: async () => {
      const { data } = await supabase
        .from('cleaning_supplies')
        .select('*')
        .eq('product', 'cleaning')
        .order('category')
        .order('name')
      return (data ?? []) as Supply[]
    },
  })
}

export function SuppliesPage() {
  const hasAccess = useFeature('supplies')
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: supplies = [], isLoading } = useSupplies()
  const { data: rawCategories = [] } = useSuppliesCategories()
  const enabledCategories = rawCategories.filter(c => c.enabled)
  const CATEGORIES = [{ value: 'all', label: 'Все' }, ...enabledCategories]
  const defaultCat = enabledCategories[0]?.value ?? 'other'
  const labelFor = (value: string) => rawCategories.find(c => c.value === value)?.label ?? value
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<Supply | null>(null)

  // Form
  const [fname, setFname] = useState('')
  const [fcat, setFcat] = useState(defaultCat)
  const [funit, setFunit] = useState('шт')
  const [fqty, setFqty] = useState('')
  const [fmin, setFmin] = useState('')
  const [fprice, setFprice] = useState('')
  const [fsupplier, setFsupplier] = useState('')
  const [fnotes, setFnotes] = useState('')

  function resetForm() {
    setFname(''); setFcat(defaultCat); setFunit('шт'); setFqty(''); setFmin(''); setFprice(''); setFsupplier(''); setFnotes('')
    setEditId(null); setAddOpen(false)
  }

  function openEdit(s: Supply) {
    setEditId(s.id); setFname(s.name); setFcat(s.category); setFunit(s.unit)
    setFqty(String(s.quantity)); setFmin(String(s.min_quantity)); setFprice(String(s.price_per_unit))
    setFsupplier(s.supplier || ''); setFnotes(s.notes || ''); setAddOpen(true)
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const row = {
        product: 'cleaning', name: fname.trim(), category: fcat, unit: funit,
        quantity: parseFloat(fqty) || 0, min_quantity: parseFloat(fmin) || 0,
        price_per_unit: parseFloat(fprice) || 0, supplier: fsupplier.trim() || null, notes: fnotes.trim() || null,
      }
      if (editId) {
        const { error } = await supabase.from('cleaning_supplies').update(row).eq('id', editId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('cleaning_supplies').insert(row)
        if (error) throw error
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cleaning_supplies'] }); resetForm(); toast.success('Сохранено') },
    onError: () => toast.error('Ошибка сохранения'),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cleaning_supplies').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cleaning_supplies'] }); toast.success('Удалено') },
  })

  const adjustMut = useMutation({
    mutationFn: async ({ id, delta, type }: { id: string; delta: number; type: 'in' | 'out' }) => {
      const supply = supplies.find(s => s.id === id)
      if (!supply) return
      const newQty = Math.max(0, supply.quantity + delta)
      await supabase.from('cleaning_supplies').update({ quantity: newQty }).eq('id', id)
      await supabase.from('cleaning_supply_log').insert({
        supply_id: id, change_type: type, quantity: Math.abs(delta),
        note: type === 'in' ? 'Приход' : 'Расход', created_by: user?.id,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cleaning_supplies'] }),
  })

  const filtered = supplies.filter(s => {
    if (catFilter !== 'all' && s.category !== catFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return s.name.toLowerCase().includes(q) || (s.supplier || '').toLowerCase().includes(q)
    }
    return true
  })

  const lowStock = supplies.filter(s => s.quantity < s.min_quantity).length

  if (!hasAccess) return <Navigate to="/orders" replace />

  return (
    <div className="space-y-4">
      <PageHeader title="Расходные материалы" description={`${supplies.length} позиций${lowStock > 0 ? ` · ${lowStock} мало` : ''}`}>
        <Button size="sm" onClick={() => { resetForm(); setAddOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" />
          Добавить
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..." className="pl-9" />
        </div>
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCatFilter(c.value)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                catFilter === c.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title="Нет материалов" description="Добавьте расходные материалы для учёта" action={{ label: 'Добавить', onClick: () => { resetForm(); setAddOpen(true) } }} />
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const isLow = s.quantity < s.min_quantity
            return (
              <div key={s.id} className={cn('rounded-xl border p-4 bg-card', isLow && 'border-orange-300 dark:border-orange-800')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{s.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {labelFor(s.category)}
                      </span>
                      {isLow && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Мало
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>В наличии: <strong className={cn(isLow ? 'text-orange-600' : 'text-foreground')}>{s.quantity}</strong> {s.unit}</span>
                      <span>Мин: {s.min_quantity} {s.unit}</span>
                      {s.price_per_unit > 0 && <span>{formatCurrency(s.price_per_unit)}/{s.unit}</span>}
                      {s.supplier && <span className="hidden sm:inline">Поставщик: {s.supplier}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => adjustMut.mutate({ id: s.id, delta: 1, type: 'in' })}
                      className="h-8 w-8 rounded-lg border flex items-center justify-center text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
                      title="Приход +1"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => adjustMut.mutate({ id: s.id, delta: -1, type: 'out' })}
                      disabled={s.quantity <= 0}
                      className="h-8 w-8 rounded-lg border flex items-center justify-center text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-30"
                      title="Расход -1"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => openEdit(s)} className="h-8 w-8 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Редактировать">
                      <Package className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleteCandidate(s)} className="h-8 w-8 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors" title="Удалить">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Confirm delete — без подтверждения легко снести материал случайным тапом */}
      <ConfirmDialog
        open={!!deleteCandidate}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={() => {
          if (deleteCandidate) deleteMut.mutate(deleteCandidate.id)
          setDeleteCandidate(null)
        }}
        title={deleteCandidate ? `Удалить «${deleteCandidate.name}»?` : ''}
        description="Действие необратимо. История прихода/расхода сохранится в логе."
        loading={deleteMut.isPending}
      />

      {/* Add/Edit modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => resetForm()}>
          <div className="bg-background rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">{editId ? 'Редактировать' : 'Добавить материал'}</h3>
              <button onClick={resetForm}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <Label>Название *</Label>
                <Input value={fname} onChange={e => setFname(e.target.value)} className="mt-1" placeholder="Пятновыводитель..." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Категория</Label>
                  <select value={fcat} onChange={e => setFcat(e.target.value)} className="mt-1 w-full h-9 rounded-md border bg-background px-3 text-sm">
                    {CATEGORIES.filter(c => c.value !== 'all').map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Ед. изм.</Label>
                  <Input value={funit} onChange={e => setFunit(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Кол-во</Label>
                  <Input type="number" value={fqty} onChange={e => setFqty(e.target.value)} className="mt-1" placeholder="0" />
                </div>
                <div>
                  <Label>Минимум</Label>
                  <Input type="number" value={fmin} onChange={e => setFmin(e.target.value)} className="mt-1" placeholder="0" />
                </div>
                <div>
                  <Label>Цена/ед.</Label>
                  <Input type="number" value={fprice} onChange={e => setFprice(e.target.value)} className="mt-1" placeholder="0" />
                </div>
              </div>
              <div>
                <Label>Поставщик</Label>
                <Input value={fsupplier} onChange={e => setFsupplier(e.target.value)} className="mt-1" placeholder="ООО ..." />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={resetForm}>Отмена</Button>
              <Button className="flex-1" disabled={!fname.trim() || saveMut.isPending} onClick={() => saveMut.mutate()}>
                {saveMut.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Сохранить
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
