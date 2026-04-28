import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, AlertTriangle, ArrowRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useHomeScreenConfig } from '@/hooks/useAppSettings'
import { useHomeStats } from '@/hooks/useHomeStats'
import { getDefaultTiles } from '@/lib/homeScreenDefaults'
import { PRODUCT } from '@/lib/config'
import { formatCurrency, cn } from '@/lib/utils'
import { getTileIcon, getTileColor } from './_parts/tileIcons'
import { OpsModule } from './_parts/OpsModule'
import { getNewOrderRoute } from './_parts/newOrderRoute'
import dayjs from 'dayjs'

export function HybridDense() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: config } = useHomeScreenConfig()
  const { data: stats } = useHomeStats()

  const tiles = useMemo(() => {
    const raw = config?.tiles?.length ? config.tiles : getDefaultTiles(PRODUCT)
    return raw.filter(t => t.visible).sort((a, b) => a.order - b.order)
  }, [config])

  const firstName = user?.name?.split(' ')[0] || ''

  // Метаданные для подзаголовка плитки
  function tileMeta(id: string): { value: string; sub?: string; warn?: boolean } | null {
    if (!stats) return null
    switch (id) {
      case 'orders':
        return {
          value: String(stats.ordersActive),
          sub: stats.ordersInIntake > 0 ? t('homeScreen.summaryIntake', { count: stats.ordersInIntake }) : undefined,
        }
      case 'pos':
        return { value: '', sub: t('homeScreen.dragAndDrop') }
      case 'clients':
        return {
          value: String(stats.clientsTotal),
          sub: stats.clientsNewWeek > 0 ? `+${stats.clientsNewWeek} ${t('homeScreen.weekShort')}` : undefined,
        }
      case 'delivery':
        return { value: String(stats.deliveriesToday), sub: t('homeScreen.today') }
      case 'supplies': {
        const warn = stats.suppliesLow > 0
        return {
          value: '',
          sub: warn ? t('homeScreen.lowStockShort', { count: stats.suppliesLow }) : t('homeScreen.inStock'),
          warn,
        }
      }
      case 'stats': {
        const grow = stats.revenueGrowthPct
        return {
          value: '',
          sub: grow !== null ? `${grow > 0 ? '+' : ''}${grow}%` : undefined,
        }
      }
      default:
        return null
    }
  }

  return (
    <div className="min-h-full bg-muted/40">
      {/* Header */}
      <div className="px-4 lg:px-8 pt-6 pb-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('homeScreen.welcome')}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{dayjs().format('dddd, D MMMM')}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(getNewOrderRoute())}
          className="self-start sm:self-auto bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-4 h-10 rounded-lg flex items-center gap-2 shadow-sm transition"
        >
          <Plus className="h-4 w-4" />
          {t('homeScreen.newOrder')}
        </button>
      </div>

      {/* Алерт-баннер (показываем только если есть проблемы) */}
      {stats && stats.suppliesLow > 0 && (
        <div className="px-4 lg:px-8 pt-3">
          <button
            type="button"
            onClick={() => navigate('/supplies')}
            className="w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-3 flex items-center gap-3 hover:bg-rose-100/70 dark:hover:bg-rose-950/50 transition"
          >
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span className="text-xs text-rose-900 dark:text-rose-200 font-semibold flex-1 text-left">
              {t('homeScreen.lowStockAlert', { count: stats.suppliesLow })}
            </span>
            <span className="text-[11px] text-rose-700 dark:text-rose-300 font-bold">
              {t('homeScreen.openAction')} →
            </span>
          </button>
        </div>
      )}

      {/* Плитки-ярлычки */}
      <div className="px-4 lg:px-8 pt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {tiles.map(tile => {
          const Icon = getTileIcon(tile.icon)
          const color = getTileColor(tile.id)
          const label = tile.label[i18n.language] || tile.label['ru'] || tile.id
          const meta = tileMeta(tile.id)

          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => navigate(tile.route)}
              className={cn(
                'bg-card rounded-xl border border-border p-3 flex items-center gap-3 cursor-pointer text-left',
                'hover:border-primary/30 hover:shadow-sm transition',
                meta?.warn && 'ring-1 ring-rose-200 dark:ring-rose-900/50'
              )}
            >
              <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', color.bg, color.fg)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-foreground truncate">{label}</div>
                {meta?.sub && (
                  <div className={cn('text-[10px] truncate', meta.warn ? 'text-rose-600 font-semibold' : 'text-muted-foreground')}>
                    {meta.sub}
                  </div>
                )}
              </div>
              {meta?.value
                ? <div className={cn('font-mono text-base font-extrabold', meta.warn && 'text-rose-600')}>{meta.value}</div>
                : <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            </button>
          )
        })}
      </div>

      {/* 3 модуля операционки */}
      <div className="px-4 lg:px-8 py-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <OpsModule kind="to_issue" />
        <OpsModule kind="in_intake" />
        <OpsModule kind="delivery" />
      </div>
    </div>
  )
}
