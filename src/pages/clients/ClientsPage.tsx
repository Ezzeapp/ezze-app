import { useState, useEffect, useRef, useMemo, KeyboardEvent, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Phone, Mail, Users, MoreVertical, Trash2, Edit, BarChart2, Calendar, CheckCircle2, XCircle, AlertCircle, X as XIcon, Tag, Square, CheckSquare, Camera, UserCircle2, Sparkles, Loader2, Gift, TrendingUp, TrendingDown, Award, Crown, Gem } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useClientsPaged, useClientSummary, useCreateClient, useUpdateClient, useUpdateClientAvatar, useDeleteClient } from '@/hooks/useClients'
import { PaginationBar } from '@/components/shared/PaginationBar'
import { useClientStats } from '@/hooks/useClientStats'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { PlanLimitBanner } from '@/components/shared/PlanLimitBanner'
import { toast } from '@/components/shared/Toaster'
import { formatCurrency } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { usePlanLimitCheck, useAIConfig } from '@/hooks/useAppSettings'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { getFileUrl } from '@/lib/utils'
import type { Client } from '@/types'
import {
  useLoyaltySettings,
  useAllClientsLoyaltyBalances,
  useAllClientsDoneVisits,
  useClientLoyaltyPoints,
  useClientLoyaltyBalance,
  useAddLoyaltyPoints,
  getLoyaltyLevel,
  getLevelLabel,
  getLevelColor,
  getLevelDiscount,
  type LoyaltyPoint,
} from '@/hooks/useLoyalty'

