import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Search, Plus, Minus, Check, X, Loader2,
  User, ShoppingBag, Tag, CreditCard, UserPlus,
  Clock, Zap, Truck, Package, Camera, Printer, CheckCircle2, Star,
} from 'lucide-react'
import { ReceiptModal, type ReceiptData } from '@/components/orders/ReceiptModal'
import { ClientHistoryCard } from '@/components/orders/ClientHistoryCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { DateInput } from '@/components/ui/date-input'
import { toast } from '@/components/shared/Toaster'
import {
  useCreateOrder, useCleaningEnabledOrderTypes, getOrderTypeIcon, isItemAvailableForOrderType,
  type OrderType, type CleaningOrderTypeConfig, DEFAULT_ENABLED_CONFIGS,
} from '@/hooks/useCleaningOrders'
import { useCleaningItemTypes, type CleaningItemType } from '@/hooks/useCleaningItemTypes'
import { useClientsPaged, useCreateClient } from '@/hooks/useClients'
import { useCleaningClientStats } from '@/hooks/useCleaningClientStats'
import { useFavouriteItemTypes } from '@/hooks/useFavouriteItemTypes'
import { useFormDraft } from '@/hooks/useFormDraft'
import { validatePromoCode } from '@/hooks/usePromoCodes'
import { useCleaningDefaults } from '@/hooks/useCleaningDefaults'
import { useAuth } from '@/contexts/AuthContext'
import { compressDefect } from '@/lib/imageCompression'

const MAX_PHOTOS_PER_ITEM = 3
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { formatCurrency, cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import { useTranslation } from 'react-i18next'
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
  unitPrice: string
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
    unitPrice: '',
  }
}

// ── Главный компонент ───────────────────────────────────────────────────────

