import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useHomeScreenConfig } from '@/hooks/useAppSettings'
import { useHomeStats } from '@/hooks/useHomeStats'
import { getDefaultTiles } from '@/lib/homeScreenDefaults'
import { PRODUCT } from '@/lib/config'
import { getTileIcon, getTileColor } from './_parts/tileIcons'
import { KpiBadge } from './_parts/KpiBadge'
import { RevenueSparkline } from './_parts/RevenueSparkline'
import { ActivityFeed } from './_parts/ActivityFeed'
import { getNewOrderRoute } from './_parts/newOrderRoute'
import dayjs from 'dayjs'

export function HybridLight() {
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
  const today = dayjs().format('dddd, D MMMM')

  // Подсчёт бейджа для конкретного раздела
  function badgeFor(id: string): { value: string | number; tone: 'rose' | 'emerald' | 'amber' } | null {
    if (!stats) return null
    if (id === 'orders' && stats.ordersInIntake > 0)
      return { value: stats.ordersInIntake, tone: 'rose' }
    if (id === 'clients' && stats.clientsNewWeek > 0)
      return { value: `+${stats.clientsNewWeek}`, tone: 'emerald' }
    if (id === 'delivery' && stats.deliveriesToday > 0)
      return { value: stats.deliveriesToday, tone: 'rose' }
    if (id === 'supplies' && stats.suppliesLow > 0)
      return { value: '!', tone: 'amber' }
    return null
  }

  const subStatusParts: string[] = []
  if (stats) {
    if (stats.ordersInIntake) subStatusParts.push(t('homeScreen.summaryIntake', { count: stats.ordersInIntake }))
    if (stats.ordersReady) subStatusParts.push(t('homeScreen.summaryReady', { count: stats.ordersReady }))
    if (stats.suppliesLow) subStatusParts.push(t('homeScreen.summarySuppliesLow', { count: stats.suppliesLow }))
  }

  return (
    <div className="min-h-full bg-[radial-gradient(at_20%_10%,rgba(59,130,246,.10)_0px,transparent_50%),radial-gradient(at_80%_0%,rgba(236,72,153,.08)_0px,transparent_50%),radial-gradient(at_80%_80%,rgba(34,197,94,.08)_0px,transparent_50%),radial-gradient(at_10%_90%,rgba(168,85,247,.08)_0px,transparent_50%)] bg-background">
      {/* Header */}
      <div className="px-4 lg:px-8 pt-6 lg:pt-8 pb-3 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground font-semibold capitalize mb-1">{today}</div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
            {t('homeScreen.welcome')}{firstName ? `, ${firstName}` : ''}
          </h1>
          {subStatusParts.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">{subStatusParts.join(' · ')}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate(getNewOrderRoute())}
          className="self-start lg:self-auto bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-4 h-10 rounded-xl flex items-center gap-2 shadow-md transition"
        >
          <Plus className="h-4 w-4" />
          {t('homeScreen.newOrder')}
        </button>
      </div>

      {/* Tile row — iOS style круглые-большие */}
      <div className="px-4 lg:px-8 py-5">
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-4 lg:gap-3">
          {tiles.map(tile => {
            const Icon = getTileIcon(tile.icon)
            const color = getTileColor(tile.id)
            const label = tile.label[i18n.language] || tile.label['ru'] || tile.id
            const badge = badgeFor(tile.id)

            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => navigate(tile.route)}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div className="relative">
                  <div
                    className="h-16 w-16 lg:h-[68px] lg:w-[68px] rounded-[20px] flex items-center justify-center text-white shadow-lg group-hover:scale-105 group-active:scale-95 transition-transform"
                    style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }}
                  >
                    <Icon className="h-7 w-7" />
                  </div>
                  {badge && <KpiBadge value={badge.value} tone={badge.tone} />}
                </div>
                <span className="text-[11px] font-semibold text-foreground text-center line-clamp-1">
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Widgets */}
      <div className="px-4 lg:px-8 pb-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RevenueSparkline className="lg:col-span-2" />
        <ActivityFeed />
      </div>
    </div>
  )
}
