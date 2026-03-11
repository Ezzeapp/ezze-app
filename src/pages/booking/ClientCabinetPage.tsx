import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight, Zap, Smartphone } from 'lucide-react'
import pb from '@/lib/pocketbase'
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
      setLoading(false)
    }
  }, [])

  const loadAppointments = async (tgId: string) => {
    try {
      const records = await pb.collection('appointments').getFullList<Appointment>({
        filter: `telegram_id = "${tgId}"`,
        sort: '-date,-start_time',
        expand: 'service,master',
        // Передаём tgid как query-параметр для PocketBase rule
        query: { tgid: tgId },
      } as any)

      // Обогащаем данными о мастере и услуге
      const enriched: AppointmentWithMaster[] = await Promise.all(
        records.map(async (appt) => {
          let masterName = ''
          let serviceName = (appt.expand as any)?.service?.name || ''

          // Получаем имя мастера через профиль
          try {
            const profile = await pb.collection('master_profiles').getFirstListItem(
              `user = "${appt.master}"`,
              { query: { tgid: tgId } } as any
            )
            masterName = (profile as any).profession || ''
            // Пробуем получить имя пользователя
          } catch {}

          return { ...appt, masterName, serviceName }
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

  // Нет Telegram — заглушка (только в продакшене)
  if (!loading && !telegramId && !import.meta.env.DEV) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center gap-4">
        <Smartphone className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-xl font-bold">Откройте через Telegram</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Личный кабинет доступен только в Telegram Mini App.
          <br />
          Перейдите по ссылке от вашего мастера.
        </p>
        <a
          href="https://t.me/ezzeapp_bot"
          className="text-sm text-primary underline underline-offset-2"
        >
          Открыть @ezzeapp_bot
        </a>
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
