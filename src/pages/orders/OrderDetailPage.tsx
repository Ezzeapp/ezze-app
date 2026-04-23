import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, Loader2, Package, User, Calendar,
  AlertCircle, Printer, Phone, MessageCircle, AlertTriangle,
  Clock, Banknote, X, Trash2, Pencil, Plus, Check, Search,
  Bell, MapPin, Copy,
} from 'lucide-react'
import { ReceiptModal, type ReceiptData } from '@/components/orders/ReceiptModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/shared/Toaster'
import {
  useCleaningOrder,
  useUpdateOrderStatus,
  useAcceptPayment,
  useDeleteOrder,
  useAssignClientToOrder,
  useAddItemToOrder,
  useRemoveItemFromOrder,
  useUpdateOrderItem,
} from '@/hooks/useCleaningOrders'
import { OrderStatusBadge, PaymentStatusBadge, STATUS_CONFIG } from '@/components/orders/OrderStatusBadge'
import { IssueItemsDialog } from '@/components/orders/IssueItemsDialog'
import { useClientsPaged } from '@/hooks/useClients'
import { formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import type { OrderStatus, CleaningOrderItem } from '@/hooks/useCleaningOrders'
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

const POSITIVE_STATUSES: OrderStatus[] = ['in_progress', 'ready', 'issued', 'paid']

// ── Поиск клиента для привязки ────────────────────────────────────────────────
function ClientPickerDropdown({ onSelect, onClose }: {
  onSelect: (c: { id: string; first_name: string; last_name?: string | null; phone?: string | null }) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const { data } = useClientsPaged(q, 1, 10)
  const clients = data?.items ?? []

  return (
    <div className="mt-2 rounded-xl border bg-background shadow-lg overflow-hidden">
      <div className="relative p-2">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Имя или телефон..."
          value={q}
          onChange={e => setQ(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {clients.map(c => (
          <button
            key={c.id}
            onClick={() => { onSelect(c); onClose() }}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors flex items-center justify-between"
          >
            <span className="font-medium">{[c.first_name, c.last_name].filter(Boolean).join(' ')}</span>
            {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
          </button>
        ))}
        {q && clients.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted-foreground text-center">Не найдено</p>
        )}
      </div>
      <div className="border-t p-2">
        <button onClick={onClose} className="w-full text-xs text-muted-foreground py-1 hover:text-foreground transition-colors">
          Отмена
        </button>
      </div>
    </div>
  )
}

// ── Строка редактирования изделия ─────────────────────────────────────────────
function EditItemRow({ item, orderId, onClose }: {
  item: CleaningOrderItem
  orderId: string
  onClose: () => void
}) {
  const symbol = useCurrencySymbol()
  const [name,  setName]  = useState(item.item_type_name)
  const [price, setPrice] = useState(String(item.price))
  const [date,  setDate]  = useState(item.ready_date ?? '')
  const { mutateAsync: updateItem, isPending } = useUpdateOrderItem()

  async function handleSave() {
    try {
      await updateItem({
        orderId,
        itemId: item.id,
        data: {
          item_type_name: name.trim() || item.item_type_name,
          price: parseFloat(price) || item.price,
          ready_date: date || null,
        },
      })
      toast.success('Изделие обновлено')
      onClose()
    } catch {
      toast.error('Ошибка сохранения')
    }
  }

  return (
    <div className="mt-2 p-3 rounded-lg bg-muted/50 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-xs">Название</Label>
          <Input value={name} onChange={e => setName(e.target.value)} className="h-7 text-xs mt-0.5" />
        </div>
        <div>
          <Label className="text-xs">Цена ({symbol})</Label>
          <Input type="number" value={price} onChange={e => setPrice(e.target.value)} className="h-7 text-xs mt-0.5" />
        </div>
        <div>
          <Label className="text-xs">Срок</Label>
          <DateInput value={date} onChange={e => setDate(e.target.value)} className="h-7 text-xs mt-0.5" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs flex-1" disabled={isPending} onClick={handleSave}>
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" />Сохранить</>}
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onClose}>Отмена</Button>
      </div>
    </div>
  )
}

// ── Форма добавления нового изделия ───────────────────────────────────────────
function AddItemForm({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const symbol = useCurrencySymbol()
  const [name,  setName]  = useState('')
  const [price, setPrice] = useState('')
  const [date,  setDate]  = useState('')
  const { mutateAsync: addItem, isPending } = useAddItemToOrder()

  async function handleAdd() {
    if (!name.trim()) { toast.error('Введите название'); return }
    if (!price || parseFloat(price) <= 0) { toast.error('Введите цену'); return }
    try {
      await addItem({
        orderId,
        item: {
          item_type_name: name.trim(),
          price: parseFloat(price),
          ready_date: date || null,
        },
      })
      toast.success('Изделие добавлено')
      onClose()
    } catch {
      toast.error('Ошибка добавления')
    }
  }

  return (
    <div className="mt-2 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 space-y-2">
      <p className="text-xs font-medium text-primary">Новое изделие</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-xs">Название *</Label>
          <Input autoFocus placeholder="Куртка..." value={name} onChange={e => setName(e.target.value)} className="h-7 text-xs mt-0.5" />
        </div>
        <div>
          <Label className="text-xs">Цена ({symbol}) *</Label>
          <Input type="number" placeholder="0" value={price} onChange={e => setPrice(e.target.value)} className="h-7 text-xs mt-0.5" />
        </div>
        <div>
          <Label className="text-xs">Срок готовности</Label>
          <DateInput value={date} onChange={e => setDate(e.target.value)} className="h-7 text-xs mt-0.5" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs flex-1" disabled={isPending} onClick={handleAdd}>
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Plus className="h-3 w-3 mr-1" />Добавить</>}
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onClose}>Отмена</Button>
      </div>
    </div>
  )
}

// ── Главный компонент ─────────────────────────────────────────────────────────

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const symbol = useCurrencySymbol()

  const { data: order, isLoading } = useCleaningOrder(id)
  const { mutateAsync: updateStatus,       isPending: updatingStatus  } = useUpdateOrderStatus()
  const { mutateAsync: acceptPayment,      isPending: payingInProgress } = useAcceptPayment()
  const { mutateAsync: deleteOrder,        isPending: deletingOrder    } = useDeleteOrder()
  const { mutateAsync: assignClient,       isPending: assigningClient  } = useAssignClientToOrder()
  const { mutateAsync: removeItem                                      } = useRemoveItemFromOrder()

  const [issueOpen,      setIssueOpen]      = useState(false)
  const [showReceipt,    setShowReceipt]    = useState(false)
  const [payDialogOpen,  setPayDialogOpen]  = useState(false)
  const [payAmount,      setPayAmount]      = useState('')
  const [deleteConfirm,  setDeleteConfirm]  = useState(false)
  const [showClientPick, setShowClientPick] = useState(false)
  const [editingItemId,  setEditingItemId]  = useState<string | null>(null)
  const [addingItem,     setAddingItem]     = useState(false)

  // Feature 1: Cancel reason modal
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelReason,     setCancelReason]     = useState('')

  // Feature 2: TG notify button
  const [notifyOpen, setNotifyOpen] = useState(false)

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

  async function handleStatusChange(newStatus: OrderStatus, note?: string) {
    if (!order) return
    try {
      await updateStatus({ id: order.id, status: newStatus, note })
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

  async function handleDeleteOrder() {
    if (!order) return
    try {
      await deleteOrder(order.id)
      toast.success('Заказ удалён')
      navigate('/orders')
    } catch {
      toast.error('Ошибка удаления')
    }
  }

  async function handleAssignClient(c: { id: string; first_name: string; last_name?: string | null; phone?: string | null }) {
    if (!order) return
    try {
      await assignClient({ id: order.id, client_id: c.id })
      toast.success(`Клиент ${c.first_name} привязан`)
    } catch {
      toast.error('Ошибка привязки клиента')
    }
  }

  async function handleRemoveItem(itemId: string) {
    if (!order) return
    try {
      await removeItem({ orderId: order.id, itemId })
      toast.success('Изделие удалено')
    } catch {
      toast.error('Ошибка удаления изделия')
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

  const nextStatuses = NEXT_STATUSES[order.status] ?? []
  const canIssue     = order.status === 'ready' || order.status === 'in_progress'
  const items        = order.items ?? []
  const remaining    = order.total_amount - order.paid_amount
  const showPayBtn   = remaining > 0 && order.status !== 'cancelled'

  // Urgency
  const nonFinalStatuses: OrderStatus[] = ['received', 'in_progress', 'ready']
  const isUrgentStatus = nonFinalStatuses.includes(order.status as OrderStatus)
  const readyDateDue   = order.ready_date ? dayjs(order.ready_date) : null
  const isOverdue      = isUrgentStatus && readyDateDue != null && readyDateDue.isBefore(dayjs(), 'day')
  const isDueToday     = isUrgentStatus && readyDateDue != null && readyDateDue.isSame(dayjs(), 'day')

  const clientName = order.client
    ? [order.client.first_name, order.client.last_name].filter(Boolean).join(' ')
    : null

  // Feature 4: Payment progress bar
  const paidPercent = order.total_amount > 0
    ? Math.min(100, Math.round((order.paid_amount / order.total_amount) * 100))
    : 0

  // Feature 2: TG notify message + link helpers
  const notifyText = `Ваш заказ ${order.number} готов к выдаче! Химчистка.`
  const tgChatId = (order.client as any)?.tg_chat_id
  const clientPhone = order.client?.phone ?? ''
  const tgLink = tgChatId
    ? `https://t.me/${tgChatId}`
    : `tg://resolve?phone=${clientPhone.replace(/[^0-9]/g, '')}`

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
            {order.ready_date && (
              <span className={cn(
                'ml-2',
                isOverdue ? 'text-red-500 font-medium' : isDueToday ? 'text-orange-500 font-medium' : ''
              )}>
                · Срок: {dayjs(order.ready_date).format('DD.MM.YYYY')}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline" size="sm"
            onClick={() => navigate(`/orders/new?repeat=${order.id}`)}
            title="Создать похожий заказ"
          >
            <Copy className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Повторить</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowReceipt(true)}>
            <Printer className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Квитанция</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteConfirm(true)}
            title="Удалить заказ"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-40 pt-4">

        {/* Urgency banners — full width */}
        {(isOverdue || isDueToday) && (
          <div className="space-y-2 mb-4">
            {isOverdue && (
              <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-4 py-2.5 text-sm font-medium text-red-700 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Срок сдачи просрочен!
              </div>
            )}
            {isDueToday && (
              <div className="flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 px-4 py-2.5 text-sm font-medium text-orange-700 dark:text-orange-400">
                <Clock className="h-4 w-4 shrink-0" />
                Срок сдачи сегодня!
              </div>
            )}
          </div>
        )}

        {/* 2-col on desktop, stacked on mobile */}
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">

          {/* ── Левый сайдбар ── */}
          <div className="flex flex-col gap-4 lg:w-64 xl:w-72 shrink-0">

            {/* Клиент + Детали */}
            <Card>
              <CardContent className="pt-4 space-y-4">

                {/* Клиент */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Клиент</p>

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
                            {order.status === 'ready' && (
                              <button
                                onClick={() => setNotifyOpen(v => !v)}
                                className={cn(
                                  'inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors',
                                  notifyOpen
                                    ? 'bg-violet-200 text-violet-700 dark:bg-violet-800/50 dark:text-violet-300'
                                    : 'bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/30 dark:text-violet-400'
                                )}
                                title="Уведомить клиента"
                              >
                                <Bell className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setShowClientPick(v => !v)}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                        title="Сменить клиента"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowClientPick(v => !v)}
                      className="flex items-center gap-2 text-sm text-primary hover:underline w-fit"
                    >
                      <User className="h-4 w-4" />
                      + Привязать клиента
                    </button>
                  )}

                  {notifyOpen && order.status === 'ready' && order.client && (
                    <div className="rounded-lg border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/20 p-3 space-y-2 mt-2">
                      <p className="text-xs font-medium text-violet-700 dark:text-violet-300">Уведомить клиента</p>
                      <div className="rounded-md bg-white dark:bg-background/60 border px-3 py-2 text-sm text-foreground">
                        {notifyText}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => { navigator.clipboard.writeText(notifyText); toast.success('Скопировано') }}>
                          Скопировать
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => window.open(tgLink, '_blank')}>
                          Открыть Telegram
                        </Button>
                      </div>
                    </div>
                  )}

                  {showClientPick && (
                    <ClientPickerDropdown
                      onSelect={handleAssignClient}
                      onClose={() => setShowClientPick(false)}
                    />
                  )}
                </div>

                {order.assigned_to_profile && (
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="text-sm">Исп.: {order.assigned_to_profile.display_name}</p>
                  </div>
                )}

                {order.order_type === 'carpet' && ((order as any).pickup_date || (order as any).delivery_date) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="text-sm space-y-0.5">
                      {(order as any).pickup_date && <p>Забор: {dayjs((order as any).pickup_date).format('DD.MM.YYYY')}</p>}
                      {(order as any).delivery_date && <p>Доставка: {dayjs((order as any).delivery_date).format('DD.MM.YYYY')}</p>}
                    </div>
                  </div>
                )}
                {order.order_type === 'furniture' && ((order as any).visit_address || (order as any).visit_date) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="text-sm space-y-0.5">
                      {(order as any).visit_address && <p>{(order as any).visit_address}</p>}
                      {(order as any).visit_date && <p>Дата выезда: {dayjs((order as any).visit_date).format('DD.MM.YYYY')}</p>}
                    </div>
                  </div>
                )}

                {order.notes && (
                  <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                    {order.notes}
                  </p>
                )}

                <Separator />

                {/* Детали */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Детали</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Создан</span>
                      <span>{dayjs(order.created_at).format('DD.MM.YY HH:mm')}</span>
                    </div>
                    {order.ready_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Срок</span>
                        <span className={cn(isOverdue ? 'text-red-500 font-medium' : isDueToday ? 'text-orange-500 font-medium' : '')}>
                          {dayjs(order.ready_date).format('DD.MM.YYYY')}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Оплата</span>
                      <PaymentStatusBadge status={order.payment_status} />
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* Изменить статус */}
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
                      onClick={s === 'cancelled' ? () => setCancelDialogOpen(true) : () => handleStatusChange(s)}
                    >
                      {STATUS_CONFIG[s].label}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            )}

          </div>

          {/* ── Правая область: изделия ── */}
          <div className="flex-1 min-w-0">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Изделия ({items.length})</CardTitle>
                  <button
                    onClick={() => { setAddingItem(v => !v); setEditingItemId(null) }}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Добавить
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">

                {addingItem && (
                  <AddItemForm orderId={order.id} onClose={() => setAddingItem(false)} />
                )}

                {items.map(item => (
                  <div key={item.id}>
                    <div
                      className={`flex items-start gap-3 rounded-lg border p-3 group ${
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
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-sm font-semibold">
                          {formatCurrency(item.price)} {symbol}
                        </span>
                        <button
                          onClick={() => setEditingItemId(v => v === item.id ? null : item.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-primary"
                          title="Редактировать"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive"
                          title="Удалить изделие"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {editingItemId === item.id && (
                      <EditItemRow
                        item={item}
                        orderId={order.id}
                        onClose={() => setEditingItemId(null)}
                      />
                    )}
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

                  {order.total_amount > 0 && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Оплачено {paidPercent}%</span>
                        <span>{formatCurrency(order.paid_amount)} / {formatCurrency(order.total_amount)} {symbol}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            paidPercent >= 100
                              ? 'bg-green-500'
                              : paidPercent > 0
                              ? 'bg-orange-400'
                              : 'bg-muted-foreground/30'
                          }`}
                          style={{ width: `${paidPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>
          </div>

        </div>
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

      {/* Диалог подтверждения удаления заказа */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl shadow-2xl p-6 w-72 space-y-4">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold">Удалить заказ {order.number}?</p>
              <p className="text-sm text-muted-foreground">Все изделия и история будут удалены безвозвратно.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" size="sm" onClick={() => setDeleteConfirm(false)}>
                Отмена
              </Button>
              <Button variant="destructive" className="flex-1" size="sm" disabled={deletingOrder} onClick={handleDeleteOrder}>
                {deletingOrder ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Удалить'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 1: Cancel reason modal */}
      {cancelDialogOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl shadow-2xl p-6 w-80 space-y-4">
            <h3 className="font-semibold text-base">Отменить заказ?</h3>
            <div>
              <Label className="text-sm">Причина (необязательно)</Label>
              <textarea
                className="w-full mt-1 p-2 rounded-lg border text-sm resize-none h-20 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Клиент передумал, брак и т.д."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                size="sm"
                onClick={() => { setCancelDialogOpen(false); setCancelReason('') }}
              >
                Назад
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                size="sm"
                disabled={updatingStatus}
                onClick={async () => {
                  await handleStatusChange('cancelled', cancelReason)
                  setCancelDialogOpen(false)
                  setCancelReason('')
                }}
              >
                {updatingStatus ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Подтвердить'}
              </Button>
            </div>
          </div>
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

      {/* ReceiptModal */}
      {showReceipt && receiptData && (
        <ReceiptModal data={receiptData} onClose={() => setShowReceipt(false)} />
      )}
    </div>
  )
}

// ── Вспомогательный хелпер cn ─────────────────────────────────────────────────
function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
