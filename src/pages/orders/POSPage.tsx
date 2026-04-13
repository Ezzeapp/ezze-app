import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Plus, Search, ShoppingBag, ArrowLeft, Loader2, Phone, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/shared/Toaster'
import { useCreateOrder, type OrderType, ORDER_TYPE_LABELS, ORDER_TYPE_ICONS } from '@/hooks/useCleaningOrders'
import { useCleaningItemTypes } from '@/hooks/useCleaningItemTypes'
import { useClientsPaged } from '@/hooks/useClients'
import { formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { cn } from '@/lib/utils'
import dayjs from 'dayjs'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'

// ── Типы ─────────────────────────────────────────────────────────────────────

interface CartItem {
  key: number
  item_type_id: string | null
  item_type_name: string
  price: number
  ready_date: string
  // доп поля
  color: string
  brand: string
  defects: string
  // ковры
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

const ORDER_TYPES: OrderType[] = ['clothing', 'carpet', 'furniture']

// Фильтрация типов изделий по категории заказа
function filterByOrderType(types: any[], orderType: OrderType) {
  const carpetKw = ['кв.м', 'ковёр', 'ковр']
  const furnitureKw = ['диван', 'кресло', 'матрас', 'пуф', 'угловой']
  return types.filter(t => {
    const n = t.name.toLowerCase()
    if (orderType === 'carpet')    return carpetKw.some(k => n.includes(k))
    if (orderType === 'furniture') return furnitureKw.some(k => n.includes(k))
    return !carpetKw.some(k => n.includes(k)) && !furnitureKw.some(k => n.includes(k))
  })
}

// ── Компонент диалога размеров ковра ─────────────────────────────────────────

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

// ── Главный компонент ─────────────────────────────────────────────────────────

export function POSPage() {
  const navigate = useNavigate()
  const symbol = useCurrencySymbol()
  const { mutateAsync: createOrder, isPending } = useCreateOrder()

  // Тип заказа
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
  const filteredTypes = filterByOrderType(allTypes, orderType)

  // Корзина
  const [cart, setCart] = useState<CartItem[]>([])
  const [expandedKey, setExpandedKey] = useState<number | null>(null)

  // Диалог размеров ковра
  const [carpetDialog, setCarpetDialog] = useState<{ typeName: string; pricePerSqm: number; typeId: string } | null>(null)

  // Оплата
  const [prepaid, setPrepaid] = useState('')
  const [notes, setNotes] = useState('')

  const total = cart.reduce((s, i) => s + i.price, 0)

  // ── Действия ──────────────────────────────────────────────────────────────

  function addFromCatalog(type: any) {
    if (orderType === 'carpet') {
      setCarpetDialog({ typeName: type.name, pricePerSqm: type.default_price, typeId: type.id })
      return
    }
    const item = makeCartItem(type.name, type.default_price, type.default_days, type.id)
    setCart(prev => [...prev, item])
  }

  function addCarpetItem(typeId: string, typeName: string, pricePerSqm: number, w: number, l: number, area: number, price: number) {
    const item = makeCartItem(typeName, price, 5, typeId)
    item.width_m = String(w)
    item.length_m = String(l)
    item.area_m2 = area
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

  async function handleSubmit() {
    if (cart.length === 0) { toast.error('Добавьте хотя бы одно изделие'); return }
    try {
      const order = await createOrder({
        order_type: orderType,
        client_id: clientId,
        assigned_to: assignedTo,
        prepaid_amount: parseFloat(prepaid) || 0,
        total_amount: total,
        notes: notes || null,
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
      toast.success(`Заказ ${order.number} принят`)
      navigate(`/orders/${order.id}`)
    } catch (e: any) {
      toast.error(e.message || 'Ошибка создания')
    }
  }

  // ── Рендер ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">

      {/* ── Шапка ── */}
      <div className="flex items-center gap-4 px-4 h-14 border-b shrink-0 bg-background">
        <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="font-semibold text-base">Приём заказа</span>

        {/* Тип заказа */}
        <div className="flex gap-1 ml-4">
          {ORDER_TYPES.map(t => (
            <button
              key={t}
              onClick={() => { setOrderType(t); setCart([]) }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                orderType === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted text-muted-foreground border-transparent hover:border-border'
              )}
            >
              {(() => { const Icon = ORDER_TYPE_ICONS[t]; return <Icon className="h-3.5 w-3.5 inline-block mr-1" /> })()}
              {ORDER_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Поиск клиента */}
        <div className="relative ml-auto w-72">
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
              {showClientList && clientSearch && clients.length > 0 && (
                <div className="absolute top-full mt-1 w-full bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
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
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Основная область ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Левая панель: каталог ── */}
        <div className="w-[55%] border-r flex flex-col overflow-hidden bg-muted/20">
          <div className="p-3 pb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              {(() => { const Icon = ORDER_TYPE_ICONS[orderType]; return <Icon className="h-3.5 w-3.5" /> })()}
              {ORDER_TYPE_LABELS[orderType]}
              {orderType === 'carpet' && ' — нажмите для ввода размеров'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 pt-0">
            <div className="grid grid-cols-3 gap-2">
              {filteredTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => addFromCatalog(type)}
                  className="flex flex-col items-start gap-1 p-3 rounded-xl border bg-background hover:bg-accent hover:border-primary/40 transition-all text-left group active:scale-95"
                >
                  <span className="text-sm font-medium leading-tight group-hover:text-primary transition-colors">
                    {type.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {orderType === 'carpet'
                      ? `${formatCurrency(type.default_price)} ${symbol}/м²`
                      : `${formatCurrency(type.default_price)} ${symbol}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {type.default_days} дн.
                  </span>
                </button>
              ))}

              {/* Добавить своё */}
              <button
                onClick={() => {
                  const item = makeCartItem('', 0, 3)
                  setCart(prev => [...prev, item])
                  setExpandedKey(item.key)
                }}
                className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-dashed text-muted-foreground hover:border-primary hover:text-primary transition-all"
              >
                <Plus className="h-5 w-5" />
                <span className="text-xs">Своё</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Правая панель: чек ── */}
        <div className="w-[45%] flex flex-col overflow-hidden">

          {/* Список позиций */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 opacity-20" />
                <p className="text-sm">Нажмите на изделие из каталога</p>
              </div>
            ) : (
              <div className="divide-y">
                {cart.map((item, idx) => (
                  <div key={item.key} className="px-4 py-2">
                    {/* Строка изделия */}
                    <div className="flex items-center gap-2">
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
                        <span className="text-sm font-medium tabular-nums">
                          {formatCurrency(item.price)}
                        </span>
                        <button
                          onClick={() => setExpandedKey(expandedKey === item.key ? null : item.key)}
                          className="text-muted-foreground hover:text-foreground p-1"
                          title="Детали"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeItem(item.key)}
                          className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Раскрытая форма деталей */}
                    {expandedKey === item.key && (
                      <div className="mt-2 ml-7 grid grid-cols-2 gap-2">
                        {orderType !== 'carpet' && (
                          <>
                            <div>
                              <Label className="text-xs">Цвет</Label>
                              <Input placeholder="Синий..." value={item.color}
                                onChange={e => updateItem(item.key, 'color', e.target.value)}
                                className="h-7 text-xs mt-0.5" />
                            </div>
                            <div>
                              <Label className="text-xs">Бренд</Label>
                              <Input placeholder="Zara..." value={item.brand}
                                onChange={e => updateItem(item.key, 'brand', e.target.value)}
                                className="h-7 text-xs mt-0.5" />
                            </div>
                          </>
                        )}
                        <div className="col-span-2">
                          <Label className="text-xs">Дефекты при приёме</Label>
                          <Input placeholder="Пятно, потёртость..." value={item.defects}
                            onChange={e => updateItem(item.key, 'defects', e.target.value)}
                            className="h-7 text-xs mt-0.5" />
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
          <div className="border-t bg-background shrink-0 p-4 space-y-3">

            {/* Исполнитель */}
            {members.length > 0 && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground w-24 shrink-0">Исполнитель</Label>
                <select
                  value={assignedTo ?? ''}
                  onChange={e => setAssignedTo(e.target.value || null)}
                  className="flex-1 h-7 text-xs rounded-md border bg-background px-2"
                >
                  <option value="">— Не назначен —</option>
                  {members.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.display_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Примечание */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground w-24 shrink-0">Примечание</Label>
              <Input
                placeholder="Дополнительно..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="flex-1 h-7 text-xs"
              />
            </div>

            <Separator />

            {/* Итого и предоплата */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Позиций</span>
                <span>{cart.length}</span>
              </div>
              <div className="flex justify-between text-base font-bold">
                <span>Итого</span>
                <span>{formatCurrency(total)} {symbol}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground flex-1">Предоплата</span>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={prepaid}
                  onChange={e => setPrepaid(e.target.value)}
                  className="w-32 h-7 text-sm text-right"
                />
                <span className="text-xs text-muted-foreground">{symbol}</span>
              </div>
            </div>

            <Button
              className="w-full h-11 text-base font-semibold"
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
    </div>
  )
}
