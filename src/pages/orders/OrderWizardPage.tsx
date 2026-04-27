import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Search, Plus, Minus, Check, X, Loader2,
  User, ShoppingBag, Tag, CreditCard, UserPlus,
  Clock, Zap, Truck, Package, Camera, Printer, CheckCircle2, Star,
} from 'lucide-react'
import { ReceiptModal, type ReceiptData } from '@/components/orders/ReceiptModal'
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
import { useCleaningClientStats } from '@/hooks/useCleaningClientStats'
import { useFavouriteItemTypes } from '@/hooks/useFavouriteItemTypes'
import { useFormDraft } from '@/hooks/useFormDraft'
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
  photos: string[]
}

const COLOR_PALETTE = [
  'Чёрный','Белый','Бежевый','Серый','Синий','Красный','Зелёный','Коричневый','Жёлтый','Розовый','Разноцвет',
]
const SIZES = ['S','M','L','XL','XXL']
import { DEFECT_MODIFIERS, defectsPctMultiplier } from '@/lib/cleaningDefects'

let keySeq = 0
function makeLine(t: CleaningItemType, readyDate: string): CartLine {
  return {
    key: ++keySeq,
    type: t,
    qty: 1,
    color: '', size: 'M', defects: '', brand: '',
    width_m: '', length_m: '', weight_kg: '', notes: '',
    ready_date: readyDate,
    photos: [],
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
  const { data: clientStats } = useCleaningClientStats(clientId)

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
  const [showFavsOnly, setShowFavsOnly] = useState(false)
  const { isFavourite, toggle: toggleFav, favs } = useFavouriteItemTypes()
  // Авто-выключение фильтра при удалении последнего избранного
  useEffect(() => {
    if (showFavsOnly && favs.size === 0) setShowFavsOnly(false)
  }, [favs.size, showFavsOnly])
  const visibleTypes = useMemo(() => {
    let arr = filteredTypes
    if (showFavsOnly) arr = arr.filter(t => favs.has(t.id))
    else if (activeSub) arr = arr.filter(t => (t.subcategory || 'Другое') === activeSub)
    if (catalogQuery) {
      const q = catalogQuery.toLowerCase()
      arr = (showFavsOnly ? arr : filteredTypes).filter(t => t.name.toLowerCase().includes(q))
    }
    return arr
  }, [filteredTypes, activeSub, catalogQuery, showFavsOnly, favs])

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
  // Custom-позиция вне каталога
  const [customDialog, setCustomDialog] = useState(false)
  function addCustomItem(name: string, price: number) {
    const fake: CleaningItemType = {
      id: `custom:${Date.now()}_${Math.random().toString(36).slice(2)}`,
      product: PRODUCT,
      name,
      category: orderType,
      subcategory: 'Своя позиция',
      default_price: price,
      default_days: defaultDays,
      sort_order: 999,
      created_at: new Date().toISOString(),
    }
    addType(fake)
    setCustomDialog(false)
  }
  function updateLine(key: number, patch: Partial<CartLine>) {
    setCart(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l))
  }
  function removeLine(key: number) {
    setCart(prev => prev.filter(l => l.key !== key))
    if (focusedKey === key) setFocusedKey(null)
  }

  // Загрузка фото
  const [photoUploadingKey, setPhotoUploadingKey] = useState<number | null>(null)
  async function uploadPhoto(key: number, file: File) {
    setPhotoUploadingKey(key)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${PRODUCT}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('cleaning-photos').upload(path, file, {
        contentType: file.type, upsert: false,
      })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('cleaning-photos').getPublicUrl(path)
      updateLine(key, { photos: [...(cart.find(l => l.key === key)?.photos ?? []), publicUrl] })
    } catch {
      toast.error('Ошибка загрузки фото')
    } finally {
      setPhotoUploadingKey(null)
    }
  }
  function removePhoto(key: number, url: string) {
    const line = cart.find(l => l.key === key)
    if (!line) return
    updateLine(key, { photos: line.photos.filter(p => p !== url) })
  }

  // Создание заказа → диалог Принят → печать
  const [createdOrder, setCreatedOrder] = useState<{ id: string; number: string } | null>(null)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)

  // Оплата
  const [isUrgent, setIsUrgent] = useState(false)
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup')
  const [payment, setPayment] = useState<string>('cash')
  const [paymentCash, setPaymentCash] = useState('')
  const [paymentCard, setPaymentCard] = useState('')
  // Срочная надбавка: % или фикс. сумма
  const [expressMode, setExpressMode] = useState<'percent' | 'fixed'>('percent')
  const [expressValue, setExpressValue] = useState<string>('50')
  const [tags, setTags] = useState<string[]>([])
  const [discount, setDiscount] = useState(0)
  const [prepayPct, setPrepayPct] = useState(0)
  const [notes, setNotes] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [visitAddress, setVisitAddress] = useState('')

  // Черновик в localStorage
  interface WizardDraft {
    cart: CartLine[]
    clientId: string | null
    clientName: string
    clientPhone: string
    orderType: OrderType
    isUrgent: boolean
    deliveryMethod: 'pickup' | 'delivery'
    payment: string
    paymentCash: string
    paymentCard: string
    expressMode: 'percent' | 'fixed'
    expressValue: string
    tags: string[]
    discount: number
    prepayPct: number
    notes: string
    pickupDate: string
    deliveryDate: string
    visitAddress: string
    defaultDays: number
    assignedTo: string | null
    step: 1 | 2 | 3 | 4
  }
  const { restored, save: saveDraft, clear: clearDraft, dismiss: dismissDraft } = useFormDraft<WizardDraft>('cleaning_wizard_draft')

  function applyDraft(d: WizardDraft) {
    setCart(d.cart || [])
    setClientId(d.clientId)
    setClientName(d.clientName || '')
    setClientPhone(d.clientPhone || '')
    setOrderType(d.orderType || 'clothing')
    setIsUrgent(!!d.isUrgent)
    setDeliveryMethod(d.deliveryMethod || 'pickup')
    setPayment(d.payment || 'cash')
    setPaymentCash(d.paymentCash || '')
    setPaymentCard(d.paymentCard || '')
    setExpressMode(d.expressMode || 'percent')
    setExpressValue(d.expressValue || '50')
    setTags(d.tags || [])
    setDiscount(d.discount || 0)
    setPrepayPct(d.prepayPct || 0)
    setNotes(d.notes || '')
    setPickupDate(d.pickupDate || '')
    setDeliveryDate(d.deliveryDate || '')
    setVisitAddress(d.visitAddress || '')
    setDefaultDays(d.defaultDays || 3)
    setAssignedTo(d.assignedTo)
    setStep(d.step || 1)
    clearDraft()
  }

  // Авто-сохранение черновика
  useEffect(() => {
    // не сохраняем пустую форму
    if (cart.length === 0 && !clientId && !notes && tags.length === 0) return
    saveDraft({
      cart, clientId, clientName, clientPhone, orderType,
      isUrgent, deliveryMethod, payment, paymentCash, paymentCard,
      expressMode, expressValue, tags, discount, prepayPct, notes,
      pickupDate, deliveryDate, visitAddress, defaultDays, assignedTo, step,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, clientId, clientName, clientPhone, orderType,
      isUrgent, deliveryMethod, payment, paymentCash, paymentCard,
      expressMode, expressValue, tags, discount, prepayPct, notes,
      pickupDate, deliveryDate, visitAddress, defaultDays, assignedTo, step])

  // Расчёты
  function lineSum(l: CartLine) {
    const mul = defectsPctMultiplier(l.defects)
    if (orderType === 'carpet') {
      const w = parseFloat(l.width_m) || 0
      const h = parseFloat(l.length_m) || 0
      const area = w * h
      if (area > 0) return area * l.type.default_price * l.qty * mul
    }
    return l.type.default_price * l.qty * mul
  }
  const subtotal = cart.reduce((s, l) => s + lineSum(l), 0)
  const surchargeAmt = isUrgent
    ? expressMode === 'percent'
      ? Math.round(subtotal * (parseFloat(expressValue) || 0) / 100)
      : (parseFloat(expressValue) || 0)
    : 0
  const discountAmt = Math.round((subtotal + surchargeAmt) * discount / 100)
  const total = Math.round(subtotal + surchargeAmt - discountAmt)
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

  // Шорткаты: Esc — назад, Ctrl/Cmd+Enter — далее/принять
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const inField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (e.key === 'Escape' && step > 1 && !inField) {
        e.preventDefault()
        setStep((step - 1) as 1 | 2 | 3 | 4)
      } else if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault()
        if (step < 4 && canNext()) setStep((step + 1) as 1 | 2 | 3 | 4)
        else if (step === 4) handleSubmit()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, cart.length])

  async function handleSubmit() {
    if (cart.length === 0) {
      toast.error('Добавьте хотя бы одну позицию')
      setStep(2)
      return
    }
    if (orderType === 'carpet') {
      const missing = cart.find(l => !(parseFloat(l.width_m) > 0) || !(parseFloat(l.length_m) > 0))
      if (missing) {
        toast.error(`Укажите размеры для «${missing.type.name}»`)
        setStep(3)
        setFocusedKey(missing.key)
        return
      }
    }
    if (orderType === 'furniture' && !visitAddress.trim()) {
      toast.error('Укажите адрес выезда')
      setStep(4)
      return
    }
    if (deliveryMethod === 'delivery' && !visitAddress.trim()) {
      toast.error('Укажите адрес доставки')
      setStep(4)
      return
    }
    if (payment === 'mixed') {
      const sum = (parseFloat(paymentCash) || 0) + (parseFloat(paymentCard) || 0)
      if (Math.abs(sum - prepayAmt) > 1) {
        toast.error(`Сумма наличные + карта (${sum}) не совпадает с предоплатой (${prepayAmt})`)
        return
      }
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
        is_express: isUrgent,
        payment_method: payment,
        payment_cash: payment === 'mixed' ? (parseFloat(paymentCash) || 0) : (payment === 'cash' ? prepayAmt : 0),
        payment_card: payment === 'mixed' ? (parseFloat(paymentCard) || 0) : (payment === 'card' ? prepayAmt : 0),
        surcharge_percent: isUrgent && expressMode === 'percent' ? (parseFloat(expressValue) || 0) : 0,
        surcharge_amount: surchargeAmt,
        tags: [
          ...tags,
          ...(isUrgent && !tags.includes('Срочно') ? ['Срочно'] : []),
          ...(deliveryMethod === 'delivery' && !tags.includes('Доставка') ? ['Доставка'] : []),
          ...(deliveryMethod === 'pickup' && !tags.includes('Самовывоз') ? ['Самовывоз'] : []),
        ],
        pickup_date: orderType === 'carpet' ? (pickupDate || null) : null,
        delivery_date: orderType === 'carpet' ? (deliveryDate || null) : null,
        visit_address: (orderType === 'furniture' || deliveryMethod === 'delivery') ? (visitAddress || null) : null,
        items: cart.flatMap(l => Array.from({ length: l.qty }, () => {
          const w = parseFloat(l.width_m) || null
          const h = parseFloat(l.length_m) || null
          const mul = defectsPctMultiplier(l.defects)
          return {
            item_type_id: l.type.id.startsWith('custom:') ? null : l.type.id,
            item_type_name: l.type.name,
            color: l.color || null,
            brand: l.brand || null,
            defects: l.defects || null,
            price: (orderType === 'carpet' && w && h ? w * h * l.type.default_price : l.type.default_price) * mul,
            ready_date: l.ready_date || null,
            width_m: orderType === 'carpet' ? w : null,
            length_m: orderType === 'carpet' ? h : null,
            area_m2: orderType === 'carpet' && w && h ? w * h : null,
            photos: l.photos,
          }
        })),
      })
      const rData: ReceiptData = {
        id: order.id,
        number: order.number,
        created_at: order.created_at,
        order_type: orderType,
        client: clientId ? {
          first_name: clientName.split(' ')[0] ?? '',
          last_name: clientName.split(' ').slice(1).join(' ') || null,
          phone: clientPhone || null,
        } : null,
        items: cart.map(l => {
          const w = parseFloat(l.width_m) || null
          const h = parseFloat(l.length_m) || null
          return {
            item_type_name: l.type.name,
            price: lineSum(l),
            ready_date: l.ready_date || null,
            color: l.color || null,
            brand: l.brand || null,
            defects: l.defects || null,
            area_m2: orderType === 'carpet' && w && h ? w * h : null,
            width_m: w,
            length_m: h,
          }
        }),
        total_amount: total,
        prepaid_amount: prepayAmt,
        notes: notes || null,
      }
      setReceiptData(rData)
      setCreatedOrder({ id: order.id, number: order.number })
      clearDraft()
      toast.success(`Заказ ${order.number} принят`)
    } catch (e: any) {
      toast.error(e.message || 'Ошибка создания заказа')
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#f5f7fb] dark:bg-background overflow-hidden">
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

      {/* ── Restore draft banner ───────────────────────────────── */}
      {restored && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 px-3 sm:px-6 py-2 flex items-center gap-3 shrink-0">
          <div className="text-sm font-semibold text-amber-900 dark:text-amber-200 flex-1">
            Найден незавершённый заказ ({restored.cart?.length || 0} позиций
            {restored.clientName ? `, клиент ${restored.clientName}` : ''})
          </div>
          <Button size="sm" variant="default" onClick={() => applyDraft(restored)} className="h-8">
            Восстановить
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { dismissDraft(); clearDraft() }} className="h-8">
            Начать заново
          </Button>
        </div>
      )}

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
              onAddCustom={() => setCustomDialog(true)}
              symbol={symbol}
              orderType={orderType}
              setOrderType={setOrderType}
              enabledOrderTypes={enabledOrderTypes}
              isFavourite={isFavourite}
              toggleFav={toggleFav}
              showFavsOnly={showFavsOnly}
              setShowFavsOnly={setShowFavsOnly}
              favsCount={favs.size}
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
              lineSum={lineSum}
              uploadPhoto={uploadPhoto}
              removePhoto={removePhoto}
              photoUploadingKey={photoUploadingKey}
            />
          )}

          {step === 4 && (
            <Step4Payment
              isUrgent={isUrgent}
              setIsUrgent={setIsUrgent}
              deliveryMethod={deliveryMethod}
              setDeliveryMethod={setDeliveryMethod}
              payment={payment}
              setPayment={setPayment}
              paymentCash={paymentCash}
              setPaymentCash={setPaymentCash}
              paymentCard={paymentCard}
              setPaymentCard={setPaymentCard}
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
              prepayAmt={prepayAmt}
              symbol={symbol}
              expressMode={expressMode}
              setExpressMode={setExpressMode}
              expressValue={expressValue}
              setExpressValue={setExpressValue}
              surchargeAmt={surchargeAmt}
              tags={tags}
              setTags={setTags}
            />
          )}
        </div>

        {/* Right rail (desktop) */}
        <div className="hidden lg:flex flex-col gap-3 w-[300px] xl:w-[340px] shrink-0">
          {/* Client card */}
          <div className="bg-background rounded-xl border p-4 shadow-sm">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Клиент</div>
            {clientId ? (
              <>
                <div className="text-base font-semibold mt-1.5 truncate">{clientName}</div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">{clientPhone || '—'}</div>
                {clientStats && clientStats.count > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Заказов</div>
                      <div className="font-mono font-bold text-sm mt-0.5">{clientStats.count}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Потрачено</div>
                      <div className="font-mono font-bold text-sm mt-0.5">{formatCurrency(clientStats.spent)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Долг</div>
                      <div className={cn(
                        'font-mono font-bold text-sm mt-0.5',
                        clientStats.unpaidAmount > 0 ? 'text-red-600' : 'text-emerald-600'
                      )}>
                        {clientStats.unpaidAmount > 0 ? formatCurrency(clientStats.unpaidAmount) : '0'}
                      </div>
                    </div>
                  </div>
                )}
                {clientStats && clientStats.count === 0 && (
                  <div className="text-[11px] text-muted-foreground mt-2">Новый клиент</div>
                )}
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
              {isUrgent && surchargeAmt > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Срочно {expressMode === 'percent' ? `+${expressValue}%` : ''}</span>
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

      {/* Custom-позиция */}
      {customDialog && (
        <CustomItemDialog
          symbol={symbol}
          onClose={() => setCustomDialog(false)}
          onConfirm={addCustomItem}
        />
      )}

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

      {/* Заказ принят → диалог печати/перехода */}
      {createdOrder && !showReceipt && (
        <OrderCreatedDialog
          orderNumber={createdOrder.number}
          onPrint={() => setShowReceipt(true)}
          onGoToOrder={() => navigate(`/orders/${createdOrder.id}`)}
          onClose={() => navigate('/orders')}
        />
      )}
      {showReceipt && receiptData && (
        <ReceiptModal
          data={receiptData}
          onClose={() => { setShowReceipt(false); navigate(`/orders/${createdOrder?.id ?? ''}`) }}
        />
      )}
    </div>
  )
}

// ── Диалог «Заказ принят» ───────────────────────────────────────────────────

function OrderCreatedDialog({ orderNumber, onPrint, onGoToOrder, onClose }: {
  orderNumber: string
  onPrint: () => void
  onGoToOrder: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4">
      <div className="bg-background rounded-2xl shadow-2xl p-6 w-full max-w-xs space-y-4 text-center">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 grid place-items-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
        </div>
        <div>
          <h3 className="font-bold text-lg">Заказ принят!</h3>
          <p className="text-muted-foreground text-sm mt-1">№ {orderNumber}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={onPrint} className="w-full">
            <Printer className="h-4 w-4 mr-1.5" />
            Печать квитанции
          </Button>
          <Button variant="outline" onClick={onGoToOrder} className="w-full">
            Открыть заказ
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full">
            К списку заказов
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Step 1: Клиент + тип заказа ─────────────────────────────────────────────

function Step1Client({
  clientQuery, setClientQuery, clients, clientId, clientName, clientPhone,
  onSelectClient, onClearClient, onAddClient,
  members, assignedTo, setAssignedTo,
}: {
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
  visibleTypes, cart, addType, onAddCustom, symbol,
  orderType, setOrderType, enabledOrderTypes,
  isFavourite, toggleFav, showFavsOnly, setShowFavsOnly, favsCount,
}: {
  subgroups: { name: string; count: number }[]
  activeSub: string | null
  setActiveSub: (s: string | null) => void
  catalogQuery: string
  setCatalogQuery: (s: string) => void
  visibleTypes: CleaningItemType[]
  cart: CartLine[]
  addType: (t: CleaningItemType) => void
  onAddCustom: () => void
  symbol: string
  orderType: OrderType
  setOrderType: (t: OrderType) => void
  enabledOrderTypes: CleaningOrderTypeConfig[]
  isFavourite: (id: string) => boolean
  toggleFav: (id: string) => void
  showFavsOnly: boolean
  setShowFavsOnly: (b: boolean) => void
  favsCount: number
}) {
  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Тип услуги — компактные пилюли */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <span className="text-[10.5px] uppercase tracking-wider font-bold text-muted-foreground">Тип:</span>
        {enabledOrderTypes.map(cfg => {
          const Icon = getOrderTypeIcon(cfg.icon)
          const sel = orderType === cfg.slug
          return (
            <button
              key={cfg.slug}
              onClick={() => setOrderType(cfg.slug)}
              className={cn(
                'flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-semibold transition-colors',
                sel ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground hover:border-primary/40'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {cfg.label}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4 lg:gap-5 flex-1 min-h-0">
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
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Найти позицию..."
              value={catalogQuery}
              onChange={e => setCatalogQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
          <button
            onClick={() => setShowFavsOnly(!showFavsOnly)}
            disabled={favsCount === 0}
            className={cn(
              'h-10 px-3 rounded-md border-2 text-sm font-semibold transition-colors flex items-center gap-1.5 shrink-0',
              showFavsOnly
                ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200'
                : 'border-border hover:border-amber-400/50 disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title={favsCount === 0 ? 'Нет избранного — добавьте звёздочкой на карточке' : 'Только избранное'}
          >
            <Star className={cn('h-4 w-4', showFavsOnly && 'fill-current')} />
            <span className="hidden sm:inline">{favsCount}</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto -mr-2 pr-2 min-h-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {/* Своя позиция вне каталога */}
            <button
              onClick={onAddCustom}
              className="relative p-3 rounded-xl border-2 border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-colors text-left flex flex-col justify-center items-center min-h-[100px] gap-1.5"
            >
              <Plus className="h-5 w-5" />
              <span className="text-sm font-semibold">Своя позиция</span>
              <span className="text-[10px] text-muted-foreground">Не из каталога</span>
            </button>
            {visibleTypes.length === 0 && (
              <div className="col-span-full text-sm text-muted-foreground italic text-center py-2">
                Нет позиций в категории — добавьте через «Своя позиция» или Справочник
              </div>
            )}
            {visibleTypes.map(t => {
              const inCart = cart.find(l => l.type.id === t.id)
              const fav = isFavourite(t.id)
              return (
                <div
                  key={t.id}
                  className={cn(
                    'relative p-3 rounded-xl border-2 transition-colors',
                    inCart ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
                  )}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFav(t.id) }}
                    className={cn(
                      'absolute top-1.5 left-1.5 p-1 rounded transition-colors',
                      fav ? 'text-amber-400' : 'text-muted-foreground/40 hover:text-amber-400'
                    )}
                    title={fav ? 'Убрать из избранного' : 'В избранное'}
                  >
                    <Star className={cn('h-3.5 w-3.5', fav && 'fill-current')} />
                  </button>
                  {inCart && (
                    <div className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold text-xs font-mono">
                      {inCart.qty}
                    </div>
                  )}
                  <button
                    onClick={() => addType(t)}
                    className="text-left w-full pt-3"
                  >
                    <div className="text-sm font-semibold leading-tight min-h-[36px]">{t.name}</div>
                    <div className="font-mono text-base font-extrabold mt-2">
                      {formatCurrency(t.default_price)} <span className="text-xs text-muted-foreground">{symbol}</span>
                    </div>
                    {t.subcategory && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{t.subcategory}</div>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

// ── Step 3: Детали позиций ──────────────────────────────────────────────────

function Step3Details({
  cart, focusedKey, setFocusedKey, updateLine, removeLine,
  orderType, symbol, lineSum,
  uploadPhoto, removePhoto, photoUploadingKey,
}: {
  cart: CartLine[]
  focusedKey: number | null
  setFocusedKey: (k: number | null) => void
  updateLine: (key: number, patch: Partial<CartLine>) => void
  removeLine: (key: number) => void
  orderType: OrderType
  symbol: string
  lineSum: (l: CartLine) => number
  uploadPhoto: (key: number, file: File) => Promise<void>
  removePhoto: (key: number, url: string) => void
  photoUploadingKey: number | null
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
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Ширина (м) *</Label>
                <Input
                  type="number" min={0} step={0.1}
                  placeholder="2.0"
                  value={focused.width_m}
                  onChange={e => updateLine(focused.key, { width_m: e.target.value })}
                  className={cn(
                    'mt-1.5',
                    !(parseFloat(focused.width_m) > 0) && 'border-red-500/60 focus-visible:ring-red-500/40'
                  )}
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Длина (м) *</Label>
                <Input
                  type="number" min={0} step={0.1}
                  placeholder="3.0"
                  value={focused.length_m}
                  onChange={e => updateLine(focused.key, { length_m: e.target.value })}
                  className={cn(
                    'mt-1.5',
                    !(parseFloat(focused.length_m) > 0) && 'border-red-500/60 focus-visible:ring-red-500/40'
                  )}
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
          <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
            Дефекты при приёме
            <span className="text-[9px] ml-2 normal-case text-muted-foreground/70 tracking-normal">
              (некоторые увеличивают цену — смотрите %)
            </span>
          </Label>
          <div className="flex gap-1.5 flex-wrap mt-1.5">
            {DEFECT_MODIFIERS.map(d => {
              const list = focused.defects.split(',').map(s => s.trim()).filter(Boolean)
              const on = list.includes(d.name)
              return (
                <button
                  key={d.id}
                  onClick={() => {
                    const next = on ? list.filter(x => x !== d.name) : [...list, d.name]
                    updateLine(focused.key, { defects: next.join(', ') })
                  }}
                  className={cn(
                    'h-9 px-3 rounded-md text-sm border transition-colors flex items-center gap-1.5',
                    on
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 font-semibold'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  {d.name}
                  {d.pct > 0 && (
                    <span className={cn('font-mono text-[10.5px]', on ? 'text-red-600' : 'text-muted-foreground')}>
                      +{d.pct}%
                    </span>
                  )}
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

        {/* Фото изделий */}
        <div className="mt-4">
          <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
            Фото изделия ({focused.photos.length})
          </Label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {focused.photos.map(url => (
              <div key={url} className="relative h-20 w-20 rounded-lg overflow-hidden border bg-muted">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => removePhoto(focused.key, url)}
                  className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80"
                  aria-label="Удалить фото"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className={cn(
              'h-20 w-20 rounded-lg border-2 border-dashed grid place-items-center cursor-pointer transition-colors',
              photoUploadingKey === focused.key
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40 hover:bg-muted'
            )}>
              {photoUploadingKey === focused.key ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <Camera className="h-5 w-5 text-muted-foreground" />
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={photoUploadingKey === focused.key}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) uploadPhoto(focused.key, file)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step 4: Оплата ──────────────────────────────────────────────────────────

function Step4Payment({
  isUrgent, setIsUrgent, deliveryMethod, setDeliveryMethod,
  payment, setPayment,
  paymentCash, setPaymentCash, paymentCard, setPaymentCard,
  discount, setDiscount, prepayPct, setPrepayPct,
  notes, setNotes,
  orderType, pickupDate, setPickupDate, deliveryDate, setDeliveryDate,
  visitAddress, setVisitAddress,
  defaultDays, setDefaultDays,
  prepayAmt, symbol,
  expressMode, setExpressMode, expressValue, setExpressValue, surchargeAmt,
  tags, setTags,
}: {
  isUrgent: boolean
  setIsUrgent: (b: boolean) => void
  deliveryMethod: 'pickup' | 'delivery'
  setDeliveryMethod: (m: 'pickup' | 'delivery') => void
  payment: string
  setPayment: (s: string) => void
  paymentCash: string
  setPaymentCash: (s: string) => void
  paymentCard: string
  setPaymentCard: (s: string) => void
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
  prepayAmt: number
  symbol: string
  expressMode: 'percent' | 'fixed'
  setExpressMode: (m: 'percent' | 'fixed') => void
  expressValue: string
  setExpressValue: (s: string) => void
  surchargeAmt: number
  tags: string[]
  setTags: (t: string[]) => void
}) {
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Срочность */}
        <div>
          <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Срочность</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={() => setIsUrgent(false)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors',
                !isUrgent ? 'border-blue-500 bg-blue-500/5' : 'border-border hover:border-primary/40'
              )}
            >
              <div className="h-10 w-10 rounded-lg grid place-items-center bg-muted text-blue-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-sm">Стандарт</div>
                <div className="text-xs text-muted-foreground">3–5 дней</div>
              </div>
            </button>
            <button
              onClick={() => setIsUrgent(true)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors',
                isUrgent ? 'border-red-500 bg-red-500/5' : 'border-border hover:border-primary/40'
              )}
            >
              <div className="h-10 w-10 rounded-lg grid place-items-center bg-muted text-red-600">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-sm">Срочный</div>
                <div className="text-xs text-muted-foreground">за 24 часа</div>
              </div>
            </button>
          </div>
        </div>

        {/* Способ выдачи */}
        <div>
          <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Способ выдачи</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={() => setDeliveryMethod('pickup')}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors',
                deliveryMethod === 'pickup' ? 'border-emerald-500 bg-emerald-500/5' : 'border-border hover:border-primary/40'
              )}
            >
              <div className="h-10 w-10 rounded-lg grid place-items-center bg-muted text-emerald-600">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-sm">Самовывоз</div>
                <div className="text-xs text-muted-foreground">бесплатно</div>
              </div>
            </button>
            <button
              onClick={() => setDeliveryMethod('delivery')}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors',
                deliveryMethod === 'delivery' ? 'border-violet-500 bg-violet-500/5' : 'border-border hover:border-primary/40'
              )}
            >
              <div className="h-10 w-10 rounded-lg grid place-items-center bg-muted text-violet-600">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-sm">Доставка</div>
                <div className="text-xs text-muted-foreground">курьер</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {(deliveryMethod === 'delivery' || orderType === 'furniture') && (
        <div>
          <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
            {orderType === 'furniture' ? 'Адрес выезда' : 'Адрес доставки'} *
          </Label>
          <Input
            placeholder="ул. Пушкина, 10, кв. 5"
            value={visitAddress}
            onChange={e => setVisitAddress(e.target.value)}
            className="mt-1.5"
          />
        </div>
      )}

      {isUrgent && (
        <div className="p-3 rounded-xl border-2 border-red-500/40 bg-red-50/40 dark:bg-red-950/20">
          <Label className="text-xs uppercase tracking-wider font-bold text-red-700 dark:text-red-300">
            Размер срочной надбавки
          </Label>
          <div className="grid grid-cols-[auto_auto_1fr] gap-2 items-center mt-2">
            <div className="inline-flex bg-background rounded-md border border-red-200 dark:border-red-900/50 p-0.5">
              <button
                onClick={() => setExpressMode('percent')}
                className={cn(
                  'h-8 px-3 rounded text-xs font-bold transition-colors',
                  expressMode === 'percent'
                    ? 'bg-red-500 text-white'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                %
              </button>
              <button
                onClick={() => setExpressMode('fixed')}
                className={cn(
                  'h-8 px-3 rounded text-xs font-bold transition-colors',
                  expressMode === 'fixed'
                    ? 'bg-red-500 text-white'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {symbol}
              </button>
            </div>
            <Input
              type="number" min={0}
              value={expressValue}
              onChange={e => setExpressValue(e.target.value)}
              className="w-24 h-9 text-sm font-mono font-bold"
            />
            <div className="font-mono text-sm text-red-700 dark:text-red-300 font-bold">
              = + {formatCurrency(surchargeAmt)} {symbol}
            </div>
          </div>
          <div className="flex gap-1.5 mt-2">
            {(['25', '50', '75', '100'] as const).map(v => (
              <button
                key={v}
                onClick={() => { setExpressMode('percent'); setExpressValue(v) }}
                className={cn(
                  'text-[11px] px-2 py-0.5 rounded border transition-colors',
                  expressMode === 'percent' && expressValue === v
                    ? 'border-red-500 bg-red-500/10 text-red-600 font-semibold'
                    : 'border-border text-muted-foreground hover:border-red-500/50'
                )}
              >
                +{v}%
              </button>
            ))}
          </div>
        </div>
      )}

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

        {payment === 'mixed' && (() => {
          const cash = parseFloat(paymentCash) || 0
          const card = parseFloat(paymentCard) || 0
          const sum = cash + card
          const diff = prepayAmt - sum
          return (
            <div className="mt-3 p-3 rounded-xl border bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Наличные ({symbol})</Label>
                  <Input
                    type="number" min={0}
                    placeholder="0"
                    value={paymentCash}
                    onChange={e => setPaymentCash(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Карта ({symbol})</Label>
                  <Input
                    type="number" min={0}
                    placeholder="0"
                    value={paymentCard}
                    onChange={e => setPaymentCard(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div className="font-mono text-xs mt-2 flex justify-between">
                <span className="text-muted-foreground">Сумма: <span className="font-bold text-foreground">{formatCurrency(sum)} {symbol}</span></span>
                {prepayAmt > 0 && (
                  <span className={diff === 0 ? 'text-emerald-600' : 'text-orange-600'}>
                    {diff === 0 ? '✓ совпадает с предоплатой' : `Не совпадает с предоплатой (${formatCurrency(prepayAmt)})`}
                  </span>
                )}
              </div>
              <div className="flex gap-1.5 mt-2">
                <button
                  onClick={() => { setPaymentCash(String(prepayAmt)); setPaymentCard('0') }}
                  className="text-[11px] text-primary hover:underline"
                >
                  Всё налично
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  onClick={() => { setPaymentCash('0'); setPaymentCard(String(prepayAmt)) }}
                  className="text-[11px] text-primary hover:underline"
                >
                  Всё картой
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  onClick={() => { const half = Math.round(prepayAmt / 2); setPaymentCash(String(half)); setPaymentCard(String(prepayAmt - half)) }}
                  className="text-[11px] text-primary hover:underline"
                >
                  50/50
                </button>
              </div>
            </div>
          )
        })()}
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
        <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Теги заказа</Label>
        <div className="flex gap-1.5 flex-wrap mt-1.5">
          {['Срочно','VIP','Повторная','Самовывоз','Доставка','С пятнами','Хрупкое'].map(tag => {
            const on = tags.includes(tag)
            return (
              <button
                key={tag}
                onClick={() => setTags(on ? tags.filter(t => t !== tag) : [...tags, tag])}
                className={cn(
                  'h-8 px-3 rounded-full text-xs border transition-colors flex items-center gap-1',
                  on
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border hover:border-primary/40'
                )}
              >
                {on && <Check className="h-3 w-3" />}
                {tag}
              </button>
            )
          })}
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
    } catch (e: any) {
      console.error('Create client error:', e)
      toast.error(e?.message || 'Ошибка создания клиента')
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

// ── Диалог «Своя позиция» ───────────────────────────────────────────────────

function CustomItemDialog({ symbol, onClose, onConfirm }: {
  symbol: string
  onClose: () => void
  onConfirm: (name: string, price: number) => void
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const valid = name.trim().length > 0 && parseFloat(price) > 0
  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Своя позиция
          </h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Название *</Label>
            <Input
              autoFocus
              placeholder="Например: Чехол для стула"
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Цена ({symbol}) *</Label>
            <Input
              type="number" min={0} step={1}
              placeholder="0"
              value={price}
              onChange={e => setPrice(e.target.value)}
              className="mt-1"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Эта позиция не сохранится в Справочнике, только в этом заказе.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button
            className="flex-1"
            disabled={!valid}
            onClick={() => onConfirm(name.trim(), parseFloat(price))}
          >
            <Check className="h-4 w-4 mr-1.5" />
            Добавить
          </Button>
        </div>
      </div>
    </div>
  )
}
