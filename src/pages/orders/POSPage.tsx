import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Plus, Search, ShoppingBag, ArrowLeft, Loader2, Phone, LayoutGrid, List, CheckCircle2, Trash2, UserPlus, Calendar, Zap, Camera, Weight, TrendingUp, TrendingDown, MessageSquare, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/shared/Toaster'
import { useCreateOrder, type OrderType, getOrderTypeIcon, useCleaningEnabledOrderTypes, type CleaningOrderTypeConfig, DEFAULT_ENABLED_CONFIGS } from '@/hooks/useCleaningOrders'
import { useCleaningItemTypes } from '@/hooks/useCleaningItemTypes'
import { useClientsPaged, useCreateClient } from '@/hooks/useClients'
import { formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { cn } from '@/lib/utils'
import dayjs from 'dayjs'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import { ReceiptModal, type ReceiptData } from '@/components/orders/ReceiptModal'

// ── Константы ─────────────────────────────────────────────────────────────────

const LIST_PAGE_SIZE = 20

const PAYMENT_METHODS = [
  { value: 'cash',     label: 'Наличные' },
  { value: 'card',     label: 'Карта' },
  { value: 'transfer', label: 'Перевод' },
  { value: 'mixed',    label: 'Смешанная' },
]

const COLORS_LIST = [
  { label: "Белый",       bg: "bg-white border border-gray-300 dark:border-gray-600" },
  { label: "Чёрный",      bg: "bg-gray-900" },
  { label: "Серый",       bg: "bg-gray-400" },
  { label: "Синий",       bg: "bg-blue-500" },
  { label: "Красный",     bg: "bg-red-500" },
  { label: "Зелёный",     bg: "bg-green-500" },
  { label: "Жёлтый",      bg: "bg-yellow-400" },
  { label: "Коричневый",  bg: "bg-amber-700" },
  { label: "Бежевый",     bg: "bg-amber-100 border border-gray-300 dark:border-gray-600" },
  { label: "Розовый",     bg: "bg-pink-400" },
  { label: "Оранжевый",   bg: "bg-orange-400" },
  { label: "Фиолетовый",  bg: "bg-purple-500" },
]

const DEFECTS_LIST = [
  "Пятно", "Потёртость", "Дыра", "Разрыв", "Зацепка",
  "Выцветший", "Засаленный", "Молния", "Пуговица", "Подкладка",
]

const ORDER_TAGS = ['Срочно', 'VIP', 'Повторная', 'Самовывоз', 'Доставка']

interface CartItem {
  key: number
  item_type_id: string | null
  item_type_name: string
  price: number
  ready_date: string
  color: string
  brand: string
  defects: string
  width_m: string
  length_m: string
  area_m2: number | null
  weight_kg: string
  photos: string[]
}

let keySeq = 0
function makeCartItem(name: string, price: number, days: number, typeId: string | null = null): CartItem {
  return {
    key: ++keySeq,
    item_type_id: typeId,
    item_type_name: name,
    price,
    ready_date: dayjs().add(days, 'day').format('YYYY-MM-DD'),
    color: '', brand: '', defects: '',
    width_m: '', length_m: '', area_m2: null,
    weight_kg: '', photos: [],
  }
}

// ── Диалог размеров ковра ─────────────────────────────────────────────────────

function CarpetSizeDialog({ typeName, pricePerSqm, onConfirm, onClose }: {
  typeName: string
  pricePerSqm: number
  onConfirm: (w: number, l: number, area: number, price: number) => void
  onClose: () => void
}) {
  const [w, setW] = useState('')
  const [l, setL] = useState('')
  const symbol = useCurrencySymbol()
  const area = (parseFloat(w) || 0) * (parseFloat(l) || 0)
  const total = area * pricePerSqm

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-background rounded-2xl shadow-xl p-6 w-80 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{typeName}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Ширина (м)</Label>
            <Input autoFocus type="number" min={0} step={0.1} placeholder="2.0"
              value={w} onChange={e => setW(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Длина (м)</Label>
            <Input type="number" min={0} step={0.1} placeholder="3.0"
              value={l} onChange={e => setL(e.target.value)} className="mt-1" />
          </div>
        </div>
        {area > 0 && (
          <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Площадь</span>
              <span className="font-medium">{area.toFixed(2)} м²</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Тариф</span>
              <span>{formatCurrency(pricePerSqm)} {symbol}/м²</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Итого</span>
              <span>{formatCurrency(total)} {symbol}</span>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button
            className="flex-1"
            disabled={area <= 0}
            onClick={() => { onConfirm(parseFloat(w), parseFloat(l), area, total); onClose() }}
          >
            Добавить
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Диалог успешного создания заказа ─────────────────────────────────────────

function OrderCreatedDialog({ orderNumber, onPrint, onGoToOrder, onNewOrder }: {
  orderNumber: string
  onPrint: () => void
  onGoToOrder: () => void
  onNewOrder: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-2xl p-6 w-80 space-y-4 text-center">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div>
          <h3 className="font-bold text-lg">Заказ принят!</h3>
          <p className="text-muted-foreground text-sm mt-1">№ {orderNumber}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={onPrint}>Печать квитанции</Button>
          <Button variant="outline" className="w-full" onClick={onGoToOrder}>Открыть заказ</Button>
          <Button variant="ghost" className="w-full" onClick={onNewOrder}>Новый заказ</Button>
        </div>
      </div>
    </div>
  )
}

// ── Диалог быстрого создания клиента ──────────────────────────────────────────

function QuickAddClientDialog({ initialName, onCreated, onClose }: {
  initialName: string
  onCreated: (client: { id: string; first_name: string; last_name?: string | null; phone?: string | null }) => void
  onClose: () => void
}) {
  const [firstName, setFirstName] = useState(initialName.split(' ')[0] ?? '')
  const [lastName,  setLastName]  = useState(initialName.split(' ').slice(1).join(' ') ?? '')
  const [phone,     setPhone]     = useState('')
  const { mutateAsync: createClient, isPending } = useCreateClient()

  async function handleCreate() {
    if (!firstName.trim()) { toast.error('Введите имя'); return }
    try {
      const created = await createClient({
        first_name: firstName.trim(),
        last_name:  lastName.trim() || undefined,
        phone:      phone.trim() || undefined,
      } as any)
      toast.success('Клиент создан')
      onCreated(created)
    } catch {
      toast.error('Ошибка создания клиента')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl shadow-2xl p-6 w-80 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            Новый клиент
          </h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Имя *</Label>
            <Input autoFocus placeholder="Иван" value={firstName}
              onChange={e => setFirstName(e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Фамилия</Label>
            <Input placeholder="Иванов" value={lastName}
              onChange={e => setLastName(e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Телефон</Label>
            <Input type="tel" placeholder="+998 90 123-45-67" value={phone}
              onChange={e => setPhone(e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" size="sm" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" size="sm" disabled={isPending} onClick={handleCreate}>
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Создать'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Главный компонент ─────────────────────────────────────────────────────────

export function POSPage() {
  const navigate = useNavigate()
  const symbol = useCurrencySymbol()
  const { mutateAsync: createOrder, isPending } = useCreateOrder()

  // Тип заказа
  const { data: enabledOrderTypes = DEFAULT_ENABLED_CONFIGS } = useCleaningEnabledOrderTypes()
  const [orderType, setOrderType] = useState<OrderType>('clothing')

  // Клиент
  const [clientSearch, setClientSearch] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')
  const [showClientList, setShowClientList] = useState(false)
  const { data: clientsData } = useClientsPaged(clientSearch, 1, 20)
  const clients = clientsData?.items ?? []

  // Исполнитель
  const [assignedTo, setAssignedTo] = useState<string | null>(null)
  const [flashTypeId, setFlashTypeId] = useState<string|null>(null)
  const { data: members = [] } = useQuery({
    queryKey: ['master_profiles_list', PRODUCT],
    queryFn: async () => {
      const { data } = await supabase.from('master_profiles')
        .select('id, display_name').eq('product', PRODUCT).order('display_name')
      return data ?? []
    },
  })

  // Каталог
  const { data: allTypes = [] } = useCleaningItemTypes()
  const filteredTypes = allTypes.filter(t => (t.category || 'clothing') === orderType)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogView, setCatalogView] = useState<'grid' | 'list'>('grid')
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [listPage, setListPage] = useState(1)

  const subcategories = useMemo(() => {
    const map = new Map<string, number>()
    filteredTypes.forEach(t => {
      const sub = t.subcategory || 'Другое'
      map.set(sub, (map.get(sub) || 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [filteredTypes])

  const handleSetOrderType = (t: OrderType) => {
    setOrderType(t); setCart([]); setCatalogSearch(''); setSelectedSubcategory(null); setListPage(1)
  }

  const visibleTypes = useMemo(() => {
    if (catalogSearch) return filteredTypes.filter(t => t.name.toLowerCase().includes(catalogSearch.toLowerCase()))
    if (selectedSubcategory) return filteredTypes.filter(t => (t.subcategory || 'Другое') === selectedSubcategory)
    return filteredTypes
  }, [filteredTypes, catalogSearch, selectedSubcategory])

  // Корзина
  const [cart, setCart] = useState<CartItem[]>([])
  const [expandedKey, setExpandedKey] = useState<number | null>(null)

  // Диалог размеров ковра
  const [carpetDialog, setCarpetDialog] = useState<{ typeName: string; pricePerSqm: number; typeId: string } | null>(null)

  // Быстрое добавление клиента
  const [quickAddClient, setQuickAddClient] = useState(false)

  // После создания заказа
  const [createdOrder, setCreatedOrder] = useState<{ id: string; number: string; clientInfo: typeof clientId } | null>(null)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)

  // Оплата
  const [prepaid, setPrepaid] = useState('')
  const [notes, setNotes] = useState('')
  const [globalReadyDate, setGlobalReadyDate] = useState(() => dayjs().add(1, 'day').format('YYYY-MM-DD'))
  const [dateDisplay,     setDateDisplay]     = useState(() => dayjs().add(1, 'day').format('DD.MM.YYYY'))
  const [discount, setDiscount] = useState('')
  const [isExpress, setIsExpress] = useState(false)
  const [expressCharge, setExpressCharge] = useState('')
  const [expressChargeIsPercent, setExpressChargeIsPercent] = useState(true)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [surchargePct, setSurchargePct] = useState('')
  const [paymentCash, setPaymentCash] = useState('')
  const [paymentCard, setPaymentCard] = useState('')
  const [orderTags, setOrderTags] = useState<string[]>([])
  const [photoUploading, setPhotoUploading] = useState<number | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Избранное — сохраняется в localStorage
  const [showFavourites, setShowFavourites] = useState(false)
  const [favourites, setFavourites] = useState<Set<string>>(() => {
    try {
      const s = localStorage.getItem('pos_favourites')
      return new Set(s ? JSON.parse(s) : [])
    } catch { return new Set() }
  })

  function toggleFavourite(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setFavourites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      localStorage.setItem('pos_favourites', JSON.stringify([...next]))
      return next
    })
  }

  const favouriteTypes = allTypes.filter(t => favourites.has(t.id))

  const subtotal = cart.reduce((s, i) => s + i.price, 0)
  const surchargeAmt = subtotal * (parseFloat(surchargePct) || 0) / 100
  const discountAmt  = subtotal * (parseFloat(discount) || 0) / 100
  const expressChargeAmt = isExpress
    ? expressChargeIsPercent
      ? subtotal * (parseFloat(expressCharge) || 0) / 100
      : (parseFloat(expressCharge) || 0)
    : 0
  const finalTotal = subtotal + surchargeAmt + expressChargeAmt - discountAmt

  const isMixed = paymentMethod === 'mixed'
  const mixedPrepaid = (parseFloat(paymentCash) || 0) + (parseFloat(paymentCard) || 0)
  const effectivePrepaid = isMixed ? mixedPrepaid : (parseFloat(prepaid) || 0)

  useEffect(() => {
    if (globalReadyDate) {
      setCart(prev => prev.map(i => ({ ...i, ready_date: globalReadyDate })))
    }
  }, [globalReadyDate])

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Element
      if (!target.closest('[data-client-search]')) setShowClientList(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Действия ──────────────────────────────────────────────────────────────

  function addFromCatalog(type: any) {
    setFlashTypeId(type.id); setTimeout(() => setFlashTypeId(null), 500)
    if (orderType === 'carpet') {
      setCarpetDialog({ typeName: type.name, pricePerSqm: type.default_price, typeId: type.id })
      return
    }
    const item = makeCartItem(type.name, type.default_price, type.default_days, type.id)
    if (globalReadyDate) item.ready_date = globalReadyDate
    setCart(prev => [...prev, item])
  }

  function addCarpetItem(typeId: string, typeName: string, _pricePerSqm: number, w: number, l: number, area: number, price: number) {
    const item = makeCartItem(typeName, price, 5, typeId)
    item.width_m = String(w)
    item.length_m = String(l)
    item.area_m2 = area
    if (globalReadyDate) item.ready_date = globalReadyDate
    setCart(prev => [...prev, item])
  }

  function removeItem(key: number) {
    setCart(prev => prev.filter(i => i.key !== key))
    if (expandedKey === key) setExpandedKey(null)
  }

  function updateItem(key: number, field: keyof CartItem, value: any) {
    setCart(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i))
  }

  function selectClient(c: any) {
    setClientId(c.id)
    setClientName([c.first_name, c.last_name].filter(Boolean).join(' ') + (c.phone ? ` · ${c.phone}` : ''))
    setClientSearch('')
    setShowClientList(false)
  }

  function clearClient() { setClientId(null); setClientName(''); setClientSearch('') }

  function resetForm() {
    setCart([]); setClientId(null); setClientName(''); setClientSearch('')
    setAssignedTo(null); setPrepaid(''); setNotes(''); setGlobalReadyDate(dayjs().add(1, 'day').format('YYYY-MM-DD'))
    setDiscount(''); setIsExpress(false); setExpressCharge(''); setExpressChargeIsPercent(true)
    setPaymentMethod('cash'); setSurchargePct(''); setPaymentCash(''); setPaymentCard('')
    setOrderTags([]); setExpandedKey(null); setCreatedOrder(null); setReceiptData(null)
    const d1 = dayjs().add(1, 'day'); setGlobalReadyDate(d1.format('YYYY-MM-DD')); setDateDisplay(d1.format('DD.MM.YYYY'))
  }

  function setDateByDays(days: number) {
    const d = dayjs().add(days, 'day')
    setGlobalReadyDate(d.format('YYYY-MM-DD'))
    setDateDisplay(d.format('DD.MM.YYYY'))
  }

  function handleDateInput(value: string) {
    setDateDisplay(value)
    const parts = value.split('.')
    if (parts.length === 3 && parts[2].length === 4) {
      const iso = `${parts[2]}-${(parts[1] || '').padStart(2, '0')}-${(parts[0] || '').padStart(2, '0')}`
      const d = dayjs(iso)
      if (d.isValid()) setGlobalReadyDate(iso)
    }
  }

  async function handleSubmit() {
    if (cart.length === 0) { toast.error('Добавьте хотя бы одно изделие'); return }
    try {
      const order = await createOrder({
        order_type:        orderType,
        client_id:         clientId,
        assigned_to:       assignedTo,
        prepaid_amount:    effectivePrepaid,
        total_amount:      finalTotal,
        notes:             notes || null,
        ready_date:        globalReadyDate || null,
        is_express:        isExpress,
        payment_method:    paymentMethod,
        surcharge_percent: parseFloat(surchargePct) || 0,
        surcharge_amount:  surchargeAmt,
        payment_cash:      parseFloat(paymentCash) || 0,
        payment_card:      parseFloat(paymentCard) || 0,
        tags:              orderTags,
        items: cart.map(i => ({
          item_type_id:   i.item_type_id,
          item_type_name: i.item_type_name,
          color:          i.color || null,
          brand:          i.brand || null,
          defects:        i.defects || null,
          price:          i.price,
          ready_date:     i.ready_date || null,
          width_m:        i.area_m2 ? parseFloat(i.width_m) : null,
          length_m:       i.area_m2 ? parseFloat(i.length_m) : null,
          area_m2:        i.area_m2,
          weight_kg:      i.weight_kg ? parseFloat(i.weight_kg) : null,
          photos:         i.photos,
        })),
      })

      const rData: ReceiptData = {
        id: order.id,
        number: order.number,
        created_at: order.created_at,
        order_type: orderType,
        client: clientId ? {
          first_name: clientName.split(' · ')[0]?.split(' ')[0] ?? '',
          last_name:  clientName.split(' · ')[0]?.split(' ').slice(1).join(' ') ?? null,
          phone:      clientName.includes(' · ') ? clientName.split(' · ')[1] : null,
        } : null,
        items: cart.map(i => ({
          item_type_name: i.item_type_name,
          price:          i.price,
          ready_date:     i.ready_date || null,
          color:          i.color || null,
          brand:          i.brand || null,
          defects:        i.defects || null,
          area_m2:        i.area_m2,
          width_m:        i.width_m || null,
          length_m:       i.length_m || null,
        })),
        total_amount:   finalTotal,
        prepaid_amount: effectivePrepaid,
        notes:          notes || null,
      }

      setReceiptData(rData)
      setCreatedOrder({ id: order.id, number: order.number, clientInfo: clientId })
      toast.success(`Заказ ${order.number} принят`)
    } catch (e: any) {
      toast.error(e.message || 'Ошибка создания')
    }
  }

  // ── Рендер ────────────────────────────────────────────────────────────────

  const CATALOG_BG: Record<string, string> = {
    clothing:  'bg-blue-50/40 dark:bg-blue-950/10',
    carpet:    'bg-green-50/40 dark:bg-green-950/10',
    furniture: 'bg-amber-50/40 dark:bg-amber-950/10',
    shoes:     'bg-rose-50/40 dark:bg-rose-950/10',
    curtains:  'bg-violet-50/40 dark:bg-violet-950/10',
    bedding:   'bg-sky-50/40 dark:bg-sky-950/10',
  }

  const addCustomItem = () => {
    const item = makeCartItem('', 0, 3)
    setCart(prev => [...prev, item])
    setExpandedKey(item.key)
  }

  async function handlePhotoUpload(itemKey: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setPhotoUploading(itemKey)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${PRODUCT}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('cleaning-photos').upload(path, file, {
        contentType: file.type, upsert: false,
      })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('cleaning-photos').getPublicUrl(path)
      setCart(prev => prev.map(i => i.key === itemKey
        ? { ...i, photos: [...i.photos, publicUrl] }
        : i
      ))
    } catch {
      toast.error('Ошибка загрузки фото')
    } finally {
      setPhotoUploading(null)
    }
  }

  function toggleTag(tag: string) {
    setOrderTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  // Список: показываем первые listPage*20 позиций
  const pagedListTypes = visibleTypes.slice(0, listPage * LIST_PAGE_SIZE)
  const hasMoreList = pagedListTypes.length < visibleTypes.length

  // Redirect mobile to simplified form
  useEffect(() => {
    if (window.innerWidth < 1024) navigate('/orders/new', { replace: true })
  }, [navigate])

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">

      {/* ── Шапка ── */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-14 border-b shrink-0 bg-background">
        <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="font-semibold text-base shrink-0">Приём заказа</span>

        {members.length > 0 && (
          <select
            value={assignedTo ?? ""}
            onChange={e => setAssignedTo(e.target.value || null)}
            className="h-8 text-xs rounded-lg border bg-background px-2 ml-2 hidden sm:block"
          >
            <option value="">Исполнитель...</option>
            {members.map((m: any) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
        )}

        <div className="relative ml-auto w-48 sm:w-72" data-client-search>
          {clientId ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-primary/5 border-primary/30 text-sm">
              <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="flex-1 truncate font-medium">{clientName}</span>
              <button onClick={clearClient} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Клиент по имени или телефону..."
                value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowClientList(true) }}
                onFocus={() => setShowClientList(true)}
                className="pl-8 h-8 text-sm"
              />
              {showClientList && clientSearch && (
                <div className="absolute top-full mt-1 w-full bg-background dark:bg-card border shadow-xl rounded-lg z-50 overflow-hidden">
                  {clients.slice(0, 8).map(c => (
                    <button key={c.id} onClick={() => selectClient(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors">
                      <span className="font-medium">{[c.first_name, c.last_name].filter(Boolean).join(' ')}</span>
                      {c.phone && <span className="text-muted-foreground ml-2">{c.phone}</span>}
                    </button>
                  ))}
                  <button
                    onClick={() => { setShowClientList(false); setQuickAddClient(true) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 text-primary border-t"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Создать «{clientSearch}»
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Основная область ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── Каталог ── */}
        <div className={cn("flex-1 border-r flex flex-col overflow-hidden min-h-0", CATALOG_BG[orderType])}>

          {/* Тип заказа — горизонтальные табы + Избранное */}
          <div className="flex items-center gap-1 px-3 pt-2 pb-1 shrink-0 flex-wrap">
            {enabledOrderTypes.map((cfg: CleaningOrderTypeConfig) => {
              const Icon = getOrderTypeIcon(cfg.icon)
              return (
                <button
                  key={cfg.slug}
                  onClick={() => { handleSetOrderType(cfg.slug); setShowFavourites(false) }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                    !showFavourites && orderType === cfg.slug
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background/80 text-muted-foreground border-transparent hover:border-border hover:text-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cfg.label}
                </button>
              )
            })}
            <button
              onClick={() => setShowFavourites(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                showFavourites
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-background/80 text-muted-foreground border-transparent hover:border-border hover:text-amber-500'
              )}
            >
              <Star className="h-3.5 w-3.5" />
              Избранное
              {favourites.size > 0 && <span className="ml-0.5 text-xs opacity-80">({favourites.size})</span>}
            </button>
          </div>

          {/* Поиск + вид + Своё */}
          <div className="px-3 pt-1 pb-2 flex items-center gap-2 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Поиск по каталогу..."
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <button
              onClick={addCustomItem}
              className="flex items-center gap-1 px-2.5 h-8 rounded-lg border border-dashed text-muted-foreground hover:border-primary hover:text-primary transition-colors shrink-0 text-xs"
              title="Добавить своё изделие"
            >
              <Plus className="h-3.5 w-3.5" />
              Своё
            </button>
            <div className="flex rounded-lg border overflow-hidden shrink-0">
              <button
                onClick={() => setCatalogView('grid')}
                className={cn('p-1.5 transition-colors', catalogView === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted')}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCatalogView('list')}
                className={cn('p-1.5 transition-colors', catalogView === 'list' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted')}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Каталог: категории → позиции */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">

            {showFavourites ? (
              /* Избранные */
              <>
                {favouriteTypes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                    <Star className="h-8 w-8 opacity-30" />
                    <p className="text-sm">Нет избранных</p>
                    <p className="text-xs opacity-60">Нажмите ★ на карточке в каталоге</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {favouriteTypes.map(type => (
                      <button
                        key={type.id}
                        onClick={() => addFromCatalog(type)}
                        className={cn(
                          "relative flex flex-col items-start gap-1 p-2.5 rounded-xl border bg-background hover:bg-accent hover:border-primary/40 transition-all text-left group active:scale-95",
                          flashTypeId === type.id && "ring-2 ring-primary scale-95"
                        )}
                      >
                        <button
                          type="button"
                          onClick={e => toggleFavourite(e, type.id)}
                          className="absolute top-1.5 right-1.5 text-amber-400 hover:text-amber-500"
                        >
                          <Star className="h-3 w-3 fill-current" />
                        </button>
                        <span className="text-xs font-medium leading-tight group-hover:text-primary transition-colors line-clamp-2 pr-4">{type.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {(type.category || 'clothing') === 'carpet' ? `${formatCurrency(type.default_price)} ${symbol}/м²` : `${formatCurrency(type.default_price)} ${symbol}`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : !catalogSearch && !selectedSubcategory ? (
              /* Карточки категорий */
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {subcategories.map(sub => (
                  <button
                    key={sub.name}
                    onClick={() => { setSelectedSubcategory(sub.name); setListPage(1) }}
                    className="flex flex-col items-start gap-1 p-3 rounded-xl border bg-background hover:bg-accent hover:border-primary/40 transition-all text-left"
                  >
                    <span className="text-sm font-semibold leading-tight line-clamp-2">{sub.name}</span>
                    <span className="text-xs text-muted-foreground">{sub.count} позиций</span>
                  </button>
                ))}
              </div>
            ) : (
              /* Позиции */
              <>
                {selectedSubcategory && !catalogSearch && (
                  <button
                    onClick={() => setSelectedSubcategory(null)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2 -ml-1 px-2 py-1 rounded-lg hover:bg-muted/60 transition-colors"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    <span>Все категории</span>
                    <span className="text-foreground font-medium">· {selectedSubcategory}</span>
                  </button>
                )}

                {catalogView === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {visibleTypes.map(type => (
                      <button
                        key={type.id}
                        onClick={() => addFromCatalog(type)}
                        className={cn(
                          "relative flex flex-col items-start gap-1 p-2.5 rounded-xl border bg-background hover:bg-accent hover:border-primary/40 transition-all text-left group active:scale-95",
                          flashTypeId === type.id && "ring-2 ring-primary scale-95"
                        )}
                      >
                        <button
                          type="button"
                          onClick={e => toggleFavourite(e, type.id)}
                          className={cn(
                            'absolute top-1.5 right-1.5 transition-colors',
                            favourites.has(type.id)
                              ? 'text-amber-400 hover:text-amber-500'
                              : 'text-muted-foreground/30 hover:text-amber-400 opacity-0 group-hover:opacity-100'
                          )}
                        >
                          <Star className={cn('h-3 w-3', favourites.has(type.id) && 'fill-current')} />
                        </button>
                        <span className="text-xs font-medium leading-tight group-hover:text-primary transition-colors line-clamp-2 pr-4">{type.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {orderType === 'carpet' ? `${formatCurrency(type.default_price)} ${symbol}/м²` : `${formatCurrency(type.default_price)} ${symbol}`}
                        </span>
                        <span className="text-xs text-muted-foreground">{type.default_days} дн.</span>
                      </button>
                    ))}
                    <button
                      onClick={addCustomItem}
                      className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-dashed text-muted-foreground hover:border-primary hover:text-primary transition-all"
                    >
                      <Plus className="h-5 w-5" />
                      <span className="text-xs">Своё</span>
                    </button>
                  </div>
                ) : (
                  /* Список: партиями по 20 */
                  <div className="space-y-1">
                    {pagedListTypes.map(type => (
                      <button
                        key={type.id}
                        onClick={() => addFromCatalog(type)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-lg border bg-background hover:bg-accent hover:border-primary/40 transition-all text-left group active:scale-95",
                          flashTypeId === type.id && "ring-2 ring-primary scale-95"
                        )}
                      >
                        <span className="text-sm font-medium group-hover:text-primary transition-colors truncate flex-1 mr-3">{type.name}</span>
                        <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                          <span>{orderType === 'carpet' ? `${formatCurrency(type.default_price)} ${symbol}/м²` : `${formatCurrency(type.default_price)} ${symbol}`}</span>
                          <span>{type.default_days} дн.</span>
                        </div>
                      </button>
                    ))}
                    {hasMoreList && (
                      <button
                        onClick={() => setListPage(p => p + 1)}
                        className="w-full py-2 text-xs text-primary hover:underline"
                      >
                        Показать ещё ({visibleTypes.length - pagedListTypes.length})
                      </button>
                    )}
                  </div>
                )}

                {visibleTypes.length === 0 && catalogSearch && (
                  <p className="text-sm text-muted-foreground text-center py-8">Ничего не найдено по «{catalogSearch}»</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Правая панель: чек ── */}
        <div className="w-[340px] xl:w-[30%] flex flex-col overflow-hidden min-h-0 shrink-0">

          {/* Список позиций */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground select-none">
                <div className="h-20 w-20 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <ShoppingBag className="h-10 w-10 opacity-30" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">Корзина пуста</p>
                  <p className="text-xs opacity-60">← Выберите изделие из каталога</p>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {cart.map((item, idx) => (
                  <div key={item.key} className="px-4 py-2">
                    <div
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted/30 rounded-lg -mx-1 px-1 transition-colors"
                      onClick={() => setExpandedKey(expandedKey === item.key ? null : item.key)}
                    >
                      <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        {item.item_type_id ? (
                          <p className="text-sm font-medium truncate">{item.item_type_name}</p>
                        ) : (
                          <Input
                            placeholder="Название изделия..."
                            value={item.item_type_name}
                            onChange={e => updateItem(item.key, 'item_type_name', e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="h-7 text-sm"
                          />
                        )}
                        {item.area_m2 && (
                          <p className="text-xs text-muted-foreground">
                            {item.width_m}×{item.length_m} м = {item.area_m2.toFixed(2)} м²
                          </p>
                        )}
                        {(item.color || item.brand || item.defects) && (
                          <p className="text-xs text-muted-foreground truncate">
                            {[item.color, item.brand, item.defects].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-sm font-medium tabular-nums">{formatCurrency(item.price)}</span>
                        <button
                          onClick={e => { e.stopPropagation(); removeItem(item.key) }}
                          className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {expandedKey === item.key && (
                      <div className="mt-2 ml-7 grid grid-cols-2 gap-2">
                        {orderType !== 'carpet' && (
                          <>
                            <div className="col-span-2">
                              <Label className="text-xs mb-1 block">Цвет</Label>
                              <div className="flex flex-wrap gap-1.5">
                                {COLORS_LIST.map(c => (
                                  <button
                                    key={c.label}
                                    type="button"
                                    title={c.label}
                                    onClick={() => updateItem(item.key, 'color', item.color === c.label ? '' : c.label)}
                                    className={cn(
                                      'h-5 w-5 rounded-full transition-all shrink-0',
                                      c.bg,
                                      item.color === c.label ? 'ring-2 ring-offset-1 ring-primary scale-110' : 'hover:scale-110'
                                    )}
                                  />
                                ))}
                                <Input
                                  placeholder="Другой..."
                                  value={COLORS_LIST.some(c => c.label === item.color) ? '' : item.color}
                                  onChange={e => updateItem(item.key, 'color', e.target.value)}
                                  className="h-6 text-xs flex-1 min-w-[70px]"
                                />
                              </div>
                              {item.color && (
                                <p className="text-xs text-muted-foreground mt-0.5">Выбран: <span className="font-medium">{item.color}</span></p>
                              )}
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs">Бренд</Label>
                              <Input placeholder="Zara..." value={item.brand}
                                onChange={e => updateItem(item.key, 'brand', e.target.value)}
                                className="h-7 text-xs mt-0.5" />
                            </div>
                          </>
                        )}
                        <div className="col-span-2">
                          <Label className="text-xs mb-1 block">Дефекты при приёме</Label>
                          <div className="flex flex-wrap gap-1">
                            {DEFECTS_LIST.map(d => {
                              const selected = item.defects.split(',').map(s => s.trim()).filter(Boolean).includes(d)
                              return (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => {
                                    const current = item.defects.split(',').map(s => s.trim()).filter(Boolean)
                                    const next = selected ? current.filter(x => x !== d) : [...current, d]
                                    updateItem(item.key, 'defects', next.join(', '))
                                  }}
                                  className={cn(
                                    'px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
                                    selected
                                      ? 'bg-destructive/15 border-destructive/40 text-destructive dark:text-red-400'
                                      : 'bg-muted border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                                  )}
                                >
                                  {d}
                                </button>
                              )
                            })}
                          </div>
                          <Input
                            placeholder="Другой дефект..."
                            className="h-7 text-xs mt-1.5"
                            onKeyDown={e => {
                              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                const current = item.defects.split(',').map(s => s.trim()).filter(Boolean)
                                if (!current.includes(e.currentTarget.value.trim())) {
                                  updateItem(item.key, 'defects', [...current, e.currentTarget.value.trim()].join(', '))
                                }
                                e.currentTarget.value = ''
                                e.preventDefault()
                              }
                            }}
                          />
                          {item.defects && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.defects}</p>
                          )}
                        </div>
                        {/* Вес + Цена */}
                        <div>
                          <Label className="text-xs flex items-center gap-1">
                            <Weight className="h-3 w-3" />
                            Вес (кг)
                          </Label>
                          <Input type="number" min={0} step={0.1} placeholder="0.0"
                            value={item.weight_kg}
                            onChange={e => updateItem(item.key, 'weight_kg', e.target.value)}
                            className="h-7 text-xs mt-0.5" />
                        </div>
                        <div>
                          <Label className="text-xs">Цена ({symbol})</Label>
                          <Input type="number" value={item.price}
                            onChange={e => updateItem(item.key, 'price', e.target.value as any)}
                            className="h-7 text-xs mt-0.5" />
                        </div>

                        {/* Фото при приёмке */}
                        <div className="col-span-2">
                          <Label className="text-xs mb-1.5 flex items-center gap-1">
                            <Camera className="h-3 w-3" />
                            Фото при приёмке
                          </Label>
                          <div className="flex flex-wrap gap-1.5">
                            {item.photos.map((url, pi) => (
                              <div key={pi} className="relative group">
                                <img src={url} alt="" className="h-12 w-12 rounded-lg object-cover border" />
                                <button
                                  type="button"
                                  onClick={() => updateItem(item.key, 'photos', item.photos.filter((_, j) => j !== pi))}
                                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            ))}
                            {item.photos.length < 5 && (
                              <label className={cn(
                                'h-12 w-12 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:border-primary transition-colors',
                                photoUploading === item.key && 'opacity-50 pointer-events-none'
                              )}>
                                {photoUploading === item.key
                                  ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                  : <Camera className="h-4 w-4 text-muted-foreground" />
                                }
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  onChange={e => handlePhotoUpload(item.key, e)}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Нижняя панель */}
          <div className="border-t bg-background shrink-0 px-3 pt-2 pb-3 space-y-1.5">

            {/* Зона 1: Теги */}
            <div className="flex flex-wrap gap-1">
              {ORDER_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
                    orderTags.includes(tag)
                      ? tag === 'Срочно'
                        ? 'bg-red-500 text-white border-red-500'
                        : tag === 'VIP'
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-transparent hover:border-border hover:text-foreground'
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Зона 2: Примечание — иконка + input */}
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input
                placeholder="Примечание к заказу..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="h-7 text-xs flex-1"
              />
            </div>

            {/* Зона 3: Срок — иконка + чипсы + ручной ввод */}
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0 mr-0.5" />
              {[['сегодня', 0], ['+1', 1], ['+2', 2], ['+3', 3], ['+4', 4], ['+5', 5]].map(([label, days]) => (
                <button
                  key={label as string}
                  type="button"
                  onClick={() => setDateByDays(days as number)}
                  className={cn(
                    'px-2 py-1 text-xs rounded-md border leading-none transition-colors shrink-0',
                    globalReadyDate === dayjs().add(days as number, 'day').format('YYYY-MM-DD')
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-transparent hover:bg-accent hover:text-foreground'
                  )}
                >
                  {label as string}
                </button>
              ))}
              <Input
                type="text"
                placeholder="ДД.ММ.ГГГГ"
                value={dateDisplay}
                onChange={e => handleDateInput(e.target.value)}
                className="h-7 text-xs flex-1 min-w-0"
              />
            </div>

            {/* Зона 4а: Оплата — чипсы в один ряд */}
            <div className="flex gap-1">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setPaymentMethod(m.value)}
                  className={cn(
                    'flex-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors leading-none',
                    paymentMethod === m.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-transparent hover:bg-accent hover:text-foreground'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Зона 4б: Экспресс + Надбавка + Скидка */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsExpress(v => !v)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium transition-colors shrink-0',
                  isExpress
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'text-muted-foreground border-border hover:border-orange-400 hover:text-orange-500'
                )}
              >
                <Zap className="h-3 w-3" />
                Экспресс
              </button>
              {isExpress && (
                <>
                  <button
                    type="button"
                    onClick={() => setExpressChargeIsPercent(v => !v)}
                    className="px-2 py-1 rounded-md border text-xs font-medium text-orange-500 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/20 shrink-0 transition-colors"
                  >
                    {expressChargeIsPercent ? '%' : symbol}
                  </button>
                  <Input
                    type="number" min={0} placeholder="0"
                    value={expressCharge}
                    onChange={e => setExpressCharge(e.target.value)}
                    className="w-16 h-7 text-xs text-center px-1 border-orange-300 focus-visible:ring-orange-400"
                  />
                </>
              )}
              <TrendingUp className="h-3 w-3 text-orange-500 shrink-0" />
              <Input
                type="number" min={0} max={200} placeholder="0"
                value={surchargePct}
                onChange={e => setSurchargePct(e.target.value)}
                className="w-12 h-7 text-xs text-center px-1"
              />
              <span className="text-xs text-muted-foreground shrink-0">%</span>
              <TrendingDown className="h-3 w-3 text-green-500 shrink-0" />
              <Input
                type="number" min={0} max={100} placeholder="0"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                className="w-12 h-7 text-xs text-center px-1"
              />
              <span className="text-xs text-muted-foreground shrink-0">%</span>
            </div>

            {/* Зона 5: Итоги — выделенный блок */}
            <div className="rounded-xl bg-muted/50 dark:bg-muted/30 px-3 py-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Позиций: {cart.length}
                  {expressChargeAmt > 0 && <span className="ml-2 text-orange-500 font-medium"><Zap className="inline h-2.5 w-2.5 mb-0.5" />+{formatCurrency(expressChargeAmt)}</span>}
                  {surchargeAmt > 0 && <span className="ml-2 text-orange-500">+{formatCurrency(surchargeAmt)}</span>}
                  {discountAmt > 0 && <span className="ml-1 text-green-600">−{formatCurrency(discountAmt)}</span>}
                </span>
                <span className="font-bold text-xl tabular-nums">{formatCurrency(finalTotal)} {symbol}</span>
              </div>

              {isMixed ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground shrink-0">Нал.</span>
                    <Input type="number" min={0} placeholder="0"
                      value={paymentCash} onChange={e => setPaymentCash(e.target.value)}
                      className="flex-1 h-7 text-xs text-right min-w-0 bg-background" />
                    <span className="text-xs text-muted-foreground shrink-0">{symbol}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground shrink-0">Карта</span>
                    <Input type="number" min={0} placeholder="0"
                      value={paymentCard} onChange={e => setPaymentCard(e.target.value)}
                      className="flex-1 h-7 text-xs text-right min-w-0 bg-background" />
                    <span className="text-xs text-muted-foreground shrink-0">{symbol}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Предоплата</span>
                  <Input
                    type="number" min={0} placeholder="0"
                    value={prepaid}
                    onChange={e => setPrepaid(e.target.value)}
                    className="flex-1 h-7 text-sm text-right bg-background"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">{symbol}</span>
                </div>
              )}

              {effectivePrepaid > 0 && (
                <div className="flex justify-between text-sm font-semibold text-orange-600 dark:text-orange-400">
                  <span>К оплате:</span>
                  <span className="tabular-nums">{formatCurrency(Math.max(0, finalTotal - effectivePrepaid))} {symbol}</span>
                </div>
              )}
            </div>

            {/* Кнопки */}
            <div className="flex gap-2">
              {cart.length > 0 && (
                <Button
                  variant="outline" size="icon"
                  className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive hover:border-destructive"
                  onClick={() => { setCart([]); setExpandedKey(null) }}
                  title="Очистить корзину"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                className={cn("flex-1 h-10 text-sm font-semibold", isExpress && "bg-orange-500 hover:bg-orange-600 border-orange-500")}
                onClick={handleSubmit}
                disabled={isPending || cart.length === 0}
              >
                {isPending
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : isExpress
                    ? <Zap className="h-4 w-4 mr-2" />
                    : <ShoppingBag className="h-4 w-4 mr-2" />}
                {isExpress ? 'Экспресс-заказ' : 'Принять заказ'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {carpetDialog && (
        <CarpetSizeDialog
          typeName={carpetDialog.typeName}
          pricePerSqm={carpetDialog.pricePerSqm}
          onConfirm={(w, l, area, price) =>
            addCarpetItem(carpetDialog.typeId, carpetDialog.typeName, carpetDialog.pricePerSqm, w, l, area, price)
          }
          onClose={() => setCarpetDialog(null)}
        />
      )}

      {createdOrder && !showReceipt && (
        <OrderCreatedDialog
          orderNumber={createdOrder.number}
          onPrint={() => setShowReceipt(true)}
          onGoToOrder={() => navigate(`/orders/${createdOrder.id}`)}
          onNewOrder={() => { resetForm(); setOrderType('clothing') }}
        />
      )}

      {showReceipt && receiptData && (
        <ReceiptModal
          data={receiptData}
          onClose={() => { setShowReceipt(false); resetForm(); setOrderType('clothing') }}
        />
      )}

      {quickAddClient && (
        <QuickAddClientDialog
          initialName={clientSearch}
          onCreated={c => {
            setClientId(c.id)
            setClientName([c.first_name, c.last_name].filter(Boolean).join(' ') + (c.phone ? ` · ${c.phone}` : ''))
            setClientSearch('')
            setQuickAddClient(false)
          }}
          onClose={() => setQuickAddClient(false)}
        />
      )}
    </div>
  )
}
