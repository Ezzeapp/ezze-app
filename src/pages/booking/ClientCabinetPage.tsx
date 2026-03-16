import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight, Zap, Gift, Copy, Check, Sun, Moon, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  isTelegramMiniApp,
  getTelegramUserId,
  getTelegramDisplayName,
} from '@/lib/telegramWebApp'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { getStoredTheme, setTheme } from '@/stores/themeStore'
import type { Appointment } from '@/types'

// ── Telegram Login Widget (браузерный) ────────────────────────────────────────
function TelegramLoginWidget({ onAuth }: { onAuth: (user: Record<string, unknown>) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onAuthRef = useRef(onAuth)
  useEffect(() => { onAuthRef.current = onAuth }, [onAuth])

  useEffect(() => {
    if (!containerRef.current) return
    ;(window as any).onTelegramAuth = (user: Record<string, unknown>) => {
      onAuthRef.current(user)
    }
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', 'ezzeclient_bot')
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '8')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    script.async = true
    containerRef.current.appendChild(script)
    return () => {
      delete (window as any).onTelegramAuth
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [])

  return <div ref={containerRef} className="flex justify-center" />
}

// Расширенный тип с данными о мастере
interface AppointmentWithMaster extends Appointment {
  masterName?: string
  serviceName?: string
  bookingSlug?: string
}

// ── Mock-данные для локального тестирования (убрать перед продом) ─────────────
const DEV_MOCK_APPOINTMENTS: AppointmentWithMaster[] = [
  {
    id: 'mock1',
    collectionId: '',
    collectionName: 'appointments',
    created: '',
    updated: '',
    master: 'mock_master',
    client: '',
    service: '',
    date: '2026-03-10',
    start_time: '14:00',
    end_time: '15:00',
    status: 'scheduled',
    price: 2500,
    notes: '[Стрижка + укладка]',
    cancel_token: 'mock-cancel-token-1',
    masterName: 'Парикмахер',
    serviceName: 'Стрижка + укладка',
    bookingSlug: 'mock-master',
  },
  {
    id: 'mock2',
    collectionId: '',
    collectionName: 'appointments',
    created: '',
    updated: '',
    master: 'mock_master',
    client: '',
    service: '',
    date: '2026-03-15',
    start_time: '11:30',
    end_time: '12:00',
    status: 'scheduled',
    price: 800,
    notes: '[Маникюр]',
    cancel_token: '',
    masterName: 'Мастер маникюра',
    serviceName: 'Маникюр',
    bookingSlug: 'mock-master-2',
  },
  {
    id: 'mock3',
    collectionId: '',
    collectionName: 'appointments',
    created: '',
    updated: '',
    master: 'mock_master',
    client: '',
    service: '',
    date: '2026-02-20',
    start_time: '10:00',
    end_time: '11:00',
    status: 'done',
    price: 1500,
    notes: '[Окрашивание]',
    cancel_token: '',
    masterName: 'Парикмахер',
    serviceName: 'Окрашивание',
    bookingSlug: 'mock-master',
  },
  {
    id: 'mock4',
    collectionId: '',
    collectionName: 'appointments',
    created: '',
    updated: '',
    master: 'mock_master',
    client: '',
    service: '',
    date: '2026-02-05',
    start_time: '16:00',
    end_time: '16:30',
    status: 'cancelled',
    price: 600,
    notes: '[Брови]',
    cancel_token: '',
    masterName: 'Мастер маникюра',
    serviceName: 'Коррекция бровей',
    bookingSlug: 'mock-master-2',
  },
  {
    id: 'mock5',
    collectionId: '',
    collectionName: 'appointments',
    created: '',
    updated: '',
    master: 'mock_master',
    client: '',
    service: '',
    date: '2026-01-28',
    start_time: '09:00',
    end_time: '10:30',
    status: 'done',
    price: 3200,
    notes: '[Массаж спины]',
    cancel_token: '',
    masterName: 'Массажист',
    serviceName: 'Массаж спины',
    bookingSlug: 'mock-master-3',
  },
]

const STATUS_CONFIG = {
  scheduled: {
    label: 'Запланировано',
    variant: 'default' as const,
    icon: Clock,
    color: 'text-blue-500',
  },
  done: {
    label: 'Выполнено',
    variant: 'secondary' as const,
    icon: CheckCircle,
    color: 'text-emerald-500',
  },
  cancelled: {
    label: 'Отменено',
    variant: 'outline' as const,
    icon: XCircle,
    color: 'text-muted-foreground',
  },
  no_show: {
    label: 'Не явился',
    variant: 'destructive' as const,
    icon: AlertCircle,
    color: 'text-destructive',
  },
}

export function ClientCabinetPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [appointments, setAppointments] = useState<AppointmentWithMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [telegramId, setTelegramId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [tgTopPadding, setTgTopPadding] = useState(0)
  const [loyaltySummary, setLoyaltySummary] = useState<any[]>([])
  const [copied, setCopied] = useState(false)
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    const t = getStoredTheme()
    return t === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : t
  })

  useEffect(() => {
    if (isTelegramMiniApp()) {
      const tg = window.Telegram?.WebApp
      if (tg) {
        tg.ready()
        tg.expand()

        // Отступ сверху из safe area (для fullscreen-режима)
        const updatePadding = () => {
          const safe = tg.safeAreaInset?.top ?? 0
          const content = tg.contentSafeAreaInset?.top ?? 0
          setTgTopPadding(safe + content)
        }
        setTimeout(updatePadding, 100)
        tg.onEvent('safeAreaChanged', updatePadding)
        tg.onEvent('contentSafeAreaChanged', updatePadding)
      }
    }

    const tgId = getTelegramUserId()
      || new URLSearchParams(window.location.search).get('tg_id')
    const tgName = getTelegramDisplayName()

    setTelegramId(tgId)
    setUserName(tgName)

    if (tgId) {
      loadAppointments(tgId)
    } else if (import.meta.env.DEV) {
      // Локальная разработка — показываем mock-данные
      setUserName('Тест Пользователь')
      setAppointments(DEV_MOCK_APPOINTMENTS)
      setLoading(false)
    } else {
      // Браузер без Telegram — покажем виджет входа
      setLoading(false)
    }
  }, [])

  const handleWidgetAuth = (user: Record<string, unknown>) => {
    const tgId = String(user.id ?? '')
    const firstName = String(user.first_name ?? '')
    const lastName = String(user.last_name ?? '')
    const name = [firstName, lastName].filter(Boolean).join(' ')
    if (!tgId) return
    setTelegramId(tgId)
    setUserName(name || firstName)
    setLoading(true)
    loadAppointments(tgId)
  }

  const loadAppointments = async (tgId: string) => {
    try {
      const { data: records, error } = await supabase
        .from('appointments')
        .select('*, service:services(name)')
        .eq('telegram_id', tgId)
        .order('date', { ascending: false })
        .order('start_time', { ascending: false })

      if (error) throw error

      // Батч-загрузка профилей мастеров (один запрос вместо N)
      const masterIds = [...new Set((records ?? []).map((a: any) => a.master_id).filter(Boolean))]
      let profileMap = new Map<string, { profession: string; booking_slug: string }>()

      if (masterIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('master_profiles')
          .select('user_id, profession, booking_slug')
          .in('user_id', masterIds)
        if (profileError) console.error('Profile load error:', profileError)
        profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]))
      }

      const enriched: AppointmentWithMaster[] = (records ?? []).map((appt: any) => {
        const profile = profileMap.get(appt.master_id)
        return {
          ...appt,
          masterName: profile?.profession || '',
          serviceName: appt.service?.name || '',
          bookingSlug: profile?.booking_slug || '',
        } as AppointmentWithMaster
      })

      setAppointments(enriched)

      // Load loyalty summary per master
      const { data: loyaltyData } = await supabase
        .rpc('get_client_loyalty_summary', { p_telegram_id: tgId })
      setLoyaltySummary(loyaltyData || [])
    } catch (err) {
      console.error('Failed to load appointments:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyReferral = async (clientId: string, masterSlug: string) => {
    const url = `${window.location.origin}/book/${masterSlug}?ref=${clientId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const handleCancel = (cancelToken: string) => {
    navigate(`/cancel/${cancelToken}`)
  }

  // Нет Telegram — показываем виджет входа (в браузере)
  if (!loading && !telegramId && !import.meta.env.DEV) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center gap-6">
        <div className="space-y-2">
          <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto">
            <svg viewBox="0 0 24 24" className="h-9 w-9 text-blue-500 fill-current" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-2.02 9.52c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.883.701z"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold">{t('cabinet.myAppointments')}</h1>
          <p className="text-muted-foreground text-sm">
            {t('cabinet.loginDesc')}
          </p>
        </div>
        <TelegramLoginWidget onAuth={handleWidgetAuth} />
      </div>
    )
  }

  if (loading) return <LoadingSpinner fullScreen />

  const today = dayjs().format('YYYY-MM-DD')
  const upcoming = appointments.filter(
    (a) => a.status === 'scheduled' && a.date >= today
  )
  const past = appointments.filter(
    (a) => a.status !== 'scheduled' || a.date < today
  )

  return (
    <div
      className="bg-background"
      style={{ minHeight: 'var(--tg-viewport-stable-height, 100dvh)' }}
    >
      <div className="max-w-lg mx-auto px-4 pb-8 space-y-5">
      {/* Шапка */}
      <div style={{ paddingTop: tgTopPadding > 0 ? `${tgTopPadding + 8}px` : isTelegramMiniApp() ? '36px' : '12px' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="h-12 w-12 bg-primary/10 shrink-0">
              <AvatarFallback className="text-primary font-semibold text-lg">
                {userName ? userName.charAt(0).toUpperCase() : '?'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate">{userName || t('cabinet.myAppointments')}</h1>
              <p className="text-xs text-muted-foreground">{t('cabinet.personalCabinet')}</p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1">
            <button
              onClick={() => {
                const next = theme === 'dark' ? 'light' : 'dark'
                setTheme(next)
                setThemeState(next)
              }}
              className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      {/* Find master button */}
      {telegramId && (
        <button
          type="button"
          onClick={() => navigate(`/search?tg_id=${telegramId}`)}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          <Search className="h-4 w-4" />
          Найти мастера
        </button>
      )}

      {/* Loyalty section */}
      {loyaltySummary.filter(s => s.loyalty_enabled).map((s) => {
        const visits = s.done_visits ?? 0
        const balance = s.points_balance ?? 0
        const level = visits >= s.level_premium_visits ? 'premium'
          : visits >= s.level_vip_visits ? 'vip'
          : visits >= s.level_regular_visits ? 'regular' : 'new'
        const levelLabel = { new: `🆕 ${t('loyalty.level_new')}`, regular: `🥈 ${t('loyalty.level_regular')}`, vip: `🥇 ${t('loyalty.level_vip')}`, premium: `💎 ${t('loyalty.level_premium')}` }[level]
        const nextVisits = level === 'new' ? s.level_regular_visits
          : level === 'regular' ? s.level_vip_visits
          : level === 'vip' ? s.level_premium_visits : null
        const progressPct = nextVisits ? Math.min(100, Math.round((visits / nextVisits) * 100)) : 100

        return (
          <Card key={s.master_id} className="overflow-hidden">
            <div className="px-6 py-5 space-y-3">
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">{t('loyalty.myLoyalty')}</span>
                {s.master_profession && (
                  <span className="text-xs text-muted-foreground ml-auto">{s.master_profession}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-primary/8 p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{balance}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('loyalty.pts')}</p>
                </div>
                <div className="rounded-xl bg-muted p-3 text-center">
                  <p className="text-lg font-bold">{levelLabel}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{visits} {t('loyalty.visitsCount')}</p>
                </div>
              </div>

              {nextVisits && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t('loyalty.toNextLevel')}</span>
                    <span>{visits}/{nextVisits}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
              )}

              {s.referral_enabled && s.client_id && s.master_slug && (
                <div className="rounded-xl border border-dashed p-3 space-y-2">
                  <p className="text-xs font-medium">{t('loyalty.referralTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('loyalty.referralClientDesc', { bonus: s.referrer_bonus })}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => handleCopyReferral(s.client_id, s.master_slug)}
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? t('loyalty.copied') : t('loyalty.copyLink')}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )
      })}

      {/* Нет записей */}
      {appointments.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="font-semibold">{t('cabinet.noAppointments')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('cabinet.noAppointmentsDesc')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Предстоящие */}
      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t('cabinet.upcoming')}
          </h2>
          <div className="space-y-2">
            {upcoming.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appt={appt}
                onCancel={appt.cancel_token ? () => handleCancel(appt.cancel_token!) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* История */}
      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t('cabinet.history')}
          </h2>
          <div className="space-y-2">
            {past.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appt={appt}
                onBookAgain={appt.bookingSlug ? () => navigate(`/book/${appt.bookingSlug}`) : undefined}
              />
            ))}
          </div>
        </section>
      )}
      </div>
    </div>
  )
}

// ── Карточка записи ──────────────────────────────────────────────────────────

interface AppointmentCardProps {
  appt: AppointmentWithMaster
  onCancel?: () => void
  onBookAgain?: () => void
}

function AppointmentCard({ appt, onCancel, onBookAgain }: AppointmentCardProps) {
  const { t } = useTranslation()
  const cfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.scheduled
  const StatusIcon = cfg.icon

  const dateFormatted = dayjs(appt.date).format('D MMMM, dddd')
  const isUpcoming = appt.status === 'scheduled' && appt.date >= dayjs().format('YYYY-MM-DD')

  // Извлечь названия услуг из notes-префикса или expand
  const serviceNames = (() => {
    const notes = appt.notes || ''
    const match = notes.match(/^\[([^\]]+)\]/)
    if (match) return match[1]
    return appt.serviceName || '-'
  })()

  return (
    <Card className={isUpcoming ? 'border-primary/30' : ''}>
      <div className="px-6 py-5 space-y-3">
        {/* Статус + дата */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <StatusIcon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
            <span className="text-sm font-medium">{dateFormatted}</span>
          </div>
          <Badge variant={cfg.variant} className="text-xs shrink-0">
            {t(`cabinet.status.${appt.status}`, cfg.label)}
          </Badge>
        </div>

        {/* Время + услуга */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span>
              {appt.start_time}
              {appt.end_time ? ` — ${appt.end_time}` : ''}
            </span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <Zap className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <span className="leading-snug">{serviceNames}</span>
          </div>
          {appt.masterName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              <span>{appt.masterName}</span>
            </div>
          )}
        </div>

        {/* Цена */}
        {(appt.price ?? 0) > 0 && (
          <p className="text-sm font-medium">{appt.price} ₽</p>
        )}

        {/* Кнопки действий */}
        {(onCancel || onBookAgain) && (
          <div className="flex gap-2">
            {onBookAgain && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={onBookAgain}
              >
                🔁 {t('cabinet.bookAgain')}
              </Button>
            )}
            {onCancel && (
              <Button
                variant="outline"
                size="sm"
                className={onBookAgain ? 'flex-1' : 'w-full'}
                onClick={onCancel}
                style={{ color: 'var(--destructive)', borderColor: 'color-mix(in srgb, var(--destructive) 30%, transparent)' }}
              >
                {t('cabinet.cancelAppt')}
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
