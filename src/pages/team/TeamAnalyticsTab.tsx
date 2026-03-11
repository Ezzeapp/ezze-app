import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  TrendingUp, CalendarDays, Users, CalendarRange, UsersRound,
} from 'lucide-react'
import dayjs from 'dayjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatCurrency, getFileUrl } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { useTeamAnalytics } from '@/hooks/useTeamAnalytics'
import type { Team, TeamMember } from '@/types'

// ── Период ───────────────────────────────────────────────────────────────────

type Period = 'today' | 'days3' | 'week' | 'month' | 'quarter' | 'year' | 'custom'

interface PeriodOption { key: Period; labelKey: string }
const PERIODS: PeriodOption[] = [
  { key: 'today',   labelKey: 'common.today'            },
  { key: 'days3',   labelKey: 'analytics.period3Days'   },
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
    case 'today':
      return {
        start: now.format('YYYY-MM-DD'),
        end:   now.format('YYYY-MM-DD'),
      }
    case 'days3':
      return {
        start: now.subtract(2, 'day').format('YYYY-MM-DD'),
        end:   now.format('YYYY-MM-DD'),
      }
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

// ── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon, bgClass, iconClass, label, value, loading,
}: {
  icon: React.ComponentType<{ className?: string }>
  bgClass: string
  iconClass: string
  label: string
  value: React.ReactNode
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
              : <p className="text-lg sm:text-xl font-bold leading-snug">{value}</p>
            }
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── TeamAnalyticsTab ──────────────────────────────────────────────────────────

interface Props {
  team: Team
  members: TeamMember[]
  membersLoading: boolean
}

export function TeamAnalyticsTab({ team, members, membersLoading }: Props) {
  const { t, i18n } = useTranslation()
  const currency = useCurrency()

  const [period, setPeriod] = useState<Period>('month')
  const [customStart, setCustomStart] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [customEnd,   setCustomEnd]   = useState(dayjs().format('YYYY-MM-DD'))
  const [customOpen,  setCustomOpen]  = useState(false)
  const customRef = useRef<HTMLDivElement>(null)
  const today = dayjs().format('YYYY-MM-DD')

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

  const { data: analytics, isLoading: analyticsLoading } = useTeamAnalytics(
    team.id,
    members,
    start,
    end,
  )

  const isLoading = membersLoading || analyticsLoading

  const periodLabel = useMemo(() => {
    const now = dayjs()
    switch (period) {
      case 'today':
        return now.format('D MMMM YYYY')
      case 'days3':
        return `${now.subtract(2, 'day').format('D MMM')} – ${now.format('D MMM YYYY')}`
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

  return (
    <div className="space-y-4">
      {/* Подпись периода */}
      <p className="text-sm text-muted-foreground capitalize">{periodLabel}</p>

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
                <input
                  type="date"
                  value={customStart}
                  max={customEnd}
                  onChange={e => setCustomStart(e.target.value)}
                  className="h-8 px-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary w-full"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">{t('analytics.customTo')}</label>
                <input
                  type="date"
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

      {/* Итоговые метрики */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        <MetricCard
          icon={TrendingUp}
          bgClass="bg-amber-50 dark:bg-amber-950"
          iconClass="text-amber-600"
          label={t('team.analytics.totalRevenue')}
          value={
            <>
              {new Intl.NumberFormat(i18n.language).format(analytics?.totalRevenue ?? 0)}
              <span className="text-xs font-medium text-muted-foreground ml-1">{currency}</span>
            </>
          }
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

                const maxRevenue = analytics.stats[0]?.revenue || 1
                const barPct = maxRevenue > 0 ? (stat.revenue / maxRevenue) * 100 : 0

                return (
                  <div
                    key={stat.userId}
                    className="p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-mono w-4 shrink-0 text-center">
                        {i + 1}
                      </span>
                      <Avatar className="h-10 w-10 shrink-0">
                        {avatarUrl && <AvatarImage src={avatarUrl} />}
                        <AvatarFallback className="text-sm font-semibold">
                          {stat.userName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm font-medium truncate">{stat.userName}</p>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-sm font-semibold">{formatCurrency(stat.revenue, currency, i18n.language)}</p>
                        <p className="text-xs text-muted-foreground">
                          {stat.doneCount} / {stat.appointmentCount} {t('team.analytics.appts')}
                        </p>
                      </div>
                    </div>

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

      <p className="text-xs text-muted-foreground text-center pb-2">
        {t('team.analytics.dataHint')}
      </p>
    </div>
  )
}
