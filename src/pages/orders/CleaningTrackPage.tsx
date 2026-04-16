import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Search, Package, CheckCircle2, Clock, Truck, CreditCard, XCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
import dayjs from 'dayjs'

// ── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = 'received' | 'in_progress' | 'ready' | 'issued' | 'paid' | 'cancelled'

interface TrackOrder {
  id: string
  number: string
  status: OrderStatus
  order_type: string
  total_amount: number
  paid_amount: number
  prepaid_amount: number
  payment_status: string
  ready_date: string | null
  created_at: string
  notes: string | null
  items: { id: string; item_type_name: string; price: number; status: string; ready_date: string | null }[]
}

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<OrderStatus, { label: string; color: string; bg: string; icon: React.ElementType; desc: string }> = {
  received:    { label: 'Получен',   color: 'text-blue-600',    bg: 'bg-blue-100 dark:bg-blue-950/40',    icon: Package,       desc: 'Ваш заказ принят и ожидает обработки.' },
  in_progress: { label: 'В работе',  color: 'text-yellow-600',  bg: 'bg-yellow-100 dark:bg-yellow-950/40', icon: Clock,         desc: 'Мы работаем над вашим заказом.' },
  ready:       { label: 'Готов',     color: 'text-green-600',   bg: 'bg-green-100 dark:bg-green-950/40',   icon: CheckCircle2,  desc: 'Заказ готов! Приходите забирать.' },
  issued:      { label: 'Выдан',     color: 'text-purple-600',  bg: 'bg-purple-100 dark:bg-purple-950/40', icon: Truck,         desc: 'Заказ выдан клиенту.' },
  paid:        { label: 'Оплачен',   color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-950/40', icon: CreditCard, desc: 'Заказ полностью оплачен. Спасибо!' },
  cancelled:   { label: 'Отменён',   color: 'text-gray-500',    bg: 'bg-gray-100 dark:bg-gray-800',       icon: XCircle,       desc: 'Заказ был отменён.' },
}

const STEPS: OrderStatus[] = ['received', 'in_progress', 'ready', 'issued', 'paid']

function ProgressBar({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') return null
  const idx = STEPS.indexOf(status)
  return (
    <div className="flex items-center gap-1 my-4">
      {STEPS.map((s, i) => {
        const done = i <= idx
        const cfg = STATUS_CFG[s]
        return (
          <div key={s} className="flex-1 flex flex-col items-center gap-1">
            <div className={cn(
              'h-2 w-full rounded-full transition-colors',
              done ? 'bg-primary' : 'bg-muted'
            )} />
            <span className={cn('text-[10px] leading-tight text-center', done ? 'text-foreground font-medium' : 'text-muted-foreground')}>
              {cfg.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export function CleaningTrackPage() {
  const { number: paramNumber } = useParams<{ number: string }>()
  const [input, setInput] = useState(paramNumber || '')
  const [order, setOrder] = useState<TrackOrder | null>(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  async function fetchOrder(num: string) {
    const trimmed = num.trim()
    if (!trimmed) return
    setLoading(true)
    setNotFound(false)
    setOrder(null)
    try {
      const { data } = await supabase
        .from('cleaning_orders')
        .select('id, number, status, order_type, total_amount, paid_amount, prepaid_amount, payment_status, ready_date, created_at, notes, items:cleaning_order_items(id, item_type_name, price, status, ready_date)')
        .eq('number', trimmed)
        .maybeSingle()
      if (data) setOrder(data as TrackOrder)
      else setNotFound(true)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (paramNumber) fetchOrder(paramNumber)
  }, [paramNumber])

  const cfg = order ? STATUS_CFG[order.status] : null
  const remaining = order ? Math.max(0, order.total_amount - order.paid_amount) : 0

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Отслеживание заказа</h1>
          <p className="text-sm text-muted-foreground">Введите номер квитанции для проверки статуса</p>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchOrder(input)}
              placeholder="КВ-0001"
              className="w-full h-10 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={() => fetchOrder(input)}
            disabled={loading || !input.trim()}
            className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Найти'}
          </button>
        </div>

        {/* Not found */}
        {notFound && (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto opacity-30 mb-2" />
            <p className="text-sm">Заказ не найден</p>
            <p className="text-xs mt-1">Проверьте номер и попробуйте снова</p>
          </div>
        )}

        {/* Order card */}
        {order && cfg && (
          <div className="bg-background rounded-2xl border shadow-sm overflow-hidden">

            {/* Status header */}
            <div className={cn('px-5 py-4 flex items-center gap-3', cfg.bg)}>
              <cfg.icon className={cn('h-8 w-8 shrink-0', cfg.color)} />
              <div>
                <p className={cn('font-bold text-lg', cfg.color)}>{cfg.label}</p>
                <p className="text-sm text-muted-foreground">{cfg.desc}</p>
              </div>
            </div>

            <div className="px-5 py-4 space-y-4">

              {/* Progress */}
              <ProgressBar status={order.status} />

              {/* Order info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Номер</p>
                  <p className="font-semibold">{order.number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Дата приёма</p>
                  <p className="font-medium">{dayjs(order.created_at).format('DD.MM.YYYY')}</p>
                </div>
                {order.ready_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Срок готовности</p>
                    <p className="font-medium">{dayjs(order.ready_date).format('DD.MM.YYYY')}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Сумма</p>
                  <p className="font-semibold">{formatCurrency(order.total_amount)}</p>
                </div>
              </div>

              {/* Items */}
              {order.items.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Изделия ({order.items.length})</p>
                  <div className="space-y-1.5">
                    {order.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-muted/50 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn(
                            'h-2 w-2 rounded-full shrink-0',
                            item.status === 'issued' ? 'bg-purple-500'
                            : item.status === 'ready' ? 'bg-green-500'
                            : 'bg-yellow-500'
                          )} />
                          <span className="truncate">{item.item_type_name}</span>
                        </div>
                        <span className="text-muted-foreground shrink-0 ml-2">{formatCurrency(item.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment */}
              {remaining > 0 && (
                <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 px-4 py-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">К оплате:</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(remaining)}</span>
                  </div>
                </div>
              )}

              {order.payment_status === 'paid' && (
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-center">
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Полностью оплачен</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Ezze Cleaning · Система управления химчисткой
        </p>
      </div>
    </div>
  )
}
