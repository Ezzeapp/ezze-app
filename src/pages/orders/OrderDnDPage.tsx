import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Search, Plus, Minus, X, Loader2, Check,
  GripVertical, ShoppingBag, Zap, Truck, UserPlus,
  Camera, Printer, CheckCircle2, Pencil, Star, History, ChevronUp,
  Wallet, CreditCard, ArrowRightLeft, Shuffle, Tag, ChevronDown,
  LayoutGrid, List,
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ReceiptModal, type ReceiptData } from '@/components/orders/ReceiptModal'
import { ClientHistoryCard } from '@/components/orders/ClientHistoryCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/shared/Toaster'
import {
  useCreateOrder, useCleaningEnabledOrderTypes, getOrderTypeIcon, isItemAvailableForOrderType,
  type OrderType, DEFAULT_ENABLED_CONFIGS,
} from '@/hooks/useCleaningOrders'
import { useCleaningItemTypes, type CleaningItemType } from '@/hooks/useCleaningItemTypes'
import { useClientsPaged, useCreateClient } from '@/hooks/useClients'
import { useCleaningClientStats } from '@/hooks/useCleaningClientStats'
import { useFavouriteItemTypes } from '@/hooks/useFavouriteItemTypes'
import { validatePromoCode } from '@/hooks/usePromoCodes'
import { useCleaningDefaults } from '@/hooks/useCleaningDefaults'
import { useAuth } from '@/contexts/AuthContext'
import { DEFECT_MODIFIERS, defectsPctMultiplier } from '@/lib/cleaningDefects'
import { useFormDraft } from '@/hooks/useFormDraft'
import { compressDefect } from '@/lib/imageCompression'

