// BroadcastsTab — ручные рассылки в Telegram

import { useState, useMemo } from 'react'
import {
  Send, Plus, Users, CheckCircle2, XCircle, Loader2, Megaphone,
  Clock, MoreVertical, Pencil, Copy, Trash2, Search, MessageSquare,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { useAuth } from '@/contexts/AuthContext'
import {
  useBroadcasts,
  useCreateBroadcast,
  useUpdateBroadcast,
  useDeleteBroadcast,
  useSendBroadcast,
  useBroadcastRecipientCount,
  type BroadcastCampaign,
  type CreateBroadcastData,
} from '@/hooks/useBroadcasts'
import { usePromoCodes } from '@/hooks/usePromoCodes'
import { useClients } from '@/hooks/useClients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { toast } from '@/components/shared/Toaster'
import { EmptyState } from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Client } from '@/types'

// ── Типы ──────────────────────────────────────────────────────────────────────
type FilterType = 'all' | 'tag' | 'level' | 'inactive' | 'birthday_month' | 'selected'

interface FormState {
  name: string
  filterType: FilterType
  filterValue: string
  selectedIds: string[]
  message: string
  promoCodeId: string
}

const EMPTY_FORM: FormState = {
  name: '', filterType: 'all', filterValue: '',
  selectedIds: [], message: '', promoCodeId: '',
}

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

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
  if (filterType === 'selected') {
    try { return `${t('marketing.broadcasts.audienceSelected')}: ${JSON.parse(filterValue ?? '[]').length}` }
    catch { return t('marketing.broadcasts.audienceSelected') }
  }
  return ''
}

// ── Статус-бейджи ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: BroadcastCampaign['status'] }) {
  const { t } = useTranslation()
  if (status === 'sending') return (
    <Badge variant="secondary" className="gap-1 text-blue-600 bg-blue-50 shrink-0">
      <Loader2 className="h-3 w-3 animate-spin" />
      {t('marketing.broadcasts.statusSending')}
    </Badge>
  )
  if (status === 'sent') return (
    <Badge variant="secondary" className="gap-1 text-emerald-600 bg-emerald-50 shrink-0">
      <CheckCircle2 className="h-3 w-3" />
      {t('marketing.broadcasts.statusSent')}
    </Badge>
  )
  if (status === 'failed') return (
    <Badge variant="secondary" className="gap-1 text-red-600 bg-red-50 shrink-0">
      <XCircle className="h-3 w-3" />
      {t('marketing.broadcasts.statusFailed')}
    </Badge>
  )
  return (
    <Badge variant="secondary" className="gap-1 text-muted-foreground shrink-0">
      <Clock className="h-3 w-3" />
      Draft
    </Badge>
  )
}

// ── Превью получателей ────────────────────────────────────────────────────────
function RecipientCountBadge({
  masterId, filterType, filterValue, selectedIds,
}: {
  masterId: string | undefined
  filterType: string
  filterValue: string
  selectedIds: string[]
}) {
  const { t } = useTranslation()
  const countValue = filterType === 'selected' ? JSON.stringify(selectedIds) : filterValue
  const { data: count, isLoading } = useBroadcastRecipientCount(masterId, filterType, countValue)

  if (filterType === 'birthday_month') return null
  if (filterType === 'selected') {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Users className="h-3 w-3" />
        Выбрано: <strong>{selectedIds.length}</strong>
      </span>
    )
  }

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

