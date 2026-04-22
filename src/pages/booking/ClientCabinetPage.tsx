import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import {
  Calendar, Clock, CheckCircle, XCircle, AlertCircle, CalendarClock,
  Zap, Gift, Copy, Check, Sun, Moon, User, Package, Wrench,
  RotateCw, X, ExternalLink,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  isTelegramMiniApp,
  getTelegramUserId,
  getTelegramDisplayName,
  getTelegramStartParam,
} from '@/lib/telegramWebApp'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TelegramSplash } from '@/components/shared/TelegramSplash'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { getStoredTheme, setTheme } from '@/stores/themeStore'

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
    script.setAttribute('data-telegram-login', import.meta.env.VITE_CLIENT_BOT || 'ezzeprogo_bot')
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
type OrderKind = 'appointment' | 'cleaning' | 'workshop'

interface CabinetOrder {
  kind:            OrderKind
  id:              string
  status:          string
  date:            string | null          // appointment: 'YYYY-MM-DD'
  time_text:       string | null          // appointment: 'HH:mm'
  total:           number | null
  notes:           string | null
  cancel_token:    string | null
  number:          string | null          // cleaning/workshop: 'КВ-0001' / 'РМ-0001'
  booking_slug:    string | null
  master_name:     string | null
  master_avatar:   string | null
  title:           string
  approval_token:  string | null
  public_token:    string | null
  ready_date:      string | null
  created_at:      string
}

// ── Статусы для appointments ─────────────────────────────────────────────────
const APPT_STATUS = {
  scheduled: { icon: Clock,        color: 'text-blue-500',        variant: 'default'     as const },
  done:      { icon: CheckCircle,  color: 'text-emerald-500',     variant: 'secondary'   as const },
  cancelled: { icon: XCircle,      color: 'text-muted-foreground', variant: 'outline'    as const },
  no_show:   { icon: AlertCircle,  color: 'text-destructive',     variant: 'destructive' as const },
} as const

// ── Статусы для cleaning_orders ──────────────────────────────────────────────
const CLEANING_STATUS = {
  received:    { icon: Package,      color: 'text-blue-500',     variant: 'default'   as const },
  in_progress: { icon: RotateCw,     color: 'text-amber-500',    variant: 'default'   as const },
  ready:       { icon: CheckCircle,  color: 'text-emerald-500',  variant: 'default'   as const },
  issued:      { icon: CheckCircle,  color: 'text-emerald-500',  variant: 'secondary' as const },
  paid:        { icon: CheckCircle,  color: 'text-emerald-500',  variant: 'secondary' as const },
  cancelled:   { icon: XCircle,      color: 'text-muted-foreground', variant: 'outline' as const },
} as const

// ── Статусы для workshop_orders ──────────────────────────────────────────────
const WORKSHOP_STATUS = {
  received:         { icon: Package,     color: 'text-blue-500',    variant: 'default'     as const },
  diagnosing:       { icon: RotateCw,    color: 'text-amber-500',   variant: 'default'     as const },
  waiting_approval: { icon: AlertCircle, color: 'text-orange-500',  variant: 'destructive' as const },
  waiting_parts:    { icon: Clock,       color: 'text-amber-500',   variant: 'default'     as const },
  in_progress:      { icon: Wrench,      color: 'text-amber-500',   variant: 'default'     as const },
  ready:            { icon: CheckCircle, color: 'text-emerald-500', variant: 'default'     as const },
  issued:           { icon: CheckCircle, color: 'text-emerald-500', variant: 'secondary'   as const },
  paid:             { icon: CheckCircle, color: 'text-emerald-500', variant: 'secondary'   as const },
  refused:          { icon: XCircle,     color: 'text-muted-foreground', variant: 'outline' as const },
  cancelled:        { icon: XCircle,     color: 'text-muted-foreground', variant: 'outline' as const },
} as const

