import { Medal, Award, Star, Crown, History } from 'lucide-react'
import { useCleaningClientHistory } from '@/hooks/useCleaningClientHistory'
import { useClientLoyalty, TIER_CONFIG, type LoyaltyTier } from '@/hooks/useCleaningLoyalty'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { formatCurrency, cn } from '@/lib/utils'
import dayjs from 'dayjs'

const TIER_ICONS: Record<LoyaltyTier, React.ElementType> = {
  bronze: Medal, silver: Award, gold: Star, platinum: Crown,
}

const STATUS_LABEL: Record<string, string> = {
  received: 'Принят',
  in_progress: 'В работе',
  ready: 'Готов',
  issued: 'Выдан',
  paid: 'Оплачен',
  cancelled: 'Отменён',
}

const STATUS_COLOR: Record<string, string> = {
  received: 'text-blue-600',
  in_progress: 'text-amber-600',
  ready: 'text-emerald-600',
  issued: 'text-violet-600',
  paid: 'text-emerald-700',
  cancelled: 'text-muted-foreground',
}

export function ClientHistoryCard({ clientId, className }: { clientId: string | null; className?: string }) {
  const { data: history } = useCleaningClientHistory(clientId)
  const { data: loyalty } = useClientLoyalty(clientId)
  const symbol = useCurrencySymbol()

  if (!clientId) return null

  const showLoyalty = loyalty && loyalty.tier !== 'bronze'
  const hasRecent = history && history.recent.length > 0
  const hasTop = history && history.topItems.length > 0
  if (!showLoyalty && !hasRecent && !hasTop) return null

  return (
    <div className={cn('space-y-2.5', className)}>
      {/* Бонусный тир */}
      {showLoyalty && (() => {
        const cfg = TIER_CONFIG[loyalty.tier]
        const Icon = TIER_ICONS[loyalty.tier]
        return (
          <div className={cn('rounded-lg p-2.5 flex items-center gap-2', cfg.bg)}>
            <Icon className={cn('h-5 w-5 shrink-0', cfg.color)} />
            <div className="flex-1 min-w-0">
              <div className={cn('text-xs font-bold', cfg.color)}>{cfg.label}</div>
              <div className="text-[10.5px] text-muted-foreground">
                {loyalty.total_orders} {loyalty.total_orders === 1 ? 'заказ' : 'заказов'}
                {loyalty.current_discount_pct > 0 && ` · скидка ${loyalty.current_discount_pct}%`}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Любимые услуги */}
      {hasTop && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Часто заказывает
          </div>
          <div className="space-y-0.5">
            {history!.topItems.map(it => (
              <div key={it.name} className="flex items-baseline justify-between text-[12px]">
                <span className="truncate">{it.name}</span>
                <span className="font-mono text-muted-foreground shrink-0 ml-2">×{it.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Последние заказы */}
      {hasRecent && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <History className="h-3 w-3" />
            Последние заказы
          </div>
          <div className="space-y-1">
            {history!.recent.map(o => (
              <div key={o.id} className="flex items-baseline justify-between gap-2 text-[12px] py-1 border-b last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="font-mono font-semibold truncate">{o.number}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {dayjs(o.created_at).format('DD.MM.YYYY')}
                    <span className={cn('ml-1.5', STATUS_COLOR[o.status])}>
                      · {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </div>
                </div>
                <div className="font-mono text-[11px] font-bold shrink-0">
                  {formatCurrency(o.total_amount)} {symbol}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
