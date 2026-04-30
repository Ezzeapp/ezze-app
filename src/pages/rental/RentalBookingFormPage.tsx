import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Save, Loader2, AlertTriangle, CheckCircle2, ChevronDown, Search, KeyRound,
  FileText, RotateCcw,
} from 'lucide-react'
import {
  useUpsertRentalBooking, useRentalBooking, calcRentalPrice, checkRentalAvailability,
  type AvailabilityResult,
} from '@/hooks/useRentalBookings'
import { useRentalItems } from '@/hooks/useRentalItems'
import { useClients } from '@/hooks/useClients'
import { useRentalHandovers } from '@/hooks/useRentalHandovers'
import { useAuth } from '@/contexts/AuthContext'
import {
  RENTAL_PRICING_UNIT_LABELS,
  type RentalPricingUnit, type RentalBookingStatus,
} from '@/types/rental'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { toast } from '@/components/shared/Toaster'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HandoverWizard } from './HandoverWizard'
import { ContractDialog } from './ContractDialog'

// ── Утилиты дат ───────────────────────────────────────────────────────────────

/** Из datetime-local значения (без timezone) → ISO с локальной таймзоной. */
function localInputToIso(localValue: string): string {
  if (!localValue) return ''
  const d = new Date(localValue)
  if (isNaN(d.getTime())) return ''
  return d.toISOString()
}

/** Из ISO → значение для input[type=datetime-local] в локальной TZ. */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60_000)
  return local.toISOString().slice(0, 16)
}

function defaultStart(): string {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return isoToLocalInput(d.toISOString())
}

function defaultEnd(start: string): string {
  if (!start) return ''
  const d = new Date(start)
  d.setDate(d.getDate() + 1)
  return isoToLocalInput(d.toISOString())
}

// ── Status options для редактирования брони ───────────────────────────────────

const BOOKING_STATUSES: { value: RentalBookingStatus; label: string }[] = [
  { value: 'pending',   label: 'Ожидает подтверждения' },
  { value: 'confirmed', label: 'Подтверждена' },
  { value: 'active',    label: 'В аренде' },
  { value: 'returned',  label: 'Возвращён' },
  { value: 'cancelled', label: 'Отменена' },
  { value: 'overdue',   label: 'Просрочка' },
]

