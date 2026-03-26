import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Calendar, Clock, CheckCircle, XCircle, AlertCircle, CalendarClock,
  Zap, Gift, Copy, Check, Sun, Moon, Search, User, Users,
  ChevronRight, X, QrCode,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getFileUrl, cn } from '@/lib/utils'
import {
  isTelegramMiniApp,
  getTelegramUserId,
  getTelegramDisplayName,
  getTelegramStartParam,
} from '@/lib/telegramWebApp'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { toast } from '@/components/shared/Toaster'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { getStoredTheme, setTheme } from '@/stores/themeStore'
import type { Appointment } from '@/types'

// ── Telegram Login Widget ─────────────────────────────────────────────────────
function TelegramLoginWidget({ onAuth }: { onAuth: (user: Record<string, unknown>) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onAuthRef = useRef(onAuth)
  useEffect(() => { onAuthRef.current = onAuth }, [onAuth])
  useEffect(() => {
    if (!containerRef.current) return
    ;(window as any).onTelegramAuth = (user: Record<string, unknown>) => { onAuthRef.current(user) }
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

// ── Типы ─────────────────────────────────────────────────────────────────────
interface AppointmentWithMaster extends Appointment {
  masterName?: string
  serviceName?: string
  bookingSlug?: string
  masterUserId?: string
}

interface MasterResult {
  booking_slug: string
  profession: string | null
  avatar: string | null
  phone: string | null
  user: { name: string } | null
}

interface TeamResult {
  id: string
  name: string
  slug: string
  description: string | null
  logo: string | null
}

type Tab = 'appointments' | 'search' | 'profile'

// ── Mock данные (dev) ─────────────────────────────────────────────────────────
const DEV_MOCK: AppointmentWithMaster[] = [
  { id: 'mock1', collectionId: '', collectionName: 'appointments', created: '', updated: '', master: 'mock', client: '', service: '', date: dayjs().add(2, 'day').format('YYYY-MM-DD'), start_time: '14:00', end_time: '15:00', status: 'scheduled', price: 2500, notes: '[Стрижка + укладка]', cancel_token: 'mock-token', masterName: 'Парикмахер', serviceName: 'Стрижка', bookingSlug: 'mock-master' },
  { id: 'mock2', collectionId: '', collectionName: 'appointments', created: '', updated: '', master: 'mock', client: '', service: '', date: dayjs().subtract(10, 'day').format('YYYY-MM-DD'), start_time: '11:00', end_time: '12:00', status: 'done', price: 1500, notes: '[Окрашивание]', cancel_token: '', masterName: 'Колорист', serviceName: 'Окрашивание', bookingSlug: 'mock-master-2' },
]

// ── Статусы ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  scheduled: { label: 'Запланировано', variant: 'default' as const, icon: Clock,        color: 'text-blue-500' },
  done:      { label: 'Выполнено',     variant: 'secondary' as const, icon: CheckCircle, color: 'text-emerald-500' },
  cancelled: { label: 'Отменено',      variant: 'outline' as const,   icon: XCircle,     color: 'text-muted-foreground' },
  no_show:   { label: 'Не явился',     variant: 'destructive' as const, icon: AlertCircle, color: 'text-destructive' },
}

// ═════════════════════════════════════════════════════════════════════════════
export function ClientCabinetPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [tab, setTab]                   = useState<Tab>('appointments')
  const [appointments, setAppointments] = useState<AppointmentWithMaster[]>([])
  const [loading, setLoading]           = useState(true)
  const [telegramId, setTelegramId]     = useState<string | null>(null)
  const [userName, setUserName]         = useState('')
  const [telegramPhone, setTelegramPhone] = useState('')
  const [tgTopPadding, setTgTopPadding] = useState(0)
  const [loyaltySummary, setLoyaltySummary] = useState<any[]>([])
  const [copied, setCopied]             = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')
  const [theme, setThemeState]          = useState<'light' | 'dark'>(() => {
    const s = getStoredTheme()
    return s === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : s
  })

  // ── Инициализация ───────────────────────────────────────────────────────────
  useEffect(() => {
    // Если запущено через Telegram с параметром team_{slug} — переходим на страницу команды
    const startParam = getTelegramStartParam()
    if (startParam && startParam.startsWith('team_')) {
      const teamSlug = startParam.replace(/^team_/, '')
      if (teamSlug) {
        navigate(`/book/team/${teamSlug}`)
        return
      }
    }

    if (isTelegramMiniApp()) {
      const tg = window.Telegram?.WebApp
      if (tg) {
        tg.ready(); tg.expand()
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
    const params = new URLSearchParams(window.location.search)
    const tgId    = getTelegramUserId() || params.get('tg_id')
    const tgName  = getTelegramDisplayName() || params.get('tg_name') || ''
    const tgPhone = params.get('tg_phone') || ''
    setTelegramId(tgId)
    setUserName(tgName)
    setTelegramPhone(tgPhone)
    if (tgId) {
      loadData(tgId)
    } else if (import.meta.env.DEV) {
      setUserName('Тест Пользователь')
      setAppointments(DEV_MOCK)
      setLoading(false)
    } else {
      setLoading(false)
    }
  }, [])

  // ── Загрузка данных ─────────────────────────────────────────────────────────
  const loadData = async (tgId: string) => {
    try {
      // Подгружаем телефон из tg_clients (бот сохраняет его туда при регистрации)
      const { data: tgClient } = await supabase
        .from('tg_clients')
        .select('phone, name')
        .eq('tg_chat_id', tgId)
        .maybeSingle()
      if (tgClient?.phone) setTelegramPhone(tgClient.phone)
      if (tgClient?.name) setUserName(tgClient.name) // зарегистрированное имя приоритетнее TG-профиля

      const { data: records } = await supabase
        .from('appointments')
        .select('*, service:services(name)')
        .eq('telegram_id', tgId)
        .order('date', { ascending: false })
        .order('start_time', { ascending: false })

      const masterIds = [...new Set((records ?? []).map((a: any) => a.master_id).filter(Boolean))]
      let profileMap = new Map<string, any>()
      if (masterIds.length > 0) {
        const { data: profiles } = await supabase
          .from('master_profiles')
          .select('user_id, profession, booking_slug, avatar')
          .in('user_id', masterIds)
        profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]))
      }

      const enriched: AppointmentWithMaster[] = (records ?? []).map((appt: any) => {
        const profile = profileMap.get(appt.master_id)
        return {
          ...appt,
          masterName:   profile?.profession || '',
          serviceName:  appt.service?.name || '',
          bookingSlug:  profile?.booking_slug || '',
          masterUserId: appt.master_id || '',
        }
      })
      setAppointments(enriched)

      const { data: loyaltyData } = await supabase
        .rpc('get_client_loyalty_summary', { p_telegram_id: tgId })
      setLoyaltySummary(loyaltyData || [])
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Поиск мастеров ──────────────────────────────────────────────────────────
  const { data: allMasters = [], isLoading: mastersLoading } = useQuery<MasterResult[]>({
    queryKey: ['master_search_cabinet'],
    queryFn: async () => {
      const { data } = await supabase
        .from('master_profiles')
        .select('booking_slug, profession, avatar, phone, user:users(name)')
        .not('booking_slug', 'is', null)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(200)
      return (data ?? []) as unknown as MasterResult[]
    },
    enabled: tab === 'search',
    staleTime: 2 * 60_000,
  })

  const { data: allTeams = [], isLoading: teamsLoading } = useQuery<TeamResult[]>({
    queryKey: ['public_teams_cabinet'],
    queryFn: async () => {
      const { data } = await supabase
        .from('teams')
        .select('id, name, slug, description, logo')
        .eq('is_public', true)
        .order('name')
      return (data ?? []) as TeamResult[]
    },
    enabled: tab === 'search',
    staleTime: 2 * 60_000,
  })

  const filteredTeams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return allTeams
    return allTeams.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.description ?? '').toLowerCase().includes(q)
    )
  }, [allTeams, searchQuery])

  // Мастера, к которым клиент ходил раньше (избранные)
  const visitedSlugs = useMemo(() => {
    const slugs = new Set<string>()
    appointments.filter(a => a.status === 'done' && a.bookingSlug).forEach(a => slugs.add(a.bookingSlug!))
    return slugs
  }, [appointments])

  const filteredMasters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const list = q
      ? allMasters.filter(m =>
          (m.user?.name ?? '').toLowerCase().includes(q) ||
          (m.profession ?? '').toLowerCase().includes(q) ||
          (m.phone ?? '').replace(/\D/g, '').includes(q.replace(/\D/g, ''))
        )
      : allMasters
    // Избранные сверху
    return [...list].sort((a, b) => {
      const aFav = visitedSlugs.has(a.booking_slug) ? 0 : 1
      const bFav = visitedSlugs.has(b.booking_slug) ? 0 : 1
      return aFav - bFav
    })
  }, [allMasters, searchQuery, visitedSlugs])

  // ── Хелперы ─────────────────────────────────────────────────────────────────
  const handleWidgetAuth = (user: Record<string, unknown>) => {
    const tgId = String(user.id ?? '')
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ')
    if (!tgId) return
    setTelegramId(tgId)
    setUserName(name)
    setLoading(true)
    loadData(tgId)
  }

  const handleCopyReferral = async (clientId: string, masterSlug: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/book/${masterSlug}?ref=${clientId}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next); setThemeState(next)
  }

  const openBooking = (slug: string) => {
    const params = new URLSearchParams()
    if (telegramId)    params.set('tg_id',    telegramId)
    if (userName)      params.set('tg_name',  userName)
    if (telegramPhone) params.set('tg_phone', telegramPhone)
    navigate(`/book/${slug}?${params.toString()}`)
  }

  const openTeam = (slug: string) => {
    const params = new URLSearchParams()
    if (telegramId)    params.set('tg_id',    telegramId)
    if (userName)      params.set('tg_name',  userName)
    if (telegramPhone) params.set('tg_phone', telegramPhone)
    navigate(`/book/team/${slug}?${params.toString()}`)
  }

  // ── QR-сканер (Telegram WebApp API) ─────────────────────────────────────────
  const handleScanQr = () => {
    const tg = (window as any).Telegram?.WebApp
    if (!tg?.showScanQrPopup) {
      toast.error('QR-сканер недоступен. Обновите Telegram до последней версии.')
      return
    }
    tg.showScanQrPopup({ text: 'Наведите камеру на QR-код мастера' }, (data: string) => {
      tg.closeScanQrPopup?.()
      try {
        const url = new URL(data)
        // Формат: https://ezze.site/book/my-salon
        const masterMatch = url.pathname.match(/\/book\/([^/]+)$/)
        if (masterMatch) { openBooking(masterMatch[1]); return true }
        // Формат: https://ezze.site/book/team/my-team
        const teamMatch = url.pathname.match(/\/book\/team\/([^/]+)$/)
        if (teamMatch) { openTeam(teamMatch[1]); return true }
      } catch {}
      toast.error('Не удалось распознать QR-код мастера')
      return true
    })
  }

  // ── Экран без авторизации ───────────────────────────────────────────────────
  if (!loading && !telegramId && !import.meta.env.DEV) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center gap-6">
        <div className="space-y-2">
          <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto">
            <svg viewBox="0 0 24 24" className="h-9 w-9 text-blue-500 fill-current">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-2.02 9.52c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.883.701z"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold">{t('cabinet.myAppointments')}</h1>
          <p className="text-muted-foreground text-sm">{t('cabinet.loginDesc')}</p>
        </div>
        <TelegramLoginWidget onAuth={handleWidgetAuth} />
      </div>
    )
  }

  if (loading) return <LoadingSpinner fullScreen />

  const today    = dayjs().format('YYYY-MM-DD')
  const upcoming = appointments.filter(a => a.status === 'scheduled' && a.date >= today)
  const past     = appointments.filter(a => a.status !== 'scheduled' || a.date < today)
  const topPad   = tgTopPadding > 0 ? `${tgTopPadding + 8}px` : isTelegramMiniApp() ? '36px' : '12px'

  // ── Рендер ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-background flex flex-col" style={{ height: 'var(--tg-viewport-stable-height, 100dvh)' }}>

      {/* ── Контент (прокручиваемый) ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 space-y-4" style={{ paddingTop: topPad, paddingBottom: '80px' }}>

          {/* Шапка */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar className="h-11 w-11 bg-primary/10 shrink-0">
                <AvatarFallback className="text-primary font-semibold">
                  {userName ? userName.charAt(0).toUpperCase() : '?'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="text-base font-bold truncate">{userName || t('cabinet.myAppointments')}</h1>
                <p className="text-xs text-muted-foreground">{t('cabinet.personalCabinet')}</p>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-1">
              <button onClick={toggleTheme} className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <LanguageSwitcher />
            </div>
          </div>

          {/* ── Вкладка: Записи ── */}
          {tab === 'appointments' && (
            <div className="space-y-4">
              {appointments.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center space-y-4">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto" />
                    <div>
                      <h2 className="font-semibold">{t('cabinet.noAppointments')}</h2>
                      <p className="text-sm text-muted-foreground mt-1">{t('cabinet.noAppointmentsDesc')}</p>
                    </div>
                    <Button onClick={() => setTab('search')} className="gap-2">
                      <Search className="h-4 w-4" />
                      Найти мастера
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {upcoming.length > 0 && (
                    <section className="space-y-2">
                      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {t('cabinet.upcoming')}
                      </h2>
                      {upcoming.map(appt => (
                        <AppointmentCard
                          key={appt.id}
                          appt={appt}
                          onCancel={appt.cancel_token ? () => navigate(`/cancel/${appt.cancel_token}`) : undefined}
                          onReschedule={appt.bookingSlug ? () => openBooking(appt.bookingSlug!) : undefined}
                        />
                      ))}
                    </section>
                  )}
                  {past.length > 0 && (
                    <section className="space-y-2">
                      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {t('cabinet.history')}
                      </h2>
                      {past.map(appt => (
                        <AppointmentCard
                          key={appt.id}
                          appt={appt}
                          onBookAgain={appt.bookingSlug ? () => openBooking(appt.bookingSlug!) : undefined}
                        />
                      ))}
                    </section>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Вкладка: Поиск мастеров ── */}
          {tab === 'search' && (
            <div className="space-y-3">
              {/* QR-сканер (только в Telegram Mini App) */}
              {isTelegramMiniApp() && (
                <button
                  type="button"
                  onClick={handleScanQr}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 active:bg-primary/15 transition-colors py-3 text-sm font-medium text-primary"
                >
                  <QrCode className="h-4 w-4" />
                  Сканировать QR-код мастера
                </button>
              )}

              {/* Поиск */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Имя или специальность..."
                  className="pl-9 pr-9"
                  autoFocus
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Избранные мастера */}
              {!searchQuery && visitedSlugs.size > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">⭐ Были раньше</p>
                  {filteredMasters.filter(m => visitedSlugs.has(m.booking_slug)).map(m => (
                    <MasterCard key={m.booking_slug} master={m} isFav onClick={() => openBooking(m.booking_slug)} />
                  ))}
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Все мастера</p>
                </div>
              )}

              {/* Список команд и мастеров */}
              {(mastersLoading || teamsLoading) ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <Skeleton className="h-11 w-11 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))
              ) : filteredTeams.length === 0 && filteredMasters.filter(m => searchQuery || !visitedSlugs.has(m.booking_slug)).length === 0 && !searchQuery ? (
                <p className="text-center text-sm text-muted-foreground py-8">Нет доступных мастеров</p>
              ) : (
                <>
                  {/* Команды */}
                  {filteredTeams.length > 0 && (
                    <>
                      {(filteredMasters.length > 0 || visitedSlugs.size > 0) && (
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Команды</p>
                      )}
                      {filteredTeams.map(team => (
                        <TeamCard key={team.id} team={team} onClick={() => openTeam(team.slug)} />
                      ))}
                    </>
                  )}

                  {/* Мастера */}
                  {filteredMasters.filter(m => searchQuery || !visitedSlugs.has(m.booking_slug)).length > 0 && (
                    <>
                      {filteredTeams.length > 0 && (
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Мастера</p>
                      )}
                      {filteredMasters
                        .filter(m => searchQuery || !visitedSlugs.has(m.booking_slug))
                        .map(m => (
                          <MasterCard key={m.booking_slug} master={m} onClick={() => openBooking(m.booking_slug)} />
                        ))}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Вкладка: Профиль ── */}
          {tab === 'profile' && (
            <div className="space-y-4">
              {/* Инфо */}
              <Card>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-14 w-14 bg-primary/10">
                      <AvatarFallback className="text-primary font-bold text-xl">
                        {userName ? userName.charAt(0).toUpperCase() : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{userName || '—'}</p>
                      {telegramId && <p className="text-xs text-muted-foreground">ID: {telegramId}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Настройки */}
              <Card>
                <CardContent className="pt-5 space-y-4">
                  <p className="text-sm font-semibold">Настройки</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Тема оформления</span>
                    <button
                      onClick={toggleTheme}
                      className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                    >
                      {theme === 'dark' ? <><Moon className="h-3.5 w-3.5" /> Тёмная</> : <><Sun className="h-3.5 w-3.5" /> Светлая</>}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Язык</span>
                    <LanguageSwitcher />
                  </div>
                </CardContent>
              </Card>

              {/* Программа лояльности */}
              {loyaltySummary.filter(s => s.loyalty_enabled).map(s => (
                <LoyaltyCard key={s.master_id} s={s} copied={copied} onCopyReferral={handleCopyReferral} t={t} />
              ))}

              {/* Статистика */}
              {appointments.length > 0 && (
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-sm font-semibold mb-3">Статистика</p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-xl bg-muted p-3">
                        <p className="text-xl font-bold">{appointments.filter(a => a.status === 'done').length}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Визитов</p>
                      </div>
                      <div className="rounded-xl bg-muted p-3">
                        <p className="text-xl font-bold">{upcoming.length}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Предстоит</p>
                      </div>
                      <div className="rounded-xl bg-muted p-3">
                        <p className="text-xl font-bold">{visitedSlugs.size}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Мастеров</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Нижние вкладки ── */}
      <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-lg mx-auto grid grid-cols-3" style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
          {([
            { id: 'appointments', icon: Calendar, label: 'Записи' },
            { id: 'search',       icon: Search,   label: 'Поиск' },
            { id: 'profile',      icon: User,     label: 'Профиль' },
          ] as const).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex flex-col items-center gap-1 py-3 px-2 text-xs font-medium transition-colors relative',
                tab === id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
              {/* Индикатор активной вкладки */}
              {tab === id && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
              {/* Бейдж на Записях */}
              {id === 'appointments' && upcoming.length > 0 && (
                <span className="absolute top-2 right-1/4 h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center px-1">
                  {upcoming.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Карточка записи ───────────────────────────────────────────────────────────
interface AppointmentCardProps {
  appt: AppointmentWithMaster
  onCancel?: () => void
  onReschedule?: () => void
  onBookAgain?: () => void
}

function AppointmentCard({ appt, onCancel, onReschedule, onBookAgain }: AppointmentCardProps) {
  const { t } = useTranslation()
  const cfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.scheduled
  const StatusIcon = cfg.icon
  const isUpcoming = appt.status === 'scheduled' && appt.date >= dayjs().format('YYYY-MM-DD')

  const serviceNames = (() => {
    const match = (appt.notes || '').match(/^\[([^\]]+)\]/)
    return match ? match[1] : (appt.serviceName || '—')
  })()

  return (
    <Card className={isUpcoming ? 'border-primary/30' : ''}>
      <div className="px-4 py-4 space-y-3">
        {/* Статус + дата */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <StatusIcon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
            <span className="text-sm font-medium">{dayjs(appt.date).format('D MMMM, dddd')}</span>
          </div>
          <Badge variant={cfg.variant} className="text-xs shrink-0">
            {t(`cabinet.status.${appt.status}`, cfg.label)}
          </Badge>
        </div>

        {/* Детали */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{appt.start_time}{appt.end_time ? ` — ${appt.end_time}` : ''}</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <Zap className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
            <span className="leading-snug">{serviceNames}</span>
          </div>
          {appt.masterName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span>{appt.masterName}</span>
            </div>
          )}
        </div>

        {/* Цена */}
        {(appt.price ?? 0) > 0 && (
          <p className="text-sm font-semibold">{appt.price?.toLocaleString()} ₽</p>
        )}

        {/* Кнопки */}
        {(onCancel || onReschedule || onBookAgain) && (
          <div className="flex gap-2 pt-1">
            {onBookAgain && (
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onBookAgain}>
                🔁 {t('cabinet.bookAgain')}
              </Button>
            )}
            {onReschedule && (
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onReschedule}>
                <CalendarClock className="h-3.5 w-3.5" />
                Перенести
              </Button>
            )}
            {onCancel && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={onCancel}
              >
                <X className="h-3.5 w-3.5" />
                {t('cabinet.cancelAppt')}
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Карточка мастера ──────────────────────────────────────────────────────────
function TeamCard({ team, onClick }: { team: TeamResult; onClick: () => void }) {
  const logoUrl = team.logo ? getFileUrl('teams', team.logo) : undefined
  const initials = team.name.slice(0, 2).toUpperCase()
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2.5 px-1 hover:bg-muted/50 active:bg-muted rounded-xl transition-colors text-left"
    >
      <div className="h-11 w-11 shrink-0 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
        {logoUrl
          ? <img src={logoUrl} alt={team.name} className="h-11 w-11 object-cover" />
          : <span className="text-sm font-semibold text-primary">{initials}</span>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-sm truncate">{team.name}</p>
          <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium text-primary/70 bg-primary/10 rounded-full px-1.5 py-0.5 leading-none">
            <Users className="h-2.5 w-2.5" />команда
          </span>
        </div>
        {team.description && <p className="text-xs text-muted-foreground truncate">{team.description}</p>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
    </button>
  )
}

function MasterCard({ master, isFav, onClick }: { master: MasterResult; isFav?: boolean; onClick: () => void }) {
  const name      = master.user?.name ?? 'Мастер'
  const avatarUrl = master.avatar ? getFileUrl('master_profiles', master.avatar) : undefined
  const initials  = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2.5 px-1 hover:bg-muted/50 active:bg-muted rounded-xl transition-colors text-left"
    >
      <Avatar className="h-11 w-11 shrink-0">
        <AvatarImage src={avatarUrl} />
        <AvatarFallback className="text-sm font-medium bg-primary/10 text-primary">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {isFav && '⭐ '}{name}
        </p>
        {master.profession && <p className="text-xs text-muted-foreground truncate">{master.profession}</p>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
    </button>
  )
}

// ── Карточка лояльности ───────────────────────────────────────────────────────
function LoyaltyCard({ s, copied, onCopyReferral, t }: { s: any; copied: boolean; onCopyReferral: (id: string, slug: string) => void; t: any }) {
  const visits = s.done_visits ?? 0
  const balance = s.points_balance ?? 0
  const level = visits >= s.level_premium_visits ? 'premium'
    : visits >= s.level_vip_visits ? 'vip'
    : visits >= s.level_regular_visits ? 'regular' : 'new'
  const levelLabel = { new: `🆕 ${t('loyalty.level_new')}`, regular: `🥈 ${t('loyalty.level_regular')}`, vip: `🥇 ${t('loyalty.level_vip')}`, premium: `💎 ${t('loyalty.level_premium')}` }[level]
  const nextVisits = level === 'new' ? s.level_regular_visits : level === 'regular' ? s.level_vip_visits : level === 'vip' ? s.level_premium_visits : null
  const progressPct = nextVisits ? Math.min(100, Math.round((visits / nextVisits) * 100)) : 100

  return (
    <Card>
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">{t('loyalty.myLoyalty')}</span>
          {s.master_profession && <span className="text-xs text-muted-foreground ml-auto">{s.master_profession}</span>}
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
            <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => onCopyReferral(s.client_id, s.master_slug)}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t('loyalty.copied') : t('loyalty.copyLink')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
