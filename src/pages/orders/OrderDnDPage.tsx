import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Search, Plus, Minus, X, Loader2, Check,
  GripVertical, ShoppingBag, Zap, Truck, UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/shared/Toaster'
import {
  useCreateOrder, useCleaningEnabledOrderTypes, getOrderTypeIcon,
  type OrderType, DEFAULT_ENABLED_CONFIGS,
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

type ZoneId = 'normal' | 'urgent' | 'delivery'

interface CartLine {
  key: number
  type: CleaningItemType
  qty: number
  color: string
}

let keySeq = 0
function makeLine(t: CleaningItemType): CartLine {
  return { key: ++keySeq, type: t, qty: 1, color: '' }
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

  const { data: clientStats } = useQuery({
    queryKey: ['dnd_client_stats', clientId, PRODUCT],
    queryFn: async () => {
      if (!clientId) return null
      const { data } = await supabase
        .from('cleaning_orders')
        .select('id, total_amount, payment_status, created_at')
        .eq('client_id', clientId)
        .eq('product', PRODUCT)
        .order('created_at', { ascending: false })
      const o = data ?? []
      return {
        count: o.length,
        spent: o.filter(r => r.payment_status === 'paid').reduce((s, r) => s + (r.total_amount || 0), 0),
      }
    },
    enabled: !!clientId,
  })

  // Зоны (drag & drop)
  const [zones, setZones] = useState<Record<ZoneId, CartLine[]>>({
    normal: [],
    urgent: [],
    delivery: [],
  })
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropHot, setDropHot] = useState<ZoneId | null>(null)

  function dropTo(zoneId: ZoneId, typeId: string) {
    const t = filteredTypes.find(x => x.id === typeId) || allTypes.find(x => x.id === typeId)
    if (!t) return
    setZones(z => {
      const ex = z[zoneId].find(l => l.type.id === typeId)
      if (ex) {
        return { ...z, [zoneId]: z[zoneId].map(l => l.key === ex.key ? { ...l, qty: l.qty + 1 } : l) }
      }
      return { ...z, [zoneId]: [...z[zoneId], makeLine(t)] }
    })
    setDragging(null)
    setDropHot(null)
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

  // Оплата
  const [payment, setPayment] = useState('cash')
  const [discount, setDiscount] = useState(0)

  // Расчёты
  const allLines = useMemo(() => [...zones.normal, ...zones.urgent, ...zones.delivery], [zones])
  const subtotal = useMemo(
    () => allLines.reduce((s, l) => s + l.type.default_price * l.qty, 0),
    [allLines]
  )
  const urgentTotal = useMemo(
    () => zones.urgent.reduce((s, l) => s + l.type.default_price * l.qty, 0),
    [zones.urgent]
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
        Array.from({ length: l.qty }, () => ({
          item_type_id: l.type.id,
          item_type_name: l.type.name,
          color: l.color || null,
          price: l.type.default_price,
          ready_date: dayjs().add(l.type.default_days || 3, 'day').format('YYYY-MM-DD'),
        }))
      )
      const order = await createOrder({
        order_type: orderType,
        client_id: clientId,
        prepaid_amount: 0,
        total_amount: total,
        ready_date: dayjs().add(zones.urgent.length > 0 ? 1 : 3, 'day').format('YYYY-MM-DD'),
        is_express: zones.urgent.length > 0,
        payment_method: payment,
        surcharge_percent: zones.urgent.length > 0 ? 50 : 0,
        surcharge_amount: surchargeAmt,
        tags,
        items,
      })
      toast.success('Заказ создан')
      navigate(`/orders/${order.id}`)
    } catch (e: any) {
      toast.error(e.message || 'Ошибка создания заказа')
    }
  }

  return (
    <div className="h-full w-full bg-muted/30 overflow-auto p-4">
    <div className="w-full h-[860px] max-h-[calc(100vh-32px)] flex flex-col bg-[#eef1f7] dark:bg-background rounded-xl border shadow-lg overflow-hidden">
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
      <div className="flex-1 grid grid-cols-[300px_1fr_minmax(380px,420px)] gap-3.5 p-3.5 overflow-hidden min-h-0">

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
                    {clientStats && <span> · {clientStats.count} заказов</span>}
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
    </div>
    </div>
  )
}

// ── DropZone ────────────────────────────────────────────────────────────────

function DropZone({
  label, note, icon: Icon, accentClass, borderActive,
  lines, symbol, dropHot,
  onDragOver, onDragLeave, onDrop, onBumpQty, onRemove,
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
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: () => void
  onBumpQty: (key: number, delta: number) => void
  onRemove: (key: number) => void
}) {
  const total = lines.reduce((s, l) => s + l.type.default_price * l.qty, 0)
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
          {lines.map(l => (
            <div key={l.key} className="bg-muted/40 rounded-lg p-2 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">{l.type.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {formatCurrency(l.type.default_price)} {symbol}/шт
                </div>
              </div>
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
                {formatCurrency(l.type.default_price * l.qty)}
              </span>
              <button
                onClick={() => onRemove(l.key)}
                className="text-muted-foreground hover:text-destructive p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
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
