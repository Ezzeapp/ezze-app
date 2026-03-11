import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, XCircle, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePlanLimitCheck } from '@/hooks/useAppSettings'

interface PlanLimitBannerProps {
  limitKey: string        // 'clients' | 'services' | 'appts_month'
  count: number           // current total count
  entityKey?: string      // i18n key suffix: 'clients' | 'services' (for entity name in message)
}

/**
 * Показывает предупреждение когда пользователь использовал 80%+ лимита,
 * и блокирующий баннер когда лимит достигнут.
 * Renders nothing if limit is disabled or not near.
 */
export function PlanLimitBanner({ limitKey, count, entityKey }: PlanLimitBannerProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isEnabled, isReached, isWarning, limit, percent } = usePlanLimitCheck(limitKey, count)

  if (!isEnabled || (!isReached && !isWarning)) return null

  const entity = entityKey ? t(`limits.${entityKey}`) : ''

  if (isReached) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
        <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-destructive">
            {t('limits.reached', { limit, entity })}
          </p>
        </div>
        <Button
          size="sm"
          variant="destructive"
          className="shrink-0 h-7 text-xs gap-1"
          onClick={() => navigate('/billing')}
        >
          <Zap className="h-3 w-3" />
          {t('limits.upgrade')}
        </Button>
      </div>
    )
  }

  // Warning (80–99%)
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-amber-800 dark:text-amber-200">
          {t('limits.warning', { current: count, limit, entity })}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 h-7 text-xs gap-1 border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/40"
        onClick={() => navigate('/billing')}
      >
        <Zap className="h-3 w-3" />
        {t('limits.upgrade')}
      </Button>
    </div>
  )
}
