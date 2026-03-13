import { useState, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, Trash2, Tag, Copy, Check, TrendingUp } from 'lucide-react'
import { useFeature } from '@/hooks/useFeatureFlags'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { usePromoCodes, useCreatePromoCode, useUpdatePromoCode, useDeletePromoCode } from '@/hooks/usePromoCodes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { PageHeader } from '@/components/shared/PageHeader'
import { toast } from '@/components/shared/Toaster'
import type { PromoCode } from '@/types'

interface FormState {
  code: string
  discount_type: 'percent' | 'fixed'
  discount_value: string
  valid_from: string
  valid_until: string
  max_uses: string
  description: string
}

const EMPTY_FORM: FormState = {
  code: '',
  discount_type: 'percent',
  discount_value: '',
  valid_from: '',
  valid_until: '',
  max_uses: '',
  description: '',
}

function generateCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

// Parse "DD.MM.YYYY" → "YYYY-MM-DD" for the API
function parseDateInput(v: string): string | undefined {
  const match = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!match) return undefined
  const [, d, m, y] = match
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

// Auto-insert dots while typing: "01012026" → "01.01.2026"
function formatDateInput(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`
}

export function PromoCodesPage() {
  const hasPromos = useFeature('promo_codes')
  const { data: codes, isLoading } = usePromoCodes()
  const { t } = useTranslation()

  if (!hasPromos) return <Navigate to="/billing" replace />
  const create = useCreatePromoCode()
  const update = useUpdatePromoCode()
  const remove = useDeletePromoCode()

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const stats = useMemo(() => {
    if (!codes || codes.length === 0) return null
    const today = dayjs().format('YYYY-MM-DD')
    const active = codes.filter(p =>
      p.is_active &&
      !(p.valid_until && p.valid_until < today) &&
      !(p.max_uses && p.max_uses > 0 && (p.use_count ?? 0) >= p.max_uses)
    ).length
    const totalUses = codes.reduce((s, p) => s + (p.use_count ?? 0), 0)
    const expired = codes.filter(p => p.valid_until && p.valid_until < today).length
    return { total: codes.length, active, totalUses, inactive: codes.length - active, expired }
  }, [codes])

  const handleCreate = async () => {
    if (!form.code || !form.discount_value) {
      toast.error(t('promo.validationError'))
      return
    }
    try {
      await create.mutateAsync({
        code: form.code.toUpperCase(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        valid_from: parseDateInput(form.valid_from),
        valid_until: parseDateInput(form.valid_until),
        max_uses: form.max_uses ? Number(form.max_uses) : 0,
        description: form.description || undefined,
        is_active: true,
      } as any)
      setForm(EMPTY_FORM)
      setShowForm(false)
      toast.success(t('promo.created'))
    } catch (err: any) {
      const msg = err?.response?.message || err?.message || t('promo.createError')
      toast.error(msg)
    }
  }

  const handleToggleActive = async (promo: PromoCode) => {
    await update.mutateAsync({ id: promo.id, data: { is_active: !promo.is_active } })
  }

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('nav.promoCodes')} description={t('promo.subtitle')}>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" />
          {t('promo.create')}
        </Button>
      </PageHeader>

      {/* Статистика */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-muted/40 rounded-xl p-3 space-y-0.5">
            <p className="text-xs text-muted-foreground">{t('promo.statTotal')}</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-muted/40 rounded-xl p-3 space-y-0.5">
            <p className="text-xs text-muted-foreground">{t('promo.statActive')}</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
          </div>
          <div className="bg-muted/40 rounded-xl p-3 space-y-0.5">
            <p className="text-xs text-muted-foreground">{t('promo.statUses')}</p>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary shrink-0" />
              <span className="text-2xl font-bold">{stats.totalUses}</span>
            </div>
          </div>
          <div className="bg-muted/40 rounded-xl p-3 space-y-0.5">
            <p className="text-xs text-muted-foreground">{t('promo.statExpired')}</p>
            <p className="text-2xl font-bold text-muted-foreground">{stats.expired}</p>
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('promo.newTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 items-end">
              <div className="space-y-1 flex-1">
                <Label>{t('promo.code')}</Label>
                <Input
                  placeholder="SUMMER20"
                  value={form.code}
                  onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                />
              </div>
              <Button type="button" variant="outline" onClick={() => setForm(f => ({ ...f, code: generateCode() }))}>
                {t('promo.random')}
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <div className="space-y-1">
                <Label>{t('promo.discountType')}</Label>
                <Select
                  value={form.discount_type}
                  onValueChange={(v) => setForm(f => ({ ...f, discount_type: v as 'percent' | 'fixed' }))}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">{t('promo.discountPercent')}</SelectItem>
                    <SelectItem value="fixed">{t('promo.discountFixed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 w-28">
                <Label>{t('promo.discountValue')}</Label>
                <Input
                  type="number"
                  placeholder={form.discount_type === 'percent' ? '10' : '500'}
                  value={form.discount_value}
                  onChange={(e) => setForm(f => ({ ...f, discount_value: e.target.value }))}
                />
              </div>
              <div className="space-y-1 w-28">
                <Label>{t('promo.maxUses')}</Label>
                <Input
                  type="number"
                  placeholder="0 = ∞"
                  value={form.max_uses}
                  onChange={(e) => setForm(f => ({ ...f, max_uses: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-3 items-end flex-wrap">
              <div className="space-y-1">
                <Label>{t('promo.validFrom')}</Label>
                <Input
                  type="text"
                  placeholder="01.01.2000"
                  maxLength={10}
                  value={form.valid_from}
                  onChange={(e) => setForm(f => ({ ...f, valid_from: formatDateInput(e.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('promo.validUntil')}</Label>
                <Input
                  type="text"
                  placeholder="01.01.2000"
                  maxLength={10}
                  value={form.valid_until}
                  onChange={(e) => setForm(f => ({ ...f, valid_until: formatDateInput(e.target.value) }))}
                />
              </div>
              <div className="space-y-1 flex-1 min-w-40">
                <Label>{t('promo.description')}</Label>
                <Input
                  placeholder={t('promo.descriptionPlaceholder')}
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>{t('common.cancel')}</Button>
              <Button onClick={handleCreate} loading={create.isPending}>{t('promo.createBtn')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
      ) : codes && codes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <Tag className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-medium">{t('promo.empty')}</p>
            <p className="text-sm text-muted-foreground">{t('promo.emptyHint')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {codes?.map((promo) => {
            const isExpired = promo.valid_until && promo.valid_until < dayjs().format('YYYY-MM-DD')
            const isExhausted = promo.max_uses && promo.max_uses > 0 && (promo.use_count ?? 0) >= promo.max_uses

            return (
              <Card key={promo.id} className={!promo.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-base font-bold tracking-wider bg-muted px-2 py-0.5 rounded">
                        {promo.code}
                      </code>
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6"
                        onClick={() => handleCopy(promo.code, promo.id)}
                      >
                        {copiedId === promo.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <Badge variant={promo.is_active && !isExpired && !isExhausted ? 'default' : 'outline'}>
                        {isExpired ? t('promo.statusExpired') : isExhausted ? t('promo.statusExhausted') : promo.is_active ? t('promo.statusActive') : t('promo.statusInactive')}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {t('promo.discount')}: <strong>{promo.discount_value}{promo.discount_type === 'percent' ? '%' : ' ₽'}</strong>
                      {promo.max_uses && promo.max_uses > 0
                        ? ` · ${t('promo.usageCount', { used: promo.use_count ?? 0, max: promo.max_uses })}`
                        : promo.use_count ? ` · ${t('promo.usageTotal', { count: promo.use_count })}` : ''}
                      {promo.valid_until && ` · ${t('promo.until', { date: promo.valid_until })}`}
                    </p>
                    {promo.description && <p className="text-xs text-muted-foreground">{promo.description}</p>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={promo.is_active}
                      onCheckedChange={() => handleToggleActive(promo)}
                    />
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={() => remove.mutateAsync(promo.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
