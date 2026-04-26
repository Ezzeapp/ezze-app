import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Search, Plus, Minus, X, Loader2, Check,
  GripVertical, ShoppingBag, Zap, Truck, UserPlus,
  Camera, Printer, CheckCircle2, Pencil,
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ReceiptModal, type ReceiptData } from '@/components/orders/ReceiptModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/shared/Toaster'
import {
  useCreateOrder, useCleaningEnabledOrderTypes, getOrderTypeIcon,
  type OrderType, DEFAULT_ENABLED_CONFIGS,
} from '@/hooks/useCleaningOrders'
import { useCleaningItemTypes, type CleaningItemType } from '@/hooks/useCleaningItemTypes'
import { useClientsPaged, useCreateClient } from '@/hooks/useClients'
import { useCleaningClientStats } from '@/hooks/useCleaningClientStats'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { formatCurrency, cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import dayjs from 'dayjs'

// ── Типы ────────────────────────────────────────────────────────────────────

type ZoneId = 'normal' | 'urgent' | 'delivery'

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
}

const COLOR_PALETTE = [
  'Чёрный','Белый','Бежевый','Серый','Синий','Красный','Зелёный','Коричневый','Жёлтый','Розовый','Разноцвет',
]
const SIZES = ['S','M','L','XL','XXL']
const COMMON_DEFECTS = ['Пятно','Потёртость','Дыра','Зацепка','Выцветший','Засаленный']

let keySeq = 0
function makeLine(t: CleaningItemType): CartLine {
  return {
    key: ++keySeq, type: t, qty: 1,
    color: '', size: 'M', brand: '', defects: '', notes: '',
    width_m: '', length_m: '', photos: [],
  }
}

// ── Главный компонент ───────────────────────────────────────────────────────