// ── Пикер клиентов ────────────────────────────────────────────────────────────
function ClientPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const { data: clients } = useClients()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!clients) return []
    const q = search.toLowerCase()
    return clients.filter((c: Client) => {
      const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase()
      return !q || name.includes(q) || (c.phone ?? '').toLowerCase().includes(q)
    })
  }, [clients, search])

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])

  const allFiltered = filtered.map((c: Client) => c.id)
  const allChecked = allFiltered.length > 0 && allFiltered.every(id => selected.includes(id))

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск..." className="pl-8 h-8" />
      </div>

      <div className="border rounded-lg overflow-hidden">
        {filtered.length > 0 && (
          <button type="button"
            onClick={() => {
              const newSet = new Set(allChecked
                ? selected.filter(id => !allFiltered.includes(id))
                : [...selected, ...allFiltered])
              onChange([...newSet])
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 border-b"
          >
            <div className={cn('h-4 w-4 rounded border shrink-0 flex items-center justify-center',
              allChecked ? 'bg-primary border-primary' : 'border-input')}>
              {allChecked && <CheckCircle2 className="h-2.5 w-2.5 text-primary-foreground" />}
            </div>
            Выбрать всех ({filtered.length})
          </button>
        )}
        <div className="max-h-44 overflow-y-auto">
          {filtered.length === 0
            ? <p className="text-xs text-muted-foreground text-center py-4">Не найдено</p>
            : filtered.map((c: Client) => {
                const checked = selected.includes(c.id)
                return (
                  <button key={c.id} type="button" onClick={() => toggle(c.id)}
                    className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/40',
                      checked && 'bg-primary/5')}>
                    <div className={cn('h-4 w-4 rounded border shrink-0 flex items-center justify-center',
                      checked ? 'bg-primary border-primary' : 'border-input')}>
                      {checked && <CheckCircle2 className="h-2.5 w-2.5 text-primary-foreground" />}
                    </div>
                    <span className="flex-1 truncate">
                      {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.phone || '—'}
                    </span>
                    <MessageSquare className={cn('h-3 w-3 shrink-0',
                      c.tg_chat_id ? 'text-blue-500' : 'text-muted-foreground/30')} />
                  </button>
                )
              })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        <MessageSquare className="inline h-3 w-3 text-blue-500 mr-0.5" /> — есть Telegram
      </p>
    </div>
  )
}

// ── Диалог создания / редактирования ─────────────────────────────────────────
interface CampaignDialogProps {
  open: boolean
  onClose: () => void
  masterId: string | undefined
  editing: BroadcastCampaign | null
  activePromos: Array<{ id: string; code: string; discount_type: string; discount_value: number }>
  onSaveAndSend: (data: CreateBroadcastData) => Promise<void>
  onSaveDraft: (data: CreateBroadcastData) => Promise<void>
  isSending: boolean
}

