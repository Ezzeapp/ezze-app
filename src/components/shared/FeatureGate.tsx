import { type ReactNode, memo, useMemo } from 'react'
import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFeature } from '@/hooks/useFeatureFlags'
import { FEATURE_MAP, PLAN_LABELS } from '@/config/features'
import { cn } from '@/lib/utils'

interface FeatureGateProps {
  feature: string
  children: ReactNode
  /** Переопределить behavior из конфига */
  behavior?: 'hidden' | 'locked' | 'readonly'
  /** Дополнительный класс для locked-обёртки */
  className?: string
}

/**
 * Оборачивает контент проверкой доступа к функции.
 *
 * behavior='hidden'   → null (контент не рендерится вообще)
 * behavior='locked'   → показывает заблокированный overlay с призывом к апгрейду
 * behavior='readonly' → рендерит children с pointer-events-none
 */
export const FeatureGate = memo(function FeatureGate({ feature, children, behavior, className }: FeatureGateProps) {
  const hasAccess = useFeature(feature)
  const { t } = useTranslation()

  const config = useMemo(() => FEATURE_MAP[feature], [feature])

  if (hasAccess) return <>{children}</>

  const effectiveBehavior = behavior ?? config?.behavior ?? 'hidden'
  const requiredPlan = config?.defaultPlan ?? 'pro'

  if (effectiveBehavior === 'hidden') return null

  if (effectiveBehavior === 'readonly') {
    return (
      <div className={cn('pointer-events-none select-none opacity-60', className)}>
        {children}
      </div>
    )
  }

  // locked — показываем overlay поверх контента
  return (
    <div className={cn('relative rounded-xl overflow-hidden', className)}>
      {/* Blurred content */}
      <div className="pointer-events-none select-none opacity-30 blur-[2px]">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 backdrop-blur-sm p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted border">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-semibold text-sm">
            {config?.label ?? feature}
          </p>

          <p className="text-xs text-muted-foreground max-w-[200px]">
            {t('feature.lockedDesc', {
              plan: PLAN_LABELS[requiredPlan],
              defaultValue: `Доступно на плане ${PLAN_LABELS[requiredPlan]} и выше`,
            })}
          </p>
        </div>
        <a
          href="/settings"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t('feature.upgrade', { defaultValue: 'Улучшить план' })}
        </a>
      </div>
    </div>
  )
})

/**
 * Хук-версия для условного рендеринга в коде без обёртки.
 * const canUseTelegram = useCanUse('telegram')
 */
export { useFeature as useCanUse } from '@/hooks/useFeatureFlags'
