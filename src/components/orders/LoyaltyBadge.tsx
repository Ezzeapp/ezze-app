import { Medal, Award, Star, Crown } from 'lucide-react'
import { useClientLoyalty, TIER_CONFIG, type LoyaltyTier } from '@/hooks/useCleaningLoyalty'
import { cn } from '@/lib/utils'

const TIER_ICONS: Record<LoyaltyTier, React.ElementType> = {
  bronze: Medal,
  silver: Award,
  gold: Star,
  platinum: Crown,
}

export function LoyaltyBadge({ clientId, className }: { clientId: string | null; className?: string }) {
  const { data: loyalty } = useClientLoyalty(clientId)

  if (!loyalty || loyalty.tier === 'bronze') return null

  const cfg = TIER_CONFIG[loyalty.tier]
  const Icon = TIER_ICONS[loyalty.tier]

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
      cfg.bg, cfg.color, className
    )}>
      <Icon className="h-3 w-3" />
      {cfg.label}
      {loyalty.current_discount_pct > 0 && (
        <span className="opacity-70">−{loyalty.current_discount_pct}%</span>
      )}
    </span>
  )
}
