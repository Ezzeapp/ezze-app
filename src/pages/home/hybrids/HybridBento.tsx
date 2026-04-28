import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, ClipboardList, Play, CheckCircle2, ArrowRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useHomeScreenConfig } from '@/hooks/useAppSettings'
import { useHomeStats } from '@/hooks/useHomeStats'
import { getDefaultTiles } from '@/lib/homeScreenDefaults'
import { PRODUCT } from '@/lib/config'
import { cn, formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { getTileIcon, getTileColor } from './_parts/tileIcons'
import { RevenueSparkline } from './_parts/RevenueSparkline'
import { ActivityFeed } from './_parts/ActivityFeed'
import dayjs from 'dayjs'

export function HybridBento() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const symbol = useCurrencySymbol()
  const { data: config } = useHomeScreenConfig()
  const { data: stats } = useHomeStats()

  const { mainTile, miniTiles } = useMemo(() => {
    const raw = config?.tiles?.length ? config.tiles : getDefaultTiles(PRODUCT)
    const visible = raw.filter(t => t.visible).sort((a, b) => a.order - b.order)
    const main = visible.find(t => t.id === 'orders') ?? null
    const mini = visible.filter(t => t.id !== 'orders').slice(0, 6)
    return { mainTile: main, miniTiles: mini }
  }, [config])

  const firstName = user?.name?.split(' ')[0] || ''

  return (
    <div className="min-h-full bg-muted/40 px-4 lg:px-8 py-6 lg:py-8 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {firstName ? `${firstName} · ${t('homeScreen.workspace')}` : t('homeScreen.workspace')}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">
            {dayjs().format('dddd, D MMMM · HH:mm')}
            {stats && stats.ordersActive > 0 && (
              <> · {t('homeScreen.summaryActive', { count: stats.ordersActive })}</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/orders/pos')}
          className="self-start sm:self-auto bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-4 h-10 rounded-lg flex items-center gap-2 shadow-sm transition"
        >
          <Plus className="h-4 w-4" />
          {t('homeScreen.newOrder')}
        </button>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 lg:auto-rows-[160px] gap-3">

        {/* Главная плитка Заказы */}
        {mainTile && (
          <button
            type="button"
            onClick={() => navigate(mainTile.route)}
            className="text-left lg:col-span-6 lg:row-span-2 rounded-2xl p-6 cursor-pointer text-white relative overflow-hidden hover:shadow-xl transition-shadow"
            style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6 60%, #8b5cf6)' }}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[10px] uppercase tracking-wider opacity-80 font-bold">
                  {t('homeScreen.mainCard')}
                </div>
                <div className="text-2xl font-bold mt-1">
                  {mainTile.label[i18n.language] || mainTile.label['ru'] || t('homeScreen.orders')}
                </div>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center">
                <ClipboardList className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-6">
              <div className="font-mono text-6xl lg:text-7xl font-extrabold leading-none">
                {stats?.ordersActive ?? '—'}
              </div>
              <div className="text-sm opacity-80 mt-1">
                {t('homeScreen.activeNow')}
              </div>
            </div>

            {/* Разбивка статусов */}
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-white/10 p-3">
                <div className="font-mono text-2xl font-bold">{stats?.ordersInIntake ?? '—'}</div>
                <div className="text-[10px] opacity-75 uppercase tracking-wider">{t('homeScreen.intakeShort')}</div>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <div className="font-mono text-2xl font-bold">{stats?.ordersInProgress ?? '—'}</div>
                <div className="text-[10px] opacity-75 uppercase tracking-wider">{t('homeScreen.inWork')}</div>
              </div>
              <div className="rounded-xl bg-white/15 p-3 ring-1 ring-white/30">
                <div className="font-mono text-2xl font-bold">{stats?.ordersReady ?? '—'}</div>
                <div className="text-[10px] opacity-75 uppercase tracking-wider">{t('homeScreen.readyShort')}</div>
              </div>
            </div>

            {/* Быстрые действия */}
            <div className="mt-5 flex gap-2">
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); navigate('/orders?status=ready') }}
                className="bg-white/15 hover:bg-white/25 backdrop-blur rounded-lg px-3 h-9 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t('homeScreen.toIssue')}
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); navigate('/orders?status=received') }}
                className="bg-white/15 hover:bg-white/25 backdrop-blur rounded-lg px-3 h-9 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Play className="h-3.5 w-3.5" />
                {t('homeScreen.intoWork')}
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); navigate('/orders') }}
                className="bg-white/15 hover:bg-white/25 backdrop-blur rounded-lg px-3 h-9 text-xs font-bold flex items-center gap-1.5 transition ml-auto"
              >
                {t('homeScreen.all')}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </button>
        )}

        {/* 6 мини-плиток (col-span-2 каждая = 3 ряда по 2) */}
        {miniTiles.map(tile => {
          const Icon = getTileIcon(tile.icon)
          const color = getTileColor(tile.id)
          const label = tile.label[i18n.language] || tile.label['ru'] || tile.id

          // KPI на мини-плитке
          let value: string | null = null
          let badge: { value: string; tone: 'rose' | 'emerald' | 'amber' } | null = null
          let warn = false
          if (stats) {
            if (tile.id === 'pos') value = null
            if (tile.id === 'clients') {
              value = String(stats.clientsTotal)
              if (stats.clientsNewWeek > 0) badge = { value: `+${stats.clientsNewWeek}`, tone: 'emerald' }
            }
            if (tile.id === 'delivery') {
              value = String(stats.deliveriesToday)
              if (stats.deliveriesToday > 0) badge = { value: String(stats.deliveriesToday), tone: 'rose' }
            }
            if (tile.id === 'supplies') {
              value = String(stats.suppliesLow || '—')
              warn = stats.suppliesLow > 0
              if (warn) badge = { value: '!', tone: 'amber' }
            }
            if (tile.id === 'stats') {
              const grow = stats.revenueGrowthPct
              value = formatCurrency(stats.revenueMonth) + ' ' + symbol
              if (grow !== null) badge = { value: `${grow > 0 ? '+' : ''}${grow}%`, tone: grow >= 0 ? 'emerald' : 'rose' }
            }
          }

          const TONE_BG: Record<NonNullable<typeof badge>['tone'], string> = {
            rose: 'bg-rose-500 text-white',
            emerald: 'bg-emerald-500 text-white',
            amber: 'bg-amber-500 text-white',
          }

          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => navigate(tile.route)}
              className={cn(
                'lg:col-span-2 rounded-2xl p-3 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition',
                'border bg-card text-left',
                warn && 'ring-1 ring-rose-200 dark:ring-rose-900/50'
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', color.bg, color.fg)}>
                  <Icon className="h-4 w-4" />
                </div>
                {badge && (
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', TONE_BG[badge.tone])}>
                    {badge.value}
                  </span>
                )}
              </div>
              {value && (
                <div className={cn('font-mono text-lg font-extrabold text-foreground', warn && 'text-rose-600')}>
                  {value}
                </div>
              )}
              <div className="text-[11px] font-bold text-foreground truncate">{label}</div>
            </button>
          )
        })}

        {/* Виджеты в нижнем ряду */}
        <div className="lg:col-span-7">
          <RevenueSparkline />
        </div>
        <div className="lg:col-span-5">
          <ActivityFeed limit={5} />
        </div>
      </div>
    </div>
  )
}
