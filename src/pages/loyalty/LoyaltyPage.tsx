import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Gift, ChevronDown, ChevronUp, Loader2, UserPlus, Check, Star, Pencil, Trash2, Plus, Award, Crown, Gem, CalendarDays } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/components/shared/Toaster'
import {
  useLoyaltySettings,
  useUpdateLoyaltySettings,
  useReferrals,
  useRewardReferral,
  useLoyaltyHolidays,
  useCreateLoyaltyHoliday,
  useUpdateLoyaltyHoliday,
  useDeleteLoyaltyHoliday,
  DEFAULT_LOYALTY_SETTINGS,
  type LoyaltySettings,
  type LoyaltyHoliday,
} from '@/hooks/useLoyalty'
import dayjs from 'dayjs'

// ── Numeric Input helper ───────────────────────────────────────────────────────
function NumInput({
  label,
  hint,
  value,
  onChange,
  min = 1,
  step = 1,
  float = false,
  className = 'h-9 w-28',
}: {
  label: string
  hint?: string
  value: number
  onChange: (v: number) => void
  min?: number
  step?: number
  float?: boolean
  className?: string
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={e => {
          const v = float ? parseFloat(e.target.value) : parseInt(e.target.value)
          onChange(Math.max(min, isNaN(v) ? min : v))
        }}
        className={className}
      />
    </div>
  )
}

