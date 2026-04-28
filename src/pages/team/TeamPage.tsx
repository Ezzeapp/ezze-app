import { useState, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useFeature } from '@/hooks/useFeatureFlags'
import { useTeamScope } from '@/contexts/TeamContext'
import {
  Users, UserPlus, Copy, Trash2, UserMinus, Check,
  LogIn, ChevronRight, Loader2, KeyRound, AlertTriangle,
  PauseCircle, PlayCircle, QrCode, ScanBarcode,
} from 'lucide-react'
import { useMyTeam, useTeamMembers, useCreateTeam, useRemoveTeamMember, useLeaveTeam, useTogglePauseTeamMember, useUpdateMemberCommission } from '@/hooks/useTeam'
import { useTeamInvites, useCreateTeamInvite, useDeactivateTeamInvite, useJoinTeam } from '@/hooks/useTeamInvites'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/shared/Toaster'
import { cn, generateSlug, getFileUrl } from '@/lib/utils'
import { TeamAnalyticsTab } from './TeamAnalyticsTab'
import { TeamCalendarTab } from './TeamCalendarTab'
import { TeamSettingsTab } from './TeamSettingsTab'
import { PRODUCT } from '@/lib/config'
import dayjs from 'dayjs'

// ── Модальное подтверждение ──────────────────────────────────────────────────

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onCancel() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {destructive && <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />}
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── QR-диалог для кода приглашения ───────────────────────────────────────────

function InviteQrDialog({ code, open, onClose }: { code: string; open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const joinUrl = `${window.location.origin}/join/${code}`
  const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(joinUrl)}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(joinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xs w-full p-6">
        <DialogHeader>
          <DialogTitle className="text-center">QR-код приглашения</DialogTitle>
          <DialogDescription className="text-center text-xs">
            Покажите мастеру — он сканирует и сразу вступает в команду
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 pt-1">
          {/* QR */}
          <div className="rounded-2xl border bg-white p-2 shadow-sm">
            <img src={qrUrl} alt="QR-код приглашения" width={200} height={200} className="block" />
          </div>
          {/* Код текстом */}
          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono text-sm font-bold tracking-widest">{code}</span>
          </div>
          {/* Кнопки */}
          <Button variant="outline" className="w-full gap-2" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Скопировано!' : 'Копировать ссылку'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Нет команды: выбор действия ─────────────────────────────────────────────

function NoTeamSection() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'create' | 'join' | null>(null)

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Заголовок */}
      <div className="text-center py-6">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mx-auto mb-3">
          <Users className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-lg font-bold">{t('team.noTeam')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t('team.noTeamDesc')}</p>
      </div>

      {/* Карточки-выборы */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setMode(mode === 'create' ? null : 'create')}
          className={cn(
            'flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all text-left',
            mode === 'create'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/40 hover:bg-muted/50'
          )}
        >
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', mode === 'create' ? 'bg-primary/15' : 'bg-muted')}>
            <Users className={cn('h-5 w-5', mode === 'create' ? 'text-primary' : 'text-muted-foreground')} />
          </div>
          <div>
            <p className={cn('text-sm font-semibold', mode === 'create' ? 'text-primary' : '')}>{t('team.createTeam')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('team.createTeamHint')}</p>
          </div>
          <ChevronRight className={cn('h-4 w-4 ml-auto self-end transition-transform', mode === 'create' ? 'rotate-90 text-primary' : 'text-muted-foreground')} />
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === 'join' ? null : 'join')}
          className={cn(
            'flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all text-left',
            mode === 'join'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/40 hover:bg-muted/50'
          )}
        >
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', mode === 'join' ? 'bg-primary/15' : 'bg-muted')}>
            <LogIn className={cn('h-5 w-5', mode === 'join' ? 'text-primary' : 'text-muted-foreground')} />
          </div>
          <div>
            <p className={cn('text-sm font-semibold', mode === 'join' ? 'text-primary' : '')}>{t('team.joinTeam')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('team.joinTeamHint')}</p>
          </div>
          <ChevronRight className={cn('h-4 w-4 ml-auto self-end transition-transform', mode === 'join' ? 'rotate-90 text-primary' : 'text-muted-foreground')} />
        </button>
      </div>

      {mode === 'create' && <CreateTeamForm />}
      {mode === 'join' && <JoinTeamForm />}
    </div>
  )
}

// ── Форма создания команды ───────────────────────────────────────────────────

