import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Settings2, RefreshCw, LayoutGrid, ListChecks, Plus, X } from 'lucide-react'
import dayjs from 'dayjs'
import {
  useAppSettings, useUpdateAppSetting, APP_SETTINGS_KEY,
  usePlanLimits, useUpdatePlanLimits, DEFAULT_PLAN_LIMITS, type PlanLimitRow,
  usePlanPrices, useUpdatePlanPrices, DEFAULT_PLAN_PRICES,
  usePlanFeatures, useUpdatePlanFeatures, DEFAULT_PLAN_FEATURES, type PlanFeaturesConfig,
} from '@/hooks/useAppSettings'
import { useAllSubscriptions, SUBSCRIPTIONS_KEY } from '@/hooks/useSubscription'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/components/shared/Toaster'

// ── Маппинг ключей лимитов → i18n ─────────────────────────────────────────────

const LIMIT_LABEL: Record<string, string> = {
  clients:     'admin.limitClients',
  services:    'admin.limitServices',
  appts_month: 'admin.limitAppts',
}

function limitToStr(v: number | null): string {
  return v === null ? '' : String(v)
}

function strToLimit(s: string): number | null {
  const trimmed = s.trim()
  if (trimmed === '') return null
  const n = parseInt(trimmed, 10)
  return isNaN(n) ? null : Math.max(0, n)
}

// ── PlanSettings — цены + лимиты ──────────────────────────────────────────────

