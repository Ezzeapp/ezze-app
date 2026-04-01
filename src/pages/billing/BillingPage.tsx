import { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Zap, Crown, Building2, CreditCard, ExternalLink, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import dayjs from 'dayjs'
import { useAuth } from '@/contexts/AuthContext'
import { useAppSettings, usePlanPrices, DEFAULT_PLAN_PRICES, usePlanLimits, DEFAULT_PLAN_LIMITS, usePlanFeatures, DEFAULT_PLAN_FEATURES, type PlanFeaturesConfig } from '@/hooks/useAppSettings'
import { useMySubscription, useSubscriptionHistory } from '@/hooks/useSubscription'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import { buildPaymeUrl } from '@/lib/payme'
import { buildClickUrl, createClickInvoice } from '@/lib/click'
import { toast } from '@/components/shared/Toaster'
import { useProfile } from '@/hooks/useProfile'
import type { SubscriptionPlan } from '@/types'

// ── Интерфейсы ────────────────────────────────────────────────────────────────

type PlanId = 'free' | 'pro' | 'enterprise'

interface PlanConfig {
  id: PlanId
  icon: React.ComponentType<{ className?: string }>
  color: string
}

const PLANS: PlanConfig[] = [
  { id: 'free',       icon: Zap,       color: 'text-muted-foreground' },
  { id: 'pro',        icon: Crown,     color: 'text-primary' },
  { id: 'enterprise', icon: Building2, color: 'text-amber-600' },
]

// ── Диалог выбора провайдера ──────────────────────────────────────────────────

interface PaymentDialogProps {
  plan: PlanId | null
  onClose: () => void
}

function PaymentDialog({ plan, onClose }: PaymentDialogProps) {
  const { t, i18n } = useTranslation()
  const { user, refetchUser }  = useAuth()
  const { data: settings }     = useAppSettings()
  const { data: planPrices }   = usePlanPrices()
  const { data: profile }      = useProfile()
  const [clickLoading, setClickLoading]   = useState(false)
  const [waitingPayment, setWaitingPayment] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const targetPlan = useRef<string | null>(null)

  // Когда план пользователя изменился — платёж прошёл
  useEffect(() => {
    if (waitingPayment && user?.plan === targetPlan.current) {
      clearInterval(pollingRef.current!)
      pollingRef.current = null
      setWaitingPayment(false)
      toast.success(t('billing.paySuccess', 'Тариф успешно активирован!'))
      onClose()
    }
  }, [user?.plan, waitingPayment, onClose, t])

  // Очищаем интервал при размонтировании
  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current) }, [])

  const startPolling = (expectedPlan: string) => {
    targetPlan.current = expectedPlan
    setWaitingPayment(true)
    // Слушаем фокус вкладки — пользователь вернулся после оплаты
    const onFocus = () => refetchUser()
    window.addEventListener('focus', onFocus, { once: false })
    // Дополнительный polling каждые 4 сек, до 5 минут
    let attempts = 0
    pollingRef.current = setInterval(async () => {
      attempts++
      await refetchUser()
      if (attempts >= 75) { // 75 × 4s = 5 min
        clearInterval(pollingRef.current!)
        pollingRef.current = null
        setWaitingPayment(false)
        window.removeEventListener('focus', onFocus)
      }
    }, 4000)
    // Убираем listener при закрытии
    return () => window.removeEventListener('focus', onFocus)
  }

  if (!plan || plan === 'free') return null

  const prices   = planPrices ?? DEFAULT_PLAN_PRICES
  const priceUZS = prices[plan] ?? 0
  const providers = settings?.payment_providers ?? []

  const handlePayme = () => {
    if (!settings?.payme_merchant_id || !user?.id) return
    const url = buildPaymeUrl(settings.payme_merchant_id, user.id, plan, priceUZS, i18n.language)
    window.open(url, '_blank')
    startPolling(plan)
  }

  const handleClick = async () => {
    if (!settings?.click_service_id || !settings?.click_merchant_id || !user?.id) return
    setClickLoading(true)
    try {
      const { payment_url } = await createClickInvoice(
        user.id,
        plan,
        priceUZS,
        profile?.phone ?? undefined,
      )
      window.open(payment_url, '_blank')
    } catch {
      // Fallback to legacy URL on any error
      const url = buildClickUrl(settings.click_service_id, settings.click_merchant_id, user.id, plan, priceUZS)
      window.open(url, '_blank')
    } finally {
      setClickLoading(false)
    }
    startPolling(plan)
  }

  return (
    <Dialog open={!!plan} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('billing.payDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('billing.payDialog.desc', {
              plan: t(`billing.plan.${plan}`),
              price: formatCurrency(priceUZS, 'UZS', i18n.language),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Состояние ожидания подтверждения платежа */}
          {waitingPayment ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-center">
                {t('billing.payDialog.waiting', 'Ожидаем подтверждение оплаты...')}
              </p>
              <p className="text-xs text-muted-foreground text-center">
                {t('billing.payDialog.waitingHint', 'Вернитесь на эту страницу после оплаты')}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetchUser()}>
                {t('billing.payDialog.checkNow', 'Проверить сейчас')}
              </Button>
            </div>
          ) : (
            <>
              {providers.includes('payme') && settings?.payme_merchant_id && (
                <Button
                  className="w-full gap-2"
                  onClick={handlePayme}
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('billing.payDialog.payme')}
                </Button>
              )}

              {providers.includes('click') && settings?.click_service_id && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleClick}
                  disabled={clickLoading}
                >
                  {clickLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <ExternalLink className="h-4 w-4" />
                  }
                  {t('billing.payDialog.click')}
                </Button>
              )}

              {providers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t('billing.payDialog.notConfigured')}
                </p>
              )}

              <p className="text-xs text-muted-foreground text-center">
                {t('billing.payDialog.hint')}
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── CurrentPlanCard ───────────────────────────────────────────────────────────

