import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, CalendarDays, Users, CalendarRange, ArrowLeft, UsersRound,
} from 'lucide-react'
import dayjs from 'dayjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DateInput } from '@/components/ui/date-input'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatCurrency, getFileUrl } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { useMyTeam } from '@/hooks/useTeam'
import { useTeamMembers } from '@/hooks/useTeam'
import { useTeamAnalytics } from '@/hooks/useTeamAnalytics'

// ── Период ───────────────────────────────────────────────────────────────────

type Period = 'week' | 'month' | 'quarter' | 'year' | 'custom'

interface PeriodOption { key: Period; labelKey: string }
const PERIODS: PeriodOption[] = [
  { key: 'week',    labelKey: 'analytics.periodWeek'    },
  { key: 'month',   labelKey: 'analytics.periodMonth'   },
  { key: 'quarter', labelKey: 'analytics.periodQuarter' },
  { key: 'year',    labelKey: 'analytics.periodYear'    },
]

function getPeriodRange(
  period: Period,
  customStart?: string,
  customEnd?: string,
): { start: string; end: string } {
  const now = dayjs()
  switch (period) {
    case 'week':
      return {
        start: now.startOf('isoWeek').format('YYYY-MM-DD'),
        end:   now.endOf('isoWeek').format('YYYY-MM-DD'),
      }
    case 'month':
      return {
        start: now.startOf('month').format('YYYY-MM-DD'),
        end:   now.endOf('month').format('YYYY-MM-DD'),
      }
    case 'quarter': {
      const q = Math.floor(now.month() / 3)
      const qStart = now.month(q * 3).startOf('month')
      return {
        start: qStart.format('YYYY-MM-DD'),
        end:   qStart.add(2, 'month').endOf('month').format('YYYY-MM-DD'),
      }
    }
    case 'year':
      return {
        start: now.startOf('year').format('YYYY-MM-DD'),
        end:   now.endOf('year').format('YYYY-MM-DD'),
      }
    case 'custom':
      return {
        start: customStart || now.startOf('month').format('YYYY-MM-DD'),
        end:   customEnd   || now.format('YYYY-MM-DD'),
      }
  }
}

// ── Вспомогательные компоненты ───────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  bgClass,
  iconClass,
  label,
  value,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>
  bgClass: string
  iconClass: string
  label: string
  value: string
  loading: boolean
}) {
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`rounded-lg p-1.5 sm:p-2 shrink-0 ${bgClass}`}>
            <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${iconClass}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{label}</p>
            {loading
              ? <Skeleton className="h-6 w-20 mt-0.5" />
              : <p className="text-lg sm:text-xl font-bold">{value}</p>
            }
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Страница аналитики команды ────────────────────────────────────────────────