export function OrderWizardPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: defaults } = useCleaningDefaults()
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

  // Каталог: позиции выбранного типа + универсальные доп. услуги (extras)
  const filteredTypes = useMemo(
    () => allTypes.filter(t => isItemAvailableForOrderType(t.category, orderType)),
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
  const [customReadyDate, setCustomReadyDate] = useState('')
  const defaultReady = customReadyDate || dayjs().add(defaultDays, 'day').format('YYYY-MM-DD')
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
    const cur = cart.find(l => l.key === key)
    if ((cur?.photos.length ?? 0) >= MAX_PHOTOS_PER_ITEM) {
      toast.error(`Максимум ${MAX_PHOTOS_PER_ITEM} фото на позицию`)
      return
    }
    setPhotoUploadingKey(key)
    try {
      const compressed = await compressDefect(file)
      const path = `${PRODUCT}/${Date.now()}_${Math.random().toString(36).slice(2)}.webp`
      const { error } = await supabase.storage.from('cleaning-photos').upload(path, compressed, {
        contentType: compressed.type || 'image/webp', upsert: false,
      })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('cleaning-photos').getPublicUrl(path)
      updateLine(key, { photos: [...(cart.find(l => l.key === key)?.photos ?? []), publicUrl] })
    } catch (e: any) {
      console.error('Photo upload error:', e)
      toast.error(e?.message || 'Ошибка загрузки фото')
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
  const [deliveryFee, setDeliveryFee] = useState<string>('350')
  const [deliveryFeeTouched, setDeliveryFeeTouched] = useState(false)
  // Подтянуть дефолт из settings, если оператор не менял вручную
  useEffect(() => {
    if (!deliveryFeeTouched && defaults?.delivery_fee != null) {
      setDeliveryFee(String(defaults.delivery_fee))
    }
  }, [defaults?.delivery_fee, deliveryFeeTouched])
  const [payment, setPayment] = useState<string>('cash')
  const [paymentProvider, setPaymentProvider] = useState<string | null>(null)
  const [paymentCash, setPaymentCash] = useState('')
  const [paymentCard, setPaymentCard] = useState('')
  const [paymentAggregator, setPaymentAggregator] = useState('')
  // Срочная надбавка: % или фикс. сумма
  const [expressMode, setExpressMode] = useState<'percent' | 'fixed'>('percent')
  const [expressValue, setExpressValue] = useState<string>('50')
  const [tags, setTags] = useState<string[]>([])
  const [applyDefectsPct, setApplyDefectsPct] = useState(true)
  const [discount, setDiscount] = useState(0)
  const [markup, setMarkup] = useState(0)
  const [discMode, setDiscMode] = useState<'discount' | 'markup'>('discount')
  const [promoCode, setPromoCode] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; amount: number } | null>(null)
  const [validatingPromo, setValidatingPromo] = useState(false)
  const [prepayPct, setPrepayPct] = useState(0)
  const [customPrepayAmount, setCustomPrepayAmount] = useState('')
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
    deliveryFee: string
    payment: string
    paymentProvider?: string | null
    paymentCash: string
    paymentCard: string
    expressMode: 'percent' | 'fixed'
    expressValue: string
    tags: string[]
    applyDefectsPct: boolean
    markup: number
    promoCode: string
    appliedPromo: { code: string; amount: number } | null
    discount: number
    prepayPct: number
    customPrepayAmount?: string
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
    setDeliveryFee(d.deliveryFee || '350')
    setPayment(d.payment || 'cash')
    setPaymentProvider(d.paymentProvider ?? null)
    setPaymentCash(d.paymentCash || '')
    setPaymentCard(d.paymentCard || '')
    setExpressMode(d.expressMode || 'percent')
    setExpressValue(d.expressValue || '50')
    setTags(d.tags || [])
    setApplyDefectsPct(d.applyDefectsPct ?? true)
    setMarkup(d.markup || 0)
    setPromoCode(d.promoCode || '')
    setAppliedPromo(d.appliedPromo || null)
    setDiscount(d.discount || 0)
    setPrepayPct(d.prepayPct || 0)
    setCustomPrepayAmount(d.customPrepayAmount || '')
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
      isUrgent, deliveryMethod, deliveryFee, payment, paymentProvider, paymentCash, paymentCard,
      expressMode, expressValue, tags, applyDefectsPct, discount, prepayPct, customPrepayAmount, notes,
      pickupDate, deliveryDate, visitAddress, defaultDays, assignedTo, step,
      markup, promoCode, appliedPromo,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, clientId, clientName, clientPhone, orderType,
      isUrgent, deliveryMethod, deliveryFee, payment, paymentProvider, paymentCash, paymentCard,
      expressMode, expressValue, tags, applyDefectsPct, discount, prepayPct, customPrepayAmount, notes,
      pickupDate, deliveryDate, visitAddress, defaultDays, assignedTo, step,
      markup, promoCode, appliedPromo])

  // Расчёты
  function unitPriceOf(l: CartLine): number {
    const override = parseFloat(l.unitPrice)
    if (Number.isFinite(override) && override >= 0 && l.unitPrice !== '') return override
    return l.type.default_price
  }
  function lineSum(l: CartLine) {
    const mul = applyDefectsPct ? defectsPctMultiplier(l.defects) : 1
    const unit = unitPriceOf(l)
    if (orderType === 'carpet') {
      const w = parseFloat(l.width_m) || 0
      const h = parseFloat(l.length_m) || 0
      const area = w * h
      if (area > 0) return area * unit * l.qty * mul
    }
    return unit * l.qty * mul
  }
  const subtotal = cart.reduce((s, l) => s + lineSum(l), 0)
  const surchargeAmt = isUrgent
    ? expressMode === 'percent'
      ? Math.round(subtotal * (parseFloat(expressValue) || 0) / 100)
      : (parseFloat(expressValue) || 0)
    : 0
  const markupAmt = Math.round(subtotal * markup / 100)
  const discountAmt = Math.round((subtotal + surchargeAmt + markupAmt) * discount / 100)
  const promoAmt = appliedPromo?.amount || 0
  const deliveryAdd = deliveryMethod === 'delivery' ? (parseFloat(deliveryFee) || 0) : 0
  const total = Math.max(0, Math.round(subtotal + surchargeAmt + markupAmt - discountAmt - promoAmt + deliveryAdd))
  const prepayAmt = customPrepayAmount
    ? Math.min(total, Math.max(0, parseFloat(customPrepayAmount) || 0))
    : Math.round(total * prepayPct / 100)

  async function applyPromoCode() {
    const code = promoCode.trim().toUpperCase()
    if (!code) return
    if (!user?.id) { toast.error('Не удалось определить мастера'); return }
    if (subtotal <= 0) { toast.error('Добавьте позиции перед применением промокода'); return }
    setValidatingPromo(true)
    try {
      const res = await validatePromoCode(user.id, code, subtotal + surchargeAmt + markupAmt)
      if (!res.valid) { toast.error(res.error || 'Неверный промокод'); return }
      setAppliedPromo({ code, amount: res.discountAmount || 0 })
      setPromoCode('')
      toast.success(`Промокод применён: -${(res.discountAmount || 0).toLocaleString('ru')} ${symbol}`)
    } finally {
      setValidatingPromo(false)
    }
  }
  function removePromoCode() {
    setAppliedPromo(null)
  }

  // Шаги
  const steps: { n: 1 | 2 | 3 | 4; label: string; icon: typeof User }[] = [
    { n: 1, label: t('wizard.client', 'Клиент'), icon: User },
    { n: 2, label: t('wizard.items', 'Позиции'), icon: ShoppingBag },
    { n: 3, label: t('wizard.details', 'Детали'), icon: Tag },
    { n: 4, label: t('wizard.payment', 'Оплата'), icon: CreditCard },
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
        payment_provider: paymentProvider,
        payment_cash: payment === 'mixed' ? (parseFloat(paymentCash) || 0) : (payment === 'cash' ? prepayAmt : 0),
        payment_card: payment === 'mixed' ? (parseFloat(paymentCard) || 0) : (payment === 'card' && !paymentProvider ? prepayAmt : 0),
        payment_aggregator_amount: payment === 'mixed' ? (parseFloat(paymentAggregator) || 0) : (payment === 'card' && paymentProvider ? prepayAmt : 0),
        surcharge_percent: isUrgent && expressMode === 'percent' ? (parseFloat(expressValue) || 0) : 0,
        surcharge_amount: surchargeAmt + markupAmt,
        promo_code: appliedPromo?.code ?? null,
        promo_amount: promoAmt || 0,
        tags: [
          ...tags,
          ...(isUrgent && !tags.includes('Срочно') ? ['Срочно'] : []),
          ...(deliveryMethod === 'delivery' && !tags.includes('Доставка') ? ['Доставка'] : []),
          ...(deliveryMethod === 'pickup' && !tags.includes('Самовывоз') ? ['Самовывоз'] : []),
          ...(markup > 0 ? [`Надбавка ${markup}%`] : []),
          ...(appliedPromo ? [`Промокод ${appliedPromo.code}`] : []),
        ],
        pickup_date: (deliveryMethod === 'pickup' || orderType === 'carpet') ? (pickupDate || null) : null,
        delivery_date: (deliveryMethod === 'delivery' || orderType === 'carpet') ? (deliveryDate || null) : null,
        visit_address: (orderType === 'furniture' || deliveryMethod === 'delivery') ? (visitAddress || null) : null,
        items: cart.flatMap(l => Array.from({ length: l.qty }, () => {
          const w = parseFloat(l.width_m) || null
          const h = parseFloat(l.length_m) || null
          const mul = applyDefectsPct ? defectsPctMultiplier(l.defects) : 1
          const unit = unitPriceOf(l)
          return {
            item_type_id: l.type.id.startsWith('custom:') ? null : l.type.id,
            item_type_name: l.type.name,
            color: l.color || null,
            brand: l.brand || null,
            defects: l.defects || null,
            price: (orderType === 'carpet' && w && h ? w * h * unit : unit) * mul,
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
        subtotal,
        surcharge_amount: surchargeAmt + markupAmt,
        surcharge_label: surchargeAmt > 0 && markupAmt > 0
          ? `Срочно + Надбавка ${markup}%`
          : surchargeAmt > 0
            ? `Срочно ${expressMode === 'percent' ? `+${expressValue}%` : ''}`
            : markupAmt > 0
              ? `Надбавка +${markup}%`
              : '',
        delivery_fee: deliveryAdd,
        delivery_label: 'Доставка',
        discount_amount: discountAmt,
        discount_label: discount > 0 ? `Скидка ${discount}%` : '',
        promo_code: appliedPromo?.code,
        promo_amount: appliedPromo?.amount,
        payment_method: payment,
        payment_provider: paymentProvider,
        payment_cash: payment === 'mixed' ? (parseFloat(paymentCash) || 0) : undefined,
        payment_card: payment === 'mixed' ? (parseFloat(paymentCard) || 0) : undefined,
        payment_aggregator_amount: payment === 'mixed' ? (parseFloat(paymentAggregator) || 0) : undefined,
        ready_date: defaultReady,
        visit_address: (orderType === 'furniture' || deliveryMethod === 'delivery') ? visitAddress : null,
        tags: tags,
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
      <div className="bg-background border-b shrink-0">
        <div className="max-w-[1600px] mx-auto flex items-center gap-3 px-3 sm:px-6 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/orders')} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold text-sm">E</div>
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-semibold leading-none">{t('wizard.newOrder', 'Новый заказ')}</span>
              <span className="text-[10.5px] sm:text-xs text-muted-foreground font-mono leading-none mt-1 hidden xs:block">
                {dayjs().format('DD.MM.YYYY · HH:mm')}
              </span>
            </div>
          </div>
          <div className="flex-1" />
          <Button
            variant="outline" size="sm"
            disabled={cart.length > 0 || !!clientId}
            onClick={() => navigate('/orders/dnd')}
            className="h-8 text-xs hidden lg:inline-flex"
            title={cart.length > 0 || clientId
              ? 'Сначала очистите форму или примите заказ'
              : 'Переключиться на Drag & Drop (быстрый режим)'}
          >
            → Drag & Drop
          </Button>
          <Button
            variant="outline" size="sm"
            className="h-8 text-xs"
            onClick={() => navigate('/orders')}
          >
            <span className="hidden sm:inline">{t('common.cancel', 'Отмена')}</span>
            <X className="h-4 w-4 sm:hidden" />
          </Button>
        </div>
      </div>

      {/* ── Restore draft banner ───────────────────────────────── */}
      {restored && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 shrink-0">
          <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-2 flex items-center gap-3">
            <div className="text-sm font-semibold text-amber-900 dark:text-amber-200 flex-1">
              {t('wizard.draftFound', 'Найден незавершённый заказ')} ({restored.cart?.length || 0} {t('wizard.itemsShort', 'позиций')}
              {restored.clientName ? `, ${t('wizard.client', 'клиент').toLowerCase()} ${restored.clientName}` : ''})
            </div>
            <Button size="sm" variant="default" onClick={() => applyDraft(restored)} className="h-8">
              {t('wizard.restore', 'Восстановить')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { dismissDraft(); clearDraft() }} className="h-8">
              {t('wizard.startOver', 'Начать заново')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Progress ───────────────────────────────────────────── */}
      <div className="bg-background border-b shrink-0">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-3 flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none sm:justify-center">
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
                  'flex-1 min-w-[110px] sm:flex-none sm:min-w-0'
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
                    {t('wizard.step', 'Шаг')} {s.n}
                  </div>
                  <div className="text-sm font-semibold leading-tight mt-1 truncate">{s.label}</div>
                </div>
                <div className="text-sm font-semibold xs:hidden">{s.label}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 lg:gap-5 px-3 sm:px-6 py-3 sm:py-5 overflow-hidden min-h-0 max-w-[1600px] w-full mx-auto">

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
              removeLine={removeLine}
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
              applyDefectsPct={applyDefectsPct}
              setApplyDefectsPct={setApplyDefectsPct}
            />
          )}

          {step === 4 && (
            <Step4Payment
              isUrgent={isUrgent}
              setIsUrgent={setIsUrgent}
              deliveryMethod={deliveryMethod}
              setDeliveryMethod={setDeliveryMethod}
              deliveryFee={deliveryFee}
              setDeliveryFee={(v: string) => { setDeliveryFee(v); setDeliveryFeeTouched(true) }}
              payment={payment}
              setPayment={setPayment}
              paymentProvider={paymentProvider}
              setPaymentProvider={setPaymentProvider}
              paymentCash={paymentCash}
              setPaymentCash={setPaymentCash}
              paymentCard={paymentCard}
              setPaymentCard={setPaymentCard}
              paymentAggregator={paymentAggregator}
              setPaymentAggregator={setPaymentAggregator}
              discount={discount}
              setDiscount={setDiscount}
              prepayPct={prepayPct}
              setPrepayPct={setPrepayPct}
              customPrepayAmount={customPrepayAmount}
              setCustomPrepayAmount={setCustomPrepayAmount}
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
              customReadyDate={customReadyDate}
              setCustomReadyDate={setCustomReadyDate}
              prepayAmt={prepayAmt}
              total={total}
              symbol={symbol}
              expressMode={expressMode}
              setExpressMode={setExpressMode}
              expressValue={expressValue}
              setExpressValue={setExpressValue}
              surchargeAmt={surchargeAmt}
              tags={tags}
              setTags={setTags}
              markup={markup}
              setMarkup={setMarkup}
              discMode={discMode}
              setDiscMode={setDiscMode}
              promoCode={promoCode}
              setPromoCode={setPromoCode}
              appliedPromo={appliedPromo}
              applyPromoCode={applyPromoCode}
              removePromoCode={removePromoCode}
              validatingPromo={validatingPromo}
            />
          )}
        </div>

        {/* Right rail (desktop) */}
        <div className="hidden lg:flex flex-col gap-3 w-[300px] xl:w-[340px] shrink-0">
          {/* Client card */}
          <div className="bg-background rounded-xl border p-4 shadow-sm">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{t('wizard.client', 'Клиент')}</div>
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
                  <div className="text-[11px] text-muted-foreground mt-2">{t('wizard.newClient', 'Новый клиент')}</div>
                )}
                <ClientHistoryCard clientId={clientId} className="mt-3 pt-3 border-t" />
              </>
            ) : (
              <div className="text-sm text-muted-foreground italic mt-1.5">{t('wizard.notSelected', 'Не выбран')}</div>
            )}
          </div>

          {/* Cart summary */}
          <div className="flex-1 min-h-0 bg-background rounded-xl border shadow-sm p-4 flex flex-col">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              {t('wizard.items', 'Позиции')} · {cart.reduce((s, l) => s + l.qty, 0)} {t('wizard.pcs', 'шт')}
            </div>
            <div className="flex-1 overflow-y-auto -mr-2 pr-2 min-h-0">
              {cart.length === 0 ? (
                <div className="text-sm text-muted-foreground italic py-4 text-center">
                  {t('wizard.addItemsOnStep2', 'Добавьте позиции на шаге 2')}
                </div>
              ) : (
                cart.map(l => (
                  <div key={l.key} className="py-2 border-b last:border-0 group">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-[13px] truncate">
                        {l.type.name}
                        <span className="text-muted-foreground font-mono text-[11px] ml-1">× {l.qty}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="font-mono text-xs font-bold">
                          {formatCurrency(lineSum(l))} {symbol}
                        </div>
                        <button
                          onClick={() => removeLine(l.key)}
                          className="h-5 w-5 rounded-full grid place-items-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                          title="Удалить позицию"
                        >
                          <X className="h-3 w-3" />
                        </button>
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
                <span>{t('wizard.subtotal', 'Подытог')}</span>
                <span>{formatCurrency(subtotal)} {symbol}</span>
              </div>
              {isUrgent && surchargeAmt > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Срочно {expressMode === 'percent' ? `+${expressValue}%` : ''}</span>
                  <span>+ {formatCurrency(surchargeAmt)} {symbol}</span>
                </div>
              )}
              {markupAmt > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Надбавка +{markup}%</span>
                  <span>+ {formatCurrency(markupAmt)} {symbol}</span>
                </div>
              )}
              {deliveryAdd > 0 && (
                <div className="flex justify-between text-violet-600">
                  <span>Доставка</span>
                  <span>+ {formatCurrency(deliveryAdd)} {symbol}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Скидка {discount}%</span>
                  <span>− {formatCurrency(discountAmt)} {symbol}</span>
                </div>
              )}
              {promoAmt > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>Промокод {appliedPromo?.code}</span>
                  <span>− {formatCurrency(promoAmt)} {symbol}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between pt-2 border-t mt-2">
                <span className="font-sans font-bold text-base">{t('wizard.total', 'Итого')}</span>
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
              {t('wizard.back', 'Назад')}
            </Button>
            {step < 4 ? (
              <Button
                disabled={!canNext()}
                onClick={() => setStep((step + 1) as 1|2|3|4)}
                className="flex-1 bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white"
              >
                {t('wizard.next', 'Далее')}: {steps[step]?.label ?? ''}
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            ) : (
              <Button
                disabled={isPending || cart.length === 0}
                onClick={handleSubmit}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                {t('wizard.acceptShort', 'Принять')} · {formatCurrency(total)} {symbol}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile bottom action bar */}
      <div className="lg:hidden bg-background border-t px-3 py-2.5 flex items-center gap-2 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground leading-none">
            {cart.reduce((s, l) => s + l.qty, 0)} {t('wizard.itemsShort', 'позиций')}
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
            {t('wizard.next', 'Далее')}
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

            <div className="grid gap-2 mt-4 max-h-96 overflow-y-auto [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
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
  visibleTypes, cart, addType, removeLine, onAddCustom, symbol,
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
  removeLine: (key: number) => void
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
          <div className="grid gap-2 grid-cols-2 sm:[grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
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
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                      <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold text-xs font-mono">
                        {inCart.qty}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeLine(inCart.key) }}
                        className="h-6 w-6 rounded-full bg-red-500/90 hover:bg-red-600 text-white grid place-items-center"
                        title="Удалить из заказа"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
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
  applyDefectsPct, setApplyDefectsPct,
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
  applyDefectsPct: boolean
  setApplyDefectsPct: (b: boolean) => void
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
            <div className="flex items-center bg-muted rounded-lg p-1 mt-1.5 w-fit">
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

        {/* Цена за единицу */}
        <div className="mb-4">
          <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
            Цена за единицу ({symbol})
            {focused.type.default_price === 0 && (
              <span className="ml-2 text-[10px] normal-case text-amber-600 font-bold">
                ⚠ В справочнике 0 — укажите вручную
              </span>
            )}
          </Label>
          <div className="flex items-center gap-2 mt-1.5">
            <Input
              type="number" min={0} step={1}
              placeholder={String(focused.type.default_price || 0)}
              value={focused.unitPrice}
              onChange={e => updateLine(focused.key, { unitPrice: e.target.value })}
              className={cn(
                'w-40 font-mono font-bold text-base',
                focused.type.default_price === 0 && !focused.unitPrice && 'border-amber-500/60'
              )}
            />
            {focused.unitPrice && focused.unitPrice !== String(focused.type.default_price) && (
              <button
                onClick={() => updateLine(focused.key, { unitPrice: '' })}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Сбросить к {formatCurrency(focused.type.default_price)} {symbol}
              </button>
            )}
            {!focused.unitPrice && focused.type.default_price > 0 && (
              <span className="text-xs text-muted-foreground">из справочника</span>
            )}
          </div>
        </div>

        {orderType === 'carpet' && (focused.width_m || focused.length_m) && (
          <div className="mb-4 p-3 rounded-lg bg-muted text-sm font-mono">
            Площадь: {((parseFloat(focused.width_m) || 0) * (parseFloat(focused.length_m) || 0)).toFixed(2)} м²
            <span className="mx-2">·</span>
            Стоимость: {formatCurrency(lineSum(focused))} {symbol}
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
          <div className="flex items-center justify-between mb-1.5">
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Дефекты при приёме
            </Label>
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={applyDefectsPct}
                onChange={e => setApplyDefectsPct(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary cursor-pointer"
              />
              <span className={cn('font-semibold', applyDefectsPct ? 'text-foreground' : 'text-muted-foreground')}>
                Применять % надбавки
              </span>
            </label>
          </div>
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
                  {d.pct > 0 && applyDefectsPct && (
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
            Фото изделия ({focused.photos.length}/3)
            <span className="text-[9px] ml-2 normal-case text-muted-foreground/70 tracking-normal">
              сжимаются автоматически
            </span>
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
            {focused.photos.length < 3 && (
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
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step 4: Оплата ──────────────────────────────────────────────────────────

function Step4Payment({
  isUrgent, setIsUrgent, deliveryMethod, setDeliveryMethod,
  deliveryFee, setDeliveryFee,
  payment, setPayment, paymentProvider, setPaymentProvider,
  paymentCash, setPaymentCash, paymentCard, setPaymentCard,
  paymentAggregator, setPaymentAggregator,
  discount, setDiscount, prepayPct, setPrepayPct, customPrepayAmount, setCustomPrepayAmount,
  notes, setNotes,
  orderType, pickupDate, setPickupDate, deliveryDate, setDeliveryDate,
  visitAddress, setVisitAddress,
  defaultDays, setDefaultDays,
  customReadyDate, setCustomReadyDate,
  prepayAmt, total, symbol,
  expressMode, setExpressMode, expressValue, setExpressValue, surchargeAmt,
  tags, setTags,
  markup, setMarkup, discMode, setDiscMode,
  promoCode, setPromoCode, appliedPromo, applyPromoCode, removePromoCode, validatingPromo,
}: {
  isUrgent: boolean
  setIsUrgent: (b: boolean) => void
  deliveryMethod: 'pickup' | 'delivery'
  setDeliveryMethod: (m: 'pickup' | 'delivery') => void
  deliveryFee: string
  setDeliveryFee: (s: string) => void
  payment: string
  setPayment: (s: string) => void
  paymentProvider: string | null
  setPaymentProvider: (s: string | null) => void
  paymentCash: string
  setPaymentCash: (s: string) => void
  paymentCard: string
  setPaymentCard: (s: string) => void
  paymentAggregator: string
  setPaymentAggregator: (s: string) => void
  discount: number
  setDiscount: (n: number) => void
  prepayPct: number
  setPrepayPct: (n: number) => void
  customPrepayAmount: string
  setCustomPrepayAmount: (s: string) => void
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
  customReadyDate: string
  setCustomReadyDate: (s: string) => void
  prepayAmt: number
  total: number
  symbol: string
  expressMode: 'percent' | 'fixed'
  setExpressMode: (m: 'percent' | 'fixed') => void
  expressValue: string
  setExpressValue: (s: string) => void
  surchargeAmt: number
  tags: string[]
  setTags: (t: string[]) => void
  markup: number
  setMarkup: (n: number) => void
  discMode: 'discount' | 'markup'
  setDiscMode: (m: 'discount' | 'markup') => void
  promoCode: string
  setPromoCode: (s: string) => void
  appliedPromo: { code: string; amount: number } | null
  applyPromoCode: () => void
  removePromoCode: () => void
  validatingPromo: boolean
}) {
  const paymentOptions = [
    { k: 'cash',       label: 'Наличные' },
    { k: 'card',       label: 'Карта' },
    { k: 'transfer',   label: 'Перевод' },
    { k: 'aggregator', label: 'Click/Payme/Uzum' },
  ]

  function selectMethod(k: string) {
    if (k === 'aggregator') {
      setPayment('card')
      if (!['click','payme','uzum'].includes(paymentProvider || '')) setPaymentProvider('click')
    } else {
      setPayment(k)
      setPaymentProvider(null)
    }
  }
  function isMethodActive(k: string): boolean {
    if (k === 'aggregator') return payment === 'card' && ['click','payme','uzum'].includes(paymentProvider || '')
    if (k === 'card')       return payment === 'card' && !paymentProvider
    return payment === k
  }

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
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
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
          {deliveryMethod === 'delivery' && (
            <div>
              <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Цена доставки ({symbol})</Label>
              <Input
                type="number" min={0}
                value={deliveryFee}
                onChange={e => setDeliveryFee(e.target.value)}
                className="mt-1.5 sm:w-28 font-mono font-bold"
              />
            </div>
          )}
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
        <div className="grid grid-cols-2 gap-2 mt-2">
          {paymentOptions.map(p => (
            <button
              key={p.k}
              onClick={() => selectMethod(p.k)}
              className={cn(
                'h-10 rounded-md border-2 text-sm font-semibold transition-colors px-2',
                isMethodActive(p.k)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/40'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => selectMethod('mixed')}
          className={cn(
            'w-full h-10 rounded-md border-2 text-sm font-semibold transition-colors mt-2',
            isMethodActive('mixed')
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border hover:border-primary/40'
          )}
        >
          Смешанная (несколько способов)
        </button>

        {/* Под-выбор провайдера — только когда активен «Click/Payme/Uzum» (одиночный безнал-агрегатор) */}
        {isMethodActive('aggregator') && (
          <div className="mt-2 p-2 rounded-md border bg-muted/30">
            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">
              Какой агрегатор?
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { k: 'click', label: 'Click', cls: 'text-sky-600 border-sky-300 hover:border-sky-500' },
                { k: 'payme', label: 'Payme', cls: 'text-emerald-600 border-emerald-300 hover:border-emerald-500' },
                { k: 'uzum',  label: 'Uzum',  cls: 'text-violet-600 border-violet-300 hover:border-violet-500' },
              ].map(p => {
                const sel = paymentProvider === p.k
                return (
                  <button
                    key={p.k}
                    onClick={() => setPaymentProvider(p.k)}
                    className={cn(
                      'h-8 rounded-md border-2 text-xs font-bold transition-colors',
                      sel ? 'border-primary bg-primary text-primary-foreground' : `bg-background ${p.cls}`
                    )}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {payment === 'mixed' && (() => {
          const cash = parseFloat(paymentCash) || 0
          const card = parseFloat(paymentCard) || 0
          const aggr = parseFloat(paymentAggregator) || 0
          const sum = cash + card + aggr
          const remaining = total - sum
          return (
            <div className="mt-3 p-3 rounded-xl border bg-muted/30">
              <div className="text-[10.5px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">
                Оплачено сейчас (можно частично)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Наличными ({symbol})</Label>
                  <Input
                    type="number" min={0}
                    placeholder="0"
                    value={paymentCash}
                    onChange={e => setPaymentCash(e.target.value)}
                    className="mt-1.5 font-mono font-bold"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Картой ({symbol})</Label>
                  <Input
                    type="number" min={0}
                    placeholder="0"
                    value={paymentCard}
                    onChange={e => setPaymentCard(e.target.value)}
                    className="mt-1.5 font-mono font-bold"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                    {paymentProvider === 'click' ? 'Click' : paymentProvider === 'payme' ? 'Payme' : paymentProvider === 'uzum' ? 'Uzum' : 'Агрегатор'} ({symbol})
                  </Label>
                  <Input
                    type="number" min={0}
                    placeholder="0"
                    value={paymentAggregator}
                    onChange={e => setPaymentAggregator(e.target.value)}
                    className="mt-1.5 font-mono font-bold"
                  />
                  {aggr > 0 && (
                    <div className="grid grid-cols-3 gap-1 mt-1.5">
                      {(['click','payme','uzum'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setPaymentProvider(p)}
                          className={cn(
                            'h-7 rounded text-[11px] font-bold border-2 transition-colors capitalize',
                            paymentProvider === p
                              ? 'border-primary bg-primary text-primary-foreground'
                              : p === 'click' ? 'border-sky-300 text-sky-600 hover:border-sky-500'
                              : p === 'payme' ? 'border-emerald-300 text-emerald-600 hover:border-emerald-500'
                              : 'border-violet-300 text-violet-600 hover:border-violet-500'
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="font-mono text-xs mt-2 grid grid-cols-2 gap-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Оплачено сейчас:</span>
                  <span className="font-bold">{formatCurrency(sum)} {symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">К доплате при выдаче:</span>
                  <span className={cn('font-bold', remaining > 0 ? 'text-orange-600' : 'text-emerald-600')}>
                    {formatCurrency(Math.max(0, remaining))} {symbol}
                  </span>
                </div>
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <button
                  onClick={() => { setPaymentCash(String(prepayAmt)); setPaymentCard('0') }}
                  className="text-[11px] text-primary hover:underline"
                >
                  Всё налично ({formatCurrency(prepayAmt)})
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
                <span className="text-muted-foreground">·</span>
                <button
                  onClick={() => { setPaymentCash(String(total)); setPaymentCard('0') }}
                  className="text-[11px] text-primary hover:underline"
                >
                  Полная оплата ({formatCurrency(total)})
                </button>
              </div>
            </div>
          )
        })()}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 rounded-xl border bg-muted/40">
          <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Скидка / Надбавка</Label>
          <div className="flex bg-background rounded-md p-0.5 mt-2 border">
            <button
              onClick={() => { setDiscMode('discount'); if (markup > 0) { setDiscount(markup); setMarkup(0) } }}
              className={cn(
                'flex-1 h-8 rounded text-xs font-bold transition-colors',
                discMode === 'discount' ? 'bg-emerald-500 text-white shadow' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Скидка
            </button>
            <button
              onClick={() => { setDiscMode('markup'); if (discount > 0) { setMarkup(discount); setDiscount(0) } }}
              className={cn(
                'flex-1 h-8 rounded text-xs font-bold transition-colors',
                discMode === 'markup' ? 'bg-amber-500 text-white shadow' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Надбавка
            </button>
          </div>
          <div className="grid grid-cols-5 gap-1 mt-2">
            {[0, 5, 10, 15, 20].map(d => {
              const isMarkup = discMode === 'markup'
              const active = isMarkup ? markup === d : discount === d
              return (
                <button
                  key={d}
                  onClick={() => {
                    if (isMarkup) { setMarkup(d); setDiscount(0) }
                    else { setDiscount(d); setMarkup(0) }
                  }}
                  className={cn(
                    'h-9 rounded-md text-xs font-bold font-mono border transition-colors',
                    active
                      ? isMarkup
                        ? 'border-amber-500 bg-amber-500 text-white'
                        : 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  {isMarkup && d > 0 ? `+${d}%` : `${d}%`}
                </button>
              )
            })}
          </div>
        </div>

        <div className="p-3 rounded-xl border bg-muted/40">
          <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
            {payment === 'mixed' ? 'Предоплата' : 'Сумма сейчас'}
          </Label>

          {/* Поле произвольной суммы — для одиночных способов */}
          {payment !== 'mixed' && (
            <div className="flex gap-2 mt-2">
              <Input
                type="number" min={0} max={total}
                placeholder={`По умолчанию: ${formatCurrency(total)}`}
                value={customPrepayAmount}
                onChange={e => { setCustomPrepayAmount(e.target.value); setPrepayPct(0) }}
                className="flex-1 font-mono font-bold"
              />
              {customPrepayAmount && (
                <Button
                  size="sm" variant="ghost"
                  onClick={() => setCustomPrepayAmount('')}
                  className="px-2"
                  title="Сбросить произвольную сумму"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          <div className="grid grid-cols-4 gap-1 mt-2">
            {[0, 25, 50, 100].map(d => (
              <button
                key={d}
                onClick={() => { setPrepayPct(d); setCustomPrepayAmount('') }}
                className={cn(
                  'h-9 rounded-md text-xs font-bold font-mono border transition-colors',
                  !customPrepayAmount && prepayPct === d
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:border-primary/40'
                )}
              >
                {d}%
              </button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-1.5 font-mono">
            = {formatCurrency(prepayAmt)} {symbol}
            {prepayAmt < total && <span className="ml-2 text-orange-600">· остаток при выдаче: {formatCurrency(total - prepayAmt)} {symbol}</span>}
          </div>
        </div>

        <div className="p-3 rounded-xl border bg-muted/40">
          <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Промокод</Label>
          {appliedPromo ? (
            <div className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded-md border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30">
              <span className="font-mono text-sm font-bold text-blue-700 dark:text-blue-300 flex-1">{appliedPromo.code}</span>
              <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-300">−{formatCurrency(appliedPromo.amount)} {symbol}</span>
              <button
                onClick={removePromoCode}
                className="text-blue-700 dark:text-blue-300 hover:text-destructive p-0.5"
                title="Убрать промокод"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-2">
              <Input
                placeholder="WELCOME10"
                value={promoCode}
                onChange={e => setPromoCode(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') applyPromoCode() }}
                className="h-9 text-sm font-mono uppercase flex-1"
              />
              <Button
                onClick={applyPromoCode}
                disabled={!promoCode.trim() || validatingPromo}
                size="sm"
                className="h-9 shrink-0"
                variant="default"
              >
                {validatingPromo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Применить'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {(orderType === 'carpet' || deliveryMethod === 'pickup' || deliveryMethod === 'delivery') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(orderType === 'carpet' || deliveryMethod === 'pickup') && (
            <div>
              <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Дата забора</Label>
              <DateInput
                value={pickupDate}
                onChange={e => setPickupDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
          )}
          {(orderType === 'carpet' || deliveryMethod === 'delivery') && (
            <div>
              <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Дата доставки</Label>
              <DateInput
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
          )}
        </div>
      )}

      <div>
        <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
          Срок готовности
        </Label>
        <div className="grid grid-cols-5 gap-2 mt-2">
          {[1, 2, 3, 5, 7].map(d => (
            <button
              key={d}
              onClick={() => { setDefaultDays(d); setCustomReadyDate('') }}
              className={cn(
                'h-10 rounded-md text-sm font-bold border transition-colors',
                !customReadyDate && defaultDays === d
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/40'
              )}
            >
              {d} {d === 1 ? 'день' : 'дн'}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Label className="text-[10.5px] uppercase tracking-wider font-bold text-muted-foreground shrink-0">
            или к дате:
          </Label>
          <DateInput
            value={customReadyDate}
            onChange={e => setCustomReadyDate(e.target.value)}
            min={dayjs().format('YYYY-MM-DD')}
            className={cn('h-9 flex-1', customReadyDate && 'border-primary ring-1 ring-primary/30')}
          />
          {customReadyDate && (
            <Button
              size="sm" variant="ghost"
              onClick={() => setCustomReadyDate('')}
              className="h-9 px-2"
              title="Сбросить кастомную дату"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
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