export function RentalBookingFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id && id !== 'new'
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const upsert = useUpsertRentalBooking()
  const { data: existing, isLoading: loadingExisting } = useRentalBooking(isEdit ? id : undefined)
  const { data: items = [], isLoading: loadingItems } = useRentalItems()
  const { data: clients = [], isLoading: loadingClients } = useClients()
  const { data: handovers = [] } = useRentalHandovers(isEdit ? id : undefined)
  const { user } = useAuth()
  const currencySymbol = useCurrencySymbol()
  const masterName = user?.email ?? ''

  const [handoverOpen, setHandoverOpen] = useState<null | 'pickup' | 'return'>(null)
  const [contractOpen, setContractOpen] = useState(false)

  const hasPickup = handovers.some(h => h.type === 'pickup')
  const hasReturn = handovers.some(h => h.type === 'return')

  // Pre-fill из query (?itemId=...&start=...&end=...) при создании из календаря
  const initialItemId = !isEdit ? (searchParams.get('itemId') ?? '') : ''
  const initialStart  = !isEdit ? (searchParams.get('start') ?? '')  : ''
  const initialEnd    = !isEdit ? (searchParams.get('end') ?? '')    : ''

  const [itemId, setItemId]       = useState(initialItemId)
  const [clientId, setClientId]   = useState<string>('')
  const [clientSearch, setClientSearch] = useState('')
  const [showClientList, setShowClientList] = useState(false)
  const [startLocal, setStartLocal] = useState(initialStart ? isoToLocalInput(initialStart) : defaultStart())
  const [endLocal, setEndLocal]     = useState(initialEnd   ? isoToLocalInput(initialEnd)   : defaultEnd(initialStart ? isoToLocalInput(initialStart) : defaultStart()))
  const [pricingUnit, setPricingUnit] = useState<RentalPricingUnit>('day')
  const [unitPrice, setUnitPrice]   = useState('0')
  const [unitsCount, setUnitsCount] = useState('1')
  const [basePrice, setBasePrice]   = useState('0')
  const [depositRequired, setDepositRequired] = useState(false)
  const [depositAmount, setDepositAmount]     = useState('0')
  const [prepaid, setPrepaid]       = useState('0')
  const [notes, setNotes]           = useState('')
  const [status, setStatus]         = useState<RentalBookingStatus>('pending')

  const [availability, setAvailability] = useState<AvailabilityResult | null>(null)
  const [checking, setChecking] = useState(false)

  // Подгружаем данные существующей брони
  useEffect(() => {
    if (!existing) return
    setItemId(existing.item_id)
    setClientId(existing.client_id ?? '')
    setStartLocal(isoToLocalInput(existing.start_at))
    setEndLocal(isoToLocalInput(existing.end_at))
    setPricingUnit(existing.pricing_unit)
    setUnitPrice(String(existing.unit_price))
    setUnitsCount(String(existing.units_count))
    setBasePrice(String(existing.base_price))
    setDepositRequired(existing.deposit_required)
    setDepositAmount(String(existing.deposit_amount))
    setPrepaid(String(existing.prepaid_amount))
    setNotes(existing.notes ?? '')
    setStatus(existing.status)
  }, [existing])

  const selectedItem = useMemo(() => items.find(i => i.id === itemId), [items, itemId])
  const selectedClient = useMemo(() => clients.find(c => c.id === clientId), [clients, clientId])

  // При смене объекта — выставляем дефолты тарифа и депозита
  useEffect(() => {
    if (!selectedItem || isEdit) return
    setPricingUnit(selectedItem.pricing_unit)
    setDepositRequired(selectedItem.deposit_required)
    if (selectedItem.deposit_required) {
      setDepositAmount(String(selectedItem.deposit_amount))
    } else {
      setDepositAmount('0')
    }
  }, [selectedItem, isEdit])

  // Авторасчёт цены при изменении объекта/периода/единицы
  useEffect(() => {
    if (!selectedItem || !startLocal || !endLocal) return
    const startIso = localInputToIso(startLocal)
    const endIso   = localInputToIso(endLocal)
    if (!startIso || !endIso) return
    const calc = calcRentalPrice(
      { ...selectedItem, pricing_unit: pricingUnit },
      startIso, endIso,
    )
    setUnitPrice(String(calc.unitPrice))
    setUnitsCount(String(calc.unitsCount))
    setBasePrice(String(calc.basePrice))
  }, [selectedItem, startLocal, endLocal, pricingUnit])

  // Проверка доступности при смене объекта/периода
  useEffect(() => {
    if (!itemId || !startLocal || !endLocal) {
      setAvailability(null)
      return
    }
    const startIso = localInputToIso(startLocal)
    const endIso   = localInputToIso(endLocal)
    if (!startIso || !endIso) return
    if (new Date(endIso) <= new Date(startIso)) {
      setAvailability(null)
      return
    }
    setChecking(true)
    checkRentalAvailability(itemId, startIso, endIso, isEdit ? id : undefined)
      .then(res => setAvailability(res))
      .catch(e => {
        console.error('availability error', e)
        setAvailability(null)
      })
      .finally(() => setChecking(false))
  }, [itemId, startLocal, endLocal, id, isEdit])

  // Депозит расчёт (если процент)
  const computedDeposit = useMemo(() => {
    if (!depositRequired) return 0
    if (!selectedItem) return Number(depositAmount) || 0
    if (selectedItem.deposit_type === 'percent_of_price') {
      const pct = Number(depositAmount) || 0
      return Math.round((Number(basePrice) || 0) * pct / 100)
    }
    return Number(depositAmount) || 0
  }, [depositRequired, depositAmount, selectedItem, basePrice])

  const totalAmount = useMemo(() => Math.max(0, Number(basePrice) || 0), [basePrice])

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    if (!q) return clients.slice(0, 20)
    return clients.filter(c => {
      const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase()
      return name.includes(q) || (c.phone ?? '').toLowerCase().includes(q)
    }).slice(0, 50)
  }, [clients, clientSearch])

  const handleSubmit = async () => {
    if (!itemId) {
      toast.error('Выберите объект аренды')
      return
    }
    const startIso = localInputToIso(startLocal)
    const endIso   = localInputToIso(endLocal)
    if (!startIso || !endIso) {
      toast.error('Укажите период')
      return
    }
    if (new Date(endIso) <= new Date(startIso)) {
      toast.error('Дата окончания должна быть позже начала')
      return
    }
    if (availability && !availability.is_available) {
      toast.error(`Объект занят в этот период (${availability.conflicts_count} из ${availability.inventory_qty} единиц)`)
      return
    }
    try {
      await upsert.mutateAsync({
        ...(existing?.id ? { id: existing.id } : {}),
        item_id: itemId,
        client_id: clientId || null,
        start_at: startIso,
        end_at: endIso,
        pricing_unit: pricingUnit,
        unit_price: Number(unitPrice) || 0,
        units_count: Number(unitsCount) || 0,
        base_price: Math.max(0, Number(basePrice) || 0),
        total_amount: totalAmount,
        deposit_required: depositRequired,
        deposit_amount: computedDeposit,
        prepaid_amount: Number(prepaid) || 0,
        notes: notes.trim() || null,
        status,
      })
      toast.success(isEdit ? 'Бронь обновлена' : 'Бронь создана')
      navigate('/rental/bookings')
    } catch (e) {
      console.error(e)
      toast.error('Ошибка сохранения')
    }
  }

  if (isEdit && loadingExisting) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/rental/bookings')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">
          {isEdit ? `Бронь ${existing?.number ?? ''}` : 'Новая бронь'}
        </h1>
      </div>

      <div className="space-y-5">
        {/* Объект */}
        <div className="space-y-1.5">
          <Label>Объект аренды *</Label>
          {loadingItems ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : items.length === 0 ? (
            <div className="p-3 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
              <KeyRound className="h-6 w-6 mx-auto mb-1 text-muted-foreground/40" />
              Каталог пуст. <button onClick={() => navigate('/rental/items')} className="text-primary underline">Добавить объект</button>
            </div>
          ) : (
            <div className="relative">
              <select
                value={itemId}
                onChange={e => setItemId(e.target.value)}
                className="w-full h-10 appearance-none rounded-md border border-input bg-background px-3 pr-8 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— выберите объект —</option>
                {items.filter(i => i.active && i.status !== 'retired').map(i => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                    {i.brand ? ` — ${i.brand}` : ''}
                    {i.inventory_qty > 1 ? ` (×${i.inventory_qty})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          )}
          {selectedItem && (
            <div className="text-xs text-muted-foreground space-x-3">
              {selectedItem.price_per_hour ? <span>час: {formatCurrency(selectedItem.price_per_hour)} {currencySymbol}</span> : null}
              {selectedItem.price_per_day  ? <span>день: {formatCurrency(selectedItem.price_per_day)} {currencySymbol}</span> : null}
              {selectedItem.price_per_week ? <span>неделя: {formatCurrency(selectedItem.price_per_week)} {currencySymbol}</span> : null}
              {selectedItem.price_per_month? <span>мес: {formatCurrency(selectedItem.price_per_month)} {currencySymbol}</span> : null}
            </div>
          )}
        </div>

        {/* Клиент */}
        <div className="space-y-1.5">
          <Label>Клиент</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={selectedClient
                ? `${selectedClient.first_name ?? ''} ${selectedClient.last_name ?? ''}`.trim() || (selectedClient.phone ?? '')
                : clientSearch}
              onChange={e => {
                setClientSearch(e.target.value)
                setClientId('')
                setShowClientList(true)
              }}
              onFocus={() => setShowClientList(true)}
              placeholder="Поиск по имени или телефону..."
              className="w-full h-10 pl-9 pr-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {showClientList && (
              <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg z-10">
                {loadingClients ? (
                  <div className="p-3 text-sm text-muted-foreground">Загрузка...</div>
                ) : filteredClients.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">Ничего не найдено</div>
                ) : (
                  filteredClients.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-b-0"
                      onClick={() => {
                        setClientId(c.id)
                        setClientSearch('')
                        setShowClientList(false)
                      }}
                    >
                      <p className="font-medium">{`${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.phone || '—'}</p>
                      {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {selectedClient && (
            <button
              type="button"
              onClick={() => { setClientId(''); setClientSearch('') }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Очистить выбор
            </button>
          )}
        </div>

        {/* Период */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Начало *</Label>
            <Input
              type="datetime-local"
              value={startLocal}
              onChange={e => setStartLocal(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Окончание *</Label>
            <Input
              type="datetime-local"
              value={endLocal}
              onChange={e => setEndLocal(e.target.value)}
              min={startLocal}
            />
          </div>
        </div>

        {/* Доступность */}
        {itemId && availability && (
          <div className={cn(
            'p-3 rounded-lg border flex items-start gap-2',
            availability.is_available
              ? 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-800'
              : 'border-rose-300 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800'
          )}>
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0 mt-0.5" />
            ) : availability.is_available ? (
              <CheckCircle2 className="h-4 w-4 text-green-700 dark:text-green-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="text-sm">
              {availability.is_available ? (
                <p className="text-green-800 dark:text-green-200">
                  Свободно: {availability.inventory_qty - availability.conflicts_count} из {availability.inventory_qty} ед.
                </p>
              ) : (
                <p className="text-rose-800 dark:text-rose-200">
                  Объект занят на этот период ({availability.conflicts_count} из {availability.inventory_qty} ед.)
                </p>
              )}
            </div>
          </div>
        )}

        {/* Тариф и стоимость */}
        <div className="border rounded-lg p-3 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Тариф</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Единица</Label>
              <div className="relative">
                <select
                  value={pricingUnit}
                  onChange={e => setPricingUnit(e.target.value as RentalPricingUnit)}
                  className="w-full h-9 appearance-none rounded-md border border-input bg-background px-2 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {Object.entries(RENTAL_PRICING_UNIT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Цена за единицу</Label>
              <Input type="number" min={0} value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Кол-во единиц</Label>
              <Input type="number" min={0} step="0.01" value={unitsCount} onChange={e => setUnitsCount(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Сумма аренды</Label>
            <Input type="number" min={0} value={basePrice} onChange={e => setBasePrice(e.target.value)} />
          </div>
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
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">
                  {selectedItem?.deposit_type === 'percent_of_price' ? 'Процент от стоимости' : 'Сумма залога'}
                </Label>
                <Input type="number" min={0} value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
              </div>
              {selectedItem?.deposit_type === 'percent_of_price' && (
                <p className="text-xs text-muted-foreground">
                  Расчётный залог: {formatCurrency(computedDeposit)} {currencySymbol}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Аванс и статус */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Предоплата</Label>
            <Input type="number" min={0} value={prepaid} onChange={e => setPrepaid(e.target.value)} />
          </div>
          {isEdit && (
            <div className="space-y-1.5">
              <Label>Статус</Label>
              <div className="relative">
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as RentalBookingStatus)}
                  className="w-full h-10 appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {BOOKING_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {/* Заметки */}
        <div className="space-y-1.5">
          <Label>Заметки</Label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Доп. информация..."
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Действия (только для существующих броней) */}
        {isEdit && existing && (
          <div className="border rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Документы и операции</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setContractOpen(true)}>
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Договор
              </Button>
              {!hasPickup && existing.status !== 'cancelled' && existing.status !== 'returned' && (
                <Button size="sm" variant="outline" onClick={() => setHandoverOpen('pickup')}>
                  <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                  Выдать клиенту
                </Button>
              )}
              {hasPickup && !hasReturn && existing.status !== 'returned' && existing.status !== 'cancelled' && (
                <Button size="sm" variant="outline" onClick={() => setHandoverOpen('return')}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Принять у клиента
                </Button>
              )}
            </div>
            {(hasPickup || hasReturn) && (
              <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t">
                {handovers.map(h => (
                  <p key={h.id}>
                    {h.type === 'pickup' ? '→ Выдан' : '← Принят'} ·{' '}
                    {new Date(h.created_at).toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {h.charges_total > 0 && ` · удержано ${formatCurrency(h.charges_total)} ${currencySymbol}`}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Итого */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
          <div className="flex justify-between text-sm">
            <span>Аренда</span>
            <span>{formatCurrency(totalAmount)} {currencySymbol}</span>
          </div>
          {depositRequired && (
            <div className="flex justify-between text-sm">
              <span>Залог</span>
              <span>{formatCurrency(computedDeposit)} {currencySymbol}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span>Предоплата</span>
            <span>−{formatCurrency(Number(prepaid) || 0)} {currencySymbol}</span>
          </div>
          <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
            <span>К оплате клиенту</span>
            <span>{formatCurrency(totalAmount + computedDeposit - (Number(prepaid) || 0))} {currencySymbol}</span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => navigate('/rental/bookings')}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            loading={upsert.isPending}
            disabled={!itemId || !startLocal || !endLocal || (availability ? !availability.is_available : false)}
          >
            <Save className="h-4 w-4 mr-1.5" />
            {isEdit ? 'Сохранить' : 'Создать бронь'}
          </Button>
        </div>
      </div>

      {/* Диалоги действий (только для существующих броней) */}
      {isEdit && existing && (
        <>
          {handoverOpen && (
            <HandoverWizard
              open={!!handoverOpen}
              onClose={() => setHandoverOpen(null)}
              booking={existing}
              item={selectedItem}
              type={handoverOpen}
            />
          )}
          <ContractDialog
            open={contractOpen}
            onClose={() => setContractOpen(false)}
            booking={existing}
            item={selectedItem}
            client={selectedClient}
            masterName={masterName}
          />
        </>
      )}
    </div>
  )
}
