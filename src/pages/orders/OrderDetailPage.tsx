import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Loader2, Package, User, Calendar, AlertCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/shared/Toaster'
import { useCleaningOrder, useUpdateOrderStatus } from '@/hooks/useCleaningOrders'
import { OrderStatusBadge, PaymentStatusBadge, STATUS_CONFIG } from '@/components/orders/OrderStatusBadge'
import { IssueItemsDialog } from '@/components/orders/IssueItemsDialog'
import { formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import type { OrderStatus } from '@/hooks/useCleaningOrders'
import dayjs from 'dayjs'

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

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const symbol = useCurrencySymbol()

  const { data: order, isLoading } = useCleaningOrder(id)
  const { mutateAsync: updateStatus, isPending: updatingStatus } = useUpdateOrderStatus()

  const [issueOpen, setIssueOpen] = useState(false)

  async function handleStatusChange(newStatus: OrderStatus) {
    if (!order) return
    try {
      await updateStatus({ id: order.id, status: newStatus })
      toast.success(`Статус изменён: ${STATUS_CONFIG[newStatus].label}`)
    } catch {
      toast.error('Ошибка изменения статуса')
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
        <p className="text-muted-foreground">Квитанция не найдена</p>
        <Button variant="outline" onClick={() => navigate('/orders')}>Назад</Button>
      </div>
    )
  }

  const nextStatuses = NEXT_STATUSES[order.status] ?? []
  const canIssue = order.status === 'ready' || order.status === 'in_progress'
  const items = order.items ?? []
  const remaining = order.total_amount - order.paid_amount

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
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-32 space-y-4 pt-4">

        {/* Клиент и исполнитель */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            {order.client ? (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">{[order.client.first_name, order.client.last_name].filter(Boolean).join(' ')}</p>
                  {order.client.phone && (
                    <a href={`tel:${order.client.phone}`} className="text-xs text-primary hover:underline">
                      {order.client.phone}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Клиент не указан</p>
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

        {/* Изделия */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Изделия ({items.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{item.item_type_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.status === 'issued' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                      : item.status === 'ready' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                    }`}>
                      {ITEM_STATUS_LABELS[item.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                    {item.color && <span>Цвет: {item.color}</span>}
                    {item.brand && <span>Бренд: {item.brand}</span>}
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

            {/* Итого */}
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

        {/* Смена статуса */}
        {nextStatuses.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Изменить статус</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {nextStatuses.map(s => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  disabled={updatingStatus}
                  onClick={() => handleStatusChange(s)}
                >
                  {STATUS_CONFIG[s].label}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

      </div>

      {/* Footer actions */}
      {(canIssue || order.status === 'cancelled') && (
        <div className="fixed bottom-0 left-0 right-0 lg:relative lg:bottom-auto bg-background border-t px-4 py-3">
          {canIssue && (
            <Button className="w-full" onClick={() => setIssueOpen(true)}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Выдать изделия
            </Button>
          )}
        </div>
      )}

      {/* IssueItemsDialog */}
      {issueOpen && order && (
        <IssueItemsDialog
          order={order}
          open={issueOpen}
          onClose={() => setIssueOpen(false)}
        />
      )}
    </div>
  )
}
