import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, Loader2, Package, User, Calendar,
  AlertCircle, Printer, Phone, MessageCircle, AlertTriangle,
  Clock, Banknote, X,
} from 'lucide-react'
import { ReceiptModal, type ReceiptData } from '@/components/orders/ReceiptModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/shared/Toaster'
import { useCleaningOrder, useUpdateOrderStatus, useAcceptPayment } from '@/hooks/useCleaningOrders'
import { OrderStatusBadge, PaymentStatusBadge, STATUS_CONFIG } from '@/components/orders/OrderStatusBadge'
import { IssueItemsDialog } from '@/components/orders/IssueItemsDialog'
import { formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import type { OrderStatus } from '@/hooks/useCleaningOrders'
import dayjs from 'dayjs'
import isToday from 'dayjs/plugin/isToday'

dayjs.extend(isToday)

const ITEM_STATUS_LABELS: Record<string, string> = {
  pending: 'В работе',
  ready:   'Готово',
  issued:  'Выдано',
}

const NEXT_STATUSES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  received:    ['in_progress', 'cancelled'],
  in_progress: ['ready', 'cancelled'],
  ready:       ['issued', 'cancelled'],
  issued:      ['paid'],
}

const POSITIVE_STATUSES: OrderStatus[] = ['in_progress', 'ready', 'issued', 'paid']

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const symbol = useCurrencySymbol()

  const { data: order, isLoading } = useCleaningOrder(id)
  const { mutateAsync: updateStatus, isPending: updatingStatus } = useUpdateOrderStatus()
  const { mutateAsync: acceptPayment, isPending: payingInProgress } = useAcceptPayment()

  const [issueOpen, setIssueOpen]         = useState(false)
  const [showReceipt, setShowReceipt]     = useState(false)
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payAmount, setPayAmount]         = useState('')

  const receiptData: ReceiptData | null = order ? {
    id:             order.id,
    number:         order.number,
    created_at:     order.created_at,
    order_type:     order.order_type,
    client:         order.client,
    items:          order.items ?? [],
    total_amount:   order.total_amount,
    prepaid_amount: order.prepaid_amount,
    notes:          order.notes,
  } : null

  async function handleStatusChange(newStatus: OrderStatus) {
    if (!order) return
    try {
      await updateStatus({ id: order.id, status: newStatus })
      toast.success(`Статус изменён: ${STATUS_CONFIG[newStatus].label}`)
    } catch {
      toast.error('Ошибка изменения статуса')
    }
  }

  function openPayDialog() {
    if (!order) return
    const rem = order.total_amount - order.paid_amount
    setPayAmount(rem > 0 ? String(rem) : '')
    setPayDialogOpen(true)
  }

  async function handleConfirmPayment() {
    if (!order) return
    const amount = Number(payAmount)
    if (!amount || isNaN(amount) || amount <= 0) {
      toast.error('Введите корректную сумму')
      return
    }
    try {
      await acceptPayment({ id: order.id, amount })
      toast.success(`Оплата ${formatCurrency(amount)} ${symbol} принята`)
      setPayDialogOpen(false)
    } catch {
      toast.error('Ошибка при сохранении оплаты')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">Заказ не найден</p>
        <Button variant="outline" onClick={() => navigate('/orders')}>Назад</Button>
      </div>
    )
  }

  const nextStatuses    = NEXT_STATUSES[order.status] ?? []
  const canIssue        = order.status === 'ready' || order.status === 'in_progress'
  const items           = order.items ?? []
  const remaining       = order.total_amount - order.paid_amount
  const showPayBtn      = remaining > 0 && order.status !== 'cancelled'

  // Urgency
  const nonFinalStatuses: OrderStatus[] = ['received', 'in_progress', 'ready']
  const isUrgentStatus = nonFinalStatuses.includes(order.status as OrderStatus)
  const readyDateDue   = order.ready_date ? dayjs(order.ready_date) : null
  const isOverdue      = isUrgentStatus && readyDateDue != null && readyDateDue.isBefore(dayjs(), 'day')
  const isDueToday     = isUrgentStatus && readyDateDue != null && readyDateDue.isToday()

  // Client name helper
  const clientName = order.client
    ? [order.client.first_name, order.client.last_name].filter(Boolean).join(' ')
    : null

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold">{order.number}</h1>
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.payment_status} />
          </div>
          <p className="text-xs text-muted-foreground">
            {dayjs(order.created_at).format('DD.MM.YYYY HH:mm')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowReceipt(true)}>
          <Printer className="h-4 w-4 mr-1.5" />
          Квитанция
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-40 space-y-4 pt-4">

        {/* Urgency banners */}
        {isOverdue && (
          <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-4 py-2.5 text-sm font-medium text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Срок сдачи просрочен!
          </div>
        )}
        {!isOverdue && isDueToday && (
          <div className="flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 px-4 py-2.5 text-sm font-medium text-orange-700 dark:text-orange-400">
            <Clock className="h-4 w-4 shrink-0" />
            Срок сдачи сегодня!
          </div>
        )}

        {/* Client / Executor / Notes */}
        <Card>
          <CardContent className="pt-4 space-y-3">

            {order.client ? (
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{clientName}</p>
                  {order.client.phone && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{order.client.phone}</span>
                      <a
                        href={`tel:${order.client.phone}`}
                        className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 transition-colors"
                        title="Позвонить"
                      >
                        <Phone className="h-3 w-3" />
                      </a>
                      <a
                        href={`tg://resolve?phone=${order.client.phone.replace(/[^0-9]/g, '')}`}
                        className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-900/30 dark:text-sky-400 transition-colors"
                        title="Написать в Telegram"
                      >
                        <MessageCircle className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <button className="text-sm text-primary hover:underline">
                  + Без клиента
                </button>
              </div>
            )}

            {order.assigned_to_profile && (
              <div className="flex items-center gap-3">
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-sm">Исп.: {order.assigned_to_profile.display_name}</p>
              </div>
            )}

            {order.ready_date && (
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-sm">Срок: {dayjs(order.ready_date).format('DD.MM.YYYY')}</p>
              </div>
            )}

            {order.notes && (
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                {order.notes}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Изделия ({items.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map(item => (
              <div
                key={item.id}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  item.defects
                    ? 'border-orange-300 bg-orange-50/50 dark:border-orange-700 dark:bg-orange-950/20'
                    : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{item.item_type_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.status === 'issued'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                        : item.status === 'ready'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                    }`}>
                      {ITEM_STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                    {item.color      && <span>Цвет: {item.color}</span>}
                    {item.brand      && <span>Бренд: {item.brand}</span>}
                    {(item as any).area_m2 != null && (
                      <span>Площадь: {Number((item as any).area_m2).toFixed(2)} м²</span>
                    )}
                    {item.ready_date && <span>Срок: {dayjs(item.ready_date).format('DD.MM')}</span>}
                  </div>
                  {item.defects && (
                    <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                      ⚠ {item.defects}
                    </p>
                  )}
                </div>
                <span className="text-sm font-semibold shrink-0">
                  {formatCurrency(item.price)} {symbol}
                </span>
              </div>
            ))}

            <Separator />

            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Итого</span>
                <span className="font-semibold">{formatCurrency(order.total_amount)} {symbol}</span>
              </div>
              {order.prepaid_amount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Предоплата</span>
                  <span>{formatCurrency(order.prepaid_amount)} {symbol}</span>
                </div>
              )}
              {order.paid_amount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Оплачено</span>
                  <span>{formatCurrency(order.paid_amount)} {symbol}</span>
                </div>
              )}
              {remaining > 0 && (
                <div className="flex justify-between font-medium text-orange-600 dark:text-orange-400">
                  <span>Остаток</span>
                  <span>{formatCurrency(remaining)} {symbol}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status change */}
        {nextStatuses.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Изменить статус</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {nextStatuses.map(s => (
                <Button
                  key={s}
                  variant={s === 'cancelled' ? 'outline' : 'default'}
                  size="sm"
                  disabled={updatingStatus}
                  className={
                    s === 'cancelled'
                      ? 'border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30'
                      : POSITIVE_STATUSES.includes(s)
                      ? 'bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600'
                      : ''
                  }
                  onClick={() => handleStatusChange(s)}
                >
                  {STATUS_CONFIG[s].label}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 lg:relative lg:bottom-auto bg-background border-t px-4 py-3 space-y-2 shrink-0">

        {/* Payment inline panel */}
        {payDialogOpen && (
          <div className="flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-700 px-3 py-2">
            <Banknote className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0" />
            <Input
              type="number"
              className="h-8 flex-1 min-w-0 bg-white dark:bg-background border-orange-300 focus-visible:ring-orange-400"
              value={payAmount}
              onChange={e => setPayAmount(e.target.value)}
              placeholder="Сумма"
              autoFocus
            />
            <span className="text-sm text-muted-foreground shrink-0">{symbol}</span>
            <Button
              size="sm"
              className="h-8 bg-green-600 hover:bg-green-700 text-white shrink-0"
              disabled={payingInProgress}
              onClick={handleConfirmPayment}
            >
              {payingInProgress ? <Loader2 className="h-3 w-3 animate-spin" /> : '✓ Подтвердить'}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => setPayDialogOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          {canIssue && (
            <Button className="flex-1" onClick={() => setIssueOpen(true)}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Выдать изделия
            </Button>
          )}
          {showPayBtn && !payDialogOpen && (
            <Button
              variant="outline"
              className={`${canIssue ? '' : 'flex-1'} border-orange-400 text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-600 dark:text-orange-400 dark:hover:bg-orange-950/30`}
              onClick={openPayDialog}
            >
              <Banknote className="h-4 w-4 mr-2" />
              Принять оплату
            </Button>
          )}
        </div>

      </div>

      {/* IssueItemsDialog */}
      {issueOpen && order && (
        <IssueItemsDialog
          order={order}
          open={issueOpen}
          onClose={() => setIssueOpen(false)}
        />
      )}

      {/* ReceiptModal */}
      {showReceipt && receiptData && (
        <ReceiptModal data={receiptData} onClose={() => setShowReceipt(false)} />
      )}
    </div>
  )
}