export function TeamAnalyticsPage() {
  const { t, i18n } = useTranslation()
  const currency = useCurrency()
  const navigate = useNavigate()

  const [period, setPeriod] = useState<Period>('month')
  const [customStart, setCustomStart] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [customEnd,   setCustomEnd]   = useState(dayjs().format('YYYY-MM-DD'))
  const [customOpen,  setCustomOpen]  = useState(false)
  const customRef = useRef<HTMLDivElement>(null)
  const today = dayjs().format('YYYY-MM-DD')

  // Закрытие дропдауна кастомного периода по клику снаружи
  useEffect(() => {
    if (!customOpen) return
    const handler = (e: MouseEvent) => {
      if (customRef.current && !customRef.current.contains(e.target as Node)) {
        setCustomOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [customOpen])

  const { start, end } = getPeriodRange(period, customStart, customEnd)

  // Данные команды
  const { data: teamData, isLoading: teamLoading } = useMyTeam()
  const team = teamData?.team
  const isOwner = teamData?.isOwner

  const { data: members = [], isLoading: membersLoading } = useTeamMembers(team?.id ?? '')

  const { data: analytics, isLoading: analyticsLoading } = useTeamAnalytics(
    team?.id ?? '',
    members,
    start,
    end,
  )

  const isLoading = teamLoading || membersLoading || analyticsLoading

  // Метка периода
  const periodLabel = useMemo(() => {
    const now = dayjs()
    switch (period) {
      case 'week':
        return `${now.startOf('isoWeek').format('D MMM')} – ${now.endOf('isoWeek').format('D MMM YYYY')}`
      case 'month':
        return now.format('MMMM YYYY')
      case 'quarter': {
        const q = Math.floor(now.month() / 3)
        const qStart = now.month(q * 3).startOf('month')
        const qEnd = qStart.add(2, 'month').endOf('month')
        return `${qStart.format('MMM')} – ${qEnd.format('MMM YYYY')}`
      }
      case 'year':
        return now.format('YYYY')
      case 'custom':
        if (customStart === customEnd) return dayjs(customStart).format('D MMMM YYYY')
        return `${dayjs(customStart).format('D MMM')} – ${dayjs(customEnd).format('D MMM YYYY')}`
    }
  }, [period, customStart, customEnd])

  // Если не владелец — показываем сообщение
  if (!teamLoading && (!team || !isOwner)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <UsersRound className="h-12 w-12 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground">{t('team.analytics.ownerOnly')}</p>
        <Button variant="outline" onClick={() => navigate('/team')}>
          {t('common.back')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Заголовок */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 mt-0.5"
            onClick={() => navigate('/team')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold">{t('nav.teamAnalytics')}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {team?.name ?? '...'}
              <span className="mx-1.5 text-muted-foreground/40">·</span>
              <span className="text-foreground/70 font-medium capitalize">{periodLabel}</span>
            </p>
          </div>
        </div>

        {/* Переключатель периода */}
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIODS.map(p => (
            <Button
              key={p.key}
              variant={period === p.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setPeriod(p.key); setCustomOpen(false) }}
            >
              {t(p.labelKey)}
            </Button>
          ))}

          {/* Произвольный период */}
          <div className="relative" ref={customRef}>
            <Button
              variant={period === 'custom' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCustomOpen(v => !v)}
              className="flex items-center gap-1.5"
            >
              <CalendarRange className="h-3.5 w-3.5" />
              {period === 'custom'
                ? `${dayjs(customStart).format('D MMM')} – ${dayjs(customEnd).format('D MMM')}`
                : t('analytics.periodCustom')}
            </Button>

            {customOpen && (
              <div className="absolute left-0 top-full mt-1.5 z-50 bg-white dark:bg-zinc-900 border border-border rounded-xl shadow-xl p-4 flex flex-col gap-3 w-56">
                <p className="text-xs font-semibold text-foreground">{t('analytics.periodCustom')}</p>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">{t('analytics.customFrom')}</label>
                  <DateInput
                    value={customStart}
                    max={customEnd}
                    onChange={e => setCustomStart(e.target.value)}
                    className="h-8 px-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary w-full"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">{t('analytics.customTo')}</label>
                  <DateInput
                    value={customEnd}
                    min={customStart}
                    max={today}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="h-8 px-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary w-full"
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => { setPeriod('custom'); setCustomOpen(false) }}
                >
                  {t('common.apply')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Итоговые метрики команды */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        <MetricCard
          icon={TrendingUp}
          bgClass="bg-amber-50 dark:bg-amber-950"
          iconClass="text-amber-600"
          label={t('team.analytics.totalRevenue')}
          value={formatCurrency(analytics?.totalRevenue ?? 0, currency, i18n.language)}
          loading={isLoading}
        />
        <MetricCard
          icon={CalendarDays}
          bgClass="bg-blue-50 dark:bg-blue-950"
          iconClass="text-blue-600"
          label={t('team.analytics.totalAppts')}
          value={String(analytics?.totalAppts ?? 0)}
          loading={isLoading}
        />
        <MetricCard
          icon={Users}
          bgClass="bg-violet-50 dark:bg-violet-950"
          iconClass="text-violet-600"
          label={t('team.analytics.activeMasters')}
          value={String(members.length)}
          loading={isLoading}
        />
      </div>

      {/* Таблица по мастерам */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UsersRound className="h-4 w-4" />
            {t('team.analytics.byMaster')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !analytics || analytics.stats.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">
              {t('analytics.noData')}
            </p>
          ) : (
            <div className="space-y-2">
              {analytics.stats.map((stat, i) => {
                const avatarUrl = stat.userAvatar
                  ? getFileUrl('avatars', stat.userAvatar)
                  : undefined

                // Ширина прогресс-бара относительно максимальной выручки
                const maxRevenue = analytics.stats[0]?.revenue || 1
                const barPct = maxRevenue > 0 ? (stat.revenue / maxRevenue) * 100 : 0

                return (
                  <div
                    key={stat.userId}
                    className="p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* Позиция */}
                      <span className="text-xs text-muted-foreground font-mono w-4 shrink-0 text-center">
                        {i + 1}
                      </span>

                      {/* Аватар */}
                      <Avatar className="h-10 w-10 shrink-0">
                        {avatarUrl && <AvatarImage src={avatarUrl} />}
                        <AvatarFallback className="text-sm font-semibold">
                          {stat.userName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      {/* Имя + прогресс-бар */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm font-medium truncate">{stat.userName}</p>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Метрики */}
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-sm font-semibold">{formatCurrency(stat.revenue, currency, i18n.language)}</p>
                        <p className="text-xs text-muted-foreground">
                          {stat.doneCount} / {stat.appointmentCount} {t('team.analytics.appts')}
                        </p>
                      </div>
                    </div>

                    {/* Средний чек — маленький */}
                    {stat.doneCount > 0 && (
                      <div className="mt-1.5 ml-7 pl-10 flex gap-3 text-xs text-muted-foreground">
                        <span>
                          {t('team.analytics.avgCheck')}: {formatCurrency(stat.avgCheck, currency, i18n.language)}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Подсказка для владельца */}
      <p className="text-xs text-muted-foreground text-center pb-2">
        {t('team.analytics.dataHint')}
      </p>
    </div>
  )
}
