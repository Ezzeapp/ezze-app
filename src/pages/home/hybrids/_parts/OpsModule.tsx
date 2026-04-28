import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Package, Truck, type LucideIcon } from 'lucide-react'
import { useCleaningOrders } from '@/hooks/useCleaningOrders'
import type { OrderStatus } from '@/hooks/useCleaningOrders'
import { formatCurrency, cn } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import dayjs from 'dayjs'

type ModuleKind = 'to_issue' | 'in_intake' | 'delivery'

interface OpsModuleProps {
  kind: ModuleKind
  className?: string
}

const MODULE_CONFIG: Record<ModuleKind, {
  icon: LucideIcon
  iconBg: string
  iconText: string
  status?: OrderStatus
  titleKey: string
}> = {
  to_issue: {
    icon: CheckCircle2,
    iconBg: 'bg-emerald-100 dark:bg-emerald-950/40',
    iconText: 'text-emerald-700 dark:text-emerald-300',
    status: 'ready',
    titleKey: 'homeScreen.toIssue',
  },
  in_intake: {
    icon: Package,
    iconBg: 'bg-blue-100 dark:bg-blue-950/40',
    iconText: 'text-blue-700 dark:text-blue-300',
    status: 'received',
    titleKey: 'homeScreen.inIntake',
  },
  delivery: {
    icon: Truck,
    iconBg: 'bg-amber-100 dark:bg-amber-950/40',
    iconText: 'text-amber-700 dark:text-amber-300',
    titleKey: 'homeScreen.delivery',
  },
}

export function OpsModule({ kind, className }: OpsModuleProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const symbol = useCurrencySymbol()
  const cfg = MODULE_CONFIG[kind]
  const Icon = cfg.icon

  // Для to_issue/in_intake — фильтр по статусу. Для delivery — все на сегодня.
  const today = dayjs().format('YYYY-MM-DD')
  const { data, isLoading } = useCleaningOrders(
    kind === 'delivery'
      ? { perPage: 5, sortBy: 'newest', dateFrom: today, dateTo: today }
      : { perPage: 5, sortBy: 'newest', status: cfg.status }
  )
  const orders = data?.orders ?? []
  const total = data?.total ?? 0

  return (
    <div className={cn('bg-card rounded-2xl border border-border p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
          <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', cfg.iconBg, cfg.iconText)}>
            <Icon className="h-4 w-4" />
          </div>
          {t(cfg.titleKey)} · {total}
        </h3>
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="text-[11px] text-primary font-semibold hover:underline"
        >
          {t('homeScreen.all')}
        </button>
      </div>
      {isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-7 rounded bg-muted animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-xs text-muted-foreground italic py-3 text-center">
          {t('homeScreen.opsEmpty')}
        </div>
      ) : (
        <div className="space-y-1 text-xs">
          {orders.slice(0, 3).map(o => {
            const clientName = o.client
              ? `${o.client.first_name}${o.client.last_name ? ' ' + o.client.last_name[0] + '.' : ''}`.trim()
              : t('orders.noClient')
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => navigate(`/orders/${o.id}`)}
                className="w-full flex justify-between items-center p-1.5 hover:bg-muted/50 rounded transition"
              >
                <span className="font-mono font-bold text-foreground">#{o.number}</span>
                <span className="truncate flex-1 mx-2 text-foreground text-left">{clientName}</span>
                <span className="text-muted-foreground font-mono">
                  {formatCurrency(o.total_amount)} {symbol}
                </span>
              </button>
            )
          })}
          {total > 3 && (
            <div className="text-center text-[10px] text-muted-foreground py-1">
              +{total - 3} {t('homeScreen.more')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