export function OrderDnDPage() {
  const navigate = useNavigate()
  const symbol = useCurrencySymbol()

  // Mobile fallback → wizard (DnD только для desktop)
  useEffect(() => {
    if (window.innerWidth < 1024) navigate('/orders/wizard', { replace: true })
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
  const [groupSearch, setGroupSearch] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const visibleSubgroups = useMemo(() => {
    if (!groupSearch) return subgroups
    const q = groupSearch.toLowerCase()
    return subgroups.filter(g => g.name.toLowerCase().includes(q))
  }, [subgroups, groupSearch])
  const visibleTypes = useMemo(() => {
    let arr = filteredTypes
    if (activeSub && !itemSearch) arr = arr.filter(t => (t.subcategory || 'Другое') === activeSub)
    if (itemSearch) {
      const q = itemSearch.toLowerCase()
      arr = filteredTypes.filter(t => t.name.toLowerCase().includes(q))
    }
    return arr
  }, [filteredTypes, activeSub, itemSearch])

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

  // Зоны (drag & drop)
  const [zones, setZones] = useState<Record<ZoneId, CartLine[]>>({
    normal: [],
    urgent: [],
    delivery: [],
  })
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropHot, setDropHot] = useState<ZoneId | null>(null)
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
    setPhotoUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${PRODUCT}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('cleaning-photos').upload(path, file, {
        contentType: file.type, upsert: false,
      })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('cleaning-photos').getPublicUrl(path)
      const cur = zones[zoneId].find(l => l.key === key)
      if (cur) updateLine(zoneId, key, { photos: [...cur.photos, publicUrl] })
    } catch {
      toast.error('Ошибка загрузки фото')
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

  // Оплата
  const [payment, setPayment] = useState('cash')
  const [paymentCash, setPaymentCash] = useState('')
  const [paymentCard, setPaymentCard] = useState('')
  const [discount, setDiscount] = useState(0)
  const [visitAddress, setVisitAddress] = useState('')

  // Расчёты
  function lineSum(l: CartLine): number {
    if (orderType === 'carpet') {
      const w = parseFloat(l.width_m) || 0
      const h = parseFloat(l.length_m) || 0
      const area = w * h
      if (area > 0) return area * l.type.default_price * l.qty
    }
    return l.type.default_price * l.qty
  }
  const allLines = useMemo(() => [...zones.normal, ...zones.urgent, ...zones.delivery], [zones])
  const subtotal = useMemo(
    () => allLines.reduce((s, l) => s + lineSum(l), 0),
    [allLines, orderType]
  )
  const urgentTotal = useMemo(
    () => zones.urgent.reduce((s, l) => s + lineSum(l), 0),
    [zones.urgent, orderType]
  )
  const surchargeAmt = Math.round(urgentTotal * 0.5)
  const discountAmt = Math.round((subtotal + surchargeAmt) * discount / 100)
  const deliveryAdd = zones.delivery.length > 0 ? 350 : 0
  const total = subtotal + surchargeAmt - discountAmt + deliveryAdd

  async function handleSubmit() {
    if (allLines.length === 0) {
      toast.error('Перетащите хотя бы одну позицию в корзину')
      return
    }
    try {
      // Каждая зона → один заказ? Нет — один заказ, но с tags для зоны.
      // Решение: сохраняем как один заказ; срочный/доставка фиксируются через is_express и tags.
      const tags: string[] = []
      if (zones.urgent.length > 0) tags.push('Срочно')
      if (zones.delivery.length > 0) tags.push('Доставка')

      const items = allLines.flatMap(l =>
        Array.from({ length: l.qty }, () => {
          const w = parseFloat(l.width_m) || null
          const h = parseFloat(l.length_m) || null
          const area = orderType === 'carpet' && w && h ? w * h : null
          return {
            item_type_id: l.type.id.startsWith('custom:') ? null : l.type.id,
            item_type_name: l.type.name,
            color: l.color || null,
            brand: l.brand || null,
            defects: l.defects || null,
            price: orderType === 'carpet' && w && h ? w * h * l.type.default_price : l.type.default_price,
            ready_date: dayjs().add(l.type.default_days || 3, 'day').format('YYYY-MM-DD'),
            width_m: orderType === 'carpet' ? w : null,
            length_m: orderType === 'carpet' ? h : null,
            area_m2: area,
            photos: l.photos.length > 0 ? l.photos : undefined,
          }
        })
      )
      const order = await createOrder({
        order_type: orderType,
        client_id: clientId,
        prepaid_amount: 0,
        total_amount: total,
        ready_date: dayjs().add(zones.urgent.length > 0 ? 1 : 3, 'day').format('YYYY-MM-DD'),
        is_express: zones.urgent.length > 0,
        payment_method: payment,
        payment_cash: payment === 'mixed' ? (parseFloat(paymentCash) || 0) : 0,
        payment_card: payment === 'mixed' ? (parseFloat(paymentCard) || 0) : 0,
        surcharge_percent: zones.urgent.length > 0 ? 50 : 0,
        surcharge_amount: surchargeAmt,
        visit_address: orderType === 'furniture' ? (visitAddress || null) : null,
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
        prepaid_amount: 0,
        notes: null,
      }
      setReceiptData(rData)
      setCreatedOrder({ id: order.id, number: order.number })
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

        <Button variant="outline" size="sm" onClick={() => navigate('/orders/wizard')} className="h-9">
          Wizard
        </Button>
      </div>

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
          </div>
          <div className="flex-1 overflow-y-auto p-3">
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
                  className={cn(
                    'p-3 rounded-xl border-[1.5px] cursor-grab active:cursor-grabbing transition-all bg-background',
                    dragging === t.id
                      ? 'border-primary opacity-70 scale-[0.98] shadow-lg'
                      : 'border-border hover:border-primary/40 hover:shadow-sm'
                  )}
                  style={dragging === t.id ? { boxShadow: '0 10px 24px -10px rgba(37,99,235,.5)' } : undefined}
                >
                  <div className="flex justify-between items-start mb-2">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    {t.default_days <= 1 && (
                      <span className="text-[9.5px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                        FAST
                      </span>
                    )}
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
          </div>
        </div>

        {/* ── Колонка 3: workbench (drop zones) + totals ────── */}
        <div className="flex flex-col gap-2.5 min-h-0 overflow-hidden">

          {/* Client header */}
          <div
            className="rounded-2xl px-3.5 py-3 flex items-center gap-3 text-white shrink-0"
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
                <Input
                  placeholder="Поиск клиента..."
                  value={clientQuery}
                  onChange={e => { setClientQuery(e.target.value); setShowClientSearch(true) }}
                  onFocus={() => setShowClientSearch(true)}
                  className="h-8 text-xs bg-white/20 border-white/30 text-white placeholder:text-white/70"
                />
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
              <button
                onClick={() => { setClientId(null); setClientName(''); setClientPhone('') }}
                className="text-xs px-2.5 py-1 border border-white/30 rounded text-white hover:bg-white/10"
              >
                Сменить
              </button>
            )}
          </div>

          {/* Адрес выезда для мебели */}
          {orderType === 'furniture' && (
            <div className="bg-background rounded-2xl border shadow-sm p-2.5 shrink-0">
              <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Адрес выезда</Label>
              <Input
                placeholder="ул. Пушкина, 10, кв. 5"
                value={visitAddress}
                onChange={e => setVisitAddress(e.target.value)}
                className="mt-1 h-8 text-xs"
              />
            </div>
          )}

          {/* Drop zones */}
          <div className="flex-1 grid grid-rows-3 gap-2.5 min-h-0 overflow-y-auto">
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
              orderType={orderType}
              lineSum={lineSum}
            />
            <DropZone
              id="urgent"
              label="Срочный заказ"
              note="24 часа · +50% к стоимости"
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
              orderType={orderType}
              lineSum={lineSum}
            />
            <DropZone
              id="delivery"
              label="С доставкой"
              note="Курьер · +350"
              icon={Truck}
              accentClass="bg-emerald-500/15 text-emerald-600"
              borderActive="border-emerald-500"
              lines={zones.delivery}
              symbol={symbol}
              dropHot={dropHot === 'delivery'}
              onDragOver={(e) => { e.preventDefault(); setDropHot('delivery') }}
              onDragLeave={() => setDropHot(h => h === 'delivery' ? null : h)}
              onDrop={() => dragging && dropTo('delivery', dragging)}
              onBumpQty={(key, d) => bumpQty('delivery', key, d)}
              onRemove={(key) => removeLine('delivery', key)}
              onEdit={(key) => setEditing({ zoneId: 'delivery', key })}
              orderType={orderType}
              lineSum={lineSum}
            />
          </div>

          {/* Totals + payment */}
          <div className="bg-background rounded-2xl border shadow-sm p-3.5 shrink-0">
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {[['cash','Нал.'], ['card','Карта'], ['transfer','Перевод'], ['mixed','Смеш.']].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setPayment(k)}
                  className={cn(
                    'h-8 rounded-md text-xs font-bold border transition-colors',
                    payment === k
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {payment === 'mixed' && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Нал. ({symbol})</Label>
                  <Input
                    type="number" min={0}
                    placeholder="0"
                    value={paymentCash}
                    onChange={e => setPaymentCash(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Карта ({symbol})</Label>
                  <Input
                    type="number" min={0}
                    placeholder="0"
                    value={paymentCard}
                    onChange={e => setPaymentCard(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10.5px] uppercase tracking-wider font-bold text-muted-foreground">Скидка:</span>
              {[0, 5, 10, 15, 20].map(d => (
                <button
                  key={d}
                  onClick={() => setDiscount(d)}
                  className={cn(
                    'flex-1 h-7 rounded-md text-[10.5px] font-bold font-mono border transition-colors',
                    discount === d
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  {d}%
                </button>
              ))}
            </div>

            <div className="font-mono text-xs space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Подытог ({allLines.reduce((s, l) => s + l.qty, 0)} шт)</span>
                <span>{formatCurrency(subtotal)} {symbol}</span>
              </div>
              {surchargeAmt > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Срочно +50%</span>
                  <span>+ {formatCurrency(surchargeAmt)} {symbol}</span>
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
              <div className="flex justify-between items-baseline border-t pt-2 mt-2">
                <span className="font-sans font-bold text-base">Итого</span>
                <span className="text-xl font-extrabold">{formatCurrency(total)} {symbol}</span>
              </div>
            </div>

            <Button
              disabled={isPending || allLines.length === 0}
              onClick={handleSubmit}
              className="w-full mt-3 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
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
        'rounded-2xl border-2 border-dashed p-3 flex flex-col bg-background transition-all min-h-[140px]',
        dropHot ? `${borderActive} bg-muted/30 scale-[1.01]` : 'border-border'
      )}
    >
      <div className="flex items-center gap-2 pb-2 border-b">
        <div className={cn('h-7 w-7 rounded-lg grid place-items-center', accentClass)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold leading-none">{label}</div>
          <div className="text-[10.5px] text-muted-foreground leading-none mt-1">{note}</div>
        </div>
        <div className="font-mono text-xs font-bold">{formatCurrency(total)} {symbol}</div>
      </div>

      {lines.length === 0 ? (
        <div className="flex-1 grid place-items-center text-[11px] text-muted-foreground italic text-center py-3">
          Перетащите сюда позиции<br />из каталога →
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 mt-2 overflow-y-auto">
          {lines.map(l => {
            const hasDetails = l.color || l.defects || l.brand || l.photos.length > 0
            return (
              <div key={l.key} className="bg-muted/40 rounded-lg p-2 flex items-center gap-2">
                <button
                  onClick={() => onEdit(l.key)}
                  className="flex-1 min-w-0 text-left hover:bg-background/50 rounded p-0.5 -m-0.5"
                  title="Редактировать детали"
                >
                  <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                    {l.type.name}
                    {l.photos.length > 0 && <Camera className="h-3 w-3 text-muted-foreground shrink-0" />}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {orderType === 'carpet' && l.width_m && l.length_m
                      ? `${l.width_m}×${l.length_m} м · `
                      : ''}
                    {hasDetails
                      ? [l.color, l.brand, l.defects].filter(Boolean).join(' · ').slice(0, 40)
                      : `${formatCurrency(l.type.default_price)} ${symbol}/шт`}
                  </div>
                </button>
                <button
                  onClick={() => onEdit(l.key)}
                  className="text-muted-foreground hover:text-primary p-1"
                  title="Редактировать"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <div className="flex items-center bg-background rounded border">
                  <button
                    onClick={() => onBumpQty(l.key, -1)}
                    className="px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <Minus className="h-2.5 w-2.5" />
                  </button>
                  <span className="font-mono text-[11px] font-bold w-5 text-center">{l.qty}</span>
                  <button
                    onClick={() => onBumpQty(l.key, 1)}
                    className="px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-2.5 w-2.5" />
                  </button>
                </div>
                <span className="font-mono text-xs font-bold w-16 text-right">
                  {formatCurrency(lineSum(l))}
                </span>
                <button
                  onClick={() => onRemove(l.key)}
                  className="text-muted-foreground hover:text-destructive p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
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
  onClose, onChange, onUploadPhoto,
}: {
  line: CartLine
  orderType: OrderType
  symbol: string
  photoUploading: boolean
  onClose: () => void
  onChange: (patch: Partial<CartLine>) => void
  onUploadPhoto: (file: File) => void
}) {
  const sum = orderType === 'carpet'
    ? ((parseFloat(line.width_m) || 0) * (parseFloat(line.length_m) || 0)) * line.type.default_price * line.qty
    : line.type.default_price * line.qty

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
              <div className="inline-flex items-center bg-muted rounded-lg p-1 mt-1.5">
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
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Дефекты при приёме</Label>
            <div className="flex gap-1.5 flex-wrap mt-1.5">
              {COMMON_DEFECTS.map(d => {
                const list = line.defects.split(',').map(s => s.trim()).filter(Boolean)
                const on = list.includes(d)
                return (
                  <button
                    key={d}
                    onClick={() => {
                      const next = on ? list.filter(x => x !== d) : [...list, d]
                      onChange({ defects: next.join(', ') })
                    }}
                    className={cn(
                      'h-8 px-3 rounded-md text-xs border transition-colors',
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
              Фото изделия ({line.photos.length})
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
