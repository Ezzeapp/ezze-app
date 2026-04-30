import { useNavigate } from 'react-router-dom'
import { CreditCard, Sparkles, ArrowRight, AlertTriangle } from 'lucide-react'
import dayjs from 'dayjs'
import { useAuth } from '@/contexts/AuthContext'
import { useTeamScope } from '@/contexts/TeamContext'
import { useMySubscription } from '@/hooks/useSubscription'
import { usePlanNames } from '@/hooks/useAppSettings'
import { cn } from '@/lib/utils'

type PlanId = 'free' | 'pro' | 'enterprise'

export function PlanCard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const teamScope = useTeamScope()
  const { data: sub } = useMySubscription()
  const { data: planNames } = usePlanNames()

  // Сотрудник в чужой команде — биллинг недоступен (платит владелец)
  if (teamScope.isTeamOnly) return null

  const plan = (user?.plan ?? 'free') as PlanId
  const planLabel =
    planNames?.[plan] ?? (plan === 'free' ? 'Free' : plan === 'pro' ? 'Pro' : 'Enterprise')

  // ── Free: компактный CTA «Подключить Pro» ────────────────────────────────
  if (plan === 'free') {
    return (
      <div className="m-2">
        <button
          type="button"
          onClick={() => navigate('/billing')}
          className="group w-full text-left rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-colors px-3 py-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">Подключить Pro</span>
            </div>
            <ArrowRight className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 leading-tight">
            Все возможности без ограничений
          </p>
        </button>
      </div>
    )
  }

  // ── Paid: карточка тарифа с прогресс-баром ───────────────────────────────
  const expiresAt = sub?.expires_at ? dayjs(sub.expires_at) : null
  const createdAt = sub?.created_at ? dayjs(sub.created_at) : null
  const now = dayjs()

  const totalDays =
    expiresAt && createdAt && expiresAt.isAfter(createdAt)
      ? expiresAt.diff(createdAt, 'day')
      : (sub?.period_months ?? 1) * 30

  const daysLeft = expiresAt ? Math.max(0, expiresAt.diff(now, 'day')) : null
  const progressPct =
    expiresAt && totalDays > 0
      ? Math.max(0, Math.min(100, (daysLeft! / totalDays) * 100))
      : 100

  const expiringSoon = daysLeft !== null && daysLeft <= 7
  const expired = daysLeft === 0

  return (
    <div className="m-2">
      <button
        type="button"
        onClick={() => navigate('/billing')}
        className={cn(
          'group block w-full text-left rounded-xl border px-3 py-2.5 transition-all',
          expired || expiringSoon
            ? 'bg-amber-500/10 border-amber-300 dark:border-amber-700 hover:bg-amber-500/15'
            : 'bg-gradient-to-br from-primary/10 to-purple-500/10 border-primary/20 hover:border-primary/40'
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {expiringSoon || expired ? (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <CreditCard className="h-3.5 w-3.5 text-primary shrink-0" />
            )}
            <span className="text-xs font-semibold truncate">{planLabel}</span>
          </div>
          {daysLeft !== null && (
            <span
              className={cn(
                'text-[10px] tabular-nums shrink-0',
                expiringSoon || expired
                  ? 'text-amber-700 dark:text-amber-400 font-semibold'
                  : 'text-muted-foreground'
              )}
            >
              {expired ? 'истёк' : `${daysLeft} дн.`}
            </span>
          )}
        </div>
        {expiresAt && (
          <>
            <div className="h-1 bg-background/60 rounded-full mt-2 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  expired || expiringSoon
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-primary to-purple-500'
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] mt-1.5">
              <span className="text-muted-foreground">до {expiresAt.format('DD.MM.YY')}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </>
        )}
      </button>
    </div>
  )
}
