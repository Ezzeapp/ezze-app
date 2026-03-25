import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, CalendarDays, Users, MoreHorizontal, Bot,
  Package, User, Settings, ShieldCheck, X, UsersRound, ChevronRight, Tag, Star, LogOut, CreditCard, LifeBuoy, Gift,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useFeature } from '@/hooks/useFeatureFlags'
import { useProfileIcon } from '@/hooks/useProfileIcon'

function MoreMenu({ onClose, ServiceIcon }: { onClose: () => void; ServiceIcon: React.ComponentType<{ className?: string }> }) {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const hasInventory = useFeature('inventory')
  const hasTeams     = useFeature('teams')
  const hasPromos    = useFeature('promo_codes')
  const hasReviews   = useFeature('reviews')

  const items = [
    { icon: User,        label: t('nav.profile'),        to: '/profile',        highlight: false },
    { icon: ServiceIcon, label: t('nav.services'),       to: '/services',       highlight: false },
    hasInventory && { icon: Package,     label: t('nav.inventory'),     to: '/inventory',      highlight: false },
    hasTeams     && { icon: UsersRound,  label: t('nav.team'),           to: '/team',           highlight: false },
    hasPromos    && { icon: Tag,         label: t('nav.promoCodes'),     to: '/promo-codes',    highlight: false },
    hasReviews   && { icon: Star,        label: t('nav.reviews'),        to: '/reviews',        highlight: false },
    { icon: Gift,        label: t('nav.loyalty'),         to: '/loyalty',        highlight: false },
    { icon: CreditCard,  label: t('nav.billing'),        to: '/billing',        highlight: false },
    { icon: LifeBuoy,    label: t('nav.support'),        to: '/support',        highlight: false },
    { icon: Settings,    label: t('nav.settings'),       to: '/settings',       highlight: false },
    user?.is_admin && { icon: ShieldCheck, label: t('nav.admin'),        to: '/admin',          highlight: true },
  ].filter(Boolean) as { icon: React.ComponentType<{ className?: string }>; label: string; to: string; highlight: boolean }[]

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in slide-in-from-bottom duration-300 lg:hidden">
      {/* Header — pt-tg-safe отодвигает контент ниже плавающих кнопок Telegram */}
      <div className="pt-tg-safe border-b shrink-0">
        <div className="flex items-center justify-between px-4 h-14">
          <span className="text-base font-semibold">{t('nav.more')}</span>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Nav items list */}
      <div className="flex-1 overflow-y-auto">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-4 px-6 py-4 border-b border-border/50 transition-colors last:border-0',
                isActive
                  ? 'text-primary bg-primary/5'
                  : item.highlight
                    ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20'
                    : 'text-foreground hover:bg-muted'
              )
            }
          >
            <item.icon
              className={cn(
                'h-5 w-5 shrink-0',
                item.highlight ? 'text-amber-500' : 'text-muted-foreground'
              )}
            />
            <span className="flex-1 text-[15px] font-medium">{item.label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
          </NavLink>
        ))}
      </div>

      {/* Logout button */}
      <button
        onClick={() => { logout(); onClose() }}
        className="flex items-center gap-4 px-6 py-4 border-t text-destructive hover:bg-destructive/5 transition-colors w-full"
      >
        <LogOut className="h-5 w-5 shrink-0" />
        <span className="flex-1 text-[15px] font-medium text-left">{t('auth.logout')}</span>
      </button>

      {/* Bottom nav replica */}
      <div className="shrink-0 border-t bg-background pb-safe">
        <div className="flex items-stretch h-16">
          {([
            { icon: CalendarDays,    label: 'nav.calendar',  to: '/calendar'  },
            { icon: Users,           label: 'nav.clients',   to: '/clients'   },
          ] as { icon: React.ComponentType<{ className?: string }>; label: string; to: string }[]).map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              <tab.icon className="h-5 w-5" />
              <span>{t(tab.label)}</span>
            </NavLink>
          ))}
          {/* AI Ассистент */}
          <NavLink
            to="/ai"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            <Bot className="h-5 w-5" />
            <span>AI</span>
          </NavLink>
          {([
            { icon: LayoutDashboard, label: 'nav.dashboard', to: '/dashboard' },
          ] as { icon: React.ComponentType<{ className?: string }>; label: string; to: string }[]).map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              <tab.icon className="h-5 w-5" />
              <span>{t(tab.label)}</span>
            </NavLink>
          ))}
          {/* Active "More" button */}
          <button
            onClick={onClose}
            className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium text-primary"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>{t('nav.more')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export function BottomNav() {
  const { t } = useTranslation()
  const [moreOpen, setMoreOpen] = useState(false)
  const ServiceIcon = useProfileIcon()

  return (
    <>
      {moreOpen && <MoreMenu onClose={() => setMoreOpen(false)} ServiceIcon={ServiceIcon} />}

      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-background border-t pb-safe lg:hidden">
        <div className="flex items-stretch h-16">

          {/* Календарь */}
          <NavLink
            to="/calendar"
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            <CalendarDays className="h-5 w-5" />
            <span>{t('nav.calendar')}</span>
          </NavLink>

          {/* Клиенты */}
          <NavLink
            to="/clients"
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            <Users className="h-5 w-5" />
            <span>{t('nav.clients')}</span>
          </NavLink>

          {/* AI Ассистент */}
          <NavLink
            to="/ai"
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            <Bot className="h-5 w-5" />
            <span>AI</span>
          </NavLink>

          {/* Главная */}
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>{t('nav.dashboard')}</span>
          </NavLink>

          {/* Ещё */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
              moreOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>{t('nav.more')}</span>
          </button>

        </div>
      </nav>
    </>
  )
}