function CreateTeamForm() {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const createTeam = useCreateTeam()

  const handleNameChange = (v: string) => {
    setName(v)
    if (!slugEdited) setSlug(generateSlug(v))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return
    try {
      await createTeam.mutateAsync({ name: name.trim(), slug: slug.trim() })
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('team.teamName')}</Label>
            <Input
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="Салон Красота"
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('team.teamSlug')}</Label>
            <Input
              value={slug}
              onChange={e => { setSlug(e.target.value); setSlugEdited(true) }}
              placeholder="salon-krasota"
              pattern="[-a-z0-9]+"
              required
            />
            <p className="text-xs text-muted-foreground">{t('team.teamSlugHint')}</p>
          </div>
          <Button type="submit" className="w-full" loading={createTeam.isPending} disabled={!name.trim() || !slug.trim()}>
            {t('team.createTeam')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Форма вступления по коду ─────────────────────────────────────────────────

function JoinTeamForm() {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const joinTeam = useJoinTeam()

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return
    try {
      await joinTeam.mutateAsync({ code: trimmed })
      toast.success(t('team.joinSuccess'))
    } catch (err: any) {
      if (err.message === 'already_member') toast.error(t('team.alreadyMember'))
      else if (err.message === 'invite_expired') toast.error(t('team.expiredInvite'))
      else if (err.message === 'invite_inactive' || err.message === 'invite_used') toast.error(t('team.invalidInvite'))
      else toast.error(t('team.invalidInvite'))
    }
  }

  const handleScanQr = () => {
    const tg = (window as any).Telegram?.WebApp
    if (!tg?.showScanQrPopup) {
      toast.error('QR-сканер доступен только в Telegram')
      return
    }
    tg.showScanQrPopup({ text: 'Наведите камеру на QR-код приглашения команды' }, (data: string) => {
      tg.closeScanQrPopup?.()
      try {
        const url = new URL(data)
        // Формат: https://ezze.site/join/ABCD1234
        const match = url.pathname.match(/\/join\/([^/]+)$/)
        if (match) {
          const inviteCode = match[1]
          setCode(inviteCode)
          joinTeam.mutateAsync({ code: inviteCode })
            .then(() => toast.success(t('team.joinSuccess')))
            .catch((err: any) => {
              if (err.message === 'already_member') toast.error(t('team.alreadyMember'))
              else if (err.message === 'invite_expired') toast.error(t('team.expiredInvite'))
              else toast.error(t('team.invalidInvite'))
            })
          return true
        }
      } catch {}
      toast.error('Не удалось распознать QR-код')
      return true
    })
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={handleJoin} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('team.inviteCode')}</Label>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder={t('team.enterInviteCode')}
                className="font-mono flex-1"
                autoFocus
              />
              {/* Кнопка сканирования QR (в TMA) */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleScanQr}
                title="Сканировать QR-код"
              >
                <ScanBarcode className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button type="submit" className="w-full" loading={joinTeam.isPending} disabled={!code.trim()}>
            {t('team.joinTeam')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Карточка приглашения ─────────────────────────────────────────────────────

function InviteRow({ invite, onShowQR }: { invite: any; onShowQR?: (code: string) => void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const deactivate = useDeactivateTeamInvite()

  const isExpired = new Date(invite.expires_at) < new Date()
  const isExhausted = invite.max_uses > 0 && invite.use_count >= invite.max_uses
  const isActive = invite.is_active && !isExpired && !isExhausted

  const handleCopy = async () => {
    await navigator.clipboard.writeText(invite.code)
    setCopied(true)
    toast.success(t('team.inviteCodeCopied'))
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('flex items-center gap-3 py-2.5 border-b last:border-0', !isActive && 'opacity-50')}>
      <div className="flex-1 min-w-0">
        {invite.label && (
          <p className="text-xs font-medium truncate">{invite.label}</p>
        )}
        <p className="text-xs font-mono text-muted-foreground">{invite.code}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <Badge variant={isActive ? 'default' : 'secondary'} className="text-[10px] h-4 px-1.5">
            {isActive ? t('team.inviteActive') : isExpired ? t('team.inviteExpiredLabel') : t('team.inviteInactive')}
          </Badge>
          {/* Счётчик использований */}
          <span className="text-[10px] text-muted-foreground">
            {t('team.inviteUsed')}: {invite.use_count}
            {invite.max_uses > 0 ? ` / ${invite.max_uses}` : ' / ∞'}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {t('team.validUntil')} {dayjs(invite.expires_at).format('DD.MM.YY')}
          </span>
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        {isActive && (
          <>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onShowQR?.(invite.code)} title="Показать QR-код">
              <QrCode className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCopy} title={t('team.copyCode')}>
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </>
        )}
        {invite.is_active && (
          <Button
            size="icon" variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => deactivate.mutateAsync(invite.id)}
            disabled={deactivate.isPending}
            title={t('team.deactivate')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Вкладка «Участники» ──────────────────────────────────────────────────────


function MembersTab({ team, members, membersLoading }: { team: any; members: any[]; membersLoading: boolean }) {
  const { t } = useTranslation()
  const [maxUsesInput, setMaxUsesInput] = useState('1')
  const [inviteRole, setInviteRole] = useState<'admin' | 'operator' | 'worker'>('operator')
  const [newInviteCode, setNewInviteCode] = useState<string | null>(null)
  const [copiedNew, setCopiedNew] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)

  const { data: invites = [], isLoading: invitesLoading } = useTeamInvites(team.id)
  const createInvite = useCreateTeamInvite()
  const removeM = useRemoveTeamMember()
  const togglePause = useTogglePauseTeamMember()
  const updateCommission = useUpdateMemberCommission()

  const activeInvites = invites.filter((inv: any) => {
    const expired = new Date(inv.expires_at) < new Date()
    const exhausted = inv.max_uses > 0 && inv.use_count >= inv.max_uses
    return inv.is_active && !expired && !exhausted
  })

  const maxUsesValue = maxUsesInput === '' ? 0 : Math.max(0, parseInt(maxUsesInput) || 0)

  // TG-бот ссылка для приглашения сотрудника (master-бот для всех продуктов)
  // Сотрудник тапает → бот регистрирует через team-employee-register
  const botLink = newInviteCode
    ? `https://t.me/ezzemaster_bot?start=join_${newInviteCode}`
    : null

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const inv = await createInvite.mutateAsync({
        teamId: team.id,
        maxUses: maxUsesValue,
        expiryDays: 7,
        label: inviteRole,
      })
      setNewInviteCode(inv.code)
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const handleCopyNew = async () => {
    if (!newInviteCode) return
    await navigator.clipboard.writeText(newInviteCode)
    setCopiedNew(true)
    toast.success(t('team.inviteCodeCopied'))
    setTimeout(() => { setCopiedNew(false) }, 2000)
  }

  const handleCopyLink = async () => {
    if (!botLink) return
    await navigator.clipboard.writeText(botLink)
    setCopiedLink(true)
    toast.success('Ссылка скопирована')
    setTimeout(() => { setCopiedLink(false) }, 2000)
  }

  const handleRemoveConfirmed = async () => {
    if (!confirmRemoveId) return
    try {
      await removeM.mutateAsync({ memberId: confirmRemoveId, teamId: team.id })
      toast.success(t('team.removeSuccess'))
    } catch {
      toast.error(t('common.saveError'))
    } finally {
      setConfirmRemoveId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Добавить участника */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            {t('team.addMember')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={handleCreateInvite} className="space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground shrink-0">Роль:</span>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as any)}
                className="h-8 rounded border border-border bg-background px-2 text-sm font-medium focus:outline-none focus:border-primary"
              >
                <option value="operator">Оператор (POS, заказы)</option>
                <option value="worker">Сотрудник (только свои заказы)</option>
                <option value="admin">Админ (управление командой)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">{t('team.inviteUses')}:</span>
              <input
                type="number"
                min={0}
                max={999}
                value={maxUsesInput}
                onChange={e => setMaxUsesInput(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-16 h-8 rounded border border-border bg-background px-2 text-base sm:text-sm text-center font-medium focus:outline-none focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0=∞"
              />
              <Button type="submit" size="sm" loading={createInvite.isPending} className="ml-auto shrink-0">
                <UserPlus className="h-3.5 w-3.5 mr-1" />
                Пригласить сотрудника
              </Button>
            </div>
          </form>

          {newInviteCode && botLink && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 space-y-2.5">
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                ✅ Приглашение готово — отправьте ссылку сотруднику в Telegram/WhatsApp:
              </p>

              {/* TG-бот ссылка — главный способ */}
              <div className="bg-white dark:bg-emerald-950/50 rounded-md p-2 border border-emerald-300 dark:border-emerald-700">
                <p className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400 font-semibold mb-1">
                  Ссылка для регистрации через бот
                </p>
                <div className="flex items-center gap-1.5">
                  <code className="text-xs font-mono break-all text-emerald-900 dark:text-emerald-200 flex-1">
                    {botLink}
                  </code>
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 px-2 text-emerald-700 hover:bg-emerald-100 shrink-0"
                    onClick={handleCopyLink}
                  >
                    {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Альтернатива: код вручную */}
              <div className="flex items-center gap-2 pt-1 border-t border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-emerald-600 dark:text-emerald-500 shrink-0">
                  или код вручную:
                </span>
                <span className="font-mono text-sm font-bold tracking-widest text-emerald-700 dark:text-emerald-400">
                  {newInviteCode}
                </span>
                <Button size="sm" variant="ghost" className="h-7 text-emerald-700 hover:bg-emerald-100 shrink-0 ml-auto" onClick={() => setQrCode(newInviteCode)} title="QR-код">
                  <QrCode className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-emerald-700 hover:bg-emerald-100 shrink-0" onClick={handleCopyNew}>
                  {copiedNew ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Сотрудник тапает по ссылке → бот запросит контакт → автоматически регистрирует и открывает кабинет команды.
          </p>
        </CardContent>
      </Card>

      {/* Активные приглашения */}
      {(activeInvites.length > 0 || invitesLoading) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {t('team.pendingInvites')}
              {activeInvites.length > 0 && (
                <Badge variant="secondary" className="text-xs">{activeInvites.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invitesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <div>
                {activeInvites.map((inv: any) => (
                  <InviteRow key={inv.id} invite={inv} onShowQR={code => setQrCode(code)} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Участники */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('team.members')}
            {members.length > 0 && (
              <Badge variant="secondary" className="text-xs">{members.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-1">{t('team.noMembers')}</p>
          ) : (
            <div>
              {members.map((m: any) => {
                const u = m.expand?.user
                const name = u?.name || u?.email || '—'
                const avatarUrl = u?.avatar ? getFileUrl('avatars', u.avatar) : null
                return (
                  <div
                    key={m.id}
                    className={cn(
                      'flex items-center gap-3 py-2.5 border-b last:border-0',
                      m.status === 'paused' && 'opacity-60'
                    )}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      {avatarUrl && <AvatarImage src={avatarUrl} />}
                      <AvatarFallback className="text-xs">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-medium truncate">{name}</p>
                        {m.status === 'paused' && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
                            {t('team.paused')}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs text-muted-foreground">
                          {t('team.joinedAt')} {dayjs(m.joined_at).format('DD.MM.YY')}
                        </p>
                        <span className="text-xs text-muted-foreground">·</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Комиссия</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            defaultValue={m.commission_pct ?? 100}
                            className="w-14 sm:w-12 text-base sm:text-xs border rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-primary bg-background"
                            onBlur={(e) => {
                              const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 100))
                              e.target.value = String(val)
                              if (val !== (m.commission_pct ?? 100)) {
                                updateCommission.mutate({ memberId: m.id, commissionPct: val })
                              }
                            }}
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <Button
                        size="icon" variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => togglePause.mutate({ memberId: m.id, currentStatus: m.status })}
                        disabled={togglePause.isPending}
                        title={m.status === 'paused' ? t('team.unpauseMember') : t('team.pauseMember')}
                      >
                        {m.status === 'paused'
                          ? <PlayCircle className="h-4 w-4" />
                          : <PauseCircle className="h-4 w-4" />
                        }
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                        onClick={() => setConfirmRemoveId(m.id)}
                        title={t('team.removeMember')}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmRemoveId}
        title={t('team.removeMember')}
        description={t('team.removeConfirm')}
        confirmLabel={t('team.removeMember')}
        destructive
        loading={removeM.isPending}
        onConfirm={handleRemoveConfirmed}
        onCancel={() => setConfirmRemoveId(null)}
      />

      {/* QR-диалог для кода приглашения */}
      <InviteQrDialog
        open={!!qrCode}
        code={qrCode ?? ''}
        onClose={() => setQrCode(null)}
      />
    </div>
  )
}

// ── Owner View с 4 вкладками ─────────────────────────────────────────────────

type OwnerTab = 'members' | 'calendar' | 'analytics' | 'settings'

function OwnerView({ team }: { team: any }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<OwnerTab>('members')

  const { data: members = [], isLoading: membersLoading } = useTeamMembers(team.id)

  // Синтетическая «запись участника» для самого владельца команды,
  // чтобы его записи тоже отображались в Календаре и Аналитике
  const ownerAsMember = useMemo(() => ({
    id: 'owner-self',
    collectionId: '',
    collectionName: 'team_members',
    team: team.id,
    user: team.owner,
    role: 'member' as const,
    status: 'active' as const,
    joined_at: team.created,
    created: team.created,
    updated: team.updated,
    expand: { user: team.expand?.owner },
  }), [team])

  // Все мастера = владелец + участники (active + paused)
  const allMasters = useMemo(() => [ownerAsMember, ...members], [ownerAsMember, members])

  const tabs: { key: OwnerTab; label: string }[] = [
    { key: 'members',   label: t('team.tabMembers')   },
    // Календарь бронирований не используется в workshop
    ...(PRODUCT !== 'workshop' ? [{ key: 'calendar' as OwnerTab, label: t('team.tabCalendar') }] : []),
    { key: 'analytics', label: t('team.tabAnalytics') },
    { key: 'settings',  label: t('team.tabSettings')  },
  ]

  return (
    <div className="space-y-4">
      {/* Заголовок команды */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{team.name}</p>
          {team.description && (
            <p className="text-xs text-muted-foreground truncate">{team.description}</p>
          )}
        </div>
        <Badge variant="secondary" className="shrink-0">{t('team.owner')}</Badge>
      </div>

      {/* Вкладки */}
      <div className="flex gap-0 border-b overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              activeTab === tab.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Содержимое вкладки */}
      {activeTab === 'members' && (
        <MembersTab team={team} members={members} membersLoading={membersLoading} />
      )}
      {activeTab === 'calendar' && (
        <TeamCalendarTab teamId={team.id} members={allMasters} membersLoading={membersLoading} />
      )}
      {activeTab === 'analytics' && (
        <TeamAnalyticsTab team={team} members={allMasters} membersLoading={membersLoading} />
      )}
      {activeTab === 'settings' && (
        <TeamSettingsTab team={team} />
      )}
    </div>
  )
}

// ── Member View ──────────────────────────────────────────────────────────────

function MemberView({ team }: { team: any }) {
  const { t } = useTranslation()
  const [confirmLeave, setConfirmLeave] = useState(false)
  const leaveTeam = useLeaveTeam()
  const ownerName = team.expand?.owner?.name || '—'

  const handleLeaveConfirmed = async () => {
    try {
      await leaveTeam.mutateAsync()
      toast.success(t('team.leaveSuccess'))
    } catch {
      toast.error(t('common.saveError'))
    } finally {
      setConfirmLeave(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{team.name}</p>
              <p className="text-xs text-muted-foreground">
                {t('team.owner')}: {ownerName}
              </p>
            </div>
            <Badge variant="secondary">{t('team.member')}</Badge>
          </div>
        </CardHeader>
        {team.description && (
          <CardContent className="pt-0 pb-3">
            <p className="text-sm text-muted-foreground">{team.description}</p>
          </CardContent>
        )}
        <CardContent className="pt-0">
          <Button
            variant="outline"
            className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmLeave(true)}
          >
            <UserMinus className="h-4 w-4 mr-2" />
            {t('team.leaveTeam')}
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmLeave}
        title={t('team.leaveTeam')}
        description={t('team.leaveConfirm')}
        confirmLabel={t('team.leaveTeam')}
        destructive
        loading={leaveTeam.isPending}
        onConfirm={handleLeaveConfirmed}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function TeamPage() {
  const { t } = useTranslation()
  const hasTeams = useFeature('teams')
  const { data, isLoading } = useMyTeam()
  const teamScope = useTeamScope()

  // Сотрудник или участник команды — пускаем без проверки фичи (доступ через членство).
  // Иначе — фича `teams` (требует план Pro+).
  const allowAccess = teamScope.isMember || teamScope.isOwner || teamScope.isTeamOnly || hasTeams
  if (!allowAccess) return <Navigate to="/billing" replace />

  return (
    <div className="flex flex-col h-full">
      <PageHeader title={t('team.title')} />
      <div className="flex-1 overflow-y-auto p-4 pb-24 lg:p-6 lg:pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !data?.team ? (
          <NoTeamSection />
        ) : data.isOwner ? (
          <OwnerView team={data.team} />
        ) : (
          <MemberView team={data.team} />
        )}
      </div>
    </div>
  )
}
