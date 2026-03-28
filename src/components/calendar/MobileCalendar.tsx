import { useRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Clock, UserCircle, CalendarDays, CalendarRange, CalendarPlus, Ban, QrCode } from 'lucide-react'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDuration } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { getAppointmentServiceNames, cleanAppointmentNotes } from '@/hooks/useAppointments'
import type { Appointment, Schedule, Service } from '@/types'

const DOW_MAP: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' }

dayjs.extend(isoWeek)

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800',
  done:       'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800',
  cancelled:  'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800',
  no_show:    'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800',
}

const STATUS_DOT: Record<string, string> = {
  scheduled: 'bg-blue-500',
  done:       'bg-emerald-500',
  cancelled:  'bg-red-500',
  no_show:    'bg-amber-500',
}

const STATUS_TEXT: Record<string, string> = {
  scheduled: 'text-blue-700 dark:text-blue-300',
  done:       'text-emerald-700 dark:text-emerald-300',
  cancelled:  'text-red-700 dark:text-red-300',
  no_show:    'text-amber-700 dark:text-amber-300',
}

export type MobileViewMode = 'day' | 'week'

interface MobileCalendarProps {
  currentDate: dayjs.Dayjs
  appointments: Appointment[] | undefined
  schedule: Schedule | null
  services?: Service[]
  onDateChange: (date: dayjs.Dayjs) => void
  onOpenCreate: (date: string, time?: string) => void
  onOpenEdit: (appt: Appointment) => void
  onBlockTime?: (date: string) => void
  onShowQR?: () => void
  mobileView?: MobileViewMode
  onMobileViewChange?: (v: MobileViewMode) => void
  limitReached?: boolean
}