// ── Holiday form default ───────────────────────────────────────────────────────
const EMPTY_HOLIDAY: Omit<LoyaltyHoliday, 'id' | 'master_id' | 'created_at'> = {
  name: '',
  date_type: 'annual',
  date_value: '',
  points_multiplier: 1,
  bonus_points: 0,
  discount_pct: 0,
  enabled: true,
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card>
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setOpen(v => !v)}
      >
        <span className="font-semibold text-sm">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <CardContent className="pt-0 pb-4 space-y-4">{children}</CardContent>}
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LoyaltyPage() {
  const { t } = useTranslation()
  const { data: savedSettings, isLoading } = useLoyaltySettings()
  const update = useUpdateLoyaltySettings()
  const { data: referrals = [] } = useReferrals()
  const rewardReferral = useRewardReferral()
  const { data: holidays = [] } = useLoyaltyHolidays()
  const createHoliday = useCreateLoyaltyHoliday()
  const updateHoliday = useUpdateLoyaltyHoliday()
  const deleteHoliday = useDeleteLoyaltyHoliday()

  const [form, setForm] = useState<LoyaltySettings>(DEFAULT_LOYALTY_SETTINGS)

  const [holidayModalOpen, setHolidayModalOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<LoyaltyHoliday | null>(null)
  const [holidayForm, setHolidayForm] = useState<Omit<LoyaltyHoliday, 'id' | 'master_id' | 'created_at'>>(EMPTY_HOLIDAY)

  useEffect(() => {
    if (savedSettings) setForm(savedSettings)
  }, [savedSettings])

  const set = <K extends keyof LoyaltySettings>(key: K, val: LoyaltySettings[K]) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const handleSave = async () => {
    try {
      const { id, master_id, ...payload } = form as any
      await update.mutateAsync(payload)
      toast.success(t('loyalty.saved'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const handleReward = async (r: (typeof referrals)[0]) => {
    try {
      await rewardReferral.mutateAsync({
        referralId: r.id,
        referrerClientId: r.referrer_client_id,
        referredClientId: r.referred_client_id,
        referrerBonus: form.referrer_bonus,
        referreeBonus: form.referree_bonus,
      })
      toast.success(t('loyalty.rewardedReferral'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const openCreateHoliday = () => {
    setEditingHoliday(null)
    setHolidayForm(EMPTY_HOLIDAY)
    setHolidayModalOpen(true)
  }
  const openEditHoliday = (h: LoyaltyHoliday) => {
    setEditingHoliday(h)
    const { id, master_id, created_at, ...rest } = h
    setHolidayForm(rest)
    setHolidayModalOpen(true)
  }
  const handleSaveHoliday = async () => {
    if (!holidayForm.name.trim() || !holidayForm.date_value.trim()) {
      toast.error(t('common.saveError'))
      return
    }
    try {
      if (editingHoliday) {
        await updateHoliday.mutateAsync({ id: editingHoliday.id, ...holidayForm })
      } else {
        await createHoliday.mutateAsync(holidayForm)
      }
      setHolidayModalOpen(false)
      toast.success(t('loyalty.saved'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }
  const handleDeleteHoliday = async (id: string) => {
    try {
      await deleteHoliday.mutateAsync(id)
    } catch {
      toast.error(t('common.saveError'))
    }
  }
  const setHol = <K extends keyof typeof holidayForm>(key: K, val: (typeof holidayForm)[K]) =>
    setHolidayForm(prev => ({ ...prev, [key]: val }))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-20 max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10 text-primary">
          <Gift className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{t('loyalty.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('loyalty.subtitle')}</p>
        </div>
      </div>

      {/* Master switch */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-sm">{t('loyalty.enabled')}</p>
            <p className="text-xs text-muted-foreground">{t('loyalty.enabledDesc')}</p>
          </div>
          <Switch checked={form.enabled} onCheckedChange={v => set('enabled', v)} />
        </CardContent>
      </Card>

      {form.enabled && (
        <>
          {/* Points */}
          <Section title={t('loyalty.pointsSection')}>
            <NumInput
              label={t('loyalty.earnRate')}
              hint={t('loyalty.earnRateDesc')}
              value={form.earn_per_1000}
              onChange={v => set('earn_per_1000', v)}
            />
            <NumInput
              label={t('loyalty.redeemRate')}
              hint={t('loyalty.redeemRateDesc')}
              value={form.redeem_per_100pts}
              onChange={v => set('redeem_per_100pts', v)}
            />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{t('loyalty.autoRedeem')}</p>
                <p className="text-xs text-muted-foreground">{t('loyalty.autoRedeemDesc')}</p>
              </div>
              <Switch checked={form.auto_redeem} onCheckedChange={v => set('auto_redeem', v)} />
            </div>
          </Section>

          {/* Levels */}
          <Section title={t('loyalty.levelsSection')}>
            <div className="space-y-3">
              {/* Regular */}
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-sm">{t('loyalty.levelRegular')}</span>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <NumInput
                    label={t('loyalty.fromVisits')}
                    value={form.level_regular_visits}
                    onChange={v => set('level_regular_visits', v)}
                  />
                  <NumInput
                    label={t('loyalty.discountPct')}
                    value={form.discount_regular}
                    onChange={v => set('discount_regular', v)}
                    min={0}
                  />
                </div>
              </div>
              {/* VIP */}
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-sm">{t('loyalty.levelVip')}</span>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <NumInput
                    label={t('loyalty.fromVisits')}
                    value={form.level_vip_visits}
                    onChange={v => set('level_vip_visits', v)}
                  />
                  <NumInput
                    label={t('loyalty.discountPct')}
                    value={form.discount_vip}
                    onChange={v => set('discount_vip', v)}
                    min={0}
                  />
                </div>
              </div>
              {/* Premium */}
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Gem className="h-4 w-4 text-violet-500" />
                  <span className="font-medium text-sm">{t('loyalty.levelPremium')}</span>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <NumInput
                    label={t('loyalty.fromVisits')}
                    value={form.level_premium_visits}
                    onChange={v => set('level_premium_visits', v)}
                  />
                  <NumInput
                    label={t('loyalty.discountPct')}
                    value={form.discount_premium}
                    onChange={v => set('discount_premium', v)}
                    min={0}
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* Referral */}
          <Section title={t('loyalty.referralSection')} defaultOpen={false}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{t('loyalty.referralEnabled')}</p>
                <p className="text-xs text-muted-foreground">{t('loyalty.referralDesc')}</p>
              </div>
              <Switch checked={form.referral_enabled} onCheckedChange={v => set('referral_enabled', v)} />
            </div>
            {form.referral_enabled && (
              <div className="space-y-3 pt-1">
                <NumInput
                  label={t('loyalty.referrerBonus')}
                  value={form.referrer_bonus}
                  onChange={v => set('referrer_bonus', v)}
                  min={0}
                />
                <NumInput
                  label={t('loyalty.referreeBonus')}
                  value={form.referree_bonus}
                  onChange={v => set('referree_bonus', v)}
                  min={0}
                />
              </div>
            )}
          </Section>

          {/* Referrals list */}
          {form.referral_enabled && referrals.length > 0 && (
            <Section title={t('loyalty.referralsList')} defaultOpen={false}>
              <div className="space-y-2">
                {referrals.map(r => {
                  const referrerName = r.referrer
                    ? `${r.referrer.first_name} ${r.referrer.last_name || ''}`.trim()
                    : '—'
                  const referredName = r.referred
                    ? `${r.referred.first_name} ${r.referred.last_name || ''}`.trim()
                    : '—'
                  return (
                    <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{referrerName}</span>
                          <span className="text-muted-foreground mx-1">→</span>
                          <span className="font-medium">{referredName}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {dayjs(r.created_at).format('D MMM YYYY')}
                        </p>
                      </div>
                      {r.status === 'rewarded' ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300 shrink-0 gap-1">
                          <Check className="h-3 w-3" /> {t('loyalty.rewarded')}
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          disabled={rewardReferral.isPending}
                          onClick={() => handleReward(r)}
                        >
                          {t('loyalty.rewardBtn')}
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          {/* Holidays & Special Days */}
          <Section title={t('loyalty.holidaysSection')} defaultOpen={false}>
            <div className="space-y-2">
              {holidays.map(h => {
                const dateLabel = h.date_type === 'annual'
                  ? `${t('loyalty.holidayDateTypeAnnual')} ${h.date_value}`
                  : h.date_value
                const bonuses = [
                  h.points_multiplier !== 1 && `×${h.points_multiplier} ${t('loyalty.pts')}`,
                  h.bonus_points > 0 && `+${h.bonus_points} ${t('loyalty.pts')}`,
                  h.discount_pct > 0 && `−${h.discount_pct}%`,
                ].filter(Boolean).join(' · ')
                return (
                  <div key={h.id} className="flex items-center gap-2.5 rounded-lg border p-3">
                    <Star className="h-4 w-4 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{h.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3 inline mr-1" />
                        {dateLabel}
                        {bonuses ? ` · ${bonuses}` : ''}
                      </p>
                    </div>
                    {!h.enabled && (
                      <Badge variant="outline" className="text-xs shrink-0">{t('loyalty.holidayInactive')}</Badge>
                    )}
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                      onClick={() => openEditHoliday(h)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteHoliday(h.id)}
                      disabled={deleteHoliday.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              })}
              {holidays.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">{t('loyalty.noHolidays')}</p>
              )}
              <Button
                variant="outline" size="sm" className="w-full gap-2"
                onClick={openCreateHoliday}
              >
                <Plus className="h-4 w-4" />
                {t('loyalty.addHoliday')}
              </Button>
            </div>
          </Section>
        </>
      )}

      {/* Save */}
      <Button
        className="w-full"
        onClick={handleSave}
        disabled={update.isPending}
      >
        {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {t('common.save')}
      </Button>

      {/* Holiday modal */}
      <Dialog open={holidayModalOpen} onOpenChange={setHolidayModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingHoliday ? t('loyalty.editHoliday') : t('loyalty.addHoliday')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-sm">{t('loyalty.holidayName')}</Label>
              <Input
                value={holidayForm.name}
                onChange={e => setHol('name', e.target.value)}
                placeholder={t('loyalty.holidayNamePlaceholder')}
                className="h-9"
              />
            </div>

            {/* Date type */}
            <div className="space-y-1.5">
              <Label className="text-sm">{t('loyalty.holidayDateType')}</Label>
              <div className="flex gap-2">
                {(['annual', 'once'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setHol('date_type', type)}
                    className={`flex-1 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                      holidayForm.date_type === type
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-muted'
                    }`}
                  >
                    {type === 'annual' ? t('loyalty.holidayDateTypeAnnual') : t('loyalty.holidayDateTypeOnce')}
                  </button>
                ))}
              </div>
            </div>

            {/* Date value */}
            <div className="space-y-1.5">
              <Label className="text-sm">{t('loyalty.holidayDateValue')}</Label>
              {holidayForm.date_type === 'annual' ? (
                <Input
                  value={holidayForm.date_value}
                  onChange={e => setHol('date_value', e.target.value)}
                  placeholder="MM-DD"
                  maxLength={5}
                  className="h-9 font-mono"
                />
              ) : (
                <Input
                  type="date"
                  value={holidayForm.date_value}
                  onChange={e => setHol('date_value', e.target.value)}
                  className="h-9"
                />
              )}
              <p className="text-xs text-muted-foreground">{t('loyalty.holidayDateValueHint')}</p>
            </div>

            {/* Points multiplier */}
            <NumInput
              label={t('loyalty.holidayMultiplier')}
              hint={t('loyalty.holidayMultiplierHint')}
              value={holidayForm.points_multiplier}
              onChange={v => setHol('points_multiplier', v)}
              min={0}
              step={0.5}
              float
              className="h-9 w-24"
            />

            {/* Bonus points */}
            <NumInput
              label={t('loyalty.holidayBonusPts')}
              hint={t('loyalty.holidayBonusPtsHint')}
              value={holidayForm.bonus_points}
              onChange={v => setHol('bonus_points', v)}
              min={0}
              className="h-9 w-24"
            />

            {/* Discount */}
            <NumInput
              label={t('loyalty.holidayDiscount')}
              hint={t('loyalty.holidayDiscountHint')}
              value={holidayForm.discount_pct}
              onChange={v => setHol('discount_pct', Math.min(100, v))}
              min={0}
              className="h-9 w-24"
            />

            {/* Enabled toggle */}
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm">{t('loyalty.holidayActive')}</Label>
              <Switch
                checked={holidayForm.enabled}
                onCheckedChange={v => setHol('enabled', v)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setHolidayModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSaveHoliday}
              disabled={createHoliday.isPending || updateHoliday.isPending}
            >
              {(createHoliday.isPending || updateHoliday.isPending) && (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              )}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
