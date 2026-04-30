import { useMemo, useState } from 'react'
import {
  Plus, Trash2, Search, X, Download, KeyRound, Pencil,
  Car, Wrench, PartyPopper, Bike, Package, ChevronDown,
} from 'lucide-react'
import { useRentalItems, useUpsertRentalItem, useDeleteRentalItem, useGlobalRentalItems } from '@/hooks/useRentalItems'
import {
  RENTAL_CATEGORY_LABELS, RENTAL_PRICING_UNIT_LABELS, RENTAL_STATUS_LABELS,
  type RentalItem, type RentalCategory, type RentalPricingUnit, type GlobalRentalItem,
} from '@/types/rental'
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

const CATEGORY_ICONS: Record<string, typeof Car> = {
  transport: Car,
  tool:      Wrench,
  event:     PartyPopper,
  sport:     Bike,
  household: Package,
  other:     Package,
}

const CATEGORY_COLORS: Record<string, string> = {
  transport: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  tool:      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  event:     'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  sport:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  household: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  other:     'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

const STATUS_COLORS: Record<string, string> = {
  available:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  rented:      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  retired:     'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

// ── Форма создания/редактирования объекта ─────────────────────────────────────

interface ItemFormProps {
  open: boolean
  onClose: () => void
  initial?: RentalItem | null
}

function ItemFormDialog({ open, onClose, initial }: ItemFormProps) {
  const upsert = useUpsertRentalItem()
  const isEdit = !!initial

  const [name, setName]               = useState(initial?.name ?? '')
  const [category, setCategory]       = useState<string>(initial?.category ?? 'transport')
  const [subcategory, setSubcategory] = useState(initial?.subcategory ?? '')
  const [brand, setBrand]             = useState(initial?.brand ?? '')
  const [model, setModel]             = useState(initial?.model ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [inventoryQty, setInventoryQty] = useState(String(initial?.inventory_qty ?? 1))
  const [pricingUnit, setPricingUnit] = useState<RentalPricingUnit>(initial?.pricing_unit ?? 'day')
  const [priceHour, setPriceHour]     = useState(initial?.price_per_hour?.toString() ?? '')
  const [priceDay, setPriceDay]       = useState(initial?.price_per_day?.toString() ?? '')
  const [priceWeek, setPriceWeek]     = useState(initial?.price_per_week?.toString() ?? '')
  const [priceMonth, setPriceMonth]   = useState(initial?.price_per_month?.toString() ?? '')
  const [depositRequired, setDepositRequired] = useState(initial?.deposit_required ?? false)
  const [depositType, setDepositType] = useState(initial?.deposit_type ?? 'fixed')
  const [depositAmount, setDepositAmount] = useState(initial?.deposit_amount?.toString() ?? '')
  const [pickupAddress, setPickupAddress] = useState(initial?.pickup_address ?? '')

  const reset = () => {
    setName(''); setCategory('transport'); setSubcategory('')
    setBrand(''); setModel(''); setDescription(''); setInventoryQty('1')
    setPricingUnit('day'); setPriceHour(''); setPriceDay(''); setPriceWeek(''); setPriceMonth('')
    setDepositRequired(false); setDepositType('fixed'); setDepositAmount('')
    setPickupAddress('')
  }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Название обязательно')
      return
    }
    const hasAnyPrice = [priceHour, priceDay, priceWeek, priceMonth].some(p => Number(p) > 0)
    if (!hasAnyPrice) {
      toast.error('Укажите хотя бы одну цену (час/день/неделя/месяц)')
      return
    }
    try {
      await upsert.mutateAsync({
        ...(initial?.id ? { id: initial.id } : {}),
        name: name.trim(),
        category,
        subcategory: subcategory.trim() || null,
        brand: brand.trim() || null,
        model: model.trim() || null,
        description: description.trim() || null,
        inventory_qty: Math.max(1, Number(inventoryQty) || 1),
        pricing_unit: pricingUnit,
        price_per_hour:  priceHour  ? Number(priceHour)  : null,
        price_per_day:   priceDay   ? Number(priceDay)   : null,
        price_per_week:  priceWeek  ? Number(priceWeek)  : null,
        price_per_month: priceMonth ? Number(priceMonth) : null,
        deposit_required: depositRequired,
        deposit_type: depositType as 'fixed' | 'percent_of_price',
        deposit_amount: depositRequired ? (Number(depositAmount) || 0) : 0,
        pickup_address: pickupAddress.trim() || null,
      })
      toast.success(isEdit ? 'Объект обновлён' : 'Объект добавлен')
      handleClose()
    } catch (e) {
      toast.error('Ошибка сохранения')
      console.error(e)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редактировать объект' : 'Добавить объект аренды'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Название *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="BMW X5 2023, Bosch GSB 13 RE..." autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Категория</Label>
              <div className="relative">
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full h-9 appearance-none rounded-md border border-input bg-background px-3 pr-8 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {Object.entries(RENTAL_CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Подкатегория</Label>
              <Input value={subcategory} onChange={e => setSubcategory(e.target.value)} placeholder="Авто, Бензо, Декор..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Бренд</Label>
              <Input value={brand} onChange={e => setBrand(e.target.value)} placeholder="BMW, Bosch..." />
            </div>
            <div className="space-y-1.5">
              <Label>Модель</Label>
              <Input value={model} onChange={e => setModel(e.target.value)} placeholder="X5, GSB 13 RE..." />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Кол-во одинаковых единиц</Label>
            <Input
              type="number" min={1}
              value={inventoryQty}
              onChange={e => setInventoryQty(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Если у вас 5 одинаковых дрелей — поставьте 5. Это позволит брать их в аренду параллельно.
            </p>
          </div>

          {/* Тарификация */}
          <div className="border rounded-lg p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Тарификация</p>

            <div className="space-y-1.5">
              <Label>Основная единица</Label>
              <div className="relative">
                <select
                  value={pricingUnit}
                  onChange={e => setPricingUnit(e.target.value as RentalPricingUnit)}
                  className="w-full h-9 appearance-none rounded-md border border-input bg-background px-3 pr-8 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {Object.entries(RENTAL_PRICING_UNIT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Цена за час</Label>
                <Input type="number" min={0} value={priceHour} onChange={e => setPriceHour(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Цена за день</Label>
                <Input type="number" min={0} value={priceDay} onChange={e => setPriceDay(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Цена за неделю</Label>
                <Input type="number" min={0} value={priceWeek} onChange={e => setPriceWeek(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Цена за месяц</Label>
                <Input type="number" min={0} value={priceMonth} onChange={e => setPriceMonth(e.target.value)} placeholder="0" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Заполните хотя бы одну цену — оставьте 0/пустым нерелевантные тарифы.</p>
          </div>

          {/* Депозит */}
          <div className="border rounded-lg p-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={depositRequired}
                onChange={e => setDepositRequired(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm font-medium">Требуется залог</span>
            </label>
            {depositRequired && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Тип</Label>
                  <div className="relative">
                    <select
                      value={depositType}
                      onChange={e => setDepositType(e.target.value as 'fixed' | 'percent_of_price')}
                      className="w-full h-9 appearance-none rounded-md border border-input bg-background px-3 pr-8 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="fixed">Фиксированный</option>
                      <option value="percent_of_price">% от стоимости</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{depositType === 'percent_of_price' ? 'Процент' : 'Сумма'}</Label>
                  <Input type="number" min={0} value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="0" />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Адрес самовывоза</Label>
            <Input value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} placeholder="г. Ташкент, ул. ..." />
          </div>

          <div className="space-y-1.5">
            <Label>Описание</Label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Краткое описание объекта, комплектация..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Отмена</Button>
          <Button onClick={handleSubmit} loading={upsert.isPending}>
            {isEdit ? 'Сохранить' : 'Добавить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Импорт из global_rental_items ─────────────────────────────────────────────

interface ImportDialogProps {
  open: boolean
  onClose: () => void
}

function ImportRentalDialog({ open, onClose }: ImportDialogProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)

  const { data: globalItems = [], isLoading } = useGlobalRentalItems()
  const upsert = useUpsertRentalItem()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return globalItems.filter(g => {
      const matchesSearch = !q || g.name.toLowerCase().includes(q) || (g.subcategory ?? '').toLowerCase().includes(q)
      const matchesCat = categoryFilter === 'all' || g.category === categoryFilter
      return matchesSearch && matchesCat
    })
  }, [globalItems, search, categoryFilter])

  const grouped = useMemo(() => {
    const map: Record<string, GlobalRentalItem[]> = {}
    for (const g of filtered) {
      const key = RENTAL_CATEGORY_LABELS[g.category as RentalCategory] ?? g.category
      if (!map[key]) map[key] = []
      map[key].push(g)
    }
    return map
  }, [filtered])

  const allSelected = filtered.length > 0 && filtered.every(g => selected.has(g.id))
  const availableCategories = useMemo(() => {
    const set = new Set<string>()
    globalItems.forEach(g => set.add(g.category))
    return Array.from(set)
  }, [globalItems])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleImport = async () => {
    if (selected.size === 0) return
    setImporting(true)
    const toImport = globalItems.filter(g => selected.has(g.id))
    const results = await Promise.allSettled(
      toImport.map(g => upsert.mutateAsync({
        name: g.name,
        category: g.category,
        subcategory: g.subcategory,
        pricing_unit: g.default_pricing_unit,
        price_per_day:  g.default_price_per_day || null,
        price_per_hour: g.default_price_per_hour || null,
        min_rental_minutes: g.default_min_rental_minutes,
        deposit_required: g.default_deposit_required,
        deposit_type: 'percent_of_price',
        deposit_amount: g.default_deposit_percent,
        inventory_qty: 1,
      }))
    )
    const ok = results.filter(r => r.status === 'fulfilled').length
    const err = results.filter(r => r.status === 'rejected').length
    setImporting(false)
    if (ok > 0) toast.success(`Добавлено объектов: ${ok}`)
    if (err > 0) toast.error('Часть объектов не добавилась')
    setSelected(new Set())
    onClose()
  }

  const handleClose = () => {
    setSearch(''); setSelected(new Set()); setCategoryFilter('all')
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

        <div className="px-6 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по объектам..."
              className="pl-9"
            />
          </div>
        </div>

        {availableCategories.length > 1 && (
          <div className="px-6 pb-2 shrink-0 flex gap-1.5 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={cn(
                'shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                categoryFilter === 'all'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              )}
            >
              Все
            </button>
            {availableCategories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  'shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  categoryFilter === cat
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted'
                )}
              >
                {RENTAL_CATEGORY_LABELS[cat as RentalCategory] ?? cat}
              </button>
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="px-6 pb-2 shrink-0 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelected(allSelected ? new Set() : new Set(filtered.map(g => g.id)))}
              className="text-xs text-primary hover:underline"
            >
              {allSelected ? 'Снять выделение' : 'Выбрать все'}
            </button>
            {selected.size > 0 && (
              <Badge variant="secondary" className="text-xs">Выбрано: {selected.size}</Badge>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 pb-4 border-t pt-2">
          {isLoading && (
            <div className="space-y-2 pt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 w-full rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">
              {search ? 'Ничего не найдено' : 'Справочник пуст'}
            </p>
          )}
          {!isLoading && Object.entries(grouped).map(([catLabel, items]) => (
            <div key={catLabel} className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {catLabel} ({items.length})
              </p>
              <div className="space-y-1">
                {items.map(g => {
                  const isSel = selected.has(g.id)
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggle(g.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors',
                        isSel ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
                      )}
                    >
                      <div className={cn(
                        'h-4 w-4 rounded border flex items-center justify-center shrink-0',
                        isSel ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                      )}>
                        {isSel && <span className="h-2 w-2 bg-primary-foreground rounded-sm" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{g.name}</p>
                        {g.subcategory && <p className="text-xs text-muted-foreground truncate">{g.subcategory}</p>}
                      </div>
                      {g.default_price_per_day > 0 && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {g.default_price_per_day.toLocaleString('ru')}/день
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="px-6 pb-6 pt-3 shrink-0 border-t">
          <Button variant="outline" onClick={handleClose}>Отмена</Button>
          <Button onClick={handleImport} disabled={selected.size === 0} loading={importing}>
            <Download className="h-4 w-4 mr-2" />
            Добавить ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Карточка объекта ──────────────────────────────────────────────────────────

function ItemCard({ item, onEdit, onDelete }: {
  item: RentalItem
  onEdit: (item: RentalItem) => void
  onDelete: (id: string) => void
}) {
  const Icon = CATEGORY_ICONS[item.category ?? 'other'] ?? Package
  const currencySymbol = useCurrencySymbol()

  const primaryPrice = item.pricing_unit === 'hour'  ? item.price_per_hour
                     : item.pricing_unit === 'week'  ? item.price_per_week
                     : item.pricing_unit === 'month' ? item.price_per_month
                     : item.price_per_day
  const fallbackPrice =
    item.price_per_day ?? item.price_per_hour ?? item.price_per_week ?? item.price_per_month ?? 0
  const displayPrice = primaryPrice ?? fallbackPrice
  const displayUnit  = primaryPrice != null ? item.pricing_unit
                     : item.price_per_day != null ? 'day'
                     : item.price_per_hour != null ? 'hour'
                     : item.price_per_week != null ? 'week'
                     : 'month'

  return (
    <div className="group relative rounded-xl border border-border bg-card p-3 hover:shadow-sm transition-shadow">
      {/* Обложка / иконка */}
      <div className="aspect-[4/3] rounded-lg bg-muted mb-2.5 overflow-hidden flex items-center justify-center">
        {item.photos.length > 0 ? (
          <img src={item.photos[0]} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <Icon className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />
        )}
      </div>

      {/* Бейджи статуса/категории */}
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        <span className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide',
          STATUS_COLORS[item.status]
        )}>
          {RENTAL_STATUS_LABELS[item.status]}
        </span>
        <span className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium',
          CATEGORY_COLORS[item.category ?? 'other']
        )}>
          {RENTAL_CATEGORY_LABELS[item.category as RentalCategory] ?? item.category}
        </span>
        {item.inventory_qty > 1 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
            ×{item.inventory_qty}
          </span>
        )}
      </div>

      {/* Название */}
      <h3 className="text-sm font-semibold leading-tight line-clamp-2">{item.name}</h3>
      {(item.brand || item.model) && (
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {[item.brand, item.model].filter(Boolean).join(' ')}
        </p>
      )}

      {/* Цена */}
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-base font-bold">{formatCurrency(displayPrice ?? 0)} {currencySymbol}</span>
        <span className="text-xs text-muted-foreground">/ {RENTAL_PRICING_UNIT_LABELS[displayUnit]}</span>
      </div>
      {item.deposit_required && item.deposit_amount > 0 && (
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Залог: {item.deposit_type === 'percent_of_price'
            ? `${item.deposit_amount}%`
            : `${formatCurrency(item.deposit_amount)} ${currencySymbol}`}
        </p>
      )}

      {/* Действия */}
      <div className="mt-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(item)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Редактировать"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Удалить"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Главная страница ──────────────────────────────────────────────────────────

export function RentalItemsPage() {
  const { data: items = [], isLoading } = useRentalItems()
  const deleteItem = useDeleteRentalItem()

  const [search, setSearch]                 = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter]     = useState<string>('all')
  const [editing, setEditing]               = useState<RentalItem | null>(null)
  const [addOpen, setAddOpen]               = useState(false)
  const [importOpen, setImportOpen]         = useState(false)
  const [deleteId, setDeleteId]             = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(it => {
      const matchesSearch = !q || it.name.toLowerCase().includes(q)
        || (it.brand ?? '').toLowerCase().includes(q)
        || (it.model ?? '').toLowerCase().includes(q)
      const matchesCat = categoryFilter === 'all' || it.category === categoryFilter
      const matchesStatus = statusFilter === 'all' || it.status === statusFilter
      return matchesSearch && matchesCat && matchesStatus
    })
  }, [items, search, categoryFilter, statusFilter])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteItem.mutateAsync(deleteId)
      toast.success('Объект удалён')
    } catch {
      toast.error('Ошибка удаления')
    } finally {
      setDeleteId(null)
    }
  }

  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const it of items) c[it.category ?? 'other'] = (c[it.category ?? 'other'] || 0) + 1
    return c
  }, [items])

  const availableCategories = useMemo(
    () => Object.keys(categoryCounts).sort(),
    [categoryCounts]
  )

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Объекты аренды</h1>
          <Badge variant="secondary" className="ml-1">{items.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Из справочника</span>
            <span className="sm:hidden">Импорт</span>
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Добавить
          </Button>
        </div>
      </div>

      {/* Search + status filter */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по названию, бренду..."
            className="w-full h-9 pl-8 pr-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
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
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-9 pl-3 pr-8 appearance-none rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Все статусы</option>
            {Object.entries(RENTAL_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Category tabs */}
      {availableCategories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none mb-4">
          <button
            onClick={() => setCategoryFilter('all')}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
              categoryFilter === 'all'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-muted'
            )}
          >
            Все ({items.length})
          </button>
          {availableCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
                categoryFilter === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              )}
            >
              {RENTAL_CATEGORY_LABELS[cat as RentalCategory] ?? cat} ({categoryCounts[cat]})
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-3">
              <div className="aspect-[4/3] rounded-lg bg-muted animate-pulse mb-2" />
              <div className="h-3 bg-muted animate-pulse rounded mb-1" />
              <div className="h-3 w-2/3 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed">
          <KeyRound className="h-10 w-10 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground mb-3">
            {items.length === 0
              ? 'Каталог пуст. Добавьте первый объект или импортируйте из справочника.'
              : 'Ничего не найдено по фильтрам.'}
          </p>
          {items.length === 0 ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Импорт из справочника
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Добавить вручную
              </Button>
            </div>
          ) : (
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => { setSearch(''); setCategoryFilter('all'); setStatusFilter('all') }}
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              onEdit={setEditing}
              onDelete={setDeleteId}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <ItemFormDialog
        open={addOpen || !!editing}
        onClose={() => { setAddOpen(false); setEditing(null) }}
        initial={editing}
      />
      <ImportRentalDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Удалить объект?"
        loading={deleteItem.isPending}
      />
    </div>
  )
}
