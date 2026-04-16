import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Wrench, CheckCircle2, Clock, AlertTriangle, Package, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import type { WorkshopOrder, WorkshopOrderStatus } from '@/hooks/useWorkshopOrders'
import { useAppSettings } from '@/hooks/useAppSettings'
import dayjs from 'dayjs'

const STATUS_LABELS: Record<WorkshopOrderStatus, string> = {
  received: 'Принят',
  diagnosing: 'Диагностика',
  waiting_approval: 'Ожидает вашего согласия',
  waiting_parts: 'Ожидает запчасти',
  in_progress: 'В ремонте',
  ready: 'Готов к выдаче',
  issued: 'Выдан',
  paid: 'Оплачен',
  refused: 'Отказ от ремонта',
  cancelled: 'Отменён',
}

const STATUS_DESCRIPTIONS: Record<WorkshopOrderStatus, string> = {
  received: 'Устройство принято, скоро начнём диагностику',
  diagnosing: 'Мастер проводит диагностику',
  waiting_approval: 'Диагностика завершена, свяжитесь с мастером для согласования стоимости',
  waiting_parts: 'Заказаны необходимые запчасти',
  in_progress: 'Идёт ремонт',
  ready: 'Устройство готово, можете забирать',
  issued: 'Устройство выдано',
  paid: 'Оплата получена',
  refused: 'Клиент отказался от ремонта',
  cancelled: 'Заказ отменён',
}

// Упорядочить прогресс для визуализации
const PROGRESS_ORDER: WorkshopOrderStatus[] = [
  'received', 'diagnosing', 'in_progress', 'ready', 'issued',
]

export function WorkshopTrackPage() {
  const { number } = useParams<{ number: string }>()
  const { data: appSettings } = useAppSettings()
  const [order, setOrder] = useState<WorkshopOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  // Когда ссылка пришла с номером заказа (РМ-0001), а не с токеном —
  // прячем финансовую информацию (кто угодно может угадать номер).
  const [withToken, setWithToken] = useState(false)

  useEffect(() => {
    if (!number) return
    ;(async () => {
      const param = decodeURIComponent(number)
      // Сначала пробуем как public_token (uuid hex без дефисов, 32 символа)
      if (/^[a-f0-9]{32,}$/i.test(param)) {
        const { data } = await supabase
          .from('workshop_orders')
          .select('id, number, status, item_type_name, brand, model, ready_date, total_amount, paid_amount, warranty_days, issued_at, created_at, updated_at')
          .eq('public_token', param)
          .maybeSingle()
        if (data) {
          setOrder(data as WorkshopOrder)
          setWithToken(true)
          setLoading(false)
          return
        }
      }

      // Fallback: по номеру квитанции (backward compat, без финансов)
      const { data, error } = await supabase
        .from('workshop_orders')
        .select('id, number, status, item_type_name, brand, model, ready_date, warranty_days, issued_at, created_at, updated_at')
        .eq('number', param)
        .maybeSingle()
      if (error || !data) {
        setNotFound(true)
      } else {
        setOrder(data as WorkshopOrder)
        setWithToken(false)
      }
      setLoading(false)
    })()
  }, [number])

  if (loading) return <LoadingSpinner fullScreen />

  if (notFound || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Заказ не найден</h1>
          <p className="text-sm text-muted-foreground">Проверьте правильность номера квитанции</p>
        </div>
      </div>
    )
  }

  const currentIdx = PROGRESS_ORDER.indexOf(order.status)
  const device = [order.item_type_name, order.brand, order.model].filter(Boolean).join(' ')
  const statusLabel = STATUS_LABELS[order.status]
  const statusDesc = STATUS_DESCRIPTIONS[order.status]
  const isFinal = ['issued', 'paid'].includes(order.status)
  const isProblem = ['refused', 'cancelled', 'waiting_approval'].includes(order.status)

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 sm:p-8">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Wrench className="h-4 w-4" />
            <span>{appSettings?.platform_name ?? 'Workshop'}</span>
          </div>
          <h1 className="text-3xl font-bold">{order.number}</h1>
          <p className="text-muted-foreground mt-1">{device || 'Устройство'}</p>
        </div>

        {/* Status card */}
        <div className={cn(
          'rounded-2xl border p-6 mb-6 text-center',
          isFinal ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900' :
          isProblem ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900' :
          'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900'
        )}>
          <StatusIcon status={order.status} />
          <h2 className="text-xl font-semibold mt-3">{statusLabel}</h2>
          <p className="text-sm text-muted-foreground mt-2">{statusDesc}</p>
        </div>

        {/* Progress timeline (только для активных заказов) */}
        {currentIdx >= 0 && !isProblem && (
          <div className="rounded-2xl border bg-card p-6 mb-6">
            <div className="space-y-1">
              {PROGRESS_ORDER.map((s, idx) => {
                const done = idx <= currentIdx
                const active = idx === currentIdx
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors',
                      done
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      {done ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                    </div>
                    <div className={cn(
                      'flex-1 text-sm',
                      active ? 'font-semibold' : done ? '' : 'text-muted-foreground'
                    )}>
                      {STATUS_LABELS[s]}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Details */}
        <div className="rounded-2xl border bg-card p-6 space-y-3 mb-6 text-sm">
          {order.ready_date && !isFinal && (
            <Row label="Плановая дата готовности" value={dayjs(order.ready_date).format('DD.MM.YYYY')} />
          )}
          {order.issued_at && (
            <Row label="Выдано" value={dayjs(order.issued_at).format('DD.MM.YYYY')} />
          )}
          {withToken && order.total_amount > 0 && (
            <Row label="Итого к оплате" value={formatCurrency(order.total_amount)} bold />
          )}
          {withToken && order.paid_amount > 0 && order.paid_amount < order.total_amount && (
            <Row label="Осталось доплатить" value={formatCurrency(order.total_amount - order.paid_amount)} accent />
          )}
          {order.warranty_days > 0 && order.issued_at && (
            <Row
              label="Гарантия действует до"
              value={dayjs(order.issued_at).add(order.warranty_days, 'day').format('DD.MM.YYYY')}
            />
          )}
        </div>

        <div className="text-center text-xs text-muted-foreground">
          Вопросы по заказу — свяжитесь с мастерской
        </div>
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: WorkshopOrderStatus }) {
  if (['ready', 'issued', 'paid'].includes(status)) {
    return <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
  }
  if (['refused', 'cancelled'].includes(status)) {
    return <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
  }
  if (status === 'waiting_parts') {
    return <Package className="h-12 w-12 text-orange-500 mx-auto" />
  }
  if (status === 'waiting_approval') {
    return <Phone className="h-12 w-12 text-amber-500 mx-auto" />
  }
  return <Clock className="h-12 w-12 text-blue-500 mx-auto animate-pulse" />
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(bold && 'font-semibold', accent && 'text-amber-600 dark:text-amber-400 font-semibold')}>
        {value}
      </span>
    </div>
  )
}
