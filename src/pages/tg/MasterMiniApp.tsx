import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  User,
  TrendingUp,
  Smartphone,
  RefreshCw,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getFileUrl } from '@/lib/utils'
import {
  isTelegramMiniApp,
  initMiniApp,
  getTelegramUserId,
  hapticSuccess,
  hapticImpact,
} from '@/lib/telegramWebApp'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

const APP_URL = 'https://ezze.site'

interface MasterProfile {
  id: string
  user: string
  profession: string
  booking_slug: string
  tg_chat_id: string
  currency?: string
  avatar?: string
  collectionId?: string
}

interface AppointmentRow {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  price: number
  client_name: string
  client_phone: string
  notes: string
  service: string
  expand?: { service?: { name: string } }
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Запланировано',
  done: 'Выполнено',
  cancelled: 'Отменено',
  no_show: 'Не явился',
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  done: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
  no_show: 'bg-red-100 text-red-600',
}

export function MasterMiniApp() {
  const location = useLocation()
  const locationState = location.state as { masterId?: string; profileId?: string } | null

  const [profile, setProfile] = useState<MasterProfile | null>(null)
  const [masterName, setMasterName] = useState('')
  const [todayAppts, setTodayAppts] = useState<AppointmentRow[]>([])
  const [tomorrowAppts, setTomorrowAppts] = useState<AppointmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null)

  const today    = dayjs().format('YYYY-MM-DD')
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD')

  // ── Загрузка профиля мастера ──────────────────────────────────────────────
  const loadProfile = useCallback(async (tgId: string): Promise<MasterProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('master_profiles')
        .select('*')
        .eq('tg_chat_id', tgId)
        .maybeSingle()
      if (error || !data) return null
      return data as unknown as MasterProfile
    } catch {
      return null
    }
  }, [])

  // ── Загрузка записей на дату ──────────────────────────────────────────────
  const loadAppts = useCallback(async (masterId: string, date: string): Promise<AppointmentRow[]> => {
    try {
      const { data } = await supabase
        .from('appointments')
        .select('*, service:services(name)')
        .eq('master_id', masterId)
        .eq('date', date)
        .neq('status', 'cancelled')
        .order('start_time')
      return (data ?? []) as unknown as AppointmentRow[]
    } catch {
      return []
    }
  }, [])

  // ── Инициализация ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isTelegramMiniApp()) {
      initMiniApp()
    }

    const init = async () => {
      const tgId = getTelegramUserId()

      let masterProfile: MasterProfile | null = null

      // Если пришли из TelegramEntryPage со state — используем сразу
      if (locationState?.masterId) {
        try {
          const { data } = await supabase
            .from('master_profiles')
            .select('*')
            .eq('user_id', locationState.masterId)
            .maybeSingle()
          if (data) masterProfile = data as unknown as MasterProfile
        } catch {}
      }

      // Иначе ищем по tg_chat_id
      if (!masterProfile && tgId) {
        masterProfile = await loadProfile(tgId)
      }

      if (!masterProfile) {
        setLoading(false)
        return
      }

      setProfile(masterProfile)

      // Получаем имя мастера из users
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('name')
          .eq('id', masterProfile.user)
          .maybeSingle()
        setMasterName(userData?.name || masterProfile.profession)
      } catch {
        setMasterName(masterProfile.profession)
      }

      // Загружаем записи
      const [td, tm] = await Promise.all([
        loadAppts(masterProfile.user, today),
        loadAppts(masterProfile.user, tomorrow),
      ])
      setTodayAppts(td)
      setTomorrowAppts(tm)
      setLoading(false)
    }

    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Обновление статуса ────────────────────────────────────────────────────
  const updateStatus = async (apptId: string, status: string) => {
    hapticImpact()
    setUpdatingId(apptId)
    try {
      await supabase.from('appointments').update({ status }).eq('id', apptId)
      hapticSuccess()

      // Обновляем локально
      const patch = (list: AppointmentRow[]) =>
        list.map((a) => (a.id === apptId ? { ...a, status } : a))

      if (status === 'cancelled') {
        // При отмене убираем из списков
        setTodayAppts((prev) => prev.filter((a) => a.id !== apptId))
        setTomorrowAppts((prev) => prev.filter((a) => a.id !== apptId))
      } else {
        setTodayAppts(patch)
        setTomorrowAppts(patch)
      }
    } catch (err) {
      console.error('updateStatus error:', err)
    } finally {
      setUpdatingId(null)
      setConfirmCancel(null)
    }
  }

  // ── Refresh ───────────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    if (!profile) return
    hapticImpact()
    setLoading(true)
    const [td, tm] = await Promise.all([
      loadAppts(profile.user, today),
      loadAppts(profile.user, tomorrow),
    ])
    setTodayAppts(td)
    setTomorrowAppts(tm)
    setLoading(false)
  }

  // ── No Telegram ───────────────────────────────────────────────────────────
  if (!loading && !profile) {
    const tgId = getTelegramUserId()
    if (!tgId) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center gap-4">
          <Smartphone className="h-16 w-16 text-muted-foreground" />
          <h1 className="text-xl font-bold">Откройте через Telegram</h1>
          <p className="text-sm text-muted-foreground">
            Кабинет мастера доступен только в Telegram Mini App.
          </p>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center gap-4">
        <User className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-xl font-bold">Профиль не найден</h1>
        <p className="text-sm text-muted-foreground">
          Ваш Telegram не привязан к профилю мастера Ezze.
          <br />
          Откройте профиль в приложении и подключите Telegram.
        </p>
        <a
          href={`${APP_URL}/profile`}
          className="text-sm text-primary underline underline-offset-2"
        >
          Открыть настройки профиля
        </a>
      </div>
    )
  }

  if (loading) return <LoadingSpinner fullScreen />

  const todayRevenue = todayAppts
    .filter((a) => a.status !== 'cancelled')
    .reduce((sum, a) => sum + (a.price || 0), 0)

  const currency = profile?.currency || 'RUB'
  const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₽'
  const avatarUrl = profile?.avatar
    ? getFileUrl('master_profiles', profile.avatar)
    : undefined

  return (
    <div className="max-w-lg mx-auto p-4 space-y-5 pb-8">

      {/* ── Шапка ── */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={masterName} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
              {masterName ? masterName.charAt(0).toUpperCase() : 'М'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-lg font-bold leading-tight">{masterName}</h1>
            <p className="text-xs text-muted-foreground">{profile?.profession}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <a
            href={`${APP_URL}/dashboard`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary font-medium px-3 py-1.5 rounded-md border border-primary/30 hover:bg-primary/5 transition-colors"
          >
            Кабинет
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* ── Статистика дня ── */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{todayAppts.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">записей сегодня</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">
                {todayRevenue > 0 ? todayRevenue.toLocaleString('ru') : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {todayRevenue > 0 ? currencySymbol + ' выручка' : 'выручка сегодня'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Сегодня ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Сегодня — {dayjs().format('D MMMM')}
        </h2>

        {todayAppts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              Записей на сегодня нет
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {todayAppts.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appt={appt}
                updatingId={updatingId}
                confirmCancel={confirmCancel}
                onDone={() => updateStatus(appt.id, 'done')}
                onCancelRequest={() => setConfirmCancel(appt.id)}
                onCancelConfirm={() => updateStatus(appt.id, 'cancelled')}
                onCancelAbort={() => setConfirmCancel(null)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Завтра ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Завтра — {dayjs().add(1, 'day').format('D MMMM')}
        </h2>

        {tomorrowAppts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              Записей на завтра нет
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {tomorrowAppts.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appt={appt}
                updatingId={updatingId}
                confirmCancel={confirmCancel}
                onDone={() => updateStatus(appt.id, 'done')}
                onCancelRequest={() => setConfirmCancel(appt.id)}
                onCancelConfirm={() => updateStatus(appt.id, 'cancelled')}
                onCancelAbort={() => setConfirmCancel(null)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Ссылка на запись ── */}
      {profile?.booking_slug && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Ссылка на запись</p>
              <p className="text-xs text-muted-foreground">
                {APP_URL}/book/{profile.booking_slug}
              </p>
            </div>
            <a
              href={`${APP_URL}/book/${profile.booking_slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="shrink-0">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Открыть
              </Button>
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


// ── Карточка записи ────────────────────────────────────────────────────────

interface AppointmentCardProps {
  appt: AppointmentRow
  updatingId: string | null
  confirmCancel: string | null
  onDone: () => void
  onCancelRequest: () => void
  onCancelConfirm: () => void
  onCancelAbort: () => void
}

function AppointmentCard({
  appt,
  updatingId,
  confirmCancel,
  onDone,
  onCancelRequest,
  onCancelConfirm,
  onCancelAbort,
}: AppointmentCardProps) {
  const isUpdating = updatingId === appt.id
  const isConfirmingCancel = confirmCancel === appt.id
  const isDone = appt.status === 'done'

  // Имя услуги: сначала из expand, потом из notes-префикса
  const serviceName = (() => {
    if (appt.expand?.service?.name) return appt.expand.service.name
    const match = appt.notes?.match(/^\[([^\]]+)\]/)
    if (match) return match[1]
    return '—'
  })()

  const statusBadge = STATUS_LABELS[appt.status] || appt.status
  const statusColor = STATUS_COLORS[appt.status] || 'bg-gray-100 text-gray-500'

  return (
    <Card className={isDone ? 'opacity-70' : ''}>
      <CardContent className="p-4 space-y-3">
        {/* Время + статус */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-semibold">
              {appt.start_time}
              {appt.end_time ? ` — ${appt.end_time}` : ''}
            </span>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
            {statusBadge}
          </span>
        </div>

        {/* Клиент + услуга */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium">{appt.client_name || '—'}</span>
            {appt.client_phone && (
              <a
                href={`tel:${appt.client_phone}`}
                className="text-xs text-primary underline underline-offset-2 ml-auto"
              >
                {appt.client_phone}
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span>{serviceName}</span>
          </div>
          {appt.price > 0 && (
            <div className="text-sm font-medium text-emerald-600">
              {appt.price.toLocaleString('ru')} ₽
            </div>
          )}
        </div>

        {/* Кнопки действий (только для активных записей) */}
        {appt.status === 'scheduled' && !isConfirmingCancel && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="default"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isUpdating}
              onClick={onDone}
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
              Выполнено
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
              disabled={isUpdating}
              onClick={onCancelRequest}
            >
              <XCircle className="h-3.5 w-3.5 mr-1.5" />
              Отменить
            </Button>
          </div>
        )}

        {/* Подтверждение отмены */}
        {isConfirmingCancel && (
          <div className="space-y-2 pt-1">
            <p className="text-sm text-center font-medium text-red-600">
              Отменить запись?
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                disabled={isUpdating}
                onClick={onCancelConfirm}
              >
                Да, отменить
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={isUpdating}
                onClick={onCancelAbort}
              >
                Нет
              </Button>
            </div>
          </div>
        )}

        {isUpdating && (
          <div className="flex items-center justify-center py-1">
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