const MAX_PHOTOS_PER_ITEM = 3
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { formatCurrency, cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import dayjs from 'dayjs'

// ── Типы ────────────────────────────────────────────────────────────────────

type ZoneId = 'normal' | 'urgent'
type DeliveryMethod = 'pickup' | 'delivery'

interface CartLine {
  key: number
  type: CleaningItemType
  qty: number
  color: string
  size: string
  brand: string
  defects: string
  notes: string
  width_m: string
  length_m: string
  photos: string[]
  unitPrice: string  // override default_price; пустая строка = использовать дефолт
}

const COLOR_PALETTE = [
  'Чёрный','Белый','Бежевый','Серый','Синий','Красный','Зелёный','Коричневый','Жёлтый','Розовый','Разноцвет',
]
const SIZES = ['S','M','L','XL','XXL']

let keySeq = 0
function makeLine(t: CleaningItemType): CartLine {
  return {
    key: ++keySeq, type: t, qty: 1,
    color: '', size: 'M', brand: '', defects: '', notes: '',
    width_m: '', length_m: '', photos: [],
    unitPrice: '',
  }
}

// ── Главный компонент ───────────────────────────────────────────────────────

export function OrderDnDPage() {
  const navigate = useNavigate()
  const symbol = useCurrencySymbol()
  const { user } = useAuth()
  const { data: defaults } = useCleaningDefaults()

  // Mobile + узкие ноутбуки → wizard (DnD только для широких экранов 1280+)
  useEffect(() => {
    if (window.innerWidth < 1280) navigate('/orders/wizard', { replace: true })
  }, [navigate])

  const { data: enabledOrderTypes = DEFAULT_ENABLED_CONFIGS } = useCleaningEnabledOrderTypes()
  const { data: allTypes = [] } = useCleaningItemTypes()
  const { mutateAsync: createOrder, isPending } = useCreateOrder()

  // Тип заказа
  const [orderType, setOrderType] = useState<OrderType>('clothing')
  useEffect(() => {
    if (enabledOrderTypes.length && !enabledOrderTypes.find(c => c.slug === orderType)) {
      setOrderType(enabledOrderTypes[0].slug)
    }
  }, [enabledOrderTypes, orderType])

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
  const [groupSearch, setGroupSearch] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [showFavsOnly, setShowFavsOnly] = useState(false)
  const { isFavourite, toggle: toggleFav, favs } = useFavouriteItemTypes()
  useEffect(() => {
    if (showFavsOnly && favs.size === 0) setShowFavsOnly(false)
  }, [favs.size, showFavsOnly])
  const visibleSubgroups = useMemo(() => {
    if (!groupSearch) return subgroups
    const q = groupSearch.toLowerCase()
    return subgroups.filter(g => g.name.toLowerCase().includes(q))
  }, [subgroups, groupSearch])
  const visibleTypes = useMemo(() => {
    let arr = filteredTypes
    if (showFavsOnly) arr = arr.filter(t => favs.has(t.id))
    else if (activeSub && !itemSearch) arr = arr.filter(t => (t.subcategory || 'Другое') === activeSub)
    if (itemSearch) {
      const q = itemSearch.toLowerCase()
      arr = (showFavsOnly ? arr : filteredTypes).filter(t => t.name.toLowerCase().includes(q))
    }
    return arr
  }, [filteredTypes, activeSub, itemSearch, showFavsOnly, favs])

  // Клиент
  const [clientQuery, setClientQuery] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [showAddClient, setShowAddClient] = useState(false)
  const [showClientSearch, setShowClientSearch] = useState(false)
  const { data: clientsData } = useClientsPaged(clientQuery, 1, 12)
  const clients = clientsData?.items ?? []

  const { data: clientStats } = useCleaningClientStats(clientId)
  const [showClientHistory, setShowClientHistory] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showAddressModal, setShowAddressModal] = useState(false)

  // Зоны (drag & drop)
  const [zones, setZones] = useState<Record<ZoneId, CartLine[]>>({
    normal: [],
    urgent: [],
  })
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('pickup')
  const [deliveryFee, setDeliveryFee] = useState<string>('350')
  const [deliveryFeeTouched, setDeliveryFeeTouched] = useState(false)
  useEffect(() => {
    if (!deliveryFeeTouched && defaults?.delivery_fee != null) {
      setDeliveryFee(String(defaults.delivery_fee))
    }
  }, [defaults?.delivery_fee, deliveryFeeTouched])
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropHot, setDropHot] = useState<ZoneId | null>(null)
  // Активная зона для click-to-add (по умолчанию обычная)
  const [activeZone, setActiveZone] = useState<ZoneId>('normal')
  const [flashType, setFlashType] = useState<string | null>(null)

  // Шорткаты: 1/2/3 = активная зона
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const inField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (inField) return
      if (e.key === '1') { e.preventDefault(); setActiveZone('normal') }
      else if (e.key === '2') { e.preventDefault(); setActiveZone('urgent') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
  // Диалог размеров ковра при дропе
  const [carpetDialog, setCarpetDialog] = useState<{ type: CleaningItemType; zoneId: ZoneId } | null>(null)
  // Модалка деталей по клику на позицию
  const [editing, setEditing] = useState<{ zoneId: ZoneId; key: number } | null>(null)

  function dropTo(zoneId: ZoneId, typeId: string) {
    const t = filteredTypes.find(x => x.id === typeId) || allTypes.find(x => x.id === typeId)
    if (!t) return
    setDragging(null)
    setDropHot(null)
    if (orderType === 'carpet') {
      setCarpetDialog({ type: t, zoneId })
      return
    }
    setZones(z => {
      const ex = z[zoneId].find(l => l.type.id === typeId)
      if (ex) {
        return { ...z, [zoneId]: z[zoneId].map(l => l.key === ex.key ? { ...l, qty: l.qty + 1 } : l) }
      }
      return { ...z, [zoneId]: [...z[zoneId], makeLine(t)] }
    })
  }

  function addCarpetLine(zoneId: ZoneId, type: CleaningItemType, w: number, l: number) {
    const line = makeLine(type)
    line.width_m = String(w)
    line.length_m = String(l)
    setZones(z => ({ ...z, [zoneId]: [...z[zoneId], line] }))
    setCarpetDialog(null)
  }

  function bumpQty(zoneId: ZoneId, key: number, delta: number) {
    setZones(z => ({
      ...z,
      [zoneId]: z[zoneId].map(l => l.key === key ? { ...l, qty: Math.max(1, l.qty + delta) } : l),
    }))
  }
  function removeLine(zoneId: ZoneId, key: number) {
    setZones(z => ({ ...z, [zoneId]: z[zoneId].filter(l => l.key !== key) }))
  }
  function updateLine(zoneId: ZoneId, key: number, patch: Partial<CartLine>) {
    setZones(z => ({
      ...z,
      [zoneId]: z[zoneId].map(l => l.key === key ? { ...l, ...patch } : l),
    }))
  }

  // Загрузка фото для редактируемой позиции
  const [photoUploading, setPhotoUploading] = useState(false)
  async function uploadPhotoToLine(zoneId: ZoneId, key: number, file: File) {
    const cur = zones[zoneId].find(l => l.key === key)
    if ((cur?.photos.length ?? 0) >= MAX_PHOTOS_PER_ITEM) {
      toast.error(`Максимум ${MAX_PHOTOS_PER_ITEM} фото на позицию`)
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Файл слишком большой (макс. 20 МБ)')
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Можно загружать только изображения')
      return
    }
    setPhotoUploading(true)
    try {
      const compressed = await compressDefect(file)
      const path = `${PRODUCT}/${Date.now()}_${Math.random().toString(36).slice(2)}.webp`
      const { error } = await supabase.storage.from('cleaning-photos').upload(path, compressed, {
        contentType: compressed.type || 'image/webp', upsert: false,
      })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('cleaning-photos').getPublicUrl(path)
      const cur2 = zones[zoneId].find(l => l.key === key)
      if (cur2) updateLine(zoneId, key, { photos: [...cur2.photos, publicUrl] })
    } catch (e: any) {
      console.error('Photo upload error:', e)
      toast.error(e?.message || 'Ошибка загрузки фото')
    } finally {
      setPhotoUploading(false)
    }
  }

  // Custom-позиция вне каталога
  const [customDialog, setCustomDialog] = useState<ZoneId | null>(null)
  function addCustomItem(zoneId: ZoneId, name: string, price: number) {
    const fake: CleaningItemType = {
      id: `custom:${Date.now()}_${Math.random().toString(36).slice(2)}`,
      product: PRODUCT,
      name,
      category: orderType,
      subcategory: 'Своя позиция',
      default_price: price,
      default_days: 3,
      sort_order: 999,
      created_at: new Date().toISOString(),
    }
    setZones(z => ({ ...z, [zoneId]: [...z[zoneId], makeLine(fake)] }))
    setCustomDialog(null)
  }

  // Создание заказа → диалог Принят → печать
  const [createdOrder, setCreatedOrder] = useState<{ id: string; number: string } | null>(null)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)

  // Готовность: пресет в днях (1/2/3/5/7) или кастомная дата (перебивает пресет)
  const [presetDays, setPresetDays] = useState<number>(3)
  const [customReadyDate, setCustomReadyDate] = useState('')

  // Режим отображения каталога: карточки или таблица
  const [catalogView, setCatalogView] = useState<'grid' | 'list'>('grid')

  // Оплата
  const [payment, setPayment] = useState('cash')
  const [paymentProvider, setPaymentProvider] = useState<string | null>(null)
  const [paymentCash, setPaymentCash] = useState('')
  const [paymentCard, setPaymentCard] = useState('')
  const [paymentAggregator, setPaymentAggregator] = useState('')
  const [customPrepayAmount, setCustomPrepayAmount] = useState('')
  const [discount, setDiscount] = useState(0)
  const [markup, setMarkup] = useState(0)
  const [discMode, setDiscMode] = useState<'discount' | 'markup'>('discount')
  const [promoCode, setPromoCode] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; amount: number } | null>(null)
  const [validatingPromo, setValidatingPromo] = useState(false)
  const [visitAddress, setVisitAddress] = useState('')
  // Срочная надбавка — % или фикс
  const [expressMode, setExpressMode] = useState<'percent' | 'fixed'>('percent')
  const [expressValue, setExpressValue] = useState('50')
  // Тумблер: применять % надбавки от дефектов
  const [applyDefectsPct, setApplyDefectsPct] = useState(true)

  // Черновик в localStorage
  interface DnDDraft {
    zones: Record<ZoneId, CartLine[]>
    deliveryMethod: DeliveryMethod
    deliveryFee: string
    activeZone: ZoneId
    clientId: string | null
    clientName: string
    clientPhone: string
    orderType: OrderType
    payment: string
    paymentCash: string
    paymentCard: string
    discount: number
    visitAddress: string
    expressMode: 'percent' | 'fixed'
    expressValue: string
    applyDefectsPct: boolean
    markup: number
    promoCode: string
    appliedPromo: { code: string; amount: number } | null
  }
  const { restored: restoredDnD, save: saveDraft, clear: clearDraft, dismiss: dismissDraft } = useFormDraft<DnDDraft>('cleaning_dnd_draft')

  function applyDnDDraft(d: DnDDraft) {
    setZones(d.zones || { normal: [], urgent: [] })
    setDeliveryMethod(d.deliveryMethod || 'pickup')
    setDeliveryFee(d.deliveryFee || '350')
    setActiveZone(d.activeZone || 'normal')
    setClientId(d.clientId)
    setClientName(d.clientName || '')
    setClientPhone(d.clientPhone || '')
    setOrderType(d.orderType || 'clothing')
    setPayment(d.payment || 'cash')
    setPaymentCash(d.paymentCash || '')
    setPaymentCard(d.paymentCard || '')
    setDiscount(d.discount || 0)
    setVisitAddress(d.visitAddress || '')
    setExpressMode(d.expressMode || 'percent')
    setExpressValue(d.expressValue || '50')
    setApplyDefectsPct(d.applyDefectsPct ?? true)
    setMarkup(d.markup || 0)
    setPromoCode(d.promoCode || '')
    setAppliedPromo(d.appliedPromo || null)
    clearDraft()
  }

  // Авто-сохранение
  useEffect(() => {
    const allLinesCount = zones.normal.length + zones.urgent.length
    if (allLinesCount === 0 && !clientId) return
    saveDraft({
      zones, deliveryMethod, deliveryFee, activeZone,
      clientId, clientName, clientPhone, orderType,
      payment, paymentCash, paymentCard, discount, visitAddress,
      expressMode, expressValue, applyDefectsPct,
      markup, promoCode, appliedPromo,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, deliveryMethod, deliveryFee, activeZone, clientId, clientName, clientPhone, orderType,
      payment, paymentCash, paymentCard, discount, visitAddress,
      expressMode, expressValue, applyDefectsPct,
      markup, promoCode, appliedPromo])

  // Расчёты
  function unitPriceOf(l: CartLine): number {
    const override = parseFloat(l.unitPrice)
    if (Number.isFinite(override) && override >= 0 && l.unitPrice !== '') return override
    return l.type.default_price
  }
  function lineSum(l: CartLine): number {
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
  const allLines = useMemo(() => [...zones.normal, ...zones.urgent], [zones])
  const subtotal = useMemo(
    () => allLines.reduce((s, l) => s + lineSum(l), 0),
    [allLines, orderType]
  )
  const urgentTotal = useMemo(
    () => zones.urgent.reduce((s, l) => s + lineSum(l), 0),
    [zones.urgent, orderType]
  )
  const surchargeAmt = expressMode === 'percent'
    ? Math.round(urgentTotal * (parseFloat(expressValue) || 0) / 100)
    : (zones.urgent.length > 0 ? (parseFloat(expressValue) || 0) : 0)
  const markupAmt = Math.round(subtotal * markup / 100)
  const discountAmt = Math.round((subtotal + surchargeAmt + markupAmt) * discount / 100)
  const promoAmt = appliedPromo?.amount || 0
  const deliveryAdd = deliveryMethod === 'delivery' ? (parseFloat(deliveryFee) || 0) : 0
  const total = Math.max(0, subtotal + surchargeAmt + markupAmt - discountAmt - promoAmt + deliveryAdd)

  // При изменении total: если введённая сумма предоплаты больше нового total — обнулить (сбросить «прилипшее» значение).
  // Также сбрасываем mixed-поля если они стали невалидными при total=0.
  useEffect(() => {
    if (customPrepayAmount.trim() === '') return
    const n = parseFloat(String(customPrepayAmount).replace(',', '.'))
    if (!Number.isFinite(n) || n > total) setCustomPrepayAmount('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total])

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

  async function handleSubmit() {
    if (allLines.length === 0) {
      toast.error('Перетащите хотя бы одну позицию в корзину')
      return
    }
    if (orderType === 'carpet') {
      const missing = allLines.find(l => !(parseFloat(l.width_m) > 0) || !(parseFloat(l.length_m) > 0))
      if (missing) {
        // открыть редактор пропавшей позиции
        const zoneEntry = (Object.entries(zones) as [ZoneId, CartLine[]][])
          .find(([, list]) => list.some(l => l.key === missing.key))
        if (zoneEntry) setEditing({ zoneId: zoneEntry[0], key: missing.key })
        toast.error(`Укажите размеры для «${missing.type.name}»`)
        return
      }
    }
    if (orderType === 'furniture' && !visitAddress.trim()) {
      toast.error('Укажите адрес выезда (для мебели)')
      return
    }
    if (deliveryMethod === 'delivery' && !visitAddress.trim()) {
      toast.error('Укажите адрес доставки')
      return
    }
    try {
      // Каждая зона → один заказ? Нет — один заказ, но с tags для зоны.
      // Решение: сохраняем как один заказ; срочный/доставка фиксируются через is_express и tags.
      const tags: string[] = []
      if (zones.urgent.length > 0 && !tags.includes('Срочно')) tags.push('Срочно')
      if (deliveryMethod === 'delivery' && !tags.includes('Доставка')) tags.push('Доставка')
      else if (deliveryMethod === 'pickup' && !tags.includes('Самовывоз')) tags.push('Самовывоз')
      if (markup > 0) tags.push(`Надбавка ${markup}%`)
      if (appliedPromo) tags.push(`Промокод ${appliedPromo.code}`)

      const items = allLines.flatMap(l =>
        Array.from({ length: l.qty }, () => {
          const w = parseFloat(l.width_m) || null
          const h = parseFloat(l.length_m) || null
          const area = orderType === 'carpet' && w && h ? w * h : null
          const mul = applyDefectsPct ? defectsPctMultiplier(l.defects) : 1
          const unit = unitPriceOf(l)
          return {
            item_type_id: l.type.id.startsWith('custom:') ? null : l.type.id,
            item_type_name: l.type.name,
            color: l.color || null,
            brand: l.brand || null,
            defects: l.defects || null,
            price: (orderType === 'carpet' && w && h ? w * h * unit : unit) * mul,
            ready_date: dayjs().add(l.type.default_days || 3, 'day').format('YYYY-MM-DD'),
            width_m: orderType === 'carpet' ? w : null,
            length_m: orderType === 'carpet' ? h : null,
            area_m2: area,
            photos: l.photos,
          }
        })
      )
      const readyDate = customReadyDate || dayjs().add(presetDays, 'day').format('YYYY-MM-DD')
      // Сумма «оплачено сейчас» (предоплата). Для одиночного способа: customPrepayAmount или вся сумма.
      // Для Mixed: сумма всех трёх полей.
      // Парсим с заменой запятой на точку (UZ-локаль), пустую строку трактуем как «по умолчанию = total».
      const parseAmount = (v: string) => parseFloat(String(v).replace(',', '.')) || 0
      const trimmedPrepay = customPrepayAmount.trim()
      const singlePrepay = trimmedPrepay === ''
        ? total
        : Math.min(total, Math.max(0, parseAmount(trimmedPrepay)))
      const mixedSum = parseAmount(paymentCash) + parseAmount(paymentCard) + parseAmount(paymentAggregator)
      const prepayAmt = payment === 'mixed' ? mixedSum : singlePrepay
      const order = await createOrder({
        order_type: orderType,
        client_id: clientId,
        prepaid_amount: prepayAmt,
        total_amount: total,
        ready_date: readyDate,
        is_express: zones.urgent.length > 0,
        payment_method: payment,
        payment_provider: paymentProvider,
        payment_cash: payment === 'mixed' ? parseAmount(paymentCash) : (payment === 'cash' ? prepayAmt : 0),
        payment_card: payment === 'mixed' ? parseAmount(paymentCard) : (payment === 'card' && !paymentProvider ? prepayAmt : 0),
        payment_aggregator_amount: payment === 'mixed' ? parseAmount(paymentAggregator) : (payment === 'card' && paymentProvider ? prepayAmt : 0),
        surcharge_percent: zones.urgent.length > 0 && expressMode === 'percent' ? (parseFloat(expressValue) || 0) : 0,
        surcharge_amount: surchargeAmt + markupAmt,
        visit_address: (orderType === 'furniture' || deliveryMethod === 'delivery') ? (visitAddress || null) : null,
        pickup_date: deliveryMethod === 'pickup' ? dayjs().format('YYYY-MM-DD') : null,
        delivery_date: deliveryMethod === 'delivery' ? readyDate : null,
        tags,
        items,
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
        items: allLines.map(l => {
          const w = parseFloat(l.width_m) || null
          const h = parseFloat(l.length_m) || null
          return {
            item_type_name: l.type.name,
            price: lineSum(l),
            ready_date: dayjs().add(l.type.default_days || 3, 'day').format('YYYY-MM-DD'),
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
        notes: null,
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
        ready_date: readyDate,
        visit_address: (orderType === 'furniture' || deliveryMethod === 'delivery') ? visitAddress : null,
        tags: tags,
      }
      setReceiptData(rData)
      setCreatedOrder({ id: order.id, number: order.number })
      setShowPaymentModal(false)
      clearDraft()
      toast.success(`Заказ ${order.number} принят`)
    } catch (e: any) {
      toast.error(e.message || 'Ошибка создания заказа')
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#eef1f7] dark:bg-background overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-background border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/orders')} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold text-sm">E</div>
          <span className="text-base font-semibold">Приём заказа · Drag & Drop</span>
        </div>

        {/* Тип заказа в шапке */}
        <div className="flex items-center gap-1 ml-4">
          {enabledOrderTypes.map(cfg => {
            const Icon = getOrderTypeIcon(cfg.icon)
            const sel = orderType === cfg.slug
            return (
              <button
                key={cfg.slug}
                onClick={() => setOrderType(cfg.slug)}
                className={cn(
                  'flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-semibold transition-colors',
                  sel ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
                )}
              >
                <Icon className="h-4 w-4" />
                {cfg.label}
              </button>
            )
          })}
        </div>

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          disabled={zones.normal.length + zones.urgent.length > 0 || !!clientId}
          onClick={() => navigate('/orders/wizard')}
          className="h-9"
          title={zones.normal.length + zones.urgent.length > 0 || clientId
            ? 'Сначала очистите форму или примите заказ'
            : 'Переключиться на Wizard (пошаговый режим)'}
        >
          → Wizard
        </Button>
      </div>

      {/* ── Restore draft banner ──────────────────────────────── */}
      {restoredDnD && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 px-4 py-2 flex items-center gap-3 shrink-0">
          <div className="text-sm font-semibold text-amber-900 dark:text-amber-200 flex-1">
            Найден незавершённый заказ ({(restoredDnD.zones?.normal?.length || 0) + (restoredDnD.zones?.urgent?.length || 0)} позиций
            {restoredDnD.clientName ? `, клиент ${restoredDnD.clientName}` : ''})
          </div>
          <Button size="sm" onClick={() => applyDnDDraft(restoredDnD)} className="h-8">
            Восстановить
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { dismissDraft(); clearDraft() }} className="h-8">
            Начать заново
          </Button>
        </div>
      )}

      {/* ── Body — 3 колонки ──────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-[240px_1fr_minmax(360px,400px)] xl:grid-cols-[300px_1fr_minmax(380px,420px)] gap-3.5 p-3.5 overflow-hidden min-h-0">

        {/* ── Колонка 1: каталог (subgroups) ──────────────────── */}
        <div className="bg-background rounded-2xl border shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <div className="flex items-center gap-2 mb-2.5">
              <ShoppingBag className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">Каталог</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Поиск по группам..."
                value={groupSearch}
                onChange={e => setGroupSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {visibleSubgroups.length === 0 ? (
              <div className="text-xs text-muted-foreground italic text-center py-6">
                {subgroups.length === 0 ? 'Нет подгрупп. Добавьте позиции в Справочник.' : 'Группы не найдены'}
              </div>
            ) : visibleSubgroups.map(g => (
              <button
                key={g.name}
                onClick={() => setActiveSub(g.name)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors',
                  activeSub === g.name
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'hover:bg-muted'
                )}
              >
                <span className="truncate">{g.name}</span>
                <span className="font-mono text-[10.5px] text-muted-foreground bg-background px-1.5 py-0.5 rounded-full border">
                  {g.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Колонка 2: items (draggable) ───────────────────── */}
        <div className="bg-background rounded-2xl border shadow-sm flex flex-col overflow-hidden">
          <div className="p-3.5 border-b flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">{itemSearch ? `Поиск: «${itemSearch}»` : (activeSub || 'Все позиции')}</div>
              <div className="text-xs text-muted-foreground">
                {visibleTypes.length} позиций · перетащите карточку в корзину
              </div>
            </div>
            <div className="relative w-56 shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Поиск услуги в каталоге..."
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
              {itemSearch && (
                <button
                  onClick={() => setItemSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Очистить поиск"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFavsOnly(!showFavsOnly)}
              disabled={favs.size === 0}
              className={cn(
                'h-8 px-2.5 rounded-md border text-xs font-bold transition-colors flex items-center gap-1 shrink-0',
                showFavsOnly
                  ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200'
                  : 'border-border hover:border-amber-400/50 disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title={favs.size === 0 ? 'Нет избранного — добавьте звёздочкой' : 'Только избранное'}
            >
              <Star className={cn('h-3.5 w-3.5', showFavsOnly && 'fill-current')} />
              <span className="font-mono">{favs.size}</span>
            </button>
            {/* Переключатель вида каталога */}
            <div className="flex h-8 rounded-md border overflow-hidden shrink-0">
              <button
                onClick={() => setCatalogView('grid')}
                className={cn(
                  'px-2 transition-colors flex items-center justify-center',
                  catalogView === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
                )}
                title="Карточки"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setCatalogView('list')}
                className={cn(
                  'px-2 border-l transition-colors flex items-center justify-center',
                  catalogView === 'list' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
                )}
                title="Список"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {catalogView === 'grid' ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
                {/* Своя позиция → подсказка: тащите в зону или жмите кнопку зоны */}
                <button
                  onClick={() => setCustomDialog('normal')}
                  className="p-3 rounded-xl border-2 border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-colors flex flex-col justify-center items-center min-h-[100px] gap-1.5"
                  title="Добавить позицию вне каталога в обычную зону"
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-sm font-semibold">Своя позиция</span>
                  <span className="text-[10px] text-muted-foreground">Не из каталога</span>
                </button>
                {visibleTypes.length === 0 ? (
                  <div className="col-span-full text-sm text-muted-foreground italic text-center py-12">
                    Нет позиций
                  </div>
                ) : visibleTypes.map(t => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => setDragging(t.id)}
                    onDragEnd={() => { setDragging(null); setDropHot(null) }}
                    onClick={() => {
                      dropTo(activeZone, t.id)
                      setFlashType(t.id)
                      setTimeout(() => setFlashType(f => f === t.id ? null : f), 400)
                    }}
                    className={cn(
                      'p-3 rounded-xl border-[1.5px] transition-all bg-background cursor-pointer hover:cursor-grab active:cursor-grabbing',
                      dragging === t.id
                        ? 'border-primary opacity-70 scale-[0.98] shadow-lg'
                        : flashType === t.id
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 scale-[0.97]'
                          : 'border-border hover:border-primary/40 hover:shadow-sm'
                    )}
                    style={dragging === t.id ? { boxShadow: '0 10px 24px -10px rgba(37,99,235,.5)' } : undefined}
                    title={`Клик: добавить в «${activeZone === 'normal' ? 'Обычную' : activeZone === 'urgent' ? 'Срочный' : 'С доставкой'}» · Drag: в любую`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="flex items-center gap-1">
                        {t.default_days <= 1 && (
                          <span className="text-[9.5px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                            FAST
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFav(t.id) }}
                          className={cn(
                            'p-0.5 transition-colors',
                            isFavourite(t.id) ? 'text-amber-400' : 'text-muted-foreground/40 hover:text-amber-400'
                          )}
                          title={isFavourite(t.id) ? 'Убрать из избранного' : 'В избранное'}
                        >
                          <Star className={cn('h-3 w-3', isFavourite(t.id) && 'fill-current')} />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm font-semibold leading-tight min-h-[34px]">{t.name}</div>
                    <div className="flex justify-between items-baseline mt-2">
                      <span className="font-mono text-sm font-extrabold">
                        {formatCurrency(t.default_price)} <span className="text-[10px] text-muted-foreground">{symbol}</span>
                      </span>
                      {t.subcategory && (
                        <span className="font-mono text-[9px] text-muted-foreground truncate max-w-[60px]" title={t.subcategory}>
                          {t.subcategory}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr className="text-[10.5px] uppercase tracking-wider">
                      <th className="text-left px-3 py-2 font-semibold w-6"></th>
                      <th className="text-left px-2 py-2 font-semibold">Название</th>
                      <th className="text-left px-2 py-2 font-semibold hidden md:table-cell">Категория</th>
                      <th className="text-right px-2 py-2 font-semibold">Цена</th>
                      <th className="text-center px-2 py-2 font-semibold w-12">Дн</th>
                      <th className="w-10 px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Своя позиция — первой строкой */}
                    <tr
                      onClick={() => setCustomDialog('normal')}
                      className="border-t cursor-pointer hover:bg-primary/5 text-primary"
                      title="Добавить позицию вне каталога"
                    >
                      <td className="px-3 py-2"><Plus className="h-3.5 w-3.5" /></td>
                      <td className="px-2 py-2 font-semibold" colSpan={4}>Своя позиция (не из каталога)</td>
                      <td className="px-2 py-2"></td>
                    </tr>
                    {visibleTypes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-sm text-muted-foreground italic text-center py-10">
                          Нет позиций
                        </td>
                      </tr>
                    ) : visibleTypes.map(t => (
                      <tr
                        key={t.id}
                        draggable
                        onDragStart={() => setDragging(t.id)}
                        onDragEnd={() => { setDragging(null); setDropHot(null) }}
                        onClick={() => {
                          dropTo(activeZone, t.id)
                          setFlashType(t.id)
                          setTimeout(() => setFlashType(f => f === t.id ? null : f), 400)
                        }}
                        className={cn(
                          'border-t cursor-pointer hover:cursor-grab active:cursor-grabbing transition-colors',
                          dragging === t.id
                            ? 'bg-primary/10 opacity-70'
                            : flashType === t.id
                              ? 'bg-emerald-50 dark:bg-emerald-950/30'
                              : 'hover:bg-muted/40'
                        )}
                        title={`Клик: добавить в «${activeZone === 'normal' ? 'Обычную' : activeZone === 'urgent' ? 'Срочный' : 'С доставкой'}» · Drag: в любую`}
                      >
                        <td className="px-3 py-2 text-muted-foreground">
                          <GripVertical className="h-3.5 w-3.5" />
                        </td>
                        <td className="px-2 py-2 font-medium">
                          <div className="flex items-center gap-1.5">
                            <span>{t.name}</span>
                            {t.default_days <= 1 && (
                              <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                                FAST
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-[11px] text-muted-foreground hidden md:table-cell truncate max-w-[120px]" title={t.subcategory || ''}>
                          {t.subcategory || '—'}
                        </td>
                        <td className="px-2 py-2 text-right font-mono font-bold whitespace-nowrap">
                          {formatCurrency(t.default_price)} <span className="text-[10px] text-muted-foreground font-normal">{symbol}</span>
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-[11px] text-muted-foreground">
                          {t.default_days}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFav(t.id) }}
                            className={cn(
                              'p-1 transition-colors',
                              isFavourite(t.id) ? 'text-amber-400' : 'text-muted-foreground/40 hover:text-amber-400'
                            )}
                            title={isFavourite(t.id) ? 'Убрать из избранного' : 'В избранное'}
                          >
                            <Star className={cn('h-3.5 w-3.5', isFavourite(t.id) && 'fill-current')} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Колонка 3: workbench (drop zones) + totals ────── */}
        <div className="flex flex-col gap-2.5 min-h-0 overflow-hidden">

          {/* Client header */}
          <div
            className="rounded-2xl px-3.5 py-3 flex items-center gap-3 text-white shrink-0 relative"
            style={{ background: 'linear-gradient(135deg, rgb(37, 99, 235) 0%, rgb(59, 130, 246) 100%)' }}
          >
            <div className="h-9 w-9 rounded-full bg-white text-blue-600 grid place-items-center font-bold text-sm">
              {clientId
                ? clientName.split(' ').map(s => s[0]).join('').slice(0, 2)
                : <UserPlus className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0 relative" data-client-search>
              {clientId ? (
                <>
                  <div className="text-sm font-semibold truncate">{clientName}</div>
                  <div className="text-[11px] opacity-80 font-mono truncate">
                    {clientPhone}
                    {clientStats && clientStats.count > 0 && (
                      <span> · {clientStats.count} заказов · потрачено {formatCurrency(clientStats.spent)} {symbol}{clientStats.unpaidAmount > 0 && <span className="text-red-200"> · долг {formatCurrency(clientStats.unpaidAmount)}</span>}</span>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Input
                    placeholder="Поиск клиента..."
                    value={clientQuery}
                    onChange={e => { setClientQuery(e.target.value); setShowClientSearch(true) }}
                    onFocus={() => setShowClientSearch(true)}
                    className="h-8 text-xs bg-white/20 border-white/30 text-white placeholder:text-white/70 flex-1"
                  />
                  <button
                    onClick={() => { setShowClientSearch(false); setShowAddClient(true) }}
                    className="h-8 px-2 rounded border border-white/30 bg-white/10 hover:bg-white/20 text-white shrink-0 flex items-center gap-1 text-xs font-semibold"
                    title="Создать нового клиента"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Новый
                  </button>
                </div>
              )}
              {showClientSearch && !clientId && clientQuery && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background text-foreground border shadow-xl rounded-lg z-50 overflow-hidden max-h-72 overflow-y-auto">
                  {clients.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-muted-foreground text-center">Не найдено</div>
                  ) : clients.slice(0, 6).map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setClientId(c.id)
                        setClientName([c.first_name, c.last_name].filter(Boolean).join(' '))
                        setClientPhone(c.phone || '')
                        setClientQuery('')
                        setShowClientSearch(false)
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b last:border-0"
                    >
                      <div className="text-sm font-medium truncate">
                        {[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate">{c.phone || '—'}</div>
                    </button>
                  ))}
                  <button
                    onClick={() => { setShowClientSearch(false); setShowAddClient(true) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 text-primary border-t"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Создать «{clientQuery}»
                  </button>
                </div>
              )}
            </div>
            {clientId && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowClientHistory(v => !v)}
                  className={cn(
                    'h-7 w-7 grid place-items-center border border-white/30 rounded text-white hover:bg-white/10',
                    showClientHistory && 'bg-white/20'
                  )}
                  title="История клиента"
                >
                  {showClientHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <History className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => { setClientId(null); setClientName(''); setClientPhone(''); setShowClientHistory(false) }}
                  className="text-xs px-2.5 py-1 border border-white/30 rounded text-white hover:bg-white/10"
                >
                  Сменить
                </button>
              </div>
            )}
          </div>

          {/* История клиента (раскрываемая) */}
          {clientId && showClientHistory && (
            <div className="bg-background rounded-2xl border shadow-sm p-3 shrink-0">
              <ClientHistoryCard clientId={clientId} />
            </div>
          )}

          {/* Способ выдачи + адрес (свёрнутый) */}
          <div className="bg-background rounded-2xl border shadow-sm p-2.5 shrink-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground shrink-0">Выдача:</span>
              <div className="flex gap-1 flex-1">
                <button
                  onClick={() => setDeliveryMethod('pickup')}
                  className={cn(
                    'flex-1 h-7 rounded-md text-xs font-bold border transition-colors flex items-center justify-center gap-1.5',
                    deliveryMethod === 'pickup'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'border-border hover:border-emerald-500/40'
                  )}
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Самовывоз
                </button>
                <button
                  onClick={() => setDeliveryMethod('delivery')}
                  className={cn(
                    'flex-1 h-7 rounded-md text-xs font-bold border transition-colors flex items-center justify-center gap-1.5',
                    deliveryMethod === 'delivery'
                      ? 'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-400'
                      : 'border-border hover:border-violet-500/40'
                  )}
                >
                  <Truck className="h-3.5 w-3.5" />
                  Доставка
                </button>
              </div>
            </div>
            {(deliveryMethod === 'delivery' || orderType === 'furniture') && (
              <button
                onClick={() => setShowAddressModal(true)}
                className="w-full text-left text-xs px-2 py-1.5 rounded-md bg-muted/50 hover:bg-muted flex items-center gap-2 border"
              >
                <span className="shrink-0">📍</span>
                <span className="flex-1 truncate font-mono">
                  {visitAddress
                    ? `${visitAddress}${deliveryMethod === 'delivery' && deliveryFee ? ` · ${formatCurrency(parseFloat(deliveryFee) || 0)} ${symbol}` : ''}`
                    : (orderType === 'furniture' ? 'Указать адрес выезда' : 'Указать адрес доставки')}
                </span>
                <Pencil className="h-3 w-3 text-blue-600 shrink-0" />
              </button>
            )}
          </div>

          {/* Готовность: пресет 1/2/3/5/7 дн + опционально кастомная дата */}
          {(() => {
            const computedDate = customReadyDate || dayjs().add(presetDays, 'day').format('YYYY-MM-DD')
            const computedLabel = new Date(computedDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' })
            return (
              <div className="bg-background rounded-2xl border shadow-sm p-2.5 shrink-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                    Готов к
                  </Label>
                  <span className="text-[11px] font-mono font-bold text-primary capitalize">
                    {computedLabel}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[1, 2, 3, 5, 7].map(d => (
                    <button
                      key={d}
                      onClick={() => { setPresetDays(d); setCustomReadyDate('') }}
                      className={cn(
                        'h-7 rounded text-[11px] font-bold border transition-colors',
                        !customReadyDate && presetDays === d
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      )}
                      title={`${d} ${d === 1 ? 'день' : 'дн'}`}
                    >
                      {d} дн
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/70 shrink-0">
                    или дата
                  </Label>
                  <Input
                    type="date"
                    value={customReadyDate}
                    onChange={e => setCustomReadyDate(e.target.value)}
                    min={dayjs().format('YYYY-MM-DD')}
                    className={cn('h-7 flex-1 text-[11px] font-mono', customReadyDate && 'border-primary ring-1 ring-primary/30')}
                  />
                  {customReadyDate && (
                    <button
                      onClick={() => setCustomReadyDate('')}
                      className="h-7 w-7 rounded text-muted-foreground hover:text-destructive border flex items-center justify-center"
                      title="Сбросить"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Drop zones */}
          <div className="flex-1 grid grid-rows-2 gap-2.5 min-h-0 overflow-y-auto">
            <DropZone
              id="normal"
              label="Обычная приёмка"
              note="3–5 дней · стандарт"
              icon={ShoppingBag}
              accentClass="bg-blue-500/15 text-blue-600"
              borderActive="border-blue-500"
              lines={zones.normal}
              symbol={symbol}
              dropHot={dropHot === 'normal'}
              onDragOver={(e) => { e.preventDefault(); setDropHot('normal') }}
              onDragLeave={() => setDropHot(h => h === 'normal' ? null : h)}
              onDrop={() => dragging && dropTo('normal', dragging)}
              onBumpQty={(key, d) => bumpQty('normal', key, d)}
              onRemove={(key) => removeLine('normal', key)}
              onEdit={(key) => setEditing({ zoneId: 'normal', key })}
              isActive={activeZone === 'normal'}
              onActivate={() => setActiveZone('normal')}
              shortcut="1"
              onClear={() => setZones(z => ({ ...z, normal: [] }))}
              orderType={orderType}
              lineSum={lineSum}
            />
            <DropZone
              id="urgent"
              label="Срочный заказ"
              note={`24 часа · ${expressMode === 'percent' ? `+${expressValue}%` : `+${expressValue} ${symbol}`}`}
              icon={Zap}
              accentClass="bg-red-500/15 text-red-600"
              borderActive="border-red-500"
              lines={zones.urgent}
              symbol={symbol}
              dropHot={dropHot === 'urgent'}
              onDragOver={(e) => { e.preventDefault(); setDropHot('urgent') }}
              onDragLeave={() => setDropHot(h => h === 'urgent' ? null : h)}
              onDrop={() => dragging && dropTo('urgent', dragging)}
              onBumpQty={(key, d) => bumpQty('urgent', key, d)}
              onRemove={(key) => removeLine('urgent', key)}
              onEdit={(key) => setEditing({ zoneId: 'urgent', key })}
              isActive={activeZone === 'urgent'}
              onActivate={() => setActiveZone('urgent')}
              shortcut="2"
              onClear={() => setZones(z => ({ ...z, urgent: [] }))}
              orderType={orderType}
              lineSum={lineSum}
            />
          </div>

          {/* Compact totals + К оплате */}
          <div className="bg-background rounded-2xl border shadow-sm p-3 shrink-0">
            <div className="flex items-baseline justify-between font-mono">
              <span className="text-xs text-muted-foreground">Подытог · {allLines.reduce((s, l) => s + l.qty, 0)} шт</span>
              <span className="text-sm font-semibold">{formatCurrency(subtotal)} {symbol}</span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-bold text-sm">Итого</span>
              <span className="text-xl font-extrabold font-mono">{formatCurrency(total)} <span className="text-xs">{symbol}</span></span>
            </div>

            <Button
              disabled={isPending || allLines.length === 0}
              onClick={() => setShowPaymentModal(true)}
              className="w-full mt-2.5 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              К оплате →
            </Button>
          </div>
        </div>
      </div>

      {/* ═══════════ МОДАЛКА АДРЕСА ДОСТАВКИ ═══════════ */}
      {showAddressModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4"
          onClick={() => setShowAddressModal(false)}
        >
          <div
            className="bg-background rounded-2xl shadow-2xl max-w-md w-full p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">
                {orderType === 'furniture' ? 'Адрес выезда' : 'Адрес доставки'}
              </h3>
              <button
                onClick={() => setShowAddressModal(false)}
                className="h-8 w-8 grid place-items-center hover:bg-muted rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Адрес</Label>
                <Input
                  placeholder="ул. Пушкина, 10, кв. 5"
                  value={visitAddress}
                  onChange={e => setVisitAddress(e.target.value)}
                  className="mt-1.5"
                  autoFocus
                />
              </div>
              {deliveryMethod === 'delivery' && (
                <div>
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                    Цена доставки ({symbol})
                  </Label>
                  <Input
                    type="number" min={0}
                    value={deliveryFee}
                    onChange={e => { setDeliveryFee(e.target.value); setDeliveryFeeTouched(true) }}
                    className="mt-1.5 font-mono font-bold"
                  />
                </div>
              )}
            </div>
            <Button
              onClick={() => setShowAddressModal(false)}
              className="w-full mt-4 h-10 bg-primary text-primary-foreground font-bold"
            >
              Готово
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════ МОДАЛКА ОПЛАТЫ ═══════════ */}
      {showPaymentModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4"
          onClick={() => setShowPaymentModal(false)}
        >
          <div
            className="bg-background rounded-2xl shadow-2xl max-w-md w-full max-h-[92vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Заголовок */}
            <div className="px-5 py-4 border-b flex items-center gap-3 bg-muted/30">
              <div className="min-w-0">
                <h2 className="text-lg font-bold">Оплата заказа</h2>
                <p className="text-xs text-muted-foreground truncate">
                  {clientId ? clientName : 'Без клиента'} · {allLines.reduce((s, l) => s + l.qty, 0)} позиций
                </p>
              </div>
              <div className="ml-auto text-right shrink-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Итого</div>
                <div className="text-xl font-extrabold font-mono">{formatCurrency(total)} <span className="text-sm">{symbol}</span></div>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="ml-1 h-8 w-8 grid place-items-center hover:bg-muted rounded-md shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Тело — скроллируемое */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

              {/* Способы оплаты: 4 главные + 3 агрегатора */}
              {(() => {
                const isAggrActive = (provider: string) => payment === 'card' && paymentProvider === provider
                const isMethodActive = (method: string) => {
                  if (method === 'card') return payment === 'card' && !paymentProvider
                  return payment === method
                }
                const selectMethod = (k: string) => {
                  // При выходе из mixed → сбрасываем поля cash/card/aggregator (чтобы не «прилипали»).
                  // При входе в mixed → сбрасываем customPrepayAmount (он не используется).
                  if (payment === 'mixed' && k !== 'mixed') {
                    setPaymentCash('')
                    setPaymentCard('')
                    setPaymentAggregator('')
                  }
                  if (k === 'mixed') {
                    setCustomPrepayAmount('')
                  }
                  setPayment(k)
                  setPaymentProvider(null)
                }
                const selectAggregator = (provider: string) => {
                  if (payment === 'mixed') {
                    setPaymentCash('')
                    setPaymentCard('')
                    setPaymentAggregator('')
                  }
                  setPayment('card')
                  setPaymentProvider(provider)
                }
                const isMixed = payment === 'mixed'
                return (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Способ оплаты</div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { k: 'cash',     label: 'Наличные', icon: <Wallet className="h-4 w-4" /> },
                        { k: 'card',     label: 'Карта',    icon: <CreditCard className="h-4 w-4" /> },
                        { k: 'transfer', label: 'Перевод',  icon: <ArrowRightLeft className="h-4 w-4" /> },
                        { k: 'mixed',    label: 'Смешанная', icon: <Shuffle className="h-4 w-4" /> },
                      ].map(opt => (
                        <button
                          key={opt.k}
                          onClick={() => selectMethod(opt.k)}
                          className={cn(
                            'h-12 rounded-lg text-sm font-bold border-2 transition-colors flex items-center justify-center gap-1.5',
                            isMethodActive(opt.k)
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border hover:border-primary/40'
                          )}
                        >
                          {opt.icon}
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* Агрегаторы */}
                    <div className={cn(
                      'mt-2 grid grid-cols-3 gap-2 transition-opacity',
                      isMixed && 'opacity-40 pointer-events-none'
                    )}>
                      {[
                        { k: 'click', label: 'Click', cls: 'text-sky-600 border-sky-300 hover:border-sky-500' },
                        { k: 'payme', label: 'Payme', cls: 'text-emerald-600 border-emerald-300 hover:border-emerald-500' },
                        { k: 'uzum',  label: 'Uzum',  cls: 'text-violet-600 border-violet-300 hover:border-violet-500' },
                      ].map(p => {
                        const sel = isAggrActive(p.k)
                        return (
                          <button
                            key={p.k}
                            onClick={() => selectAggregator(p.k)}
                            className={cn(
                              'h-10 rounded-lg text-xs font-bold border-2 transition-colors',
                              sel ? 'border-primary bg-primary text-primary-foreground' : `bg-background ${p.cls}`
                            )}
                          >
                            {p.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Сумма к оплате сейчас (для одиночного способа) */}
              {payment !== 'mixed' && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">
                    Сумма к оплате сейчас
                  </div>
                  {(() => {
                    const fullStr = String(total)
                    const halfStr = String(Math.floor(total / 2))
                    const quarterStr = String(Math.floor(total / 4))
                    const disabledPct = total <= 0
                    const sanitizeBlur = () => {
                      if (customPrepayAmount.trim() === '') return
                      const n = parseFloat(String(customPrepayAmount).replace(',', '.'))
                      if (!Number.isFinite(n) || n <= 0) { setCustomPrepayAmount(''); return }
                      const clamped = Math.min(total, Math.max(0, n))
                      setCustomPrepayAmount(String(clamped))
                    }
                    return (
                      <div className="flex gap-1.5">
                        <Input
                          type="number" min={0} max={total}
                          placeholder={`По умолч. ${formatCurrency(total)}`}
                          value={customPrepayAmount}
                          onChange={e => setCustomPrepayAmount(e.target.value)}
                          onBlur={sanitizeBlur}
                          disabled={total <= 0}
                          className="h-9 text-sm flex-1 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setCustomPrepayAmount(fullStr)}
                          disabled={disabledPct}
                          className={cn(
                            'h-9 px-3 rounded-md border-2 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                            !disabledPct && customPrepayAmount === fullStr ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/40'
                          )}
                        >
                          Вся
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomPrepayAmount(halfStr)}
                          disabled={disabledPct}
                          className={cn(
                            'h-9 px-3 rounded-md border-2 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                            !disabledPct && customPrepayAmount === halfStr && customPrepayAmount !== fullStr ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/40'
                          )}
                        >
                          50%
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomPrepayAmount(quarterStr)}
                          disabled={disabledPct}
                          className={cn(
                            'h-9 px-3 rounded-md border-2 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                            !disabledPct && customPrepayAmount === quarterStr && customPrepayAmount !== halfStr && customPrepayAmount !== fullStr ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/40'
                          )}
                        >
                          25%
                        </button>
                      </div>
                    )
                  })()}
                  {(() => {
                    const p = parseFloat(String(customPrepayAmount).replace(',', '.'))
                    if (customPrepayAmount.trim() === '' || !Number.isFinite(p) || p <= 0 || p >= total) return null
                    return (
                      <div className="text-[11px] text-orange-600 mt-1">
                        Остаток в долг: {formatCurrency(total - p)} {symbol}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Mixed-панель: 3 строки (Наличные / Карта / Агрегатор + выбор) */}
              {payment === 'mixed' && (() => {
                const parseN = (v: string) => parseFloat(String(v).replace(',', '.')) || 0
                const sum = parseN(paymentCash) + parseN(paymentCard) + parseN(paymentAggregator)
                const ok = total > 0 && Math.abs(sum - total) < 1
                return (
                  <div className="border-2 border-blue-100 dark:border-blue-900/40 rounded-lg p-3 bg-blue-50/40 dark:bg-blue-950/20 space-y-2.5">
                    <div className="text-xs font-bold">Распределите сумму:</div>

                    <div className="flex items-center gap-2">
                      <span className="w-20 text-xs text-muted-foreground">Наличные</span>
                      <Input
                        type="number" min={0}
                        placeholder="0"
                        value={paymentCash}
                        onChange={e => setPaymentCash(e.target.value)}
                        className="h-8 text-xs flex-1 font-mono"
                      />
                      <span className="text-[11px] text-muted-foreground w-10">{symbol}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-20 text-xs text-muted-foreground">Карта</span>
                      <Input
                        type="number" min={0}
                        placeholder="0"
                        value={paymentCard}
                        onChange={e => setPaymentCard(e.target.value)}
                        className="h-8 text-xs flex-1 font-mono"
                      />
                      <span className="text-[11px] text-muted-foreground w-10">{symbol}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-20 text-xs text-muted-foreground">Агрегатор</span>
                      <Input
                        type="number" min={0}
                        placeholder="0"
                        value={paymentAggregator}
                        onChange={e => setPaymentAggregator(e.target.value)}
                        className="h-8 text-xs flex-1 font-mono"
                      />
                      <select
                        value={paymentProvider || 'click'}
                        onChange={e => setPaymentProvider(e.target.value)}
                        className="h-8 text-xs border rounded px-1 bg-background font-bold"
                        style={{ width: '74px' }}
                      >
                        <option value="click">Click</option>
                        <option value="payme">Payme</option>
                        <option value="uzum">Uzum</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-blue-200 dark:border-blue-900/40 text-xs">
                      <span className="text-muted-foreground">Введено:</span>
                      <span className={cn('font-mono font-bold', ok ? 'text-emerald-600' : 'text-orange-600')}>
                        {formatCurrency(sum)} / {formatCurrency(total)} {symbol} {ok && '✓'}
                      </span>
                    </div>
                  </div>
                )
              })()}

              {/* Скидка / Надбавка / Промокод — свёрнуто */}
              <details className="border rounded-lg group">
                <summary className="px-3 py-2 flex items-center justify-between text-sm font-medium cursor-pointer hover:bg-muted/50 select-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    Скидка / надбавка / промокод
                    {(discount > 0 || markup > 0 || appliedPromo) && (
                      <span className="text-xs font-bold">
                        {discount > 0 && <span className="text-emerald-600">−{discount}%</span>}
                        {markup > 0 && <span className="text-amber-600">+{markup}%</span>}
                        {appliedPromo && <span className="text-blue-600 ml-1">· {appliedPromo.code}</span>}
                      </span>
                    )}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-3 pb-3 pt-1 space-y-2.5">
                  <div className="flex bg-muted rounded-md p-0.5">
                    <button
                      onClick={() => { setDiscMode('discount'); if (markup > 0) { setDiscount(markup); setMarkup(0) } }}
                      className={cn(
                        'flex-1 h-7 rounded text-xs font-bold transition-colors',
                        discMode === 'discount' ? 'bg-emerald-500 text-white shadow' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Скидка
                    </button>
                    <button
                      onClick={() => { setDiscMode('markup'); if (discount > 0) { setMarkup(discount); setDiscount(0) } }}
                      className={cn(
                        'flex-1 h-7 rounded text-xs font-bold transition-colors',
                        discMode === 'markup' ? 'bg-amber-500 text-white shadow' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Надбавка
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
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
                            'h-7 rounded-md text-xs font-bold font-mono border transition-colors',
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

                  {appliedPromo ? (
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30">
                      <span className="text-[10.5px] uppercase tracking-wider font-bold text-blue-700 dark:text-blue-300 shrink-0">Промокод:</span>
                      <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-300 flex-1">{appliedPromo.code}</span>
                      <span className="font-mono text-[11px] font-bold text-blue-700 dark:text-blue-300">−{formatCurrency(appliedPromo.amount)} {symbol}</span>
                      <button
                        onClick={removePromoCode}
                        className="text-blue-700 dark:text-blue-300 hover:text-destructive p-0.5"
                        title="Убрать промокод"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Input
                        placeholder="Промокод"
                        value={promoCode}
                        onChange={e => setPromoCode(e.target.value.toUpperCase())}
                        onKeyDown={e => { if (e.key === 'Enter') applyPromoCode() }}
                        className="h-8 text-xs font-mono uppercase flex-1"
                      />
                      <button
                        onClick={applyPromoCode}
                        disabled={!promoCode.trim() || validatingPromo}
                        className={cn(
                          'h-8 px-3 rounded-md text-xs font-bold border transition-colors shrink-0',
                          promoCode.trim() && !validatingPromo
                            ? 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600'
                            : 'border-border bg-muted text-muted-foreground cursor-not-allowed'
                        )}
                      >
                        {validatingPromo ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Применить'}
                      </button>
                    </div>
                  )}
                </div>
              </details>

              {/* Срочность — видна, если есть urgent-зоны */}
              {zones.urgent.length > 0 && (
                <div className="p-2 rounded-md border border-red-500/40 bg-red-50/40 dark:bg-red-950/20">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-red-700 dark:text-red-300">Срочно:</span>
                    <div className="inline-flex bg-background rounded border border-red-200 dark:border-red-900/50 p-0.5">
                      <button
                        onClick={() => setExpressMode('percent')}
                        className={cn(
                          'h-6 px-2 rounded text-[10px] font-bold transition-colors',
                          expressMode === 'percent' ? 'bg-red-500 text-white' : 'text-muted-foreground'
                        )}
                      >%</button>
                      <button
                        onClick={() => setExpressMode('fixed')}
                        className={cn(
                          'h-6 px-2 rounded text-[10px] font-bold transition-colors',
                          expressMode === 'fixed' ? 'bg-red-500 text-white' : 'text-muted-foreground'
                        )}
                      >{symbol}</button>
                    </div>
                    <Input
                      type="number" min={0}
                      value={expressValue}
                      onChange={e => setExpressValue(e.target.value)}
                      className="h-6 w-14 text-[11px] font-mono font-bold px-1.5"
                    />
                    <span className="ml-auto font-mono text-[10.5px] text-red-700 dark:text-red-300 font-bold">
                      + {formatCurrency(surchargeAmt)} {symbol}
                    </span>
                  </div>
                </div>
              )}

              {/* Сводка цены */}
              <div className="text-xs space-y-0.5 pt-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Подытог ({allLines.reduce((s, l) => s + l.qty, 0)} шт)</span>
                  <span className="font-mono">{formatCurrency(subtotal)} {symbol}</span>
                </div>
                {surchargeAmt > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>Срочно {expressMode === 'percent' ? `+${expressValue}%` : ''}</span>
                    <span className="font-mono">+ {formatCurrency(surchargeAmt)} {symbol}</span>
                  </div>
                )}
                {markupAmt > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>Надбавка +{markup}%</span>
                    <span className="font-mono">+ {formatCurrency(markupAmt)} {symbol}</span>
                  </div>
                )}
                {deliveryAdd > 0 && (
                  <div className="flex justify-between text-violet-600">
                    <span>Доставка</span>
                    <span className="font-mono">+ {formatCurrency(deliveryAdd)} {symbol}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Скидка {discount}%</span>
                    <span className="font-mono">− {formatCurrency(discountAmt)} {symbol}</span>
                  </div>
                )}
                {promoAmt > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>Промокод {appliedPromo?.code}</span>
                    <span className="font-mono">− {formatCurrency(promoAmt)} {symbol}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t px-5 py-3 bg-muted/30 flex gap-2 shrink-0">
              <Button
                variant="outline"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 h-11"
              >
                Отмена
              </Button>
              <Button
                disabled={isPending || allLines.length === 0 || total <= 0}
                onClick={handleSubmit}
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Принять заказ · {formatCurrency(total)} {symbol}
              </Button>
            </div>
          </div>
        </div>
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

      {/* Custom-позиция */}
      {customDialog && (
        <CustomItemDialog
          symbol={symbol}
          onClose={() => setCustomDialog(null)}
          onConfirm={(name, price) => addCustomItem(customDialog, name, price)}
        />
      )}

      {/* Диалог размеров ковра при дропе */}
      {carpetDialog && (
        <CarpetSizeDialog
          typeName={carpetDialog.type.name}
          pricePerSqm={carpetDialog.type.default_price}
          symbol={symbol}
          onClose={() => setCarpetDialog(null)}
          onConfirm={(w, l) => addCarpetLine(carpetDialog.zoneId, carpetDialog.type, w, l)}
        />
      )}

      {/* Модалка деталей позиции */}
      {editing && (() => {
        const line = zones[editing.zoneId].find(l => l.key === editing.key)
        if (!line) return null
        return (
          <LineDetailsDialog
            line={line}
            orderType={orderType}
            symbol={symbol}
            photoUploading={photoUploading}
            applyDefectsPct={applyDefectsPct}
            setApplyDefectsPct={setApplyDefectsPct}
            lineSum={lineSum}
            onClose={() => setEditing(null)}
            onChange={(patch) => updateLine(editing.zoneId, editing.key, patch)}
            onUploadPhoto={(file) => uploadPhotoToLine(editing.zoneId, editing.key, file)}
          />
        )
      })()}

      {/* Заказ принят → диалог печати */}
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

// ── DropZone ────────────────────────────────────────────────────────────────

function DropZone({
  label, note, icon: Icon, accentClass, borderActive,
  lines, symbol, dropHot, orderType, lineSum,
  isActive, onActivate, shortcut, onClear,
  onDragOver, onDragLeave, onDrop, onBumpQty, onRemove, onEdit,
}: {
  id: ZoneId
  label: string
  note: string
  icon: any
  accentClass: string
  borderActive: string
  accent?: string
  lines: CartLine[]
  symbol: string
  dropHot: boolean
  orderType: OrderType
  lineSum: (l: CartLine) => number
  isActive: boolean
  onActivate: () => void
  shortcut?: string
  onClear: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: () => void
  onBumpQty: (key: number, delta: number) => void
  onRemove: (key: number) => void
  onEdit: (key: number) => void
}) {
  const total = lines.reduce((s, l) => s + lineSum(l), 0)
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'rounded-2xl border-2 p-3 flex flex-col bg-background transition-all min-h-[140px]',
        dropHot
          ? `border-dashed ${borderActive} bg-muted/30 scale-[1.01]`
          : isActive
            ? `${borderActive} shadow-md`
            : 'border-dashed border-border'
      )}
    >
      <div className="flex items-center gap-2 pb-2 border-b -mx-1 -mt-1 px-1 pt-1 rounded">
        <div
          onClick={onActivate}
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:bg-muted/40 rounded p-1 -m-1"
          title={isActive ? 'Активна — клик по услуге добавит сюда' : 'Сделать активной для click-to-add'}
        >
          <div className={cn('h-7 w-7 rounded-lg grid place-items-center shrink-0', accentClass)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold leading-none flex items-center gap-1.5">
              {label}
              {shortcut && (
                <kbd className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                  {shortcut}
                </kbd>
              )}
              {isActive && (
                <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                  ● Активна
                </span>
              )}
            </div>
            <div className="text-[10.5px] text-muted-foreground leading-none mt-1">{note}</div>
          </div>
        </div>
        <div className="font-mono text-xs font-bold">{formatCurrency(total)} {symbol}</div>
        {lines.length > 0 && (
          <button
            onClick={onClear}
            className="text-muted-foreground hover:text-destructive p-1 rounded shrink-0"
            title="Очистить зону"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="flex-1 grid place-items-center text-[11px] text-muted-foreground italic text-center py-3">
          {isActive
            ? <>Кликните по услуге слева<br />или перетащите сюда</>
            : <>Перетащите сюда позиции<br />из каталога →</>}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 mt-2 overflow-y-auto">
          {lines.map(l => {
            const hasDetails = l.color || l.defects || l.brand || l.photos.length > 0
            return (
              <div key={l.key} className="bg-muted/40 rounded-lg p-2 flex flex-col gap-1.5">
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => onEdit(l.key)}
                    className="flex-1 min-w-0 text-left hover:bg-background/50 rounded p-0.5 -m-0.5"
                    title="Редактировать детали"
                  >
                    <div className="text-xs font-semibold flex items-center gap-1.5">
                      <span className="truncate">{l.type.name}</span>
                      {l.photos.length > 0 && <Camera className="h-3 w-3 text-muted-foreground shrink-0" />}
                    </div>
                    {(hasDetails || (orderType === 'carpet' && l.width_m && l.length_m)) && (
                      <div className="text-[10px] text-muted-foreground truncate">
                        {orderType === 'carpet' && l.width_m && l.length_m ? `${l.width_m}×${l.length_m} м · ` : ''}
                        {[l.color, l.brand, l.defects].filter(Boolean).join(' · ').slice(0, 60)}
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => onRemove(l.key)}
                    className="text-muted-foreground hover:text-destructive p-1 shrink-0"
                    title="Удалить позицию"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-background rounded border">
                    <button
                      onClick={() => onBumpQty(l.key, -1)}
                      className="px-2 py-0.5 text-muted-foreground hover:text-foreground"
                      title="Уменьшить"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="font-mono text-[11px] font-bold w-6 text-center">{l.qty}</span>
                    <button
                      onClick={() => onBumpQty(l.key, 1)}
                      className="px-2 py-0.5 text-muted-foreground hover:text-foreground"
                      title="Увеличить"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => onEdit(l.key)}
                    className="text-muted-foreground hover:text-primary p-1"
                    title="Редактировать детали"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <span className="ml-auto font-mono text-xs font-bold">
                    {formatCurrency(lineSum(l))} {symbol}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
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
            <label className="text-xs font-semibold">Имя *</label>
            <Input autoFocus placeholder="Иван" value={firstName} onChange={e => setFirstName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold">Фамилия</label>
            <Input placeholder="Иванов" value={lastName} onChange={e => setLastName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold">Телефон</label>
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

// ── Диалог размеров ковра ───────────────────────────────────────────────────

function CarpetSizeDialog({ typeName, pricePerSqm, symbol, onConfirm, onClose }: {
  typeName: string
  pricePerSqm: number
  symbol: string
  onConfirm: (w: number, l: number) => void
  onClose: () => void
}) {
  const [w, setW] = useState('')
  const [l, setL] = useState('')
  const area = (parseFloat(w) || 0) * (parseFloat(l) || 0)
  const total = area * pricePerSqm

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">{typeName}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Ширина (м)</Label>
            <Input
              autoFocus type="number" min={0} step={0.1}
              placeholder="2.0" value={w}
              onChange={e => setW(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Длина (м)</Label>
            <Input
              type="number" min={0} step={0.1}
              placeholder="3.0" value={l}
              onChange={e => setL(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        {area > 0 && (
          <div className="rounded-lg bg-muted p-3 space-y-1 text-sm font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Площадь</span>
              <span className="font-bold">{area.toFixed(2)} м²</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Тариф</span>
              <span>{formatCurrency(pricePerSqm)} {symbol}/м²</span>
            </div>
            <div className="flex justify-between border-t pt-1.5 mt-1">
              <span className="font-bold">Итого</span>
              <span className="font-bold">{formatCurrency(total)} {symbol}</span>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button
            className="flex-1"
            disabled={area <= 0}
            onClick={() => onConfirm(parseFloat(w), parseFloat(l))}
          >
            Добавить
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Модалка деталей позиции (DnD) ───────────────────────────────────────────

function LineDetailsDialog({
  line, orderType, symbol, photoUploading,
  applyDefectsPct, setApplyDefectsPct, lineSum,
  onClose, onChange, onUploadPhoto,
}: {
  line: CartLine
  orderType: OrderType
  symbol: string
  photoUploading: boolean
  applyDefectsPct: boolean
  setApplyDefectsPct: (b: boolean) => void
  lineSum: (l: CartLine) => number
  onClose: () => void
  onChange: (patch: Partial<CartLine>) => void
  onUploadPhoto: (file: File) => void
}) {
  const sum = lineSum(line)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-background z-10">
          <div>
            <div className="text-[10.5px] uppercase tracking-wider font-bold text-muted-foreground">Детали позиции</div>
            <h3 className="font-bold text-lg mt-0.5">{line.type.name}</h3>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Количество и размер */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Количество</Label>
              <div className="flex items-center bg-muted rounded-lg p-1 mt-1.5 w-fit">
                <button
                  onClick={() => onChange({ qty: Math.max(1, line.qty - 1) })}
                  className="h-9 w-9 rounded-md bg-background border grid place-items-center hover:bg-muted"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="font-mono text-xl font-bold min-w-[56px] text-center">{line.qty}</span>
                <button
                  onClick={() => onChange({ qty: line.qty + 1 })}
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
                      onClick={() => onChange({ size: s })}
                      className={cn(
                        'h-9 min-w-[44px] px-3 rounded-md text-sm font-semibold border transition-colors',
                        line.size === s
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
          </div>

          {/* Цена за единицу */}
          <div>
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Цена за единицу ({symbol})
              {line.type.default_price === 0 && (
                <span className="ml-2 text-[10px] normal-case text-amber-600 font-bold">
                  ⚠ В справочнике 0 — укажите вручную
                </span>
              )}
            </Label>
            <div className="flex items-center gap-2 mt-1.5">
              <Input
                type="number" min={0} step={1}
                placeholder={String(line.type.default_price || 0)}
                value={line.unitPrice}
                onChange={e => onChange({ unitPrice: e.target.value })}
                className={cn(
                  'w-40 font-mono font-bold text-base',
                  line.type.default_price === 0 && !line.unitPrice && 'border-amber-500/60'
                )}
              />
              {line.unitPrice && line.unitPrice !== String(line.type.default_price) && (
                <button
                  onClick={() => onChange({ unitPrice: '' })}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Сбросить к {formatCurrency(line.type.default_price)} {symbol}
                </button>
              )}
              {!line.unitPrice && line.type.default_price > 0 && (
                <span className="text-xs text-muted-foreground">из справочника</span>
              )}
            </div>
          </div>

          {/* Размеры ковра */}
          {orderType === 'carpet' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Ширина (м)</Label>
                <Input
                  type="number" min={0} step={0.1}
                  value={line.width_m}
                  onChange={e => onChange({ width_m: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Длина (м)</Label>
                <Input
                  type="number" min={0} step={0.1}
                  value={line.length_m}
                  onChange={e => onChange({ length_m: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Площадь</Label>
                <div className="mt-1.5 h-9 px-3 flex items-center rounded-md border bg-muted text-sm font-mono font-bold">
                  {((parseFloat(line.width_m) || 0) * (parseFloat(line.length_m) || 0)).toFixed(2)} м²
                </div>
              </div>
            </div>
          )}

          {/* Цвет */}
          <div>
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Цвет</Label>
            <div className="flex gap-1.5 flex-wrap mt-1.5">
              {COLOR_PALETTE.map(col => (
                <button
                  key={col}
                  onClick={() => onChange({ color: col })}
                  className={cn(
                    'h-8 px-3 rounded-full text-xs border transition-colors',
                    line.color === col
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  {col}
                </button>
              ))}
            </div>
          </div>

          {/* Бренд */}
          <div>
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Бренд</Label>
            <Input
              placeholder="Zara, IKEA..."
              value={line.brand}
              onChange={e => onChange({ brand: e.target.value })}
              className="mt-1.5"
            />
          </div>

          {/* Дефекты */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                Дефекты при приёме
              </Label>
              <label className="flex items-center gap-2 cursor-pointer text-[11px]">
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
                const list = line.defects.split(',').map(s => s.trim()).filter(Boolean)
                const on = list.includes(d.name)
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      const next = on ? list.filter(x => x !== d.name) : [...list, d.name]
                      onChange({ defects: next.join(', ') })
                    }}
                    className={cn(
                      'h-8 px-3 rounded-md text-xs border transition-colors flex items-center gap-1.5',
                      on
                        ? 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 font-semibold'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    {d.name}
                    {d.pct > 0 && applyDefectsPct && (
                      <span className={cn('font-mono text-[9.5px]', on ? 'text-red-600' : 'text-muted-foreground')}>
                        +{d.pct}%
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <Textarea
              placeholder="Дополнительно..."
              value={line.defects}
              onChange={e => onChange({ defects: e.target.value })}
              className="mt-2 resize-none"
              rows={2}
            />
          </div>

          {/* Пожелания */}
          <div>
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Пожелания</Label>
            <Input
              placeholder="Без отпаривания..."
              value={line.notes}
              onChange={e => onChange({ notes: e.target.value })}
              className="mt-1.5"
            />
          </div>

          {/* Фото */}
          <div>
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Фото изделия ({line.photos.length}/3)
              <span className="text-[9px] ml-2 normal-case text-muted-foreground/70 tracking-normal">
                сжимаются автоматически
              </span>
            </Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {line.photos.map(url => (
                <div key={url} className="relative h-20 w-20 rounded-lg overflow-hidden border bg-muted">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => onChange({ photos: line.photos.filter(p => p !== url) })}
                    className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {line.photos.length < 3 && (
              <label className={cn(
                'h-20 w-20 rounded-lg border-2 border-dashed grid place-items-center cursor-pointer transition-colors',
                photoUploading
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40 hover:bg-muted'
              )}>
                {photoUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <Camera className="h-5 w-5 text-muted-foreground" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={photoUploading}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) onUploadPhoto(file)
                    e.target.value = ''
                  }}
                />
              </label>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between sticky bottom-0">
          <div className="font-mono text-sm">
            <span className="text-muted-foreground">Итого: </span>
            <span className="font-bold text-base">{formatCurrency(sum)} {symbol}</span>
          </div>
          <Button onClick={onClose}>
            <Check className="h-4 w-4 mr-1.5" />
            Готово
          </Button>
        </div>
      </div>
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

// ── Диалог «Своя позиция» (DnD) ─────────────────────────────────────────────

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
