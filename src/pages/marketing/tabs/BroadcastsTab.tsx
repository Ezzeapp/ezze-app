// BroadcastsTab — ручные рассылки в Telegram

import { useState, useMemo } from 'react'
import { Send, Plus, Users, CheckCircle2, XCircle, Loader2, Megaphone, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { useAuth } from '@/contexts/AuthContext'
import {
  useBroadcasts,
  useCreateBroadcast,
  useSendBroadcast,
  useBroadcastRecipientCount,
  type BroadcastCampaign,
  type CreateBroadcastData,
} from '@/hooks/useBroadcasts'
import { usePromoCodes } from '@/hooks/usePromoCodes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/shared/Toaster'
import { EmptyState } from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'

// ── Типы ──────────────────────────────────────────────────────────────────────
type FilterType = 'all' | 'tag' | 'level' | 'inactive' | 'birthday_month'

interface FormState {
  name: string
  filterType: FilterType
  filterValue: string
  message: string
  promoCodeId: string
}

const EMPTY_FORM: FormState = {
  name: '',
  filterType: 'all',
  filterValue: '',
  message: '',
  promoCodeId: '',
}

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

// ── Статус-бейджи ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: BroadcastCampaign['status'] }) {
  const { t } = useTranslation()
  if (status === 'sending') return (
    <Badge variant="secondary" className="gap-1 text-blue-600 bg-blue-50">
      <Loader2 className="h-3 w-3 animate-spin" />
      {t('marketing.broadcasts.statusSending')}
    </Badge>
  )
  if (status === 'sent') return (
    <Badge variant="secondary" className="gap-1 text-emerald-600 bg-emerald-50">
      <CheckCircle2 className="h-3 w-3" />
      {t('marketing.broadcasts.statusSent')}
    </Badge>
  )
  if (status === 'failed') return (
    <Badge variant="secondary" className="gap-1 text-red-600 bg-red-50">
      <XCircle className="h-3 w-3" />
      {t('marketing.broadcasts.statusFailed')}
    </Badge>
  )
  return (
    <Badge variant="secondary" className="gap-1 text-muted-foreground">
      <Clock className="h-3 w-3" />
      Draft
    </Badge>
  )
}

// ── Описание фильтра ──────────────────────────────────────────────────────────
function filterLabel(filterType: string, filterValue: string | null, t: (k: string) => string): string {
  if (filterType === 'all') return t('marketing.broadcasts.audienceAll')
  if (filterType === 'tag') return filterValue ? `#${filterValue}` : t('marketing.broadcasts.audienceTag')
  if (filterType === 'level') {
    const map: Record<string, string> = { regular: '🥈 Regular', vip: '🥇 VIP', premium: '💎 Premium' }
    return map[filterValue ?? ''] ?? filterValue ?? ''
  }
  if (filterType === 'inactive') return filterValue ? `${filterValue} ${t('marketing.broadcasts.inactivityDays')}` : ''
  if (filterType === 'birthday_month') {
    const m = parseInt(filterValue ?? '')
    return isNaN(m) ? '' : MONTHS_RU[m - 1] ?? ''
  }
  return ''
}

// ── Превью получателей ────────────────────────────────────────────────────────
function RecipientCountBadge({
  masterId,
  filterType,
  filterValue,
}: {
  masterId: string | undefined
  filterType: string
  filterValue: string
}) {
  const { t } = useTranslation()
  const { data: count, isLoading } = useBroadcastRecipientCount(masterId, filterType, filterValue)

  if (isLoading) return (
    <span className="text-xs text-muted-foreground flex items-center gap-1">
      <Loader2 className="h-3 w-3 animate-spin" />
      {t('marketing.broadcasts.estimatedRecipients')}...
    </span>
  )
  if (count === null || count === undefined) return null

  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1">
      <Users className="h-3 w-3" />
      {t('marketing.broadcasts.estimatedRecipients')}: <strong>{count}</strong>
    </span>
  )
}

