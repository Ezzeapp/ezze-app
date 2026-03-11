import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Zap, Search, X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/shared/Toaster'
import {
  FEATURES, SECTION_LABELS, PLAN_LABELS, PLAN_COLORS, PLAN_ORDER,
  type FeaturePlan, type FeatureSection,
} from '@/config/features'
import { useFeatureFlags, useUpsertFeatureFlag, type FeatureFlag } from '@/hooks/useFeatureFlags'

export function AdminFeaturesTab() {
  const { t } = useTranslation()
  const { data: flags, isLoading } = useFeatureFlags()
  const upsert = useUpsertFeatureFlag()
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()
  const filteredFeatures = query
    ? FEATURES.filter(f =>
        f.label.toLowerCase().includes(query) ||
        f.description.toLowerCase().includes(query) ||
        f.key.toLowerCase().includes(query)
      )
    : null

  const getFlagState = (key: string): FeatureFlag => {
    const dbFlag = flags?.find((f) => f.key === key)
    const config = FEATURES.find((f) => f.key === key)!
    return dbFlag ?? {
      key,
      enabled: true,
      min_plan: config.defaultPlan,
      overrides: [],
      blocked_users: [],
    }
  }

  const handleToggleEnabled = async (key: string, current: boolean) => {
    const flag = getFlagState(key)
    try {
      await upsert.mutateAsync({ ...flag, enabled: !current })
      toast.success(!current ? t('admin.featureEnabled') : t('admin.featureDisabled'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const handlePlanChange = async (key: string, plan: FeaturePlan) => {
    const flag = getFlagState(key)
    try {
      await upsert.mutateAsync({ ...flag, min_plan: plan })
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const sections = Array.from(
    new Set(FEATURES.map((f) => f.section))
  ) as FeatureSection[]

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-4 w-24 mb-2" />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-11 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  const FeatureRow = ({ featureKey, showSection }: { featureKey: string; showSection?: boolean }) => {
    const feature = FEATURES.find(f => f.key === featureKey)!
    const flag = getFlagState(featureKey)
    const isEnabled = flag.enabled
    const currentPlan = flag.min_plan

    return (
      <div
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
          isEnabled
            ? 'bg-background hover:border-primary/30'
            : 'bg-muted/20 opacity-60'
        }`}
      >
        {/* Icon */}
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
          isEnabled ? 'bg-primary/10' : 'bg-muted'
        }`}>
          <Zap className={`h-3.5 w-3.5 ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium leading-tight truncate">{feature.label}</p>
            {showSection && (
              <span className="shrink-0 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full border">
                {SECTION_LABELS[feature.section]}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
            {feature.description}
          </p>
        </div>

        {/* Plan selector */}
        <Select
          value={currentPlan}
          onValueChange={(v) => handlePlanChange(featureKey, v as FeaturePlan)}
          disabled={!isEnabled || upsert.isPending}
        >
          <SelectTrigger className="h-7 w-[88px] text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLAN_ORDER.map((plan) => (
              <SelectItem key={plan} value={plan} className="text-xs">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${PLAN_COLORS[plan]}`}>
                  {PLAN_LABELS[plan]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Toggle */}
        <Switch
          checked={isEnabled}
          disabled={upsert.isPending}
          onCheckedChange={() => handleToggleEnabled(featureKey, isEnabled)}
          className="shrink-0"
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {t('admin.featuresDesc')}
      </p>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск функции..."
          className="pl-9 pr-9 h-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Search results */}
      {filteredFeatures && (
        filteredFeatures.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Ничего не найдено</p>
        ) : (
          <div className="space-y-1">
            {filteredFeatures.map((f) => (
              <FeatureRow key={f.key} featureKey={f.key} showSection />
            ))}
          </div>
        )
      )}

      {/* Grouped by sections */}
      {!filteredFeatures && sections.map((section) => {
        const sectionFeatures = FEATURES.filter((f) => f.section === section)
        return (
          <div key={section} className="space-y-1">
            <div className="flex items-center gap-2 pb-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {SECTION_LABELS[section]}
              </h3>
              <span className="text-xs text-muted-foreground/60">({sectionFeatures.length})</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            {sectionFeatures.map((f) => (
              <FeatureRow key={f.key} featureKey={f.key} />
            ))}
          </div>
        )
      })}
    </div>
  )
}