function PlanSettings() {
  const { t, i18n } = useTranslation()

  // Prices
  const { data: planPrices } = usePlanPrices()
  const updatePrices = useUpdatePlanPrices()
  const [proStr, setProStr] = useState(String(DEFAULT_PLAN_PRICES.pro))
  const [entStr, setEntStr] = useState(String(DEFAULT_PLAN_PRICES.enterprise))

  useEffect(() => {
    if (planPrices) {
      setProStr(String(planPrices.pro))
      setEntStr(String(planPrices.enterprise))
    }
  }, [planPrices])

  const savePrices = async () => {
    await updatePrices.mutateAsync({
      pro:        parseInt(proStr)  || DEFAULT_PLAN_PRICES.pro,
      enterprise: parseInt(entStr) || DEFAULT_PLAN_PRICES.enterprise,
    })
    toast.success(t('admin.billing.saved'))
  }

  // Limits
  const { data: limitsData } = usePlanLimits()
  const updateLimits = useUpdatePlanLimits()
  const [rows, setRows] = useState<PlanLimitRow[]>(DEFAULT_PLAN_LIMITS)

  useEffect(() => {
    if (limitsData) setRows(limitsData)
  }, [limitsData])

  const patchRow = (key: string, patch: Partial<PlanLimitRow>) =>
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r))

  const saveLimits = async () => {
    await updateLimits.mutateAsync(rows)
    toast.success(t('admin.billing.limitsSaved'))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        <div>
          <h3 className="font-semibold text-sm">{t('admin.billing.planSection')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t('admin.billing.planSectionDesc')}</p>
        </div>
      </div>

      {/* ── Цены ── */}
      <div className="rounded-lg border p-4 space-y-4">
        <div>
          <p className="font-medium text-sm">{t('admin.billing.prices')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('admin.billing.pricesHint')}</p>
        </div>

        <div className="space-y-2.5">
          {/* Free — всегда 0, readonly */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium w-28 shrink-0 text-muted-foreground">
              {t('billing.plan.free')}
            </span>
            <Input
              value="0"
              disabled
              className="text-sm w-36 bg-muted/50 text-muted-foreground"
            />
            <span className="text-xs text-muted-foreground">UZS</span>
          </div>

          {/* Pro */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium w-28 shrink-0">{t('billing.plan.pro')}</span>
            <Input
              type="number"
              min={0}
              value={proStr}
              onChange={e => setProStr(e.target.value)}
              className="text-sm w-36"
            />
            <span className="text-xs text-muted-foreground">UZS</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              = {formatCurrency(parseInt(proStr) || 0, 'UZS', i18n.language)}
            </span>
          </div>

          {/* Enterprise */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium w-28 shrink-0">{t('billing.plan.enterprise')}</span>
            <Input
              type="number"
              min={0}
              value={entStr}
              onChange={e => setEntStr(e.target.value)}
              className="text-sm w-36"
            />
            <span className="text-xs text-muted-foreground">UZS</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              = {formatCurrency(parseInt(entStr) || 0, 'UZS', i18n.language)}
            </span>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={savePrices}
          disabled={updatePrices.isPending}
        >
          {t('common.save')}
        </Button>
      </div>

      {/* ── Лимиты ── */}
      <div className="rounded-lg border p-4 space-y-4">
        <div>
          <p className="font-medium text-sm">{t('admin.planLimits')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('admin.limitHint')}</p>
        </div>

        <div className="rounded border overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2.5 text-xs font-medium text-muted-foreground">{t('admin.limitMetric')}</th>
                <th className="text-center p-2.5 text-xs font-medium text-muted-foreground w-12">{t('admin.billing.on')}</th>
                <th className="text-center p-2.5 text-xs font-medium text-muted-foreground">{t('billing.plan.free')}</th>
                <th className="text-center p-2.5 text-xs font-medium text-muted-foreground">{t('billing.plan.pro')}</th>
                <th className="text-center p-2.5 text-xs font-medium text-muted-foreground">{t('billing.plan.enterprise')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(row => (
                <tr key={row.key} className={!row.enabled ? 'opacity-40' : ''}>
                  <td className="p-2.5 text-xs font-medium">
                    {t(LIMIT_LABEL[row.key] ?? row.key)}
                  </td>
                  <td className="p-2.5 text-center">
                    <Switch
                      checked={row.enabled}
                      onCheckedChange={v => patchRow(row.key, { enabled: v })}
                      className="scale-[0.7] origin-center"
                    />
                  </td>
                  {(['free', 'pro', 'enterprise'] as const).map(plan => (
                    <td key={plan} className="p-2 text-center">
                      <Input
                        type="number"
                        min={0}
                        placeholder="∞"
                        value={limitToStr(row[plan])}
                        onChange={e => patchRow(row.key, { [plan]: strToLimit(e.target.value) })}
                        disabled={!row.enabled}
                        className="text-xs h-7 text-center w-16 mx-auto"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground">{t('admin.billing.unlimitedNote')}</p>

        <Button
          size="sm"
          variant="outline"
          onClick={saveLimits}
          disabled={updateLimits.isPending}
        >
          {t('common.save')}
        </Button>
      </div>
    </div>
  )
}

// ── Настройки провайдеров ─────────────────────────────────────────────────────

function ProviderSettings() {
  const { t }               = useTranslation()
  const { data: settings }  = useAppSettings()
  const updateSetting       = useUpdateAppSetting()
  const qc                  = useQueryClient()

  const [paymeMerchantId, setPaymeMerchantId]   = useState('')
  const [paymeKey, setPaymeKey]                 = useState('')
  const [clickServiceId, setClickServiceId]     = useState('')
  const [clickMerchantId, setClickMerchantId]   = useState('')
  const [clickKey, setClickKey]                 = useState('')

  const providers     = settings?.payment_providers ?? []
  const paymeEnabled  = providers.includes('payme')
  const clickEnabled  = providers.includes('click')

  const toggleProvider = async (provider: 'payme' | 'click', enabled: boolean) => {
    const current = settings?.payment_providers ?? []
    const next    = enabled
      ? [...current.filter(p => p !== provider), provider]
      : current.filter(p => p !== provider)
    await updateSetting.mutateAsync({ key: 'payment_providers', value: JSON.stringify(next) })
  }

  const savePayme = async () => {
    if (paymeMerchantId) {
      await updateSetting.mutateAsync({ key: 'payme_merchant_id', value: paymeMerchantId })
    }
    if (paymeKey) {
      await updateSetting.mutateAsync({ key: 'payme_key', value: paymeKey })
    }
    toast.success(t('admin.billing.saved'))
    setPaymeMerchantId('')
    setPaymeKey('')
    qc.invalidateQueries({ queryKey: [APP_SETTINGS_KEY] })
  }

  const saveClick = async () => {
    if (clickServiceId) {
      await updateSetting.mutateAsync({ key: 'click_service_id', value: clickServiceId })
    }
    if (clickMerchantId) {
      await updateSetting.mutateAsync({ key: 'click_merchant_id', value: clickMerchantId })
    }
    if (clickKey) {
      await updateSetting.mutateAsync({ key: 'click_merchant_key', value: clickKey })
    }
    toast.success(t('admin.billing.saved'))
    setClickServiceId('')
    setClickMerchantId('')
    setClickKey('')
    qc.invalidateQueries({ queryKey: [APP_SETTINGS_KEY] })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">{t('admin.billing.providers')}</h3>
      </div>

      {/* Payme */}
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Payme (paycom.uz)</p>
            <p className="text-xs text-muted-foreground">{t('admin.billing.paymeDesc')}</p>
          </div>
          <Switch
            checked={paymeEnabled}
            onCheckedChange={v => toggleProvider('payme', v)}
          />
        </div>

        {paymeEnabled && (
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-1">
              <Label className="text-xs">{t('admin.billing.paymeMerchantId')}</Label>
              <Input
                placeholder={settings?.payme_merchant_id ? '••••••' : t('admin.billing.notSet')}
                value={paymeMerchantId}
                onChange={e => setPaymeMerchantId(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('admin.billing.paymeKey')} <span className="text-muted-foreground">({t('admin.billing.secretNote')})</span></Label>
              <Input
                type="password"
                placeholder={t('admin.billing.keyPlaceholder')}
                value={paymeKey}
                onChange={e => setPaymeKey(e.target.value)}
                className="text-sm"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={savePayme}
              disabled={!paymeMerchantId && !paymeKey}
            >
              {t('common.save')}
            </Button>
          </div>
        )}
      </div>

      {/* Click */}
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Click.uz</p>
            <p className="text-xs text-muted-foreground">{t('admin.billing.clickDesc')}</p>
          </div>
          <Switch
            checked={clickEnabled}
            onCheckedChange={v => toggleProvider('click', v)}
          />
        </div>

        {clickEnabled && (
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-1">
              <Label className="text-xs">{t('admin.billing.clickServiceId')}</Label>
              <Input
                placeholder={settings?.click_service_id ? '••••••' : t('admin.billing.notSet')}
                value={clickServiceId}
                onChange={e => setClickServiceId(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('admin.billing.clickMerchantId')}</Label>
              <Input
                placeholder={settings?.click_merchant_id ? '••••••' : t('admin.billing.notSet')}
                value={clickMerchantId}
                onChange={e => setClickMerchantId(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('admin.billing.clickKey')} <span className="text-muted-foreground">({t('admin.billing.secretNote')})</span></Label>
              <Input
                type="password"
                placeholder={t('admin.billing.keyPlaceholder')}
                value={clickKey}
                onChange={e => setClickKey(e.target.value)}
                className="text-sm"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={saveClick}
              disabled={!clickServiceId && !clickMerchantId && !clickKey}
            >
              {t('common.save')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Таблица подписок ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active:    'default',
  pending:   'secondary',
  cancelled: 'destructive',
  expired:   'outline',
} as const

function SubscriptionsTable() {
  const { t, i18n }          = useTranslation()
  const [page, setPage]       = useState(1)
  const qc                    = useQueryClient()
  const { data, isLoading }   = useAllSubscriptions(page, 20)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{t('admin.billing.subsTitle')}</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => qc.invalidateQueries({ queryKey: [SUBSCRIPTIONS_KEY] })}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !data || data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {t('admin.billing.noSubs')}
        </p>
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">{t('admin.billing.colUser')}</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">{t('admin.billing.colPlan')}</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">{t('admin.billing.colProvider')}</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground hidden md:table-cell">{t('admin.billing.colAmount')}</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">{t('admin.billing.colExpires')}</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">{t('admin.billing.colStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map(sub => {
                  // sub.user — объект из Supabase join select('*, user:users(*)')
                  const userRec  = sub.user
                  const userName = (userRec as any)?.email || (userRec as any)?.name || sub.user_id?.slice(0, 8) || sub.id.slice(0, 8)
                  return (
                    <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium truncate max-w-[120px]">{userName}</td>
                      <td className="p-3">{t(`billing.plan.${sub.plan}`)}</td>
                      <td className="p-3 hidden sm:table-cell uppercase text-xs">{sub.provider}</td>
                      <td className="p-3 hidden md:table-cell">{formatCurrency(sub.amount_uzs, 'UZS', i18n.language)}</td>
                      <td className="p-3 hidden lg:table-cell text-xs text-muted-foreground">
                        {sub.expires_at ? dayjs(sub.expires_at).format('DD.MM.YYYY') : '—'}
                      </td>
                      <td className="p-3">
                        <Badge variant={STATUS_COLORS[sub.status] as any} className="text-[10px]">
                          {t(`billing.status.${sub.status}`)}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Пагинация */}
          {data.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline" size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >←</Button>
              <span className="text-sm text-muted-foreground py-1.5">
                {page} / {data.totalPages}
              </span>
              <Button
                variant="outline" size="sm"
                disabled={page === data.totalPages}
                onClick={() => setPage(p => p + 1)}
              >→</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Редактор фич тарифных планов ─────────────────────────────────────────────

function PlanFeaturesEditor() {
  const { t } = useTranslation()
  const { data: featuresData } = usePlanFeatures()
  const updateFeatures = useUpdatePlanFeatures()

  const [features, setFeatures] = useState<PlanFeaturesConfig>(DEFAULT_PLAN_FEATURES)
  const [newFeats, setNewFeats] = useState<Record<keyof PlanFeaturesConfig, string>>({
    free: '', pro: '', enterprise: '',
  })

  useEffect(() => {
    if (featuresData) setFeatures(featuresData)
  }, [featuresData])

  const addFeature = (plan: keyof PlanFeaturesConfig) => {
    const text = newFeats[plan].trim()
    if (!text) return
    setFeatures(prev => ({ ...prev, [plan]: [...prev[plan], text] }))
    setNewFeats(prev => ({ ...prev, [plan]: '' }))
  }

  const removeFeature = (plan: keyof PlanFeaturesConfig, index: number) => {
    setFeatures(prev => ({
      ...prev,
      [plan]: prev[plan].filter((_, i) => i !== index),
    }))
  }

  const save = async () => {
    await updateFeatures.mutateAsync(features)
    toast.success(t('admin.billing.saved'))
  }

  const plans: { id: keyof PlanFeaturesConfig; label: string }[] = [
    { id: 'free',       label: t('billing.plan.free') },
    { id: 'pro',        label: t('billing.plan.pro') },
    { id: 'enterprise', label: t('billing.plan.enterprise') },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-muted-foreground" />
        <div>
          <h3 className="font-semibold text-sm">{t('admin.billing.featuresSection')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t('admin.billing.featuresSectionDesc')}</p>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-5">
        {plans.map(({ id, label }) => (
          <div key={id} className="space-y-2">
            <p className="text-sm font-medium">{label}</p>

            {/* Список фич */}
            <div className="space-y-1.5">
              {features[id].length === 0 ? (
                <p className="text-xs text-muted-foreground italic">{t('admin.billing.featuresEmpty')}</p>
              ) : (
                features[id].map((feat, i) => (
                  <div key={i} className="flex items-center gap-2 group">
                    <span className="flex-1 text-sm bg-muted/40 rounded px-2.5 py-1 leading-tight">{feat}</span>
                    <button
                      type="button"
                      className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                      onClick={() => removeFeature(id, i)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Поле добавления */}
            <div className="flex items-center gap-2">
              <Input
                value={newFeats[id]}
                onChange={e => setNewFeats(prev => ({ ...prev, [id]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addFeature(id)}
                placeholder={t('admin.billing.featurePlaceholder')}
                className="text-sm h-8"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 shrink-0"
                onClick={() => addFeature(id)}
                disabled={!newFeats[id].trim()}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}

        <Button
          size="sm"
          variant="outline"
          onClick={save}
          disabled={updateFeatures.isPending}
        >
          {t('common.save')}
        </Button>
      </div>
    </div>
  )
}

// ── AdminBillingTab ───────────────────────────────────────────────────────────

export function AdminBillingTab() {
  return (
    <div className="space-y-8">
      {/* Глобальные настройки — инфо */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/30">
        <span className="mt-0.5 text-blue-500 shrink-0">ℹ️</span>
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Изменения применяются ко всей платформе.{' '}
          В будущем каждый продукт сможет переопределить свои тарифы.{' '}
          <a
            href="https://admin.ezze.site/dashboard/settings/billing"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 font-medium"
          >
            Управлять глобально в Суперадмине →
          </a>
        </p>
      </div>
      <PlanSettings />
      <div className="border-t pt-6">
        <PlanFeaturesEditor />
      </div>
      <div className="border-t pt-6">
        <ProviderSettings />
      </div>
      <div className="border-t pt-6">
        <SubscriptionsTable />
      </div>
    </div>
  )
}