// Birthday helpers: store as YYYY-MM-DD, display/input as DD.MM.YYYY
function maskBirthday(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`
}
function birthdayToDisplay(iso: string): string {
  if (!iso || !iso.includes('-')) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return `${d}.${m}.${y}`
}
function birthdayToISO(display: string): string {
  if (!display || display.length !== 10) return ''
  const [d, m, y] = display.split('.')
  if (!d || !m || !y || y.length !== 4) return ''
  return `${y}-${m}-${d}`
}

const schema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  birthday: z.string().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
})
type FormValues = z.infer<typeof schema>

/** Редактор тегов: вводишь тег, Enter или запятая — добавляет, X — удаляет */
function TagsInput({ value = [], onChange }: { value?: string[]; onChange: (tags: string[]) => void }) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/,/g, '')
    if (!tag || value.includes(tag)) { setInput(''); return }
    onChange([...value, tag])
    setInput('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const removeTag = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx))
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 min-h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2.5 py-0.5 font-medium">
          {tag}
          <button type="button" onClick={() => removeTag(i)} className="hover:text-destructive transition-colors">
            <XIcon className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => addTag(input)}
        placeholder={value.length === 0 ? t('clients.tagsPlaceholder') : ''}
        className="flex-1 min-w-20 text-sm outline-none bg-transparent placeholder:text-muted-foreground"
      />
    </div>
  )
}

const REASON_ICONS: Record<string, React.ReactNode> = {
  visit:       <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />,
  first_visit: <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />,
  referral:    <Gift className="h-3.5 w-3.5 text-violet-500" />,
  manual:      <TrendingUp className="h-3.5 w-3.5 text-blue-500" />,
  redeem:      <TrendingDown className="h-3.5 w-3.5 text-orange-500" />,
  birthday:    <Gift className="h-3.5 w-3.5 text-pink-500" />,
}

function LevelIcon({ level, className = 'h-4 w-4' }: { level: import('@/hooks/useLoyalty').LoyaltyLevel; className?: string }) {
  switch (level) {
    case 'premium': return <Gem     className={className} />
    case 'vip':     return <Crown   className={className} />
    case 'regular': return <Award   className={className} />
    default:        return <Sparkles className={className} />
  }
}

function ClientStatsDialog({ client, onClose }: { client: Client; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const currency = useCurrency()
  const clientFullName = `${client.first_name} ${client.last_name || ''}`.trim()
  const { data: stats, isLoading } = useClientStats(client.id, clientFullName)
  const { data: loyaltySettings } = useLoyaltySettings()
  const { data: loyaltyBalance = 0 } = useClientLoyaltyBalance(client.id)
  const { data: loyaltyPoints = [], isLoading: loyaltyLoading } = useClientLoyaltyPoints(client.id)
  const addPoints = useAddLoyaltyPoints()

  const [tab, setTab] = useState<'stats' | 'loyalty'>('stats')
  const [manualAmount, setManualAmount] = useState('')
  const [manualNote, setManualNote] = useState('')
  const [manualMode, setManualMode] = useState<'earn' | 'redeem' | null>(null)

  const visits = stats?.completedVisits ?? 0
  const level = loyaltySettings ? getLoyaltyLevel(visits, loyaltySettings) : 'new'
  const discount = loyaltySettings ? getLevelDiscount(level, loyaltySettings) : 0

  const STATUS_LABELS: Record<string, string> = {
    scheduled: t('appointments.status.scheduled'),
    done:      t('appointments.status.done'),
    cancelled: t('appointments.status.cancelled'),
    no_show:   t('appointments.status.no_show'),
  }
  const STATUS_COLORS: Record<string, string> = {
    scheduled: 'default',
    done:      'success',
    cancelled: 'destructive',
    no_show:   'secondary',
  }

  const reasonLabel = (r: string) => {
    const map: Record<string, string> = {
      visit:       t('loyalty.reasonVisit'),
      first_visit: t('loyalty.reasonFirstVisit'),
      referral:    t('loyalty.reasonReferral'),
      manual:      t('loyalty.reasonManual'),
      redeem:      t('loyalty.reasonRedeem'),
      birthday:    t('loyalty.reasonBirthday'),
    }
    return map[r] ?? r
  }

  const handleManualSubmit = async () => {
    const amt = parseInt(manualAmount)
    if (!amt || amt <= 0) return
    try {
      await addPoints.mutateAsync({
        clientId: client.id,
        amount: manualMode === 'redeem' ? -amt : amt,
        reason: 'manual',
        note: manualNote.trim() || undefined,
      })
      toast.success(manualMode === 'redeem' ? t('loyalty.redeemed') : t('loyalty.awarded'))
      setManualMode(null)
      setManualAmount('')
      setManualNote('')
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent mobileFullscreen className="max-w-lg overflow-y-auto max-sm:flex max-sm:flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{client.first_name.charAt(0)}{client.last_name?.charAt(0) || ''}</AvatarFallback>
            </Avatar>
            {client.first_name} {client.last_name}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
          <button
            onClick={() => setTab('stats')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'stats' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <BarChart2 className="h-3.5 w-3.5 inline mr-1.5" />
            {t('clients.history')}
          </button>
          {loyaltySettings?.enabled && (
            <button
              onClick={() => setTab('loyalty')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'loyalty' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Gift className="h-3.5 w-3.5 inline mr-1.5" />
              {t('loyalty.title')}
            </button>
          )}
        </div>

        {/* ── Tab: Stats ── */}
        {tab === 'stats' && (
          isLoading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
          ) : stats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-2xl font-bold">{stats.totalVisits}</p>
                  <p className="text-xs text-muted-foreground">{t('clients.statsVisits')}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xl font-bold text-primary leading-tight">
                    {new Intl.NumberFormat(i18n.language).format(stats.totalSpent)}
                    <span className="text-[10px] font-medium text-muted-foreground ml-1">{currency}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{t('clients.statsSpent')}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{stats.completedVisits}</p>
                  <p className="text-xs text-muted-foreground">{t('clients.statsDone')}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-sm font-medium">{stats.lastVisit || '—'}</p>
                  <p className="text-xs text-muted-foreground">{t('clients.statsLastVisit')}</p>
                </div>
              </div>

              {stats.appointments.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <p className="text-sm font-medium">{t('clients.history')}</p>
                  {stats.appointments.map((appt) => {
                    const svcName = (appt.notes || '').match(/^\[(.+)\]/)?.[1]
                      || (appt as any).service?.name
                      || appt.expand?.service?.name
                      || '—'
                    return (
                      <div key={appt.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{svcName}</p>
                            <p className="text-xs text-muted-foreground">{appt.date} {appt.start_time?.slice(0, 5)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {appt.price ? <span className="text-xs font-medium">{formatCurrency(appt.price, currency, i18n.language)}</span> : null}
                          <Badge variant={STATUS_COLORS[appt.status] as any} className="text-xs">
                            {STATUS_LABELS[appt.status]}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">{t('clients.statsNoVisits')}</p>
              )}
            </div>
          ) : null
        )}

        {/* ── Tab: Loyalty ── */}
        {tab === 'loyalty' && loyaltySettings?.enabled && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-muted/50 p-3 text-center col-span-1">
                <p className="text-2xl font-bold text-primary">{loyaltyBalance}</p>
                <p className="text-xs text-muted-foreground">{t('loyalty.pts')}</p>
              </div>
              <div className={`rounded-lg p-3 text-center col-span-1 flex flex-col items-center justify-center gap-1 ${getLevelColor(level)}`}>
                <LevelIcon level={level} className="h-5 w-5" />
                <p className="text-xs font-medium">{t(`loyalty.level_${level}`)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center col-span-1">
                <p className="text-2xl font-bold">{discount > 0 ? `${discount}%` : '—'}</p>
                <p className="text-xs text-muted-foreground">{t('loyalty.discountPct')}</p>
              </div>
            </div>

            {/* Manual actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={manualMode === 'earn' ? 'default' : 'outline'}
                className="flex-1 gap-1.5"
                onClick={() => setManualMode(manualMode === 'earn' ? null : 'earn')}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                {t('loyalty.awardPoints')}
              </Button>
              <Button
                size="sm"
                variant={manualMode === 'redeem' ? 'default' : 'outline'}
                className="flex-1 gap-1.5"
                onClick={() => setManualMode(manualMode === 'redeem' ? null : 'redeem')}
              >
                <TrendingDown className="h-3.5 w-3.5" />
                {t('loyalty.redeemPoints')}
              </Button>
            </div>

            {manualMode && (
              <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                <p className="text-sm font-medium">
                  {manualMode === 'earn' ? t('loyalty.awardPoints') : t('loyalty.redeemPoints')}
                </p>
                <Input
                  type="number"
                  min={1}
                  placeholder={t('loyalty.pts')}
                  value={manualAmount}
                  onChange={e => setManualAmount(e.target.value)}
                  className="h-9"
                />
                <Input
                  placeholder={t('loyalty.noteOptional')}
                  value={manualNote}
                  onChange={e => setManualNote(e.target.value)}
                  className="h-9"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setManualMode(null)} className="flex-1">
                    {t('common.cancel')}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={!manualAmount || addPoints.isPending}
                    onClick={handleManualSubmit}
                  >
                    {addPoints.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    {t('common.apply')}
                  </Button>
                </div>
              </div>
            )}

            {/* Points history */}
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('loyalty.pointsHistory')}</p>
              {loyaltyLoading ? (
                <div className="space-y-1.5">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
                </div>
              ) : loyaltyPoints.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t('loyalty.noPoints')}</p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {loyaltyPoints.map((p: LoyaltyPoint) => (
                    <div key={p.id} className="flex items-center gap-2.5 rounded-lg border px-3 py-2">
                      <span className="shrink-0">{REASON_ICONS[p.reason] ?? <Gift className="h-3.5 w-3.5 text-muted-foreground" />}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{reasonLabel(p.reason)}</p>
                        {p.note && <p className="text-[10px] text-muted-foreground truncate">{p.note}</p>}
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${p.amount > 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                        {p.amount > 0 ? '+' : ''}{p.amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ClientsPage() {
  const { t, i18n } = useTranslation()
  const currency = useCurrency()
  const { user } = useAuth()
  const { data: aiConfig } = useAIConfig()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [statsClient, setStatsClient] = useState<Client | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [analysis, setAnalysis] = useState('')
  const [analysisLoading, setAnalysisLoading] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 350)
    return () => clearTimeout(id)
  }, [search])

  const { data: pagedClients, isLoading } = useClientsPaged(debouncedSearch, page)
  const items = pagedClients?.items ?? []
  const totalItems = pagedClients?.totalItems ?? 0
  const totalPages = pagedClients?.totalPages ?? 1
  const clientCount = totalItems
  const { isReached: clientLimitReached } = usePlanLimitCheck('clients', clientCount)
  const { newThisMonth, withPhone } = useClientSummary()
  const create = useCreateClient()
  const update = useUpdateClient()
  const updateAvatar = useUpdateClientAvatar()
  const del = useDeleteClient()

  const getAvatarUrl = (client: Client) => {
    if (!client.avatar) return null
    return getFileUrl('clients', client.avatar)
  }

  const { data: loyaltySettings } = useLoyaltySettings()
  const { data: loyaltyBalances = {} } = useAllClientsLoyaltyBalances()
  const { data: clientVisits = {} } = useAllClientsDoneVisits()

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tags: [] },
  })

  const exportCSV = useCallback(async () => {
    if (!user || totalItems === 0) return
    const { data: all } = await supabase
      .from('clients')
      .select('*')
      .eq('master_id', user.id)
      .order('first_name')
    if (!all) return
    const headers = ['Имя', 'Фамилия', 'Телефон', 'Email', 'Источник', 'Заметки', 'Дата добавления']
    const rows = all.map(c => [
      c.first_name,
      c.last_name || '',
      c.phone || '',
      c.email || '',
      c.source || '',
      (c.notes || '').replace(/\n/g, ' '),
      c.created ? c.created.slice(0, 10) : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clients_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [user, totalItems])

  const openCreate = () => {
    setEditClient(null)
    reset({})
    setAvatarFile(null)
    setAvatarPreview(null)
    setDialogOpen(true)
  }
  const openEdit = (c: Client) => {
    setEditClient(c)
    reset({
      first_name: c.first_name,
      last_name: c.last_name || '',
      phone: c.phone || '',
      email: c.email || '',
      birthday: c.birthday ? birthdayToDisplay(c.birthday) : '',
      notes: c.notes || '',
      source: c.source || '',
      tags: c.tags || [],
    })
    setAvatarFile(null)
    setAvatarPreview(c.avatar ? getFileUrl('clients', c.avatar) : null)
    setDialogOpen(true)
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const onSubmit = async (values: FormValues) => {
    const birthdayISO = values.birthday ? birthdayToISO(values.birthday) : ''
    const payload = { ...values, birthday: birthdayISO || undefined }
    try {
      let savedClient: Client
      if (editClient) {
        savedClient = await update.mutateAsync({ id: editClient.id, data: payload })
        toast.success(t('clients.updated'))
      } else {
        savedClient = await create.mutateAsync(payload as any)
        toast.success(t('clients.created'))
      }
      // Upload avatar if changed
      if (avatarFile) {
        await updateAvatar.mutateAsync({ id: savedClient.id, file: avatarFile })
      }
      setDialogOpen(false)
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await del.mutateAsync(deleteId)
      toast.success(t('clients.deleted'))
      setDeleteId(null)
    } catch {
      toast.error(t('common.deleteError'))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const isAllSelected = useMemo(
    () => items.length > 0 && items.every(c => selectedIds.has(c.id)),
    [items, selectedIds]
  )
  const isSomeSelected = useMemo(
    () => items.some(c => selectedIds.has(c.id)),
    [items, selectedIds]
  )

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map(c => c.id)))
    }
  }

  const handleBulkDelete = async () => {
    try {
      await Promise.all([...selectedIds].map(id => del.mutateAsync(id)))
      toast.success(t('clients.deletedMultiple', { count: selectedIds.size }))
      setSelectedIds(new Set())
      setBulkDeleteOpen(false)
    } catch {
      toast.error(t('common.deleteError'))
    }
  }


  const generateAnalysis = useCallback(async () => {
    setAnalysisOpen(true)
    setAnalysisLoading(true)
    setAnalysis('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-analyze-clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      })
      const json = await resp.json()
      if (json.analysis) {
        setAnalysis(json.analysis)
      } else {
        setAnalysis('Не удалось получить анализ. Попробуйте позже.')
      }
    } catch {
      setAnalysis('Ошибка при запросе анализа. Проверьте подключение.')
    } finally {
      setAnalysisLoading(false)
    }
  }, [])

  function renderAnalysis(text: string) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) {
        return <h3 key={i} className="text-sm font-semibold mt-4 mb-1.5 first:mt-0">{line.slice(3)}</h3>
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const content = line.slice(2).replace(/\*\*(.*?)\*\*/g, '$1')
        return <li key={i} className="ml-4 text-sm list-disc text-muted-foreground leading-relaxed">{content}</li>
      }
      if (line.trim() === '') return <div key={i} className="h-1" />
      return <p key={i} className="text-sm text-muted-foreground leading-relaxed">{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 sticky top-0 z-10 bg-background -mx-3 px-3 lg:-mx-6 lg:px-6 -mt-4 pt-4 lg:-mt-6 lg:pt-6 pb-3 shadow-sm">
        {/* Row 1: title */}
        <h1 className="text-2xl font-semibold text-foreground">{t('nav.clients')}</h1>

        {/* Bulk action bar */}
        {isSomeSelected && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/20">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {isAllSelected
                ? <CheckSquare className="h-4 w-4" />
                : <Square className="h-4 w-4" />
              }
              {isAllSelected ? t('common.deselectAll') : t('common.selectAll')}
            </button>
            <span className="text-xs text-muted-foreground">
              {t('clients.selectedCount', { count: selectedIds.size })}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {t('common.delete')}
              </Button>
            </div>
          </div>
        )}

        {/* Row 2: search + button */}
        <div className="flex items-center gap-2">
          {!isLoading && (totalItems > 0 || debouncedSearch) && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('clients.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          )}
          <Button className="shrink-0 ml-auto" onClick={openCreate} disabled={clientLimitReached}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('clients.add')}</span>
          </Button>
        </div>

      </div>

      {/* Plan limit banner */}
      <PlanLimitBanner limitKey="clients" count={clientCount} entityKey="clients" />

      {!isLoading && totalItems > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Всего клиентов</p>
              <p className="text-2xl font-bold mt-1">{totalItems}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Новых за 30 дней</p>
              <p className="text-2xl font-bold mt-1">{newThisMonth ?? '—'}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">С телефоном</p>
              <p className="text-2xl font-bold mt-1">{withPhone ?? '—'}</p>
            </div>
          </div>
          {aiConfig?.enabled && (
            <Button variant="outline" size="sm" className="gap-2 text-purple-600 border-purple-200 hover:bg-purple-50 dark:hover:bg-purple-950/20" onClick={generateAnalysis}>
              <Sparkles className="h-4 w-4" />
              ИИ-анализ клиентской базы
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Users} title={t('clients.empty')} action={{ label: t('clients.add'), onClick: openCreate }} />
      ) : (
        <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:hidden">
          {items.map((client) => {
            const isSelected = selectedIds.has(client.id)
            return (
            <Card key={client.id} className={`hover:border-primary/40 transition-colors cursor-pointer ${isSelected ? 'border-primary/60 bg-primary/5' : ''}`} onClick={() => setStatsClient(client)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Чекбокс */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSelect(client.id) }}
                    className="mt-1 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors shrink-0"
                  >
                    {isSelected
                      ? <CheckSquare className="h-4 w-4 text-primary" />
                      : <Square className="h-4 w-4" />
                    }
                  </button>
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={getAvatarUrl(client) ?? undefined} />
                    <AvatarFallback>
                      {client.first_name.charAt(0)}{client.last_name?.charAt(0) || ''}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {client.first_name} {client.last_name}
                    </p>
                    {client.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />{client.phone}
                      </p>
                    )}
                    {client.email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />{client.email}
                      </p>
                    )}
                    {loyaltySettings?.enabled && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {(() => {
                          const visits = clientVisits[client.id] ?? 0
                          const level = getLoyaltyLevel(visits, loyaltySettings)
                          const balance = loyaltyBalances[client.id] ?? 0
                          const color = getLevelColor(level)
                          return (
                            <>
                              <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${color}`}>
                                <LevelIcon level={level} className="h-2.5 w-2.5" />
                                {t(`loyalty.level_${level}`)}
                              </span>
                              {balance > 0 && (
                                <span className="text-[10px] text-muted-foreground">{balance} {t('loyalty.pts')}</span>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    )}
                    {client.tags && client.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {client.tags.slice(0, 3).map((tag, i) => (
                          <span key={i} className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">{tag}</span>
                        ))}
                        {client.tags.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{client.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setStatsClient(client) }}>
                        <BarChart2 className="mr-2 h-4 w-4" />{t('clients.viewHistory')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(client) }}>
                        <Edit className="mr-2 h-4 w-4" />{t('common.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(client.id) }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />{t('common.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          )})}
        </div>
        {/* List view */}
        <div className="border rounded-xl overflow-hidden hidden sm:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 w-10">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="flex items-center text-muted-foreground hover:text-primary transition-colors"
                  >
                    {isAllSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                  </button>
                </th>
                <th className="w-10"></th>
                <th className="text-left p-3 font-medium">{t('clients.firstName')}</th>
                <th className="text-left p-3 font-medium">{t('clients.phone')}</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((client) => {
                const isSelected = selectedIds.has(client.id)
                return (
                  <tr
                    key={client.id}
                    className={`border-t hover:bg-accent/40 transition-colors cursor-pointer ${isSelected ? 'bg-primary/5' : ''}`}
                    onClick={() => openEdit(client)}
                  >
                    <td className="p-3 w-10">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleSelect(client.id) }}
                        className="flex items-center text-muted-foreground hover:text-primary transition-colors"
                      >
                        {isSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="py-3 w-10">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={getAvatarUrl(client) ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {client.first_name.charAt(0)}{client.last_name?.charAt(0) || ''}
                        </AvatarFallback>
                      </Avatar>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{client.first_name} {client.last_name}</span>
                        {loyaltySettings?.enabled && (() => {
                          const visits = clientVisits[client.id] ?? 0
                          const level = getLoyaltyLevel(visits, loyaltySettings)
                          if (level === 'new') return null
                          return (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${getLevelColor(level)}`}>
                              <LevelIcon level={level} className="h-2.5 w-2.5" />
                            </span>
                          )
                        })()}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {client.phone
                        ? <span className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{client.phone}</span>
                        : '—'}
                    </td>
                    <td className="p-3 w-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setStatsClient(client) }}>
                            <BarChart2 className="mr-2 h-4 w-4" />{t('clients.viewHistory')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(client) }}>
                            <Edit className="mr-2 h-4 w-4" />{t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteId(client.id) }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />{t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <PaginationBar page={page} totalPages={totalPages} totalItems={totalItems} perPage={25} onChange={setPage} />
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent mobileFullscreen className="overflow-y-auto max-sm:flex max-sm:flex-col">
          <DialogHeader>
            <DialogTitle>{editClient ? t('clients.edit') : t('clients.add')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="max-sm:flex-1 max-sm:flex max-sm:flex-col max-sm:overflow-hidden">
            <div className="space-y-4 max-sm:flex-1 max-sm:overflow-y-auto max-sm:pb-2">
              {/* Avatar upload */}
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="relative group">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={avatarPreview ?? undefined} />
                    <AvatarFallback className="text-2xl bg-muted">
                      <UserCircle2 className="h-10 w-10 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Camera className="h-6 w-6 text-white" />
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Camera className="h-3.5 w-3.5 mr-1.5" />
                  {t('clients.uploadPhoto')}
                </Button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>{t('clients.firstName')} *</Label>
                  <Input {...register('first_name')} />
                  {errors.first_name && <p className="text-xs text-destructive">{t('common.required')}</p>}
                </div>
                <div className="space-y-2">
                  <Label>{t('clients.phone')}</Label>
                  <Input placeholder="+998..." {...register('phone')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('clients.email')}</Label>
                  <Input type="email" {...register('email')} />
                  {errors.email && <p className="text-xs text-destructive">{t('auth.invalidEmail')}</p>}
                </div>
                <div className="space-y-2">
                  <Label>День рождения</Label>
                  <Controller
                    name="birthday"
                    control={control}
                    render={({ field }) => (
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="01.01.2000"
                        maxLength={10}
                        value={field.value || ''}
                        onChange={e => field.onChange(maskBirthday(e.target.value))}
                      />
                    )}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('clients.notes')}</Label>
                <Textarea rows={3} {...register('notes')} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  {t('clients.tags')}
                </Label>
                <Controller
                  name="tags"
                  control={control}
                  render={({ field }) => (
                    <TagsInput value={field.value || []} onChange={field.onChange} />
                  )}
                />
                <p className="text-xs text-muted-foreground">{t('clients.tagsHint')}</p>
              </div>
            </div>
            <DialogFooter className="max-sm:shrink-0 max-sm:border-t max-sm:pt-4 max-sm:mt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={create.isPending || update.isPending}>
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t('clients.deleteConfirm')}
        loading={del.isPending}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        title={t('clients.bulkDeleteConfirm', { count: selectedIds.size })}
        loading={del.isPending}
      />

      {statsClient && (
        <ClientStatsDialog client={statsClient} onClose={() => setStatsClient(null)} />
      )}

      {/* AI Analysis Dialog */}
      <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <DialogContent mobileFullscreen className="max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              ИИ-анализ клиентской базы
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {analysisLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                <p className="text-sm text-muted-foreground">Анализирую данные...</p>
              </div>
            ) : analysis ? (
              <div className="space-y-1">{renderAnalysis(analysis)}</div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnalysisOpen(false)}>{t('common.cancel')}</Button>
            {!analysisLoading && analysis && (
              <Button variant="outline" className="gap-2 text-purple-600" onClick={generateAnalysis}>
                <Sparkles className="h-4 w-4" />
                Обновить
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