// ── Главный компонент ─────────────────────────────────────────────────────────
export function BroadcastsTab() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const masterId = user?.id

  const { data: campaigns, isLoading } = useBroadcasts()
  const createBroadcast = useCreateBroadcast()
  const sendBroadcast = useSendBroadcast()
  const { data: promoCodes } = usePromoCodes()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [tagInput, setTagInput] = useState('')
  const [isSending, setIsSending] = useState(false)

  // Активные промокоды
  const activePromos = useMemo(
    () => (promoCodes ?? []).filter(p => p.is_active),
    [promoCodes],
  )

  // Статистика
  const stats = useMemo(() => {
    const all = campaigns ?? []
    return {
      total: all.length,
      totalSent: all.reduce((sum, c) => sum + (c.sent_count ?? 0), 0),
    }
  }, [campaigns])

  // Сброс формы при открытии
  function openDialog() {
    setForm(EMPTY_FORM)
    setTagInput('')
    setDialogOpen(true)
  }

  function handleFilterChange(val: FilterType) {
    setForm(f => ({ ...f, filterType: val, filterValue: '' }))
    setTagInput('')
  }

  // Значение для запроса count (нормализованное)
  const countFilterValue = useMemo(() => {
    if (form.filterType === 'tag') return tagInput.trim()
    return form.filterValue
  }, [form.filterType, form.filterValue, tagInput])

  // Валидация
  const canCreate = form.name.trim() && form.message.trim()
    && (form.filterType === 'all'
      || (form.filterType === 'tag' && tagInput.trim())
      || (form.filterType === 'level' && form.filterValue)
      || (form.filterType === 'inactive' && form.filterValue)
      || (form.filterType === 'birthday_month' && form.filterValue))

  async function handleSend() {
    if (!canCreate || isSending) return
    setIsSending(true)
    try {
      const data: CreateBroadcastData = {
        name: form.name.trim(),
        message: form.message.trim(),
        filter_type: form.filterType,
        filter_value: form.filterType === 'tag' ? tagInput.trim()
          : form.filterType !== 'all' ? form.filterValue || undefined
          : undefined,
        promo_code_id: form.promoCodeId || undefined,
      }

      // Создаём кампанию
      const campaign = await createBroadcast.mutateAsync(data)

      // Закрываем диалог сразу, рассылка пойдёт в фоне
      setDialogOpen(false)
      toast.success(t('marketing.broadcasts.statusSending'))

      // Запускаем edge function
      await sendBroadcast.mutateAsync(campaign.id)
      toast.success(t('marketing.broadcasts.statusSent'))
    } catch (err) {
      console.error('Broadcast error:', err)
      toast.error(String(err))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Статистика ── */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t('marketing.broadcasts.statCampaigns')}</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t('marketing.broadcasts.statSent')}</p>
            <p className="text-2xl font-bold">{stats.totalSent}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Кнопка новой рассылки ── */}
      <Button onClick={openDialog} className="gap-2">
        <Plus className="h-4 w-4" />
        {t('marketing.broadcasts.new')}
      </Button>

      {/* ── История ── */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {t('marketing.broadcasts.historyTitle')}
        </h3>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : !campaigns || campaigns.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={t('marketing.broadcasts.empty')}
            description={t('marketing.broadcasts.emptyDesc')}
          />
        ) : (
          <div className="space-y-2">
            {campaigns.map(c => (
              <Card key={c.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{c.name}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {filterLabel(c.filter_type, c.filter_value, t)}
                        </span>
                        {c.status === 'sent' && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Send className="h-3 w-3" />
                            {c.sent_count} / {c.total_recipients}
                          </span>
                        )}
                        {c.sent_at && (
                          <span className="text-xs text-muted-foreground">
                            {dayjs(c.sent_at).format('DD.MM.YYYY HH:mm')}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Диалог создания рассылки ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('marketing.broadcasts.dialogTitle')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Название */}
            <div className="space-y-1.5">
              <Label>{t('marketing.broadcasts.name')}</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t('marketing.broadcasts.name')}
              />
            </div>

            {/* Аудитория */}
            <div className="space-y-1.5">
              <Label>{t('marketing.broadcasts.audience')}</Label>
              <Select
                value={form.filterType}
                onValueChange={v => handleFilterChange(v as FilterType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('marketing.broadcasts.audienceAll')}</SelectItem>
                  <SelectItem value="tag">{t('marketing.broadcasts.audienceTag')}</SelectItem>
                  <SelectItem value="level">{t('marketing.broadcasts.audienceLevel')}</SelectItem>
                  <SelectItem value="inactive">{t('marketing.broadcasts.audienceInactive')}</SelectItem>
                  <SelectItem value="birthday_month">{t('marketing.broadcasts.audienceBdayMonth')}</SelectItem>
                </SelectContent>
              </Select>

              {/* Доп. поле под аудиторию */}
              {form.filterType === 'tag' && (
                <Input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  placeholder="vip, regular, ..."
                  className="mt-2"
                />
              )}
              {form.filterType === 'level' && (
                <Select
                  value={form.filterValue}
                  onValueChange={v => setForm(f => ({ ...f, filterValue: v }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">🥈 Regular (≥3)</SelectItem>
                    <SelectItem value="vip">🥇 VIP (≥10)</SelectItem>
                    <SelectItem value="premium">💎 Premium (≥20)</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {form.filterType === 'inactive' && (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="number"
                    min={1}
                    value={form.filterValue}
                    onChange={e => setForm(f => ({ ...f, filterValue: e.target.value }))}
                    placeholder="30"
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">{t('marketing.broadcasts.inactivityDays')}</span>
                </div>
              )}
              {form.filterType === 'birthday_month' && (
                <Select
                  value={form.filterValue}
                  onValueChange={v => setForm(f => ({ ...f, filterValue: v }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS_RU.map((name, idx) => (
                      <SelectItem key={idx + 1} value={String(idx + 1)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Превью кол-ва получателей */}
              <div className="mt-1.5">
                <RecipientCountBadge
                  masterId={masterId}
                  filterType={form.filterType}
                  filterValue={countFilterValue}
                />
              </div>
            </div>

            {/* Текст сообщения */}
            <div className="space-y-1.5">
              <Label>{t('marketing.broadcasts.message')}</Label>
              <Textarea
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                rows={4}
                placeholder={`${t('marketing.broadcasts.message')}...\n{client_name} — имя клиента`}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Используйте <code className="bg-muted px-1 rounded">{'{client_name}'}</code> для имени клиента
              </p>
            </div>

            {/* Прикрепить промокод */}
            {activePromos.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t('marketing.broadcasts.attachPromo')}</Label>
                <Select
                  value={form.promoCodeId || 'none'}
                  onValueChange={v => setForm(f => ({ ...f, promoCodeId: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('marketing.broadcasts.promoNone')}</SelectItem>
                    {activePromos.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code} —{' '}
                        {p.discount_type === 'percent'
                          ? `${p.discount_value}%`
                          : `${p.discount_value} сум`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleSend}
              disabled={!canCreate || isSending}
              className="gap-2"
            >
              {isSending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
              }
              {t('marketing.broadcasts.send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
