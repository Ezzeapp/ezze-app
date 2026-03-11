import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import dayjs from 'dayjs'
import { supabase } from '@/lib/supabase'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, getFileUrl } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import type { Appointment, TeamMember } from '@/types'
import { normalizeAppointment } from '@/hooks/useAppointments'

// ── Запрос записей всех мастеров за день ─────────────────────────────────────

interface MemberAppts {
  member: TeamMember
  appointments: Appointment[]
}

async function fetchTeamDayAppts(
  members: TeamMember[],
  date: string,
): Promise<MemberAppts[]> {
  return Promise.all(
    members.map(async (member) => {
      const userId = (member as any).user_id ?? (member as any).user
      const { data } = await supabase
        .from('appointments')
        .select('*, client:clients(id,first_name,last_name), service:services(id,name)')
        .eq('master_id', userId)
        .eq('date', date)
        .order('start_time')
        .then(r => r)
      const appointments = (data ?? []).map(normalizeAppointment) as Appointment[]
      return { member, appointments }
    }),
  )
}

// ── Компонент ─────────────────────────────────────────────────────────────────

interface Props {
  teamId: string
  members: TeamMember[]
  membersLoading: boolean
}

const STATUS_COLORS: Record<string, string> = {
  done:      'bg-emerald-500',
  scheduled: 'bg-primary',
  cancelled: 'bg-destructive',
  no_show:   'bg-amber-500',
}