function CurrentPlanCard() {
  const { t, i18n } = useTranslation()
  const { user }              = useAuth()
  const { data: sub, isLoading } = useMySubscription()

  const currentPlan = (user?.plan ?? 'free') as PlanId
  const planConfig  = PLANS.find(p => p.id === currentPlan) ?? PLANS[0]
  const PlanIcon    = planConfig.icon

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <PlanIcon className={`h-5 w-5 ${planConfig.color}`} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{t('billing.currentPlan')}</p>
          <p className="text-lg font-bold">{t(`billing.plan.${currentPlan}`)}</p>
        </div>

        <Badge
          variant={currentPlan === 'free' ? 'secondary' : 'default'}
          className="ml-auto"
        >
          {currentPlan === 'free' ? t('billing.statusFree') : t('billing.statusActive')}
        </Badge>
      </div>

      {isLoading ? (
        <Skeleton className="h-4 w-48 mt-3" />
      ) : sub?.expires_at ? (
        <p className="text-sm text-muted-foreground mt-3">
          {t('billing.expiresAt', {
            date: dayjs(sub.expires_at).format('D MMMM YYYY'),
          })}
        </p>
      ) : null}
    </div>
  )
}

// ── PlanCard ──────────────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: PlanConfig
  currentPlan: PlanId
  onUpgrade: (plan: PlanId) => void
}

