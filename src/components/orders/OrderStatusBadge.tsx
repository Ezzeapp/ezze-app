import { Badge } from '@/components/ui/badge'
import type { OrderStatus, PaymentStatus } from '@/hooks/useCleaningOrders'

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  received:    { label: 'Принят',    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  in_progress: { label: 'В работе', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  ready:       { label: 'Готов',    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  issued:      { label: 'Выдан',    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  paid:        { label: 'Оплачен',  className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' },
  cancelled:   { label: 'Отменён', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
}

const PAYMENT_CONFIG: Record<PaymentStatus, { label: string; className: string }> = {
  unpaid:  { label: 'Не оплачен',      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  partial: { label: 'Частично',        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  paid:    { label: 'Оплачен',         className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' },
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.received
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const cfg = PAYMENT_CONFIG[status] ?? PAYMENT_CONFIG.unpaid
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

export { STATUS_CONFIG, PAYMENT_CONFIG }