function CampaignDialog({
  open, onClose, masterId, editing, activePromos, onSaveAndSend, onSaveDraft, isSending,
}: CampaignDialogProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [tagInput, setTagInput] = useState('')

  // Заполняем форму при каждом открытии
  useMemo(() => {
    if (!open) return
    if (editing) {
      const fv = editing.filter_value ?? ''
      const isSelected = editing.filter_type === 'selected'
      let selectedIds: string[] = []
      if (isSelected) { try { selectedIds = JSON.parse(fv) } catch {} }
      setForm({
        name: editing.name,
        filterType: editing.filter_type as FilterType,
        filterValue: isSelected ? '' : fv,
        selectedIds,
        message: editing.message,
        promoCodeId: editing.promo_code_id ?? '',
      })
      setTagInput(editing.filter_type === 'tag' ? fv : '')
    } else {
      setForm(EMPTY_FORM)
      setTagInput('')
    }
  }, [open, editing])

  function handleFilterChange(val: FilterType) {
    setForm(f => ({ ...f, filterType: val, filterValue: '', selectedIds: [] }))
    setTagInput('')
  }

  const canSubmit = form.name.trim() && form.message.trim()
    && (form.filterType === 'all'
      || (form.filterType === 'tag' && tagInput.trim())
      || (form.filterType === 'level' && form.filterValue)
      || (form.filterType === 'inactive' && form.filterValue)
      || (form.filterType === 'birthday_month' && form.filterValue)
      || (form.filterType === 'selected' && form.selectedIds.length > 0))

  function buildData(): CreateBroadcastData {
    let fv: string | undefined
    if (form.filterType === 'tag') fv = tagInput.trim()
    else if (form.filterType === 'selected') fv = JSON.stringify(form.selectedIds)
    else if (form.filterType !== 'all') fv = form.filterValue || undefined
    return {
      name: form.name.trim(),
      message: form.message.trim(),
      filter_type: form.filterType,
      filter_value: fv,
      promo_code_id: form.promoCodeId || undefined,
    }
  }

  const isEditingSent = editing && editing.status === 'sent'

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent mobileFullscreen className="sm:max-w-md max-h-[90vh] overflow-y-auto max-sm:flex max-sm:flex-col">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Редактировать кампанию' : t('marketing.broadcasts.dialogTitle')}
          </DialogTitle>
          {isEditingSent && (
            <p className="text-xs text-muted-foreground pt-1">
              Кампания уже отправлена. Изменения сохранятся как черновик для повторной отправки.
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Название */}
          <div className="space-y-1.5">
            <Label>{t('marketing.broadcasts.name')}</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={t('marketing.broadcasts.name')} />
          </div>

          {/* Аудитория */}
          <div className="space-y-1.5">
            <Label>{t('marketing.broadcasts.audience')}</Label>
            <Select value={form.filterType} onValueChange={v => handleFilterChange(v as FilterType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('marketing.broadcasts.audienceAll')}</SelectItem>
                <SelectItem value="selected">{t('marketing.broadcasts.audienceSelected')}</SelectItem>
                <SelectItem value="tag">{t('marketing.broadcasts.audienceTag')}</SelectItem>
                <SelectItem value="level">{t('marketing.broadcasts.audienceLevel')}</SelectItem>
                <SelectItem value="inactive">{t('marketing.broadcasts.audienceInactive')}</SelectItem>
                <SelectItem value="birthday_month">{t('marketing.broadcasts.audienceBdayMonth')}</SelectItem>
              </SelectContent>
            </Select>

            {form.filterType === 'selected' && (
              <div className="mt-2">
                <ClientPicker selected={form.selectedIds}
                  onChange={ids => setForm(f => ({ ...f, selectedIds: ids }))} />
              </div>
            )}
            {form.filterType === 'tag' && (
              <Input value={tagInput} onChange={e => setTagInput(e.target.value)}
                placeholder="vip, regular, ..." className="mt-2" />
            )}
            {form.filterType === 'level' && (
              <Select value={form.filterValue} onValueChange={v => setForm(f => ({ ...f, filterValue: v }))}>
                <SelectTrigger className="mt-2"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">🥈 Regular (≥3)</SelectItem>
                  <SelectItem value="vip">🥇 VIP (≥10)</SelectItem>
                  <SelectItem value="premium">💎 Premium (≥20)</SelectItem>
                </SelectContent>
              </Select>
            )}
            {form.filterType === 'inactive' && (
              <div className="flex items-center gap-2 mt-2">
                <Input type="number" min={1} value={form.filterValue}
                  onChange={e => setForm(f => ({ ...f, filterValue: e.target.value }))}
                  placeholder="30" className="w-24" />
                <span className="text-sm text-muted-foreground">{t('marketing.broadcasts.inactivityDays')}</span>
              </div>
            )}
            {form.filterType === 'birthday_month' && (
              <Select value={form.filterValue} onValueChange={v => setForm(f => ({ ...f, filterValue: v }))}>
                <SelectTrigger className="mt-2"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {MONTHS_RU.map((name, idx) => (
                    <SelectItem key={idx + 1} value={String(idx + 1)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="mt-1.5">
              <RecipientCountBadge masterId={masterId} filterType={form.filterType}
                filterValue={form.filterType === 'tag' ? tagInput.trim() : form.filterValue}
                selectedIds={form.selectedIds} />
            </div>
          </div>

          {/* Текст */}
          <div className="space-y-1.5">
            <Label>{t('marketing.broadcasts.message')}</Label>
            <Textarea value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              rows={4} className="resize-none"
              placeholder={`Текст сообщения...\n{client_name} — имя клиента`} />
            <p className="text-xs text-muted-foreground">
              Используйте <code className="bg-muted px-1 rounded">{'{client_name}'}</code> для имени клиента
            </p>
          </div>

          {/* Промокод */}
          {activePromos.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t('marketing.broadcasts.attachPromo')}</Label>
              <Select value={form.promoCodeId || 'none'}
                onValueChange={v => setForm(f => ({ ...f, promoCodeId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('marketing.broadcasts.promoNone')}</SelectItem>
                  {activePromos.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} — {p.discount_type === 'percent' ? `${p.discount_value}%` : `${p.discount_value} сум`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="sm:mr-auto">Отмена</Button>
          <Button variant="outline" onClick={() => onSaveDraft(buildData())}
            disabled={!canSubmit || isSending}>
            Сохранить черновик
          </Button>
          <Button onClick={() => onSaveAndSend(buildData())}
            disabled={!canSubmit || isSending} className="gap-2">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t('marketing.broadcasts.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Главный компонент ─────────────────────────────────────────────────────────
export function BroadcastsTab() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const masterId = user?.id

  const { data: campaigns, isLoading } = useBroadcasts()
  const createBroadcast = useCreateBroadcast()
  const updateBroadcast = useUpdateBroadcast()
  const deleteBroadcast = useDeleteBroadcast()
  const sendBroadcast = useSendBroadcast()
  const { data: promoCodes } = usePromoCodes()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<BroadcastCampaign | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BroadcastCampaign | null>(null)
  const [isSending, setIsSending] = useState(false)

  const activePromos = useMemo(() => (promoCodes ?? []).filter(p => p.is_active), [promoCodes])

  const stats = useMemo(() => {
    const all = campaigns ?? []
    return {
      total: all.length,
      totalSent: all.reduce((sum, c) => sum + (c.sent_count ?? 0), 0),
    }
  }, [campaigns])

  function openNew() { setEditingCampaign(null); setDialogOpen(true) }
  function openEdit(c: BroadcastCampaign) { setEditingCampaign(c); setDialogOpen(true) }

  async function handleCopy(c: BroadcastCampaign) {
    try {
      await createBroadcast.mutateAsync({
        name: `${c.name} (копия)`,
        message: c.message,
        filter_type: c.filter_type,
        filter_value: c.filter_value ?? undefined,
        promo_code_id: c.promo_code_id ?? undefined,
      })
      toast.success('Кампания скопирована')
    } catch { toast.error('Ошибка копирования') }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteBroadcast.mutateAsync(deleteTarget.id)
      toast.success('Кампания удалена')
    } catch { toast.error('Ошибка удаления') }
    finally { setDeleteTarget(null) }
  }

  async function doSend(campaignId: string) {
    // Сбрасываем счётчики перед каждой отправкой
    await updateBroadcast.mutateAsync({
      id: campaignId,
      data: { status: 'draft', sent_count: 0, failed_count: 0, total_recipients: 0, sent_at: null } as any,
    })
    await sendBroadcast.mutateAsync(campaignId)
  }

  async function handleSaveAndSend(data: CreateBroadcastData) {
    setIsSending(true)
    try {
      let id: string
      if (editingCampaign) {
        await updateBroadcast.mutateAsync({ id: editingCampaign.id, data })
        id = editingCampaign.id
      } else {
        const c = await createBroadcast.mutateAsync(data)
        id = c.id
      }
      setDialogOpen(false)
      toast.success(t('marketing.broadcasts.statusSending'))
      await doSend(id)
      toast.success(t('marketing.broadcasts.statusSent'))
    } catch (err) { toast.error(String(err)) }
    finally { setIsSending(false) }
  }

  async function handleSaveDraft(data: CreateBroadcastData) {
    try {
      if (editingCampaign) {
        await updateBroadcast.mutateAsync({
          id: editingCampaign.id,
          data: { ...data, status: 'draft' },
        })
      } else {
        await createBroadcast.mutateAsync(data)
      }
      setDialogOpen(false)
      toast.success('Черновик сохранён')
    } catch (err) { toast.error(String(err)) }
  }

  async function handleResend(c: BroadcastCampaign) {
    setIsSending(true)
    try {
      toast.success(t('marketing.broadcasts.statusSending'))
      await doSend(c.id)
      toast.success(t('marketing.broadcasts.statusSent'))
    } catch (err) { toast.error(String(err)) }
    finally { setIsSending(false) }
  }

  return (
    <div className="space-y-6">
      {/* Статистика */}
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

      <Button onClick={openNew} className="gap-2">
        <Plus className="h-4 w-4" />
        {t('marketing.broadcasts.new')}
      </Button>

      {/* История */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {t('marketing.broadcasts.historyTitle')}
        </h3>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : !campaigns || campaigns.length === 0 ? (
          <EmptyState icon={Megaphone}
            title={t('marketing.broadcasts.empty')}
            description={t('marketing.broadcasts.emptyDesc')} />
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

                    <div className="flex items-center gap-1 shrink-0">
                      <StatusBadge status={c.status} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(c)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleResend(c)} disabled={isSending}>
                            <Send className="h-3.5 w-3.5 mr-2" />
                            Отправить снова
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopy(c)}>
                            <Copy className="h-3.5 w-3.5 mr-2" />
                            Копировать
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(c)}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CampaignDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        masterId={masterId}
        editing={editingCampaign}
        activePromos={activePromos}
        onSaveAndSend={handleSaveAndSend}
        onSaveDraft={handleSaveDraft}
        isSending={isSending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Удалить кампанию?"
        description={`«${deleteTarget?.name}» будет удалена безвозвратно.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