function PlanCard({ plan, currentPlan, onUpgrade }: PlanCardProps) {
  const { t, i18n }              = useTranslation()
  const { data: planPrices }     = usePlanPrices()
  const { data: planLimits }     = usePlanLimits()
  const { data: planFeaturesData } = usePlanFeatures()

  const PlanIcon    = plan.icon
  const prices      = planPrices ?? DEFAULT_PLAN_PRICES
  const price       = plan.id === 'free' ? 0 : (prices[plan.id as keyof typeof prices] ?? 0)
  const isCurrent   = plan.id === currentPlan
  const isDowngrade = PLANS.findIndex(p => p.id === plan.id) < PLANS.findIndex(p => p.id === currentPlan)

  // ── Динамические фичи на основе реальных лимитов ──────────────────────────
  const dynamicFeatures = useMemo(() => {
    const limits = planLimits ?? DEFAULT_PLAN_LIMITS
    const planKey = plan.id as 'free' | 'pro' | 'enterprise'

    const getLimit = (key: string): number | null => {
      const row = limits.find(r => r.key === key)
      if (!row || !row.enabled) return null
      const val = row[planKey]
      return val === undefined || val === null ? null : Number(val)
    }

    const clientLimit = getLimit('clients')
    const serviceLimit = getLimit('services')
    const apptLimit   = getLimit('appts_month')

    const feats: string[] = []

    // Клиенты
    feats.push(
      clientLimit !== null
        ? t('billing.feat.clientsLimit', { limit: clientLimit })
        : t('billing.feat.clientsUnlimited')
    )

    // Услуги (показываем только если есть лимит)
    if (serviceLimit !== null) {
      feats.push(t('billing.feat.servicesLimit', { limit: serviceLimit }))
    }

    // Записи в месяц
    feats.push(
      apptLimit !== null
        ? t('billing.feat.apptsLimit', { limit: apptLimit })
        : t('billing.feat.apptsUnlimited')
    )

    // Динамические фичи из Supabase (редактируются в админке)
    const planFeats = (planFeaturesData ?? DEFAULT_PLAN_FEATURES)[plan.id as keyof PlanFeaturesConfig] ?? []
    planFeats.forEach(feat => feats.push(feat))

    return feats
  }, [planLimits, plan.id, planFeaturesData, t])

  return (
    <div className={[
      'rounded-xl border p-5 flex flex-col gap-4 transition-all',
      isCurrent ? 'border-primary bg-primary/5' : 'bg-card hover:border-primary/50',
    ].join(' ')}>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${isCurrent ? 'bg-primary/15' : 'bg-muted'}`}>
          <PlanIcon className={`h-5 w-5 ${plan.color}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{t(`billing.plan.${plan.id}`)}</p>
            {isCurrent && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0">
                {t('billing.current')}
              </Badge>
            )}
          </div>
          <p className="text-lg font-bold mt-0.5">
            {price === 0
              ? t('billing.free')
              : formatCurrency(price, 'UZS', i18n.language) + ' / ' + t('billing.perMonth')
            }
          </p>
        </div>
      </div>

      {/* Features */}
      <ul className="space-y-2 flex-1">
        {dynamicFeatures.map((feat, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>{feat}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {plan.id !== 'free' && !isDowngrade && (
        <Button
          variant={isCurrent ? 'outline' : 'default'}
          className="w-full"
          onClick={() => onUpgrade(plan.id)}
        >
          {isCurrent ? t('billing.renew', 'Продлить') : t('billing.upgrade')}
        </Button>
      )}
    </div>
  )
}

// ── SubscriptionHistory ───────────────────────────────────────────────────────

function SubscriptionHistory() {
  const { t, i18n }             = useTranslation()
  const [open, setOpen]          = useState(false)
  const { data: history = [], isLoading } = useSubscriptionHistory()

  if (!isLoading && history.length === 0) return null

  return (
    <div className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <span className="font-semibold">{t('billing.history.title')}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-2">
          {isLoading
            ? [1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)
            : history.map(sub => (
              <div key={sub.id} className="flex items-center justify-between py-2 border-t first:border-t-0">
                <div>
                  <p className="text-sm font-medium">{t(`billing.plan.${sub.plan}`)}</p>
                  <p className="text-xs text-muted-foreground">
                    {sub.provider.toUpperCase()} · {dayjs(sub.created_at).format('DD.MM.YYYY')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {formatCurrency(sub.amount_uzs, 'UZS', i18n.language)}
                  </p>
                  <Badge
                    variant={sub.status === 'active' ? 'default' : 'secondary'}
                    className="text-[10px]"
                  >
                    {t(`billing.status.${sub.status}`)}
                  </Badge>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

// ── BillingPage ───────────────────────────────────────────────────────────────

export function BillingPage() {
  const { t }            = useTranslation()
  const { user }         = useAuth()
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null)

  const currentPlan = (user?.plan ?? 'free') as PlanId

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={t('billing.pageTitle')}
        description={t('billing.pageDesc')}
      >
        <CreditCard className="h-5 w-5 text-primary" />
      </PageHeader>

      {/* Текущий план */}
      <CurrentPlanCard />

      {/* Карточки планов */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            currentPlan={currentPlan}
            onUpgrade={setSelectedPlan}
          />
        ))}
      </div>

      {/* История платежей */}
      <SubscriptionHistory />

      {/* Диалог оплаты */}
      <PaymentDialog
        plan={selectedPlan}
        onClose={() => setSelectedPlan(null)}
      />
    </div>
  )
}
