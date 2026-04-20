import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useHomeScreenConfig } from '@/hooks/useAppSettings'
import { getDefaultTiles } from '@/lib/homeScreenDefaults'
import { PRODUCT } from '@/lib/config'
import {
  Calendar, Users, ClipboardList, ShoppingCart, Truck, Droplets,
  BarChart3, Tag, Settings2, Wallet, LayoutDashboard, Wrench,
  MessageSquare, Star, Package, UserCheck, Bot, Shield,
  FlaskConical, Pill, BedDouble, Syringe, UtensilsCrossed,
  CalendarDays, BarChart2, Beef, Wheat, Factory,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  Calendar, CalendarDays, Users, ClipboardList, ShoppingCart, Truck, Droplets,
  BarChart3, BarChart2, Tag, Settings2, Wallet, LayoutDashboard, Wrench,
  MessageSquare, Star, Package, UserCheck, Bot, Shield,
  FlaskConical, Pill, BedDouble, Syringe, UtensilsCrossed,
  Beef, Wheat, Factory,
}

export function HomeScreen() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: config } = useHomeScreenConfig()

  const rawTiles = config?.tiles?.length ? config.tiles : getDefaultTiles(PRODUCT)
  const tiles = rawTiles
    .filter(tile => tile.visible)
    .sort((a, b) => a.order - b.order)

  const firstName = user?.name?.split(' ')[0] || ''

  return (
    <div className="min-h-full flex flex-col">
      {/* Приветствие */}
      <div className="px-4 pt-6 pb-4 lg:px-8 lg:pt-8">
        <h1 className="text-xl font-semibold text-foreground">
          {t('homeScreen.welcome')}{firstName ? `, ${firstName}` : ''}!
        </h1>
      </div>

      {/* Сетка плиток */}
      <div className="flex-1 px-4 pb-6 lg:px-8 lg:pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
          {tiles.map(tile => {
            const Icon = ICON_MAP[tile.icon] ?? LayoutDashboard
            const label = tile.label[i18n.language] || tile.label['ru'] || tile.id

            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => navigate(tile.route)}
                className="
                  group flex flex-col items-center justify-center gap-3
                  aspect-square rounded-2xl border bg-card
                  p-4 text-center
                  transition-all duration-150
                  hover:shadow-md hover:scale-[1.03] hover:border-primary/30
                  active:scale-[0.98]
                "
              >
                <div className="rounded-xl bg-primary/10 p-3 group-hover:bg-primary/15 transition-colors">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground leading-tight line-clamp-2">
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