function statusCfg(kind: OrderKind, status: string) {
  if (kind === 'appointment') return (APPT_STATUS     as any)[status] ?? APPT_STATUS.scheduled
  if (kind === 'cleaning')    return (CLEANING_STATUS as any)[status] ?? CLEANING_STATUS.received
  return (WORKSHOP_STATUS as any)[status] ?? WORKSHOP_STATUS.received
}

const ACTIVE_APPT      = new Set(['scheduled'])
const ACTIVE_CLEANING  = new Set(['received', 'in_progress', 'ready'])
const ACTIVE_WORKSHOP  = new Set(['received', 'diagnosing', 'waiting_approval', 'waiting_parts', 'in_progress', 'ready'])

function isActive(o: CabinetOrder): boolean {
  if (o.kind === 'appointment') {
    return ACTIVE_APPT.has(o.status) && (!o.date || o.date >= dayjs().format('YYYY-MM-DD'))
  }
  if (o.kind === 'cleaning') return ACTIVE_CLEANING.has(o.status)
  return ACTIVE_WORKSHOP.has(o.status)
}

// ═════════════════════════════════════════════════════════════════════════════
export function ClientCabinetPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [orders, setOrders]             = useState<CabinetOrder[]>([])
  const [loading, setLoading]           = useState(true)
  const [telegramId, setTelegramId]     = useState<string | null>(null)
  const [userName, setUserName]         = useState('')
  const [tgProfileName, setTgProfileName] = useState('')
  const [telegramPhone, setTelegramPhone] = useState('')
  const [tgTopPadding, setTgTopPadding] = useState(0)
  const [loyaltySummary, setLoyaltySummary] = useState<any[]>([])
  const [copied, setCopied]             = useState(false)
  const [isNotRegistered, setIsNotRegistered] = useState(false)
  const [theme, setThemeState]          = useState<'light' | 'dark'>(() => {
    const s = getStoredTheme()
    return s === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : s
  })

  // ── Инициализация ───────────────────────────────────────────────────────────
  useEffect(() => {
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
    const tgId      = getTelegramUserId() || params.get('tg_id')
    const tgWebName = getTelegramDisplayName() || ''
    const urlName   = params.get('tg_name') || ''
    const tgPhone   = params.get('tg_phone') || ''
    const deleted   = params.get('deleted') === '1'
    setTelegramId(tgId)
    setUserName(urlName || tgWebName)
    setTgProfileName(tgWebName)
    setTelegramPhone(tgPhone)
    if (deleted) {
      setIsNotRegistered(true)
      setLoading(false)
      return
    }
    if (tgId) {
      loadData(tgId)
    } else {
      setLoading(false)
    }
  }, [])

  // ── Загрузка данных ─────────────────────────────────────────────────────────
  const loadData = async (tgId: string) => {
    try {
      type TgClientRow = { phone: string | null; name: string | null; tg_name: string | null; lang: string | null }
      const { data: tgClient } = await supabase
        .rpc('get_tg_client_safe', { p_tg_chat_id: tgId })
        .maybeSingle() as { data: TgClientRow | null; error: unknown }

      if (!tgClient && isTelegramMiniApp()) {
        navigate('/client-register')
        return
      }

      if (tgClient?.phone) setTelegramPhone(tgClient.phone)
      if (tgClient?.name)    setUserName(tgClient.name)
      if (tgClient?.tg_name) setTgProfileName(prev => prev || tgClient!.tg_name!)

      const { data: ordersData } = await supabase
        .rpc('get_client_cabinet_orders', { p_tg_chat_id: tgId })
      setOrders((ordersData as CabinetOrder[] | null) ?? [])

      const { data: loyaltyData } = await supabase
        .rpc('get_client_loyalty_summary', { p_telegram_id: tgId })
      setLoyaltySummary(loyaltyData || [])
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Хелперы ─────────────────────────────────────────────────────────────────
  const handleWidgetAuth = (user: Record<string, unknown>) => {
    const tgId = String(user.id ?? '')
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || String(user.username ?? '')
    if (!tgId) return
    setTelegramId(tgId)
    setUserName(name)
    setTgProfileName(name)
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

  // ── Разделение списка ───────────────────────────────────────────────────────
  const { active, history } = useMemo(() => {
    const a: CabinetOrder[] = []
    const h: CabinetOrder[] = []
    for (const o of orders) (isActive(o) ? a : h).push(o)
    return { active: a, history: h }
  }, [orders])

  // ── Экран без авторизации ───────────────────────────────────────────────────
  if (!loading && !telegramId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center gap-6">
        <div className="space-y-2">
          <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto">
            <svg viewBox="0 0 24 24" className="h-9 w-9 text-blue-500 fill-current">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-2.02 9.52c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.883.701z"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold">{t('cabinet.myOrders')}</h1>
          <p className="text-muted-foreground text-sm">{t('cabinet.loginDesc')}</p>
        </div>
        <TelegramLoginWidget onAuth={handleWidgetAuth} />
      </div>
    )
  }

  if (loading) return <TelegramSplash />

  // ── Экран удалённого / незарегистрированного клиента ────────────────────────
  if (isNotRegistered && telegramId) {
    const openBot = () => {
      const tg = (window as any).Telegram?.WebApp
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(`https://t.me/${import.meta.env.VITE_CLIENT_BOT || 'ezzeprogo_bot'}`)
      } else {
        window.open(`https://t.me/${import.meta.env.VITE_CLIENT_BOT || 'ezzeprogo_bot'}`, '_blank')
      }
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center gap-5">
        <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
          <User className="h-8 w-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">{t('cabinet.notClientTitle')}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{t('cabinet.notClientDesc')}</p>
        </div>
        <Button onClick={openBot} className="gap-2 px-6">
          {t('cabinet.registerAgain')}
        </Button>
      </div>
    )
  }

  const topPad = tgTopPadding > 0 ? `${tgTopPadding + 8}px` : isTelegramMiniApp() ? '36px' : '12px'

  // ── Рендер ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-background" style={{ minHeight: 'var(--tg-viewport-stable-height, 100dvh)' }}>
      <div className="max-w-lg mx-auto px-4 space-y-4" style={{ paddingTop: topPad, paddingBottom: '32px' }}>

        {/* Шапка */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="h-11 w-11 bg-primary/10 shrink-0">
              <AvatarFallback className="text-primary font-semibold">
                {userName ? userName.charAt(0).toUpperCase() : '?'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="text-base font-bold truncate">{userName || tgProfileName || t('cabinet.myOrders')}</h1>
              {tgProfileName && tgProfileName.toLowerCase() !== userName.toLowerCase() && (
                <p className="text-xs text-muted-foreground/70 truncate leading-tight">{tgProfileName}</p>
              )}
              <p className="text-xs text-muted-foreground">{t('cabinet.personalCabinet')}</p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <LanguageSwitcher />
          </div>
        </div>

        {/* Программа лояльности (если есть) */}
        {loyaltySummary.filter(s => s.loyalty_enabled).map(s => (
          <LoyaltyCard key={s.master_id} s={s} copied={copied} onCopyReferral={handleCopyReferral} t={t} />
        ))}

        {/* Пустой список */}
        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h2 className="font-semibold">{t('cabinet.noOrders')}</h2>
                <p className="text-sm text-muted-foreground mt-1">{t('cabinet.noOrdersDesc')}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {active.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('cabinet.active')}
                </h2>
                {active.map(o => (
                  <OrderCard
                    key={`${o.kind}-${o.id}`}
                    order={o}
                    onBookAgain={o.booking_slug ? () => openBooking(o.booking_slug!) : undefined}
                    onCancel={o.cancel_token ? () => navigate(`/cancel/${o.cancel_token}`) : undefined}
                    onTrack={o.number ? () => navigate(`/track/${o.number}`) : undefined}
                    onApprove={o.approval_token ? () => navigate(`/approve/${o.approval_token}`) : undefined}
                  />
                ))}
              </section>
            )}
            {history.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('cabinet.history')}
                </h2>
                {history.map(o => (
                  <OrderCard
                    key={`${o.kind}-${o.id}`}
                    order={o}
                    onBookAgain={o.booking_slug ? () => openBooking(o.booking_slug!) : undefined}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Карточка заказа ───────────────────────────────────────────────────────────
interface OrderCardProps {
  order:         CabinetOrder
  onBookAgain?:  () => void
  onCancel?:     () => void
  onTrack?:      () => void
  onApprove?:    () => void
}

function OrderCard({ order, onBookAgain, onCancel, onTrack, onApprove }: OrderCardProps) {
  const { t } = useTranslation()
  const cfg = statusCfg(order.kind, order.status)
  const StatusIcon = cfg.icon
  const active = isActive(order)

  // Заголовок карточки (дата или номер квитанции)
  const primary = order.kind === 'appointment' && order.date
    ? dayjs(order.date).format('D MMMM, dddd')
    : order.number ?? ''

  // Вторичная строка: время для appointment / дата готовности для cleaning/workshop
  const secondary = order.kind === 'appointment'
    ? order.time_text
    : order.ready_date ? t('cabinet.readyBy', { date: dayjs(order.ready_date).format('D MMM') }) : null

  // Название услуги/изделия — для appointment парсим notes
  const title = order.kind === 'appointment'
    ? (() => {
        const match = (order.notes || '').match(/^\[([^\]]+)\]/)
        return match ? match[1] : (order.title || '—')
      })()
    : (order.title || '—')

  const kindLabel = t(`cabinet.kind.${order.kind}`)
  const statusLabel = t(`cabinet.status.${order.kind}.${order.status}`, order.status)

  return (
    <Card className={active ? 'border-primary/30' : ''}>
      <div className="px-4 py-4 space-y-3">
        {/* Верх: тип + статус */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <StatusIcon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
            <span className="text-sm font-medium truncate">{primary || kindLabel}</span>
          </div>
          <Badge variant={cfg.variant} className="text-xs shrink-0">
            {statusLabel}
          </Badge>
        </div>

        {/* Детали */}
        <div className="space-y-1">
          {secondary && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{secondary}</span>
            </div>
          )}
          <div className="flex items-start gap-2 text-sm">
            <Zap className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
            <span className="leading-snug">{title}</span>
          </div>
          {order.master_name && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span>{order.master_name}</span>
            </div>
          )}
        </div>

        {/* Цена */}
        {(order.total ?? 0) > 0 && (
          <p className="text-sm font-semibold">{Number(order.total).toLocaleString()} ₽</p>
        )}

        {/* Кнопки действий */}
        {(onApprove || onTrack || onCancel || onBookAgain) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {onApprove && order.status === 'waiting_approval' && (
              <Button size="sm" className="flex-1 gap-1.5" onClick={onApprove}>
                <AlertCircle className="h-3.5 w-3.5" />
                {t('cabinet.approveEstimate')}
              </Button>
            )}
            {onTrack && (
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onTrack}>
                <ExternalLink className="h-3.5 w-3.5" />
                {t('cabinet.trackOrder')}
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
                {t('cabinet.cancelOrder')}
              </Button>
            )}
            {onBookAgain && !active && (
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onBookAgain}>
                <CalendarClock className="h-3.5 w-3.5" />
                {t('cabinet.bookAgain')}
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Карточка лояльности ───────────────────────────────────────────────────────
function LoyaltyCard({ s, copied, onCopyReferral, t }: { s: any; copied: boolean; onCopyReferral: (id: string, slug: string) => void; t: any }) {
  const visits = s.done_visits ?? 0
  const balance = s.points_balance ?? 0
  const level = visits >= s.level_premium_visits ? 'premium'
    : visits >= s.level_vip_visits ? 'vip'
    : visits >= s.level_regular_visits ? 'regular' : 'new'
  const levelLabel = {
    new:     t('loyalty.level_new'),
    regular: t('loyalty.level_regular'),
    vip:     t('loyalty.level_vip'),
    premium: t('loyalty.level_premium'),
  }[level]
  const nextVisits = level === 'new' ? s.level_regular_visits
    : level === 'regular' ? s.level_vip_visits
    : level === 'vip' ? s.level_premium_visits : null
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
