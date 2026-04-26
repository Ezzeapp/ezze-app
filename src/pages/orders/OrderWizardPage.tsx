import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Search, Plus, Minus, Check, X, Loader2,
  User, ShoppingBag, Tag, CreditCard, UserPlus,
  Clock, Zap, Truck, Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { DateInput } from '@/components/ui/date-input'
import { toast } from '@/components/shared/Toaster'
import {
  useCreateOrder, useCleaningEnabledOrderTypes, getOrderTypeIcon,
  type OrderType, type CleaningOrderTypeConfig, DEFAULT_ENABLED_CONFIGS,
} from '@/hooks/useCleaningOrders'
import { useCleaningItemTypes, type CleaningItemType } from '@/hooks/useCleaningItemTypes'
import { useClientsPaged, useCreateClient } from '@/hooks/useClients'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { formatCurrency, cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import dayjs from 'dayjs'

// ── Типы ────────────────────────────────────────────────────────────────────

interface CartLine {
  key: number
  type: CleaningItemType
  qty: number
  color: string
  size: string
  defects: string
  brand: string
  width_m: string
  length_m: string
  weight_kg: string
  notes: string
  ready_date: string
}

const COLOR_PALETTE = [
  'Чёрный','Белый','Бежевый','Серый','Синий','Красный','Зелёный','Коричневый','Жёлтый','Розовый','Разноцвет',
]
const SIZES = ['S','M','L','XL','XXL']
const COMMON_DEFECTS = ['Пятно','Потёртость','Дыра','Зацепка','Выцветший','Засаленный']

let keySeq = 0
function makeLine(t: CleaningItemType, readyDate: string): CartLine {
  return {
    key: ++keySeq,
    type: t,
    qty: 1,
    color: '', size: 'M', defects: '', brand: '',
    width_m: '', length_m: '', weight_kg: '', notes: '',
    ready_date: readyDate,
  }
}

// ── Главный компонент ───────────────────────────────────────────────────────

export function OrderWizardPage() {
  const navigate = useNavigate()
  const symbol = useCurrencySymbol()

  const { data: enabledOrderTypes = DEFAULT_ENABLED_CONFIGS } = useCleaningEnabledOrderTypes()
  const { data: allTypes = [] } = useCleaningItemTypes()
  const { mutateAsync: createOrder, isPending } = useCreateOrder()

  // Шаг
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Тип заказа
  const [orderType, setOrderType] = useState<OrderType>('clothing')
  useEffect(() => {
    if (enabledOrderTypes.length && !enabledOrderTypes.find(c => c.slug === orderType)) {
      setOrderType(enabledOrderTypes[0].slug)
    }
  }, [enabledOrderTypes, orderType])

  // Клиент
  const [clientQuery, setClientQuery] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  const [clientName, setClientName] = useState<string>('')
  const [clientPhone, setClientPhone] = useState<string>('')
  const [showAddClient, setShowAddClient] = useState(false)
  const { data: clientsData } = useClientsPaged(clientQuery, 1, 20)
  const clients = clientsData?.items ?? []

  // Исполнитель
  const [assignedTo, setAssignedTo] = useState<string | null>(null)
  const { data: members = [] } = useQuery({
    queryKey: ['master_profiles_list', PRODUCT],
    queryFn: async () => {
      const { data } = await supabase
        .from('master_profiles')
        .select('id, display_name')
        .eq('product', PRODUCT)
        .order('display_name')
      return data ?? []
    },
  })

  // Каталог
  const filteredTypes = useMemo(
    () => allTypes.filter(t => (t.category || 'clothing') === orderType),
    [allTypes, orderType]
  )
  const subgroups = useMemo(() => {
    const map = new Map<string, number>()
    filteredTypes.forEach(t => {
      const sub = t.subcategory || 'Другое'
      map.set(sub, (map.get(sub) || 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [filteredTypes])
  const [activeSub, setActiveSub] = useState<string | null>(null)
  useEffect(() => {
    if (!subgroups.length) { setActiveSub(null); return }
    if (!activeSub || !subgroups.find(g => g.name === activeSub)) setActiveSub(subgroups[0].name)
  }, [subgroups, activeSub])
  const [catalogQuery, setCatalogQuery] = useState('')
  const visibleTypes = useMemo(() => {
    let arr = filteredTypes
    if (activeSub) arr = arr.filter(t => (t.subcategory || 'Другое') === activeSub)
    if (catalogQuery) {
      const q = catalogQuery.toLowerCase()
      arr = filteredTypes.filter(t => t.name.toLowerCase().includes(q))
    }
    return arr
  }, [filteredTypes, activeSub, catalogQuery])

  // Корзина
  const [defaultDays, setDefaultDays] = useState(3)
  const defaultReady = dayjs().add(defaultDays, 'day').format('YYYY-MM-DD')
  const [cart, setCart] = useState<CartLine[]>([])
  const [focusedKey, setFocusedKey] = useState<number | null>(null)

  function addType(t: CleaningItemType) {
    setCart(prev => {
      const ex = prev.find(l => l.type.id === t.id)
      if (ex) return prev.map(l => l.key === ex.key ? { ...l, qty: l.qty + 1 } : l)
      const days = t.default_days || defaultDays
      const line = makeLine(t, dayjs().add(days, 'day').format('YYYY-MM-DD'))
      setFocusedKey(line.key)
      return [...prev, line]
    })
  }
  function updateLine(key: number, patch: Partial<CartLine>) {
    setCart(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l))
  }
  function removeLine(key: number) {
    setCart(prev => prev.filter(l => l.key !== key))
    if (focusedKey === key) setFocusedKey(null)
  }

  // Оплата
  const [urgency, setUrgency] = useState<'normal' | 'urgent' | 'pickup' | 'delivery'>('normal')
  const [payment, setPayment] = useState<string>('cash')
  const [discount, setDiscount] = useState(0)
  const [prepayPct, setPrepayPct] = useState(0)
  const [notes, setNotes] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [visitAddress, setVisitAddress] = useState('')

  // Расчёты
  function lineSum(l: CartLine) {
    if (orderType === 'carpet') {
      const w = parseFloat(l.width_m) || 0
      const h = parseFloat(l.length_m) || 0
      const area = w * h
      if (area > 0) return area * l.type.default_price * l.qty
    }
    return l.type.default_price * l.qty
  }
  const subtotal = cart.reduce((s, l) => s + lineSum(l), 0)
  const urgMul = urgency === 'urgent' ? 1.5 : 1
  const surchargeAmt = subtotal * (urgMul - 1)
  const discountAmt = Math.round((subtotal + surchargeAmt) * discount / 100)
  const deliveryAdd = urgency === 'delivery' ? 0 : 0 // TODO: tariff если будет
  const total = Math.round(subtotal + surchargeAmt - discountAmt + deliveryAdd)
  const prepayAmt = Math.round(total * prepayPct / 100)

  // Шаги
  const steps: { n: 1 | 2 | 3 | 4; label: string; icon: typeof User }[] = [
    { n: 1, label: 'Клиент', icon: User },
    { n: 2, label: 'Позиции', icon: ShoppingBag },
    { n: 3, label: 'Детали', icon: Tag },
    { n: 4, label: 'Оплата', icon: CreditCard },
  ]

  function canNext(): boolean {
    if (step === 1) return true // client optional
    if (step === 2) return cart.length > 0
    if (step === 3) return cart.length > 0
    return false
  }

  async function handleSubmit() {
    if (cart.length === 0) {
      toast.error('Добавьте хотя бы одну позицию')
      return
    }
    try {
      const order = await createOrder({
        order_type: orderType,
        client_id: clientId,
        assigned_to: assignedTo,
        prepaid_amount: prepayAmt,
        total_amount: total,
        ready_date: defaultReady,
        notes: notes || null,
        is_express: urgency === 'urgent',
        payment_method: payment,
        surcharge_percent: urgency === 'urgent' ? 50 : 0,
        surcharge_amount: surchargeAmt,
        pickup_date: orderType === 'carpet' ? (pickupDate || null) : null,
        delivery_date: orderType === 'carpet' ? (deliveryDate || null) : null,
        visit_address: orderType === 'furniture' ? (visitAddress || null) : null,
        items: cart.flatMap(l => Array.from({ length: l.qty }, () => {
          const w = parseFloat(l.width_m) || null
          const h = parseFloat(l.length_m) || null
          return {
            item_type_id: l.type.id,
            item_type_name: l.type.name,
            color: l.color || null,
            brand: l.brand || null,
            defects: l.defects || null,
            price: orderType === 'carpet' && w && h ? w * h * l.type.default_price : l.type.default_price,
            ready_date: l.ready_date || null,
            width_m: orderType === 'carpet' ? w : null,
            length_m: orderType === 'carpet' ? h : null,
            area_m2: orderType === 'carpet' && w && h ? w * h : null,
          }
        })),
      })
      toast.success('Заказ создан')
      navigate(`/orders/${order.id}`)
    } catch (e: any) {
      toast.error(e.message || 'Ошибка создания заказа')
    }
  }

  return (
    <div className="h-full w-full bg-muted/30 overflow-auto p-0 lg:p-4">
    <div className="w-full h-full lg:h-[860px] lg:max-h-[calc(100vh-32px)] flex flex-col bg-[#f5f7fb] dark:bg-background lg:rounded-xl lg:border lg:shadow-lg overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 sm:px-6 py-3 bg-background border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/orders')} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold text-sm">E</div>
          <div className="flex flex-col">
            <span className="text-sm sm:text-base font-semibold leading-none">Новый заказ</span>
            <span className="text-[10.5px] sm:text-xs text-muted-foreground font-mono leading-none mt-1 hidden xs:block">
              {dayjs().format('DD.MM.YYYY · HH:mm')}
            </span>
          </div>
        </div>
        <div className="flex-1" />
        <Button
          variant="outline" size="sm"
          className="h-8 text-xs"
          onClick={() => navigate('/orders')}
        >
          <span className="hidden sm:inline">Отмена</span>
          <X className="h-4 w-4 sm:hidden" />
        </Button>
      </div>

      {/* ── Progress ───────────────────────────────────────────── */}
      <div className="bg-background border-b px-3 sm:px-6 py-3 flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none shrink-0">
        {steps.map((s) => {
          const done = step > s.n
          const active = step === s.n
          const Icon = s.icon
          return (
            <button
              key={s.n}
              onClick={() => { if (s.n < step || (s.n === step + 1 && canNext())) setStep(s.n as 1|2|3|4) }}
              className={cn(
                'flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3.5 py-2 rounded-lg border text-left transition-colors shrink-0',
                active
                  ? 'border-primary bg-primary/10'
                  : done
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-border bg-muted/40',
                'flex-1 min-w-[110px] sm:min-w-0'
              )}
            >
              <div className={cn(
                'h-7 w-7 sm:h-8 sm:w-8 rounded-full grid place-items-center text-xs font-bold shrink-0',
                done ? 'bg-emerald-500 text-white'
                : active ? 'bg-gradient-to-br from-blue-500 to-blue-400 text-white'
                : 'bg-muted text-muted-foreground'
              )}>
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <div className="min-w-0 hidden xs:block">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
                  Шаг {s.n}
                </div>
                <div className="text-sm font-semibold leading-tight mt-1 truncate">{s.label}</div>
              </div>
              <div className="text-sm font-semibold xs:hidden">{s.label}</div>
            </button>
          )
        })}
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 lg:gap-5 px-3 sm:px-6 py-3 sm:py-5 overflow-hidden min-h-0">

        {/* Main panel */}
        <div className="flex-1 min-w-0 bg-background rounded-xl border shadow-sm p-4 sm:p-6 overflow-y-auto">
          {step === 1 && (
            <Step1Client
              orderType={orderType}
              setOrderType={setOrderType}
              enabledOrderTypes={enabledOrderTypes}
              clientQuery={clientQuery}
              setClientQuery={setClientQuery}
              clients={clients}
              clientId={clientId}
              clientName={clientName}
              clientPhone={clientPhone}
              onSelectClient={(c) => {
                setClientId(c.id)
                setClientName([c.first_name, c.last_name].filter(Boolean).join(' ') || '—')
                setClientPhone(c.phone || '')
              }}
              onClearClient={() => { setClientId(null); setClientName(''); setClientPhone('') }}
              onAddClient={() => setShowAddClient(true)}
              members={members}
              assignedTo={assignedTo}
              setAssignedTo={setAssignedTo}
            />
          )}

          {step === 2 && (
            <Step2Items
              subgroups={subgroups}
              activeSub={activeSub}
              setActiveSub={setActiveSub}
              catalogQuery={catalogQuery}
              setCatalogQuery={setCatalogQuery}
              visibleTypes={visibleTypes}
              cart={cart}
              addType={addType}
              symbol={symbol}
            />
          )}

          {step === 3 && (
            <Step3Details
              cart={cart}
              focusedKey={focusedKey}
              setFocusedKey={setFocusedKey}
              updateLine={updateLine}
              removeLine={removeLine}
              orderType={orderType}
              symbol={symbol}
              pricePerSqm={(focusedKey ? cart.find(l => l.key === focusedKey)?.type.default_price : 0) || 0}
            />
          )}

          {step === 4 && (
            <Step4Payment
              urgency={urgency}
              setUrgency={setUrgency}
              payment={payment}
              setPayment={setPayment}
              discount={discount}
              setDiscount={setDiscount}
              prepayPct={prepayPct}
              setPrepayPct={setPrepayPct}
              notes={notes}
              setNotes={setNotes}
              orderType={orderType}
              pickupDate={pickupDate}
              setPickupDate={setPickupDate}
              deliveryDate={deliveryDate}
              setDeliveryDate={setDeliveryDate}
              visitAddress={visitAddress}
              setVisitAddress={setVisitAddress}
              defaultDays={defaultDays}
              setDefaultDays={setDefaultDays}
            />
          )}
        </div>

        {/* Right rail (desktop) */}
        <div className="hidden lg:flex flex-col gap-3 w-[340px] shrink-0">
          {/* Client card */}
          <div className="bg-background rounded-xl border p-4 shadow-sm">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Клиент</div>
            {clientId ? (
              <>
                <div className="text-base font-semibold mt-1.5 truncate">{clientName}</div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">{clientPhone || '—'}</div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground italic mt-1.5">Не выбран</div>
            )}
          </div>

          {/* Cart summary */}
          <div className="flex-1 min-h-0 bg-background rounded-xl border shadow-sm p-4 flex flex-col">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Позиции · {cart.reduce((s, l) => s + l.qty, 0)} шт
            </div>
            <div className="flex-1 overflow-y-auto -mr-2 pr-2 min-h-0">
              {cart.length === 0 ? (
                <div className="text-sm text-muted-foreground italic py-4 text-center">
                  Добавьте позиции на шаге 2
                </div>
              ) : (
                cart.map(l => (
                  <div key={l.key} className="py-2 border-b last:border-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-[13px] truncate">
                        {l.type.name}
                        <span className="text-muted-foreground font-mono text-[11px] ml-1">× {l.qty}</span>
                      </div>
                      <div className="font-mono text-xs font-bold shrink-0">
                        {formatCurrency(lineSum(l))} {symbol}
                      </div>
                    </div>
                    {(l.color || l.defects) && (
                      <div className="text-[10.5px] text-muted-foreground mt-0.5 truncate">
                        {l.color && <>● {l.color}{l.defects && ' · '}</>}
                        {l.defects}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="border-t mt-2 pt-3 font-mono text-xs space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Подытог</span>
                <span>{formatCurrency(subtotal)} {symbol}</span>
              </div>
              {urgency === 'urgent' && (
                <div className="flex justify-between text-red-500">
                  <span>Срочно +50%</span>
                  <span>+ {formatCurrency(surchargeAmt)} {symbol}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Скидка {discount}%</span>
                  <span>− {formatCurrency(discountAmt)} {symbol}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between pt-2 border-t mt-2">
                <span className="font-sans font-bold text-base">Итого</span>
                <span className="text-xl font-extrabold">{formatCurrency(total)} {symbol}</span>
              </div>
              {prepayAmt > 0 && (
                <div className="flex justify-between text-muted-foreground pt-1">
                  <span>Предоплата {prepayPct}%</span>
                  <span>{formatCurrency(prepayAmt)} {symbol}</span>
                </div>
              )}
            </div>
          </div>

          {/* Nav */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={step === 1}
              onClick={() => setStep((step - 1) as 1|2|3|4)}
              className="px-4"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Назад
            </Button>
            {step < 4 ? (
              <Button
                disabled={!canNext()}
                onClick={() => setStep((step + 1) as 1|2|3|4)}
                className="flex-1 bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white"
              >
                Далее: {steps[step]?.label ?? ''}
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            ) : (
              <Button
                disabled={isPending || cart.length === 0}
                onClick={handleSubmit}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                Принять · {formatCurrency(total)} {symbol}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile bottom action bar */}
      <div className="lg:hidden bg-background border-t px-3 py-2.5 flex items-center gap-2 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground leading-none">
            {cart.reduce((s, l) => s + l.qty, 0)} позиций
          </div>
          <div className="text-base font-extrabold leading-tight mt-0.5 truncate">
            {formatCurrency(total)} {symbol}
          </div>
        </div>
        {step > 1 && (
          <Button
            variant="outline" size="sm"
            onClick={() => setStep((step - 1) as 1|2|3|4)}
            className="h-10 px-3"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        {step < 4 ? (
          <Button
            size="sm"
            disabled={!canNext()}
            onClick={() => setStep((step + 1) as 1|2|3|4)}
            className="h-10 px-4 bg-gradient-to-br from-blue-600 to-blue-500 text-white"
          >
            Далее
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={isPending || cart.length === 0}
            onClick={handleSubmit}
            className="h-10 px-4 bg-emerald-600 text-white"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Принять'}
          </Button>
        )}
      </div>

      {/* Quick add client */}
      {showAddClient && (
        <QuickAddClientDialog
          initialName={clientQuery}
          onClose={() => setShowAddClient(false)}
          onCreated={(c) => {
            setClientId(c.id)
            setClientName([c.first_name, c.last_name].filter(Boolean).join(' '))
            setClientPhone(c.phone || '')
            setShowAddClient(false)
          }}
        />
      )}
    </div>
    </div>
  )
}

// ── Step 1: Клиент + тип заказа ─────────────────────────────────────────────

function Step1Client({
  orderType, setOrderType, enabledOrderTypes,
  clientQuery, setClientQuery, clients, clientId, clientName, clientPhone,
  onSelectClient, onClearClient, onAddClient,
  members, assignedTo, setAssignedTo,
}: {
  orderType: OrderType
  setOrderType: (t: OrderType) => void
  enabledOrderTypes: CleaningOrderTypeConfig[]
  clientQuery: string
  setClientQuery: (s: string) => void
  clients: any[]
  clientId: string | null
  clientName: string
  clientPhone: string
  onSelectClient: (c: any) => void
  onClearClient: () => void
  onAddClient: () => void
  members: any[]
  assignedTo: string | null
  setAssignedTo: (s: string | null) => void
}) {
  return (
    <div className="space-y-6">
      {/* Тип заказа */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold tracking-tight">Что принимаете?</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Выберите тип услуги — это определит каталог.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-4">
          {enabledOrderTypes.map(cfg => {
            const Icon = getOrderTypeIcon(cfg.icon)
            const sel = orderType === cfg.slug
            return (
              <button
                key={cfg.slug}
                onClick={() => setOrderType(cfg.slug)}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-colors text-sm font-semibold',
                  sel ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'
                )}
              >
                <Icon className="h-6 w-6" />
                {cfg.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Клиент */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold tracking-tight">Кто клиент?</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Найдите по имени или телефону, или создайте нового.</p>

        {clientId ? (
          <div className="mt-4 flex items-center gap-3 p-4 rounded-xl border-2 border-primary bg-primary/5">
            <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold">
              {clientName.split(' ').map(s => s[0]).join('').slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{clientName}</div>
              <div className="text-sm text-muted-foreground font-mono truncate">{clientPhone || '—'}</div>
            </div>
            <Button variant="outline" size="sm" onClick={onClearClient}>
              Сменить
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Имя или телефон..."
                  value={clientQuery}
                  onChange={e => setClientQuery(e.target.value)}
                  className="pl-9 h-11 text-sm"
                />
              </div>
              <Button variant="outline" onClick={onAddClient} className="h-11">
                <UserPlus className="h-4 w-4 mr-1.5" />
                Новый клиент
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 max-h-96 overflow-y-auto">
              {clients.length === 0 ? (
                <div className="col-span-full text-sm text-muted-foreground italic text-center py-6">
                  {clientQuery ? 'Никого не найдено' : 'Начните вводить имя или телефон'}
                </div>
              ) : clients.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => onSelectClient(c)}
                  className="flex items-center gap-3 p-3 rounded-xl border-2 border-border hover:border-primary/40 transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-full bg-muted text-foreground grid place-items-center font-bold text-sm shrink-0">
                    {[c.first_name, c.last_name].filter(Boolean).map((s: string) => s[0]).join('').slice(0, 2) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">{c.phone || '—'}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Исполнитель */}
      {members.length > 0 && (
        <div>
          <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Исполнитель</Label>
          <select
            value={assignedTo ?? ''}
            onChange={e => setAssignedTo(e.target.value || null)}
            className="mt-1.5 h-10 w-full rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">— Не назначен —</option>
            {members.map((m: any) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

// ── Step 2: Каталог + добавление позиций ────────────────────────────────────

function Step2Items({
  subgroups, activeSub, setActiveSub,
  catalogQuery, setCatalogQuery,
  visibleTypes, cart, addType, symbol,
}: {
  subgroups: { name: string; count: number }[]
  activeSub: string | null
  setActiveSub: (s: string | null) => void
  catalogQuery: string
  setCatalogQuery: (s: string) => void
  visibleTypes: CleaningItemType[]
  cart: CartLine[]
  addType: (t: CleaningItemType) => void
  symbol: string
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4 lg:gap-5 h-full">
      {/* Subgroups */}
      <div>
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Группы</div>
        <div className="lg:max-h-[60vh] overflow-x-auto lg:overflow-y-auto -mx-1 px-1">
          <div className="flex lg:flex-col gap-1.5 lg:gap-1 min-w-max lg:min-w-0">
            {subgroups.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">Нет позиций. Добавьте в Справочник.</div>
            ) : subgroups.map(g => (
              <button
                key={g.name}
                onClick={() => setActiveSub(g.name)}
                className={cn(
                  'flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left whitespace-nowrap shrink-0',
                  activeSub === g.name
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'hover:bg-muted text-foreground'
                )}
              >
                <span>{g.name}</span>
                <span className="font-mono text-[10.5px] text-muted-foreground">{g.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="flex flex-col min-h-0">
        <h2 className="text-lg sm:text-xl font-bold tracking-tight">Что принимаем?</h2>
        <p className="text-sm text-muted-foreground mt-0.5 mb-3">
          Тапните по позиции, чтобы добавить. Количество и детали — на следующем шаге.
        </p>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Найти позицию..."
            value={catalogQuery}
            onChange={e => setCatalogQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <div className="flex-1 overflow-y-auto -mr-2 pr-2 min-h-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {visibleTypes.length === 0 ? (
              <div className="col-span-full text-sm text-muted-foreground italic text-center py-6">
                Нет позиций в категории
              </div>
            ) : visibleTypes.map(t => {
              const inCart = cart.find(l => l.type.id === t.id)
              return (
                <button
                  key={t.id}
                  onClick={() => addType(t)}
                  className={cn(
                    'relative p-3 rounded-xl border-2 transition-colors text-left',
                    inCart ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
                  )}
                >
                  {inCart && (
                    <div className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold text-xs font-mono">
                      {inCart.qty}
                    </div>
                  )}
                  <div className="text-sm font-semibold leading-tight min-h-[36px]">{t.name}</div>
                  <div className="font-mono text-base font-extrabold mt-2">
                    {formatCurrency(t.default_price)} <span className="text-xs text-muted-foreground">{symbol}</span>
                  </div>
                  {t.subcategory && (
                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{t.subcategory}</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step 3: Детали позиций ──────────────────────────────────────────────────

function Step3Details({
  cart, focusedKey, setFocusedKey, updateLine, removeLine,
  orderType, symbol,
}: {
  cart: CartLine[]
  focusedKey: number | null
  setFocusedKey: (k: number | null) => void
  updateLine: (key: number, patch: Partial<CartLine>) => void
  removeLine: (key: number) => void
  orderType: OrderType
  symbol: string
  pricePerSqm: number
}) {
  const focused = cart.find(l => l.key === focusedKey) ?? cart[0]
  useEffect(() => {
    if (!focused && cart.length) setFocusedKey(cart[0].key)
  }, [focused, cart, setFocusedKey])

  if (!focused) {
    return (
      <div className="text-center text-muted-foreground py-12">
        Нет позиций. Вернитесь на шаг 2.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 lg:gap-5 h-full">
      {/* Список позиций */}
      <div>
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Позиции</div>
        <div className="flex lg:flex-col gap-1.5 lg:gap-1 overflow-x-auto lg:overflow-y-auto lg:max-h-[60vh] -mx-1 px-1">
          {cart.map((l, i) => {
            const sel = focusedKey === l.key
            return (
              <button
                key={l.key}
                onClick={() => setFocusedKey(l.key)}
                className={cn(
                  'flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-colors shrink-0 lg:shrink',
                  sel ? 'bg-primary/15' : 'hover:bg-muted'
                )}
              >
                <div className={cn(
                  'h-7 w-7 rounded-md grid place-items-center text-xs font-bold font-mono shrink-0',
                  sel ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                )}>
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate max-w-[140px]">{l.type.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">× {l.qty}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Редактор */}
      <div className="overflow-y-auto pr-1">
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
          Позиция {(cart.findIndex(l => l.key === focused.key)) + 1} из {cart.length}
        </div>
        <div className="flex items-center justify-between mt-1 gap-3">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">{focused.type.name}</h2>
          <Button
            variant="ghost" size="sm"
            onClick={() => removeLine(focused.key)}
            className="text-destructive hover:text-destructive shrink-0"
          >
            <X className="h-4 w-4 mr-1" />
            Убрать
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5 mb-5">
          Укажите детали — это поможет технологам и исключит претензии.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Количество</Label>
            <div className="inline-flex items-center bg-muted rounded-lg p-1 mt-1.5">
              <button
                onClick={() => updateLine(focused.key, { qty: Math.max(1, focused.qty - 1) })}
                className="h-9 w-9 rounded-md bg-background border grid place-items-center hover:bg-muted"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="font-mono text-xl font-bold min-w-[56px] text-center">{focused.qty}</span>
              <button
                onClick={() => updateLine(focused.key, { qty: focused.qty + 1 })}
                className="h-9 w-9 rounded-md bg-background border grid place-items-center hover:bg-muted"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {orderType !== 'carpet' && (
            <div>
              <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Размер</Label>
              <div className="flex gap-1.5 flex-wrap mt-1.5">
                {SIZES.map(s => (
                  <button
                    key={s}
                    onClick={() => updateLine(focused.key, { size: s })}
                    className={cn(
                      'h-9 min-w-[44px] px-3 rounded-md text-sm font-semibold border transition-colors',
                      focused.size === s
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {orderType === 'carpet' && (
            <>
              <div>
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Ширина (м)</Label>
                <Input
                  type="number" min={0} step={0.1}
                  placeholder="2.0"
                  value={focused.width_m}
                  onChange={e => updateLine(focused.key, { width_m: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Длина (м)</Label>
                <Input
                  type="number" min={0} step={0.1}
                  placeholder="3.0"
                  value={focused.length_m}
                  onChange={e => updateLine(focused.key, { length_m: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </>
          )}
        </div>

        {orderType === 'carpet' && (focused.width_m || focused.length_m) && (
          <div className="mb-4 p-3 rounded-lg bg-muted text-sm font-mono">
            Площадь: {((parseFloat(focused.width_m) || 0) * (parseFloat(focused.length_m) || 0)).toFixed(2)} м²
            <span className="mx-2">·</span>
            Стоимость: {formatCurrency(((parseFloat(focused.width_m) || 0) * (parseFloat(focused.length_m) || 0)) * focused.type.default_price * focused.qty)} {symbol}
          </div>
        )}

        <div className="mb-4">
          <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Цвет</Label>
          <div className="flex gap-1.5 flex-wrap mt-1.5">
            {COLOR_PALETTE.map(col => (
              <button
                key={col}
                onClick={() => updateLine(focused.key, { color: col })}
                className={cn(
                  'h-9 px-3 rounded-full text-sm border transition-colors',
                  focused.color === col
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border hover:border-primary/40'
                )}
              >
                {col}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Бренд</Label>
          <Input
            placeholder="Zara, IKEA..."
            value={focused.brand}
            onChange={e => updateLine(focused.key, { brand: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div className="mb-4">
          <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Дефекты при приёме</Label>
          <div className="flex gap-1.5 flex-wrap mt-1.5">
            {COMMON_DEFECTS.map(d => {
              const list = focused.defects.split(',').map(s => s.trim()).filter(Boolean)
              const on = list.includes(d)
              return (
                <button
                  key={d}
                  onClick={() => {
                    const next = on ? list.filter(x => x !== d) : [...list, d]
                    updateLine(focused.key, { defects: next.join(', ') })
                  }}
                  className={cn(
                    'h-9 px-3 rounded-md text-sm border transition-colors',
                    on
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 font-semibold'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  {d}
                </button>
              )
            })}
          </div>
          <Textarea
            placeholder="Дополнительно (пятно на рукаве, потёртость...)"
            value={focused.defects}
            onChange={e => updateLine(focused.key, { defects: e.target.value })}
            className="mt-2 resize-none"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Срок готовности</Label>
            <DateInput
              value={focused.ready_date}
              onChange={e => updateLine(focused.key, { ready_date: e.target.value })}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Пожелания</Label>
            <Input
              placeholder="Без отпаривания..."
              value={focused.notes}
              onChange={e => updateLine(focused.key, { notes: e.target.value })}
              className="mt-1.5"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step 4: Оплата ──────────────────────────────────────────────────────────

function Step4Payment({
  urgency, setUrgency, payment, setPayment,
  discount, setDiscount, prepayPct, setPrepayPct,
  notes, setNotes,
  orderType, pickupDate, setPickupDate, deliveryDate, setDeliveryDate,
  visitAddress, setVisitAddress,
  defaultDays, setDefaultDays,
}: {
  urgency: 'normal' | 'urgent' | 'pickup' | 'delivery'
  setUrgency: (u: 'normal' | 'urgent' | 'pickup' | 'delivery') => void
  payment: string
  setPayment: (s: string) => void
  discount: number
  setDiscount: (n: number) => void
  prepayPct: number
  setPrepayPct: (n: number) => void
  notes: string
  setNotes: (s: string) => void
  orderType: OrderType
  pickupDate: string
  setPickupDate: (s: string) => void
  deliveryDate: string
  setDeliveryDate: (s: string) => void
  visitAddress: string
  setVisitAddress: (s: string) => void
  defaultDays: number
  setDefaultDays: (n: number) => void
}) {
  const urgencyOptions = [
    { k: 'normal',   label: 'Стандарт',  sub: '3–5 дней',         icon: Clock,  color: 'text-blue-600',    accent: 'border-blue-500'    },
    { k: 'urgent',   label: 'Срочный',   sub: 'за 24 часа · +50%', icon: Zap,    color: 'text-red-600',     accent: 'border-red-500'     },
    { k: 'pickup',   label: 'Самовывоз', sub: 'бесплатно',         icon: Package, color: 'text-emerald-600', accent: 'border-emerald-500' },
    { k: 'delivery', label: 'Доставка',  sub: 'курьер',            icon: Truck,  color: 'text-violet-600',  accent: 'border-violet-500'  },
  ] as const
  const paymentOptions = [
    { k: 'cash',     label: 'Наличные' },
    { k: 'card',     label: 'Карта' },
    { k: 'transfer', label: 'Перевод' },
    { k: 'mixed',    label: 'Смешанная' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-bold tracking-tight">Оплата и завершение</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Подтвердите способ оплаты и срочность — заказ будет принят в работу.
        </p>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Срочность</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {urgencyOptions.map(u => {
            const Icon = u.icon
            const sel = urgency === u.k
            return (
              <button
                key={u.k}
                onClick={() => setUrgency(u.k as any)}
                className={cn(
                  'flex items-center gap-3 p-3 sm:p-4 rounded-xl border-2 text-left transition-colors',
                  sel ? `${u.accent} bg-muted/40` : 'border-border hover:border-primary/40'
                )}
              >
                <div className={cn('h-10 w-10 rounded-lg grid place-items-center bg-muted', u.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold text-sm sm:text-base">{u.label}</div>
                  <div className="text-xs text-muted-foreground">{u.sub}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Способ оплаты</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
          {paymentOptions.map(p => (
            <button
              key={p.k}
              onClick={() => setPayment(p.k)}
              className={cn(
                'h-12 rounded-lg border-2 text-sm font-bold transition-colors',
                payment === p.k
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/40'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 rounded-xl border bg-muted/40">
          <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Скидка</Label>
          <div className="grid grid-cols-5 gap-1 mt-2">
            {[0, 5, 10, 15, 20].map(d => (
              <button
                key={d}
                onClick={() => setDiscount(d)}
                className={cn(
                  'h-9 rounded-md text-xs font-bold font-mono border transition-colors',
                  discount === d
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:border-primary/40'
                )}
              >
                {d}%
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-xl border bg-muted/40">
          <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Предоплата</Label>
          <div className="grid grid-cols-4 gap-1 mt-2">
            {[0, 25, 50, 100].map(d => (
              <button
                key={d}
                onClick={() => setPrepayPct(d)}
                className={cn(
                  'h-9 rounded-md text-xs font-bold font-mono border transition-colors',
                  prepayPct === d
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:border-primary/40'
                )}
              >
                {d}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {orderType === 'carpet' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Дата забора</Label>
            <DateInput
              value={pickupDate}
              onChange={e => setPickupDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Дата доставки</Label>
            <DateInput
              value={deliveryDate}
              onChange={e => setDeliveryDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
      )}

      {orderType === 'furniture' && (
        <div>
          <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Адрес выезда</Label>
          <Input
            placeholder="ул. Пушкина, 10, кв. 5"
            value={visitAddress}
            onChange={e => setVisitAddress(e.target.value)}
            className="mt-1.5"
          />
        </div>
      )}

      <div>
        <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
          Срок готовности по умолчанию
        </Label>
        <div className="grid grid-cols-5 gap-2 mt-2">
          {[1, 2, 3, 5, 7].map(d => (
            <button
              key={d}
              onClick={() => setDefaultDays(d)}
              className={cn(
                'h-10 rounded-md text-sm font-bold border transition-colors',
                defaultDays === d
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/40'
              )}
            >
              {d} {d === 1 ? 'день' : 'дн'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Примечания к заказу</Label>
        <Textarea
          placeholder="Дополнительные пожелания..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="mt-1.5 resize-none"
          rows={3}
        />
      </div>
    </div>
  )
}

// ── Quick add client dialog ─────────────────────────────────────────────────

function QuickAddClientDialog({ initialName, onCreated, onClose }: {
  initialName: string
  onCreated: (c: { id: string; first_name: string; last_name?: string | null; phone?: string | null }) => void
  onClose: () => void
}) {
  const [firstName, setFirstName] = useState(initialName.split(' ')[0] ?? '')
  const [lastName, setLastName] = useState(initialName.split(' ').slice(1).join(' ') ?? '')
  const [phone, setPhone] = useState('')
  const { mutateAsync: createClient, isPending } = useCreateClient()

  async function handleCreate() {
    if (!firstName.trim()) { toast.error('Введите имя'); return }
    try {
      const created = await createClient({
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
      } as any)
      toast.success('Клиент создан')
      onCreated(created as any)
    } catch {
      toast.error('Ошибка создания клиента')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            Новый клиент
          </h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Имя *</Label>
            <Input autoFocus placeholder="Иван" value={firstName} onChange={e => setFirstName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Фамилия</Label>
            <Input placeholder="Иванов" value={lastName} onChange={e => setLastName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Телефон</Label>
            <Input type="tel" placeholder="+998 90 123-45-67" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" disabled={isPending} onClick={handleCreate}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Создать'}
          </Button>
        </div>
      </div>
    </div>
  )
}
