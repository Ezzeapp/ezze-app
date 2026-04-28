import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { useCleaningOrders } from '@/hooks/useCleaningOrders'
import type { OrderStatus } from '@/hooks/useCleaningOrders'
import { cn } from '@/lib/utils'
import dayjs from 'dayjs'

interface ActivityFeedProps {
  className?: string
  limit?: number
}

const STATUS_TONE: Record<OrderStatus, string> = {
  received: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  ready: 'bg-emerald-500',
  issued: 'bg-slate-400',
  paid: 'bg-emerald-600',
  cancelled: 'bg-rose-400',
}

function timeAgo(iso: string): string {
  const m = dayjs().diff(dayjs(iso), 'minute')
  if (m < 1) return 'сейчас'
  if (m < 60) return `${m}м`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}ч`
  const d = Math.floor(h / 24)
  return `${d}д`
}

export function ActivityFeed({ className, limit = 5 }: ActivityFeedProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data, isLoading } = useCleaningOrders({ perPage: limit, sortBy: 'newest' })
  const orders = data?.orders ?? []

  return (
    <div className={cn('bg-card rounded-2xl border border-border p-5 shadow-sm', className)}>
      <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-foreground">
        <Activity className="h-4 w-4 text-blue-600" />
        {t('homeScreen.activityFeed')}
      </h3>
      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="h-5 rounded bg-muted animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-xs text-muted-foreground italic py-4 text-center">
          {t('homeScreen.activityEmpty')}
        </div>
      ) : (
        <div className="space-y-2.5">
          {orders.map(o => {
            const clientName = o.client
              ? `${o.client.first_name}${o.client.last_name ? ' ' + o.client.last_name : ''}`.trim()
              : t('orders.noClient')
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => navigate(`/orders/${o.id}`)}
                className="w-full flex items-center gap-2 text-xs text-left hover:bg-muted/50 rounded p-1 -m-1 transition"
              >
                <div className={cn('h-2 w-2 rounded-full shrink-0', STATUS_TONE[o.status])} />
                <span className="font-mono font-bold text-foreground">#{o.number}</span>
                <span className="truncate flex-1 text-foreground">{clientName}</span>
                <span className="text-muted-foreground text-[10px] shrink-0">{timeAgo(o.created_at)}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