export function MobileCalendar({
  currentDate,
  appointments,
  schedule,
  services = [],
  onDateChange,
  onOpenCreate,
  onOpenEdit,
  onBlockTime,
  onShowQR,
  mobileView = 'day',
  onMobileViewChange,
  limitReached = false,
}: MobileCalendarProps) {
  const { t, i18n } = useTranslation()
  const currency = useCurrency()
  const today = dayjs().format('YYYY-MM-DD')
  const selectedDate = currentDate.format('YYYY-MM-DD')
  const stripRef = useRef<HTMLDivElement>(null)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  const [fabOpen, setFabOpen] = useState(false)

  const closeFab = () => setFabOpen(false)
  const handleNewAppt = () => { closeFab(); onOpenCreate(selectedDate) }
  const handleBlock   = () => { closeFab(); onBlockTime?.(selectedDate) }
  const handleQR      = () => { closeFab(); onShowQR?.() }

  const toggleDay = (fmt: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(fmt)) next.delete(fmt)
      else next.add(fmt)
      return next
    })
  }

  // Неделя: всегда Пн–Вс текущей недели
  const weekStart = currentDate.startOf('isoWeek')
  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'))

  const goToPrev = () => onDateChange(
    mobileView === 'day' ? currentDate.subtract(1, 'day') : currentDate.subtract(1, 'week')
  )
  const goToNext = () => onDateChange(
    mobileView === 'day' ? currentDate.add(1, 'day') : currentDate.add(1, 'week')
  )
  const goToToday = () => onDateChange(dayjs())

  const isDayOff = (day: dayjs.Dayjs): boolean => {
    if (!schedule) return false
    const key = DOW_MAP[day.day()]
    return !(schedule[`${key}_enabled` as keyof Schedule] as boolean)
  }

  // При переключении вида — сбрасываем раскрытые карточки
  useEffect(() => {
    setExpandedDays(new Set())
  }, [mobileView])

  // При смене недели (через стрелки) — если выбранная дата не в текущей неделе,
  // переключаем на пн этой недели (или сегодня если он попадает в неделю)
  useEffect(() => {
    if (mobileView !== 'day') {
      const weekEnd = weekStart.add(6, 'day')
      const sel = dayjs(selectedDate)
      const inWeek = !sel.isBefore(weekStart, 'day') && !sel.isAfter(weekEnd, 'day')
      if (!inWeek) {
        const todayDjs = dayjs()
        const todayInWeek = !todayDjs.isBefore(weekStart, 'day') && !todayDjs.isAfter(weekEnd, 'day')
        onDateChange(todayInWeek ? todayDjs : weekStart)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.format('YYYY-MM-DD'), mobileView])

  // Записи на выбранный день
  const dayAppts = (appointments ?? [])
    .filter((a) => dayjs(a.date).format('YYYY-MM-DD') === selectedDate)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  // Точки на датах (есть ли записи)
  const apptDates = new Set((appointments ?? []).map((a) => dayjs(a.date).format('YYYY-MM-DD')))

  // Количество записей по датам (для week view)
  const apptCountByDate = (appointments ?? []).reduce<Record<string, number>>((acc, a) => {
    const d = dayjs(a.date).format('YYYY-MM-DD')
    acc[d] = (acc[d] || 0) + 1
    return acc
  }, {})

  const isCurrentWeek = days.some(d => d.format('YYYY-MM-DD') === today)

  // Заголовок шапки — всегда диапазон недели
  const weekEnd = weekStart.add(6, 'day')
  const headerTitle = weekStart.month() === weekEnd.month()
    ? `${weekStart.format('D')}–${weekEnd.format('D MMM YYYY')}`
    : `${weekStart.format('D MMM')} – ${weekEnd.format('D MMM YYYY')}`

  return (
    <div className="flex flex-col h-full">

      {/* ── Sticky-шапка: навигация + полоска дней + строка дня ── */}
      <div className="sticky top-0 z-10 bg-background">

      {/* Шапка: стрелки + заголовок + кнопки справа */}
      <div className="flex items-center px-3 py-3 gap-1">
        <button
          onClick={goToPrev}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Заголовок по центру */}
        <p className="flex-1 text-center text-base font-semibold truncate px-1">
          {headerTitle}
        </p>

        <button
          onClick={goToNext}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground shrink-0"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Переключатель вида Day / Week */}
        <button
          onClick={() => onMobileViewChange?.(mobileView === 'day' ? 'week' : 'day')}
          title={mobileView === 'day' ? t('calendar.week') : t('calendar.day')}
          className={cn(
            'p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0',
            mobileView === 'week' ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {mobileView === 'day'
            ? <CalendarRange className="h-5 w-5" />
            : <CalendarDays className="h-5 w-5" />
          }
        </button>
      </div>

      {/* ── Полоска 7 дней недели (всегда видна) ── */}
      <div
        ref={stripRef}
        className="grid grid-cols-7 gap-1 px-3 pb-3"
      >
        {days.map((day) => {
            const fmt = day.format('YYYY-MM-DD')
            const isSelected = fmt === selectedDate
            const isToday = fmt === today
            const hasAppts = apptDates.has(fmt)
            const isWeekend = day.day() === 6 || day.day() === 0
            const dayOff = isDayOff(day)
            const dayName = t(`schedule.days.${['sun','mon','tue','wed','thu','fri','sat'][day.day()]}`)

            return (
              <button
                key={fmt}
                data-selected={isSelected}
                disabled={dayOff}
                onClick={() => !dayOff && onDateChange(day)}
                className={cn(
                  'flex flex-col items-center justify-center rounded-2xl py-2 gap-0.5 transition-all w-full',
                  dayOff
                    ? 'opacity-35 cursor-not-allowed bg-muted/40'
                    : isSelected
                      ? 'bg-primary text-primary-foreground shadow-md scale-105'
                      : isToday
                        ? 'bg-primary/10 text-primary'
                        : isWeekend
                          ? 'hover:bg-red-50 dark:hover:bg-red-950/30'
                          : 'hover:bg-muted text-foreground'
                )}
              >
                <span className={cn(
                  'text-[10px] font-medium uppercase',
                  dayOff
                    ? 'text-muted-foreground'
                    : isSelected
                      ? 'text-primary-foreground/80'
                      : isWeekend
                        ? 'text-red-400 dark:text-red-400'
                        : 'text-muted-foreground'
                )}>
                  {dayName}
                </span>
                <span className={cn(
                  'text-base font-bold leading-none',
                  !isSelected && !dayOff && isWeekend && 'text-red-500 dark:text-red-400'
                )}>
                  {day.format('D')}
                </span>
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full mt-0.5 transition-opacity',
                  hasAppts && !dayOff ? (isSelected ? 'bg-primary-foreground/60' : 'bg-primary') : 'opacity-0'
                )} />
              </button>
            )
          })}
      </div>

      {/* ── Заголовок дня + кнопка добавить (всегда видна) ── */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-b bg-muted/20">
        <div>
          <p className="text-sm font-semibold">
            {selectedDate === today
              ? t('calendar.today')
              : currentDate.format('D MMMM')}
          </p>
          <p className="text-xs text-muted-foreground">
            {isDayOff(currentDate)
              ? t('schedule.dayOff')
              : dayAppts.length > 0
                ? t('calendar.appointmentsCount', { count: dayAppts.length })
                : t('calendar.noAppointments')}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {(mobileView === 'day' ? selectedDate !== today : !isCurrentWeek) && (
            <button
              onClick={goToToday}
              className="px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-primary text-xs font-medium shrink-0"
            >
              {t('calendar.today')}
            </button>
          )}
        </div>
      </div>

      </div>{/* ── /sticky-шапка ── */}

      {/* ── Week view: раскрываемые карточки по дням ── */}
      {mobileView === 'week' && (
        <div className="flex flex-col px-3 pt-2 pb-2 gap-1.5">
          {days.map((day) => {
            const fmt = day.format('YYYY-MM-DD')
            const isToday = fmt === today
            const isWeekend = day.day() === 6 || day.day() === 0
            const dayOff = isDayOff(day)
            const count = apptCountByDate[fmt] || 0
            const dayName = t(`schedule.days.${['sun','mon','tue','wed','thu','fri','sat'][day.day()]}`)
            const isExpanded = expandedDays.has(fmt)
            const canExpand = !dayOff && count > 0

            const dayApptList = (appointments ?? [])
              .filter(a => dayjs(a.date).format('YYYY-MM-DD') === fmt)
              .sort((a, b) => a.start_time.localeCompare(b.start_time))

            return (
              <div
                key={fmt}
                className={cn(
                  'rounded-2xl border overflow-hidden transition-all',
                  dayOff
                    ? 'opacity-40 bg-muted/30 border-border'
                    : isToday
                      ? 'bg-primary/5 border-primary/30 dark:bg-primary/10'
                      : 'bg-background border-border'
                )}
              >
                {/* Шапка карточки — нажать чтобы раскрыть */}
                <button
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                    canExpand && 'hover:bg-muted/40 active:scale-[0.99]',
                    !canExpand && 'cursor-default'
                  )}
                  onClick={() => canExpand && toggleDay(fmt)}
                  disabled={dayOff}
                >
                  {/* Кружок с датой */}
                  <div className={cn(
                    'flex flex-col items-center justify-center w-10 h-10 rounded-xl shrink-0',
                    isToday
                      ? 'bg-primary text-primary-foreground'
                      : isWeekend && !dayOff
                        ? 'bg-red-50 dark:bg-red-950/30'
                        : 'bg-muted/50'
                  )}>
                    <span className={cn(
                      'text-[10px] font-medium uppercase leading-none mb-0.5',
                      isToday ? 'text-primary-foreground/70' : isWeekend && !dayOff ? 'text-red-400' : 'text-muted-foreground'
                    )}>
                      {dayName}
                    </span>
                    <span className={cn(
                      'text-base font-bold leading-none',
                      isToday ? 'text-primary-foreground' : isWeekend && !dayOff ? 'text-red-500 dark:text-red-400' : 'text-foreground'
                    )}>
                      {day.format('D')}
                    </span>
                  </div>

                  {/* Статус / пусто */}
                  <div className="flex-1 min-w-0">
                    {dayOff
                      ? <p className="text-xs text-muted-foreground">{t('schedule.dayOff')}</p>
                      : count === 0
                        ? <p className="text-xs text-muted-foreground">{t('calendar.noAppointments')}</p>
                        : <p className="text-xs text-muted-foreground">
                            {t('calendar.appointmentsCount', { count })}
                          </p>
                    }
                  </div>

                  {/* Бейдж + шеврон */}
                  {count > 0 && !dayOff && (
                    <>
                      <Badge
                        variant={isToday ? 'default' : 'secondary'}
                        className="shrink-0 text-xs font-semibold"
                      >
                        {count}
                      </Badge>
                      <ChevronDown className={cn(
                        'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200',
                        isExpanded && 'rotate-180'
                      )} />
                    </>
                  )}
                </button>

                {/* Раскрытый список записей */}
                {isExpanded && canExpand && (
                  <div className="border-t divide-y">
                    {dayApptList.map(appt => {
                      const clientName = appt.expand?.client
                        ? `${appt.expand.client.first_name} ${appt.expand.client.last_name || ''}`.trim()
                        : appt.client_name || t('appointments.guestClient')
                      const svcName = getAppointmentServiceNames(appt, services).split(',')[0].trim() || '—'

                      return (
                        <button
                          key={appt.id}
                          className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/40 active:bg-muted/60 transition-colors"
                          onClick={() => {
                            onDateChange(day)
                            onMobileViewChange?.('day')
                          }}
                        >
                          <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_DOT[appt.status] ?? STATUS_DOT.scheduled)} />
                          <span className="font-mono text-xs text-muted-foreground shrink-0 w-10">
                            {appt.start_time.slice(0, 5)}
                          </span>
                          {appt.booked_via === 'online' && (
                            <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                          )}
                          <span className="text-xs font-semibold truncate">{clientName}</span>
                          <span className="text-xs text-muted-foreground truncate flex-1">· {svcName}</span>
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] shrink-0 border-0 px-1.5 py-0', STATUS_TEXT[appt.status])}
                          >
                            {t(`appointments.status.${appt.status}`)}
                          </Badge>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Day view: список записей на день ── */}
      {mobileView === 'day' && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {dayAppts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                  <Clock className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">{t('calendar.noAppointments')}</p>
              </div>
            ) : (
              dayAppts.map((appt) => {
                const clientName = appt.expand?.client
                  ? `${appt.expand.client.first_name} ${appt.expand.client.last_name || ''}`.trim()
                  : appt.client_name || t('appointments.guestClient')
                const serviceName = getAppointmentServiceNames(appt, services) || '—'
                const duration = appt.expand?.service?.duration_min

                return (
                  <button
                    key={appt.id}
                    onClick={() => onOpenEdit(appt)}
                    className={cn(
                      'w-full text-left rounded-2xl border p-3 transition-all active:scale-[0.98]',
                      STATUS_COLORS[appt.status] ?? STATUS_COLORS.scheduled
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {/* Время */}
                      <div className="flex flex-col items-center shrink-0 min-w-[44px]">
                        <span className={cn('text-base font-bold tabular-nums', STATUS_TEXT[appt.status])}>
                          {appt.start_time.slice(0, 5)}
                        </span>
                        {appt.end_time && (
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {appt.end_time.slice(0, 5)}
                          </span>
                        )}
                      </div>

                      {/* Вертикальный разделитель */}
                      <div className={cn('w-0.5 self-stretch rounded-full shrink-0', STATUS_DOT[appt.status])} />

                      {/* Детали */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <UserCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-semibold text-sm truncate">{clientName}</span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{serviceName}</p>
                        {duration && (
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDuration(duration, t)}
                          </div>
                        )}
                      </div>

                      {/* Статус + онлайн + цена */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] shrink-0 border-0 px-2', STATUS_TEXT[appt.status])}
                        >
                          {t(`appointments.status.${appt.status}`)}
                        </Badge>
                        {appt.booked_via === 'online' && (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-sky-600 dark:text-sky-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                            {t('common.online')}
                          </span>
                        )}
                        {appt.price != null && appt.price > 0 && (
                          <span className="text-xs font-semibold">
                            {formatCurrency(appt.price, currency, i18n.language)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
      )}

      {/* Speed Dial FAB */}
      {!limitReached && (
        <>
          {/* Backdrop — закрывает Speed Dial при тапе мимо */}
          <div
            className={cn(
              'fixed inset-0 z-10 transition-opacity duration-200',
              fabOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            )}
            onClick={closeFab}
          />

          {/* Speed Dial контейнер */}
          <div
            className="fixed right-4 z-20 flex flex-col items-end"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
          >
            {/* Мини-кнопки (всегда в DOM, скрываются через opacity) */}
            <div className="flex flex-col items-end gap-3 mb-3">

              {/* QR-код — дальняя, появляется последней */}
              <div
                className={cn('flex items-center gap-2 transition-all duration-150', fabOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none')}
                style={{ transitionDelay: fabOpen ? '100ms' : '0ms' }}
              >
                <span className="bg-background border text-foreground text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm whitespace-nowrap">
                  QR-код записи
                </span>
                <button
                  onClick={handleQR}
                  className="flex items-center justify-center rounded-full bg-background border shadow-md text-foreground transition-all active:scale-95 hover:bg-muted"
                  style={{ width: 40, height: 40 }}
                  aria-label="QR-код записи"
                >
                  <QrCode className="h-4 w-4" />
                </button>
              </div>

              {/* Блокировка времени */}
              <div
                className={cn('flex items-center gap-2 transition-all duration-150', fabOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none')}
                style={{ transitionDelay: fabOpen ? '50ms' : '0ms' }}
              >
                <span className="bg-background border text-foreground text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm whitespace-nowrap">
                  Заблокировать время
                </span>
                <button
                  onClick={handleBlock}
                  className="flex items-center justify-center rounded-full bg-background border shadow-md text-foreground transition-all active:scale-95 hover:bg-muted"
                  style={{ width: 40, height: 40 }}
                  aria-label="Заблокировать время"
                >
                  <Ban className="h-4 w-4" />
                </button>
              </div>

              {/* Новая запись — ближайшая, появляется первой */}
              <div
                className={cn('flex items-center gap-2 transition-all duration-150', fabOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none')}
                style={{ transitionDelay: '0ms' }}
              >
                <span className="bg-background border text-foreground text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm whitespace-nowrap">
                  Новая запись
                </span>
                <button
                  onClick={handleNewAppt}
                  className="flex items-center justify-center rounded-full bg-background border shadow-md text-foreground transition-all active:scale-95 hover:bg-muted"
                  style={{ width: 40, height: 40 }}
                  aria-label="Новая запись"
                >
                  <CalendarPlus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Главная FAB-кнопка */}
            <button
              onClick={() => setFabOpen(v => !v)}
              className="flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all active:scale-95 hover:brightness-110"
              style={{ width: 52, height: 52 }}
              aria-label={t('appointments.add')}
            >
              <Plus className={cn('h-5 w-5 transition-transform duration-200', fabOpen && 'rotate-45')} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