export function TeamCalendarTab({ teamId, members, membersLoading }: Props) {
  const { t, i18n } = useTranslation()
  const currency = useCurrency()

  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  // 7 дней текущей недели относительно выбранной даты
  const weekDays = useMemo(() => {
    const weekStart = dayjs(date).startOf('isoWeek')
    return Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'))
  }, [date])

  const { data: memberAppts = [], isLoading } = useQuery({
    queryKey: ['team_calendar', teamId, date],
    queryFn: () => fetchTeamDayAppts(members, date),
    enabled: members.length > 0 && !!teamId,
    staleTime: 60_000,
  })

  const isToday = date === dayjs().format('YYYY-MM-DD')

  const totalForDay = memberAppts.reduce((s, ma) => s + ma.appointments.length, 0)

  // Объединяем и сортируем записи
  const combined = useMemo(() => {
    const filtered = selectedMemberId
      ? memberAppts.filter(ma => ma.member.user === selectedMemberId)
      : memberAppts
    return filtered
      .flatMap(ma => ma.appointments.map(appt => ({ appt, member: ma.member })))
      .sort((a, b) => a.appt.start_time.localeCompare(b.appt.start_time))
  }, [memberAppts, selectedMemberId])

  return (
    <div className="lg:grid lg:grid-cols-2 lg:gap-5 space-y-4 lg:space-y-0">

      {/* ── Левая панель: календарь + фильтр ─────────────────────────── */}
      <div className="space-y-3 lg:border-r lg:pr-5">

        {/* Навигация: неделя */}
        <div className="flex items-center justify-between gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setDate(d => dayjs(d).subtract(1, 'week').format('YYYY-MM-DD'))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          <div className="text-center flex-1">
            <p className="text-xs font-medium text-muted-foreground capitalize">
              {dayjs(date).format('MMMM YYYY')}
            </p>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setDate(d => dayjs(d).add(1, 'week').format('YYYY-MM-DD'))}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Дни недели */}
        <div className="grid grid-cols-7 gap-0.5">
          {weekDays.map(day => {
            const dayStr     = day.format('YYYY-MM-DD')
            const isSelected = dayStr === date
            const isTodayDay = dayStr === dayjs().format('YYYY-MM-DD')
            return (
              <button
                key={dayStr}
                onClick={() => setDate(dayStr)}
                className={[
                  'flex flex-col items-center py-1.5 rounded-lg transition-colors select-none',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : isTodayDay
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                <span className="text-[9px] uppercase font-medium leading-none mb-1">
                  {day.format('dd').slice(0, 2)}
                </span>
                <span className={[
                  'text-sm font-semibold leading-none',
                  isTodayDay && !isSelected ? 'text-primary' : '',
                ].join(' ')}>
                  {day.format('D')}
                </span>
                {isTodayDay && !isSelected && (
                  <span className="mt-1 w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </div>

        {/* Выбранная дата */}
        <div className="text-center">
          <p className="text-sm font-medium capitalize">
            {dayjs(date).format('dddd, D MMMM')}
          </p>
          {isToday && (
            <p className="text-xs text-primary">{t('common.today')}</p>
          )}
          {!isToday && (
            <button
              onClick={() => setDate(dayjs().format('YYYY-MM-DD'))}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              ← {t('common.today')}
            </button>
          )}
        </div>

        {/* Разделитель */}
        <div className="border-t" />

        {/* Фильтр по мастеру */}
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setSelectedMemberId(null)}
            className={[
              'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between',
              !selectedMemberId
                ? 'bg-primary text-primary-foreground font-medium'
                : 'hover:bg-muted/60 text-foreground',
            ].join(' ')}
          >
            <span>{t('team.calendar.all')}</span>
            {totalForDay > 0 && (
              <span className={`text-xs ${!selectedMemberId ? 'opacity-70' : 'text-muted-foreground'}`}>
                {totalForDay}
              </span>
            )}
          </button>

          {members.map(m => {
            const user  = m.expand?.user
            const name  = user?.name || user?.email || m.user
            const count = memberAppts.find(ma => ma.member.user === m.user)?.appointments.length ?? 0
            const avatarUrl = user?.avatar ? getFileUrl('avatars', user.avatar) : null
            const isActive  = selectedMemberId === m.user

            return (
              <button
                key={m.user}
                onClick={() => setSelectedMemberId(prev => prev === m.user ? null : m.user)}
                className={[
                  'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2',
                  isActive
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-muted/60 text-foreground',
                ].join(' ')}
              >
                <Avatar className="h-5 w-5 shrink-0">
                  {avatarUrl && <AvatarImage src={avatarUrl} />}
                  <AvatarFallback className="text-[9px] font-semibold">
                    {name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate flex-1">{name}</span>
                {count > 0 && (
                  <span className={`text-xs shrink-0 ${isActive ? 'opacity-70' : 'text-muted-foreground'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Правая панель: карточки записей ──────────────────────────── */}
      <div>
        {isLoading || membersLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : combined.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {t('team.calendar.noAppts')}
          </div>
        ) : (
          <div className="space-y-2">
            {combined.map(({ appt, member }) => {
              const user       = member.expand?.user
              const masterName = user?.name || user?.email || '—'
              const avatarUrl  = user?.avatar ? getFileUrl('avatars', user.avatar) : null

              const clientName = appt.expand?.client
                ? `${appt.expand.client.first_name} ${appt.expand.client.last_name || ''}`.trim()
                : appt.client_name || t('dashboard.guestClient')

              const multiMatch = (appt.notes || '').match(/^\[(.+)\]/)
              const svcName    = multiMatch
                ? multiMatch[1]
                : (appt.expand?.service?.name || '—')

              return (
                <div
                  key={appt.id}
                  className="p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Время */}
                    <span className="text-xs font-mono text-muted-foreground w-10 shrink-0">
                      {appt.start_time.slice(0, 5)}
                    </span>

                    {/* Аватар мастера */}
                    <Avatar className="h-8 w-8 shrink-0">
                      {avatarUrl && <AvatarImage src={avatarUrl} />}
                      <AvatarFallback className="text-[10px] font-semibold">
                        {masterName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* Клиент + мастер + услуга */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{clientName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {masterName}
                        {svcName !== '—' && <> · {svcName}</>}
                      </p>
                    </div>

                    {/* Статус + цена */}
                    <div className="text-right shrink-0 ml-1">
                      {appt.price ? (
                        <p className="text-xs font-medium mb-0.5">
                          {formatCurrency(appt.price, currency, i18n.language)}
                        </p>
                      ) : null}
                      <div className="flex items-center gap-1 justify-end">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${STATUS_COLORS[appt.status] ?? 'bg-muted'}`}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {t(`appointments.status.${appt.status}`)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
