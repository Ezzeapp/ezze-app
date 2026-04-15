import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Plus, Search, ShoppingBag, ArrowLeft, Loader2, Phone, LayoutGrid, List, CheckCircle2, Trash2, UserPlus, Calendar, Tag } from 'lucide-react'
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

// ── Типы ─────────────────────────────────────────────────────────────────────


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
          <Button className="w-full" onClick={onPrint}>
            Печать квитанции
          </Button>
          <Button variant="outline" className="w-full" onClick={onGoToOrder}>
            Открыть заказ
          </Button>
          <Button variant="ghost" className="w-full" onClick={onNewOrder}>
            Новый заказ
          </Button>
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

  // Группировка по подкатегориям для текущего типа заказа
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
    setOrderType(t); setCart([]); setCatalogSearch(''); setSelectedSubcategory(null)
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
  const [globalReadyDate, setGlobalReadyDate] = useState('')
  const [discount, setDiscount] = useState('')

  const total = cart.reduce((s, i) => s + i.price, 0)
  const discountAmt = total * (parseFloat(discount) || 0) / 100
  const finalTotal = total - discountAmt

  // When globalReadyDate changes, update all cart items
  useEffect(() => {
    if (globalReadyDate) {
      setCart(prev => prev.map(i => ({ ...i, ready_date: globalReadyDate })))
    }
  }, [globalReadyDate])

  // ── Закрытие выпадающего списка клиентов по клику снаружи ────────────────
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

  function updateItem(key: number, field: keyof CartItem, value: string) {
    setCart(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i))
  }

  function selectClient(c: any) {
    setClientId(c.id)
    setClientName([c.first_name, c.last_name].filter(Boolean).join(' ') + (c.phone ? ` · ${c.phone}` : ''))
    setClientSearch('')
    setShowClientList(false)
  }

  function clearClient() {
    setClientId(null)
    setClientName('')
    setClientSearch('')
  }

  function resetForm() {
    setCart([])
    setClientId(null)
    setClientName('')
    setClientSearch('')
    setAssignedTo(null)
    setPrepaid('')
    setNotes('')
    setGlobalReadyDate('')
    setDiscount('')
    setExpandedKey(null)
    setCreatedOrder(null)
    setReceiptData(null)
  }

  async function handleSubmit() {
    if (cart.length === 0) { toast.error('Добавьте хотя бы одно изделие'); return }
    try {
      const order = await createOrder({
        order_type: orderType,
        client_id: clientId,
        assigned_to: assignedTo,
        prepaid_amount: parseFloat(prepaid) || 0,
        total_amount: finalTotal,
        notes: notes || null,
        ready_date: globalReadyDate || null,
        items: cart.map(i => ({
          item_type_id: i.item_type_id,
          item_type_name: i.item_type_name,
          color: i.color || null,
          brand: i.brand || null,
          defects: i.defects || null,
          price: i.price,
          ready_date: i.ready_date || null,
          width_m: i.area_m2 ? parseFloat(i.width_m) : null,
          length_m: i.area_m2 ? parseFloat(i.length_m) : null,
          area_m2: i.area_m2,
        })),
      })

      const rData: ReceiptData = {
        id: order.id,
        number: order.number,
        created_at: order.created_at,
        order_type: orderType,
        client: clientId ? {
          first_name: clientName.split(' · ')[0]?.split(' ')[0] ?? '',
          last_name: clientName.split(' · ')[0]?.split(' ').slice(1).join(' ') ?? null,
          phone: clientName.includes(' · ') ? clientName.split(' · ')[1] : null,
        } : null,
        items: cart.map(i => ({
          item_type_name: i.item_type_name,
          price: i.price,
          ready_date: i.ready_date || null,
          color: i.color || null,
          brand: i.brand || null,
          defects: i.defects || null,
          area_m2: i.area_m2,
          width_m: i.width_m || null,
          length_m: i.length_m || null,
        })),
        total_amount: finalTotal,
        prepaid_amount: parseFloat(prepaid) || 0,
        notes: notes || null,
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

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">

      {/* ── Шапка ── */}
      <div className="flex items-center gap-3 px-4 h-14 border-b shrink-0 bg-background">
        <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="font-semibold text-base">Приём заказа</span>

        {/* Исполнитель */}
        {members.length > 0 && (
          <select
            value={assignedTo ?? ""}
            onChange={e => setAssignedTo(e.target.value || null)}
            className="h-8 text-xs rounded-lg border bg-background px-2 ml-2"
          >
            <option value="">Исполнитель...</option>
            {members.map((m: any) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
        )}

        {/* Поиск клиента */}
        <div className="relative ml-auto w-72" data-client-search>
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
                    <button
                      key={c.id}
                      onClick={() => selectClient(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
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

        {/* ── Тип заказа — боковая панель ── */}
        <div className="w-[82px] shrink-0 border-r flex flex-col gap-1 p-1.5 bg-background overflow-y-auto">
          {enabledOrderTypes.map((cfg: CleaningOrderTypeConfig) => {
            const Icon = getOrderTypeIcon(cfg.icon)
            return (
              <button
                key={cfg.slug}
                onClick={() => handleSetOrderType(cfg.slug)}
                className={cn(
                  'flex flex-col items-center gap-1 px-1 py-2.5 rounded-lg text-xs font-medium transition-colors w-full',
                  orderType === cfg.slug
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="leading-tight text-center">{cfg.label}</span>
              </button>
            )
          })}
        </div>

        {/* ── Каталог ── */}
        <div className={cn("flex-1 border-r flex flex-col overflow-hidden min-h-0", CATALOG_BG[orderType])}>

          {/* Поиск + вид */}
          <div className="px-3 pt-3 pb-2 flex items-center gap-2 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Поиск по каталогу..."
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <div className="flex rounded-lg border overflow-hidden shrink-0">
              <button
                onClick={() => setCatalogView('grid')}
                className={cn('p-1.5 transition-colors', catalogView === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted')}
                title="Плитки"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCatalogView('list')}
                className={cn('p-1.5 transition-colors', catalogView === 'list' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted')}
                title="Список"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Подсказка для ковра */}
          {orderType === 'carpet' && selectedSubcategory && (
            <div className="px-3 pb-1 shrink-0">
              <p className="text-xs text-muted-foreground">Нажмите на позицию для ввода размеров</p>
            </div>
          )}

          {/* Каталог: категории → позиции */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">

            {!catalogSearch && !selectedSubcategory ? (
              /* ── Карточки категорий ── */
              <div className="grid grid-cols-3 gap-2">
                {subcategories.map(sub => (
                  <button
                    key={sub.name}
                    onClick={() => setSelectedSubcategory(sub.name)}
                    className="flex flex-col items-start gap-1 p-3 rounded-xl border bg-background hover:bg-accent hover:border-primary/40 transition-all text-left"
                  >
                    <span className="text-sm font-semibold leading-tight line-clamp-2">{sub.name}</span>
                    <span className="text-xs text-muted-foreground">{sub.count} позиций</span>
                  </button>
                ))}
                {/* Своё */}
                <button
                  onClick={addCustomItem}
                  className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-dashed text-muted-foreground hover:border-primary hover:text-primary transition-all"
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-xs">Своё</span>
                </button>
              </div>
            ) : (
              /* ── Позиции (по категории или поиск) ── */
              <>
                {/* Кнопка назад (только когда выбрана категория, не поиск) */}
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
                  <div className="grid grid-cols-3 gap-2">
                    {visibleTypes.map(type => (
                      <button
                        key={type.id}
                        onClick={() => addFromCatalog(type)}
                        className={cn(
                          "flex flex-col items-start gap-1 p-3 rounded-xl border bg-background hover:bg-accent hover:border-primary/40 transition-all text-left group active:scale-95",
                          flashTypeId === type.id && "ring-2 ring-primary scale-95"
                        )}
                      >
                        <span className="text-sm font-medium leading-tight group-hover:text-primary transition-colors line-clamp-2">
                          {type.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {orderType === 'carpet'
                            ? `${formatCurrency(type.default_price)} ${symbol}/м²`
                            : `${formatCurrency(type.default_price)} ${symbol}`}
                        </span>
                        <span className="text-xs text-muted-foreground">{type.default_days} дн.</span>
                      </button>
                    ))}
                    {/* Своё */}
                    <button
                      onClick={addCustomItem}
                      className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-dashed text-muted-foreground hover:border-primary hover:text-primary transition-all"
                    >
                      <Plus className="h-5 w-5" />
                      <span className="text-xs">Своё</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {visibleTypes.map(type => (
                      <button
                        key={type.id}
                        onClick={() => addFromCatalog(type)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-lg border bg-background hover:bg-accent hover:border-primary/40 transition-all text-left group active:scale-95",
                          flashTypeId === type.id && "ring-2 ring-primary scale-95"
                        )}
                      >
                        <span className="text-sm font-medium group-hover:text-primary transition-colors truncate flex-1 mr-3">
                          {type.name}
                        </span>
                        <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                          <span>
                            {orderType === 'carpet'
                              ? `${formatCurrency(type.default_price)} ${symbol}/м²`
                              : `${formatCurrency(type.default_price)} ${symbol}`}
                          </span>
                          <span>{type.default_days} дн.</span>
                        </div>
                      </button>
                    ))}
                    {/* Своё в виде строки */}
                    <button
                      onClick={addCustomItem}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-muted-foreground hover:border-primary hover:text-primary transition-all"
                    >
                      <Plus className="h-4 w-4" />
                      <span className="text-sm">Своё изделие</span>
                    </button>
                  </div>
                )}

                {visibleTypes.length === 0 && catalogSearch && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Ничего не найдено по «{catalogSearch}»
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Правая панель: чек ── */}
        <div className="w-[40%] flex flex-col overflow-hidden min-h-0">

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
                        {item.item_type_name ? (
                          <p className="text-sm font-medium truncate">{item.item_type_name}</p>
                        ) : (
                          <Input
                            placeholder="Название изделия..."
                            value={item.item_type_name}
                            onChange={e => updateItem(item.key, 'item_type_name', e.target.value)}
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
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {item.defects}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs">Цена ({symbol})</Label>
                          <Input type="number" value={item.price}
                            onChange={e => updateItem(item.key, 'price', e.target.value as any)}
                            className="h-7 text-xs mt-0.5" />
                        </div>
                        <div>
                          <Label className="text-xs">Срок готовности</Label>
                          <Input type="date" value={item.ready_date}
                            onChange={e => updateItem(item.key, 'ready_date', e.target.value)}
                            className="h-7 text-xs mt-0.5" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Нижняя панель: итоги + кнопка */}
          <div className="border-t bg-background shrink-0 p-3 space-y-2">

            {/* Примечание */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground w-20 shrink-0">Примечание</Label>
              <Input
                placeholder="Дополнительно..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="flex-1 h-7 text-xs"
              />
            </div>

            {/* Срок готовности для всех */}
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Label className="text-xs text-muted-foreground w-[4.5rem] shrink-0">Срок для всех</Label>
              <Input
                type="date"
                value={globalReadyDate}
                onChange={e => setGlobalReadyDate(e.target.value)}
                className="flex-1 h-7 text-xs"
              />
            </div>

            <Separator />

            {/* Итого */}
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Позиций: {cart.length}</span>
              <span className="font-bold text-xl tabular-nums">{formatCurrency(finalTotal)} {symbol}</span>
            </div>

            {/* Скидка строка */}
            {discountAmt > 0 && (
              <div className="flex justify-between text-sm font-medium text-green-600 dark:text-green-400">
                <span>Скидка:</span>
                <span>-{formatCurrency(discountAmt)} {symbol}</span>
              </div>
            )}

            {/* К оплате */}
            {parseFloat(prepaid) > 0 && (
              <div className="flex justify-between text-sm font-medium text-orange-600 dark:text-orange-400">
                <span>К оплате:</span>
                <span>{formatCurrency(Math.max(0, finalTotal - (parseFloat(prepaid) || 0)))} {symbol}</span>
              </div>
            )}

            {/* Предоплата */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex-1">Предоплата</span>
              <Input
                type="number" min={0} placeholder="0"
                value={prepaid}
                onChange={e => setPrepaid(e.target.value)}
                className="w-28 h-7 text-sm text-right"
              />
              <span className="text-xs text-muted-foreground">{symbol}</span>
            </div>

            {/* Скидка % */}
            <div className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground flex-1">Скидка</span>
              <Input
                type="number" min={0} max={100} placeholder="0"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                className="w-20 h-7 text-sm text-right"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>

            <div className="flex gap-2">
              {cart.length > 0 && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive hover:border-destructive"
                  onClick={() => { setCart([]); setExpandedKey(null) }}
                  title="Очистить корзину"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                className="flex-1 h-10 text-sm font-semibold"
                onClick={handleSubmit}
                disabled={isPending || cart.length === 0}
              >
                {isPending
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <ShoppingBag className="h-4 w-4 mr-2" />}
                Принять заказ
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Диалог размеров ковра */}
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

      {/* Диалог успешного создания */}
      {createdOrder && !showReceipt && (
        <OrderCreatedDialog
          orderNumber={createdOrder.number}
          onPrint={() => setShowReceipt(true)}
          onGoToOrder={() => navigate(`/orders/${createdOrder.id}`)}
          onNewOrder={() => { resetForm(); setOrderType('clothing') }}
        />
      )}

      {/* Модальное окно квитанции */}
      {showReceipt && receiptData && (
        <ReceiptModal
          data={receiptData}
          onClose={() => { setShowReceipt(false); resetForm(); setOrderType('clothing') }}
        />
      )}

      {/* Быстрое создание клиента */}
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
