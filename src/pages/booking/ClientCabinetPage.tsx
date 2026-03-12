import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  isTelegramMiniApp,
  getTelegramUserId,
  getTelegramDisplayName,
  initMiniApp,
} from '@/lib/telegramWebApp'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
    script.setAttribute('data-telegram-login', 'ezzeapp_bot')
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
  const [appointments, setAppointments] = useState<AppointmentWithMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [telegramId, setTelegramId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    if (isTelegramMiniApp()) {
      initMiniApp()
    }

    const tgId = getTelegramUserId()
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

      const enriched: AppointmentWithMaster[] = await Promise.all(
        (records ?? []).map(async (appt: any) => {
          let masterName = ''
          const serviceName = appt.service?.name || ''

          try {
            const { data: profile } = await supabase
              .from('master_profiles')
              .select('profession')
              .eq('user_id', appt.master_id)
              .maybeSingle()
            masterName = profile?.profession || ''
          } catch {}

          return { ...appt, masterName, serviceName } as AppointmentWithMaster
        })
      )

      setAppointments(enriched)
    } catch (err) {
      console.error('Failed to load appointments:', err)
    } finally {
      setLoading(false)
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
          <h1 className="text-xl font-bold">Мои записи</h1>
          <p className="text-muted-foreground text-sm">
            Войдите через Telegram, чтобы увидеть ваши записи к мастеру
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
    <div className="max-w-lg mx-auto p-4 space-y-6">
      {/* Шапка */}
      <div className="pt-2">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 bg-primary/10">
            <AvatarFallback className="text-primary font-semibold text-lg">
              {userName ? userName.charAt(0).toUpperCase() : '?'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-lg font-bold">{userName || 'Мои записи'}</h1>
            <p className="text-xs text-muted-foreground">Личный кабинет</p>
          </div>
        </div>
      </div>

      {/* Нет записей */}
      {appointments.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="font-semibold">Нет записей</h2>
            <p className="text-sm text-muted-foreground">
              Запишитесь к мастеру по его ссылке
            </p>
          </CardContent>
        </Card>
      )}

      {/* Предстоящие */}
      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Предстоящие
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
            История
          </h2>
          <div className="space-y-2">
            {past.map((appt) => (
              <AppointmentCard key={appt.id} appt={appt} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Карточка записи ──────────────────────────────────────────────────────────

interface AppointmentCardProps {
  appt: AppointmentWithMaster
  onCancel?: () => void
}

function AppointmentCard({ appt, onCancel }: AppointmentCardProps) {
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
      <CardContent className="p-4 space-y-3">
        {/* Статус + дата */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <StatusIcon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
            <span className="text-sm font-medium">{dateFormatted}</span>
          </div>
          <Badge variant={cfg.variant} className="text-xs shrink-0">
            {cfg.label}
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
        {appt.price && appt.price > 0 && (
          <p className="text-sm font-medium">{appt.price} ₽</p>
        )}

        {/* Кнопка отмены */}
        {onCancel && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
            onClick={onCancel}
          >
            Отменить запись
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
