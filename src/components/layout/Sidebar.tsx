import { NavLink } from 'react-router-dom'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, User, Users, Package, CalendarDays,
  Settings, Zap, X, ShieldCheck, UsersRound, Megaphone, CreditCard, LifeBuoy,
  ClipboardList, BarChart3, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/contexts/AuthContext'
import { useFeature } from '@/hooks/useFeatureFlags'
import { useMyTeam } from '@/hooks/useTeam'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useProfileIcon } from '@/hooks/useProfileIcon'
import { PRODUCT } from '@/lib/config'

/** Пункт меню, который сам проверяет feature flag и не рендерится если нет доступа */
const NavItemGated = memo(function NavItemGated({
  icon, iconColor, label, to, onClick, feature,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor?: string
  label: string
  to: string
  onClick?: () => void
  feature: string | null
}) {
  // Хук вызывается безусловно (правила хуков), feature=null → всегда true
  const hasAccess = useFeature(feature ?? '')
  if (feature !== null && !hasAccess) return null
  return <SidebarNavItem icon={icon} iconColor={iconColor} label={label} to={to} onClick={onClick} />
})

/** Лейбл группы навигации */
const SidebarGroupLabel = memo(function SidebarGroupLabel({ label }: { label: string }) {
  return (
    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/60 select-none">
      {label}
    </p>
  )
})

interface SidebarProps {
  onClose?: () => void
  mobile?: boolean
}

export const Sidebar = memo(function Sidebar({ onClose, mobile }: SidebarProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: teamData } = useMyTeam()
  const { data: appSettings } = useAppSettings()
  const platformName = appSettings?.platform_name ?? 'Ezze'
  const logoUrl = appSettings?.logo_url
  const ServiceIcon = useProfileIcon()

  return (
    <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary overflow-hidden shrink-0">
          {logoUrl
            ? <img src={logoUrl} alt="" className="h-8 w-8 object-cover" />
            : <Zap className="h-4 w-4 text-primary-foreground" />
          }
        </div>
        <span className="text-lg font-bold text-sidebar-foreground">{platformName}</span>
        {mobile && (
          <Button variant="ghost" size="icon" className="ml-auto" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Main nav с группами */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">

        {/* ── Основное ── */}
        <SidebarGroupLabel label={t('nav.groupMain')} />
        {PRODUCT === 'cleaning'
          ? <SidebarNavItem icon={BarChart3}     iconColor="dark:text-blue-400"    label="Статистика" to="/stats"   onClick={onClose} />
          : <NavItemGated   icon={LayoutDashboard} iconColor="dark:text-blue-400"  label={t('nav.dashboard')} to="/dashboard" feature={null} onClick={onClose} />
        }
        {PRODUCT === 'cleaning'
          ? <SidebarNavItem icon={ClipboardList} iconColor="dark:text-indigo-400" label="Заказы"     to="/orders"  onClick={onClose} />
          : <NavItemGated   icon={CalendarDays}  iconColor="dark:text-indigo-400" label={t('nav.calendar')} to="/calendar" feature="calendar" onClick={onClose} />
        }
        {PRODUCT === 'cleaning' && (
          <SidebarNavItem icon={FileText} iconColor="dark:text-slate-400" label="Отчёты" to="/reports" onClick={onClose} />
        )}
        <NavItemGated icon={Users} iconColor="dark:text-emerald-400" label={t('nav.clients')} to="/clients" feature="clients" onClick={onClose} />
        {/* ── Каталог ── */}
        <SidebarGroupLabel label={t('nav.groupCatalog')} />
        <NavItemGated icon={ServiceIcon} iconColor="dark:text-purple-400"  label={t('nav.services')}  to="/services"  feature={null}       onClick={onClose} />
        <NavItemGated icon={Package}     iconColor="dark:text-orange-400"  label={t('nav.inventory')} to="/inventory" feature="inventory"  onClick={onClose} />

        {/* ── Маркетинг ── */}
        <SidebarGroupLabel label={t('nav.groupMarketing')} />
        <SidebarNavItem icon={Megaphone} iconColor="dark:text-pink-400" label={t('nav.marketing')} to="/marketing" onClick={onClose} />

        {/* ── Команда ── */}
        <SidebarGroupLabel label={t('nav.groupTeam')} />
        <NavItemGated icon={UsersRound} iconColor="dark:text-cyan-400" label={t('nav.team')} to="/team" feature="teams" onClick={onClose} />
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* Bottom nav */}
      <div className="py-4 px-2 space-y-1">
        <SidebarNavItem icon={CreditCard} iconColor="dark:text-yellow-400"  label={t('nav.billing')}  to="/billing"  onClick={onClose} />
        <SidebarNavItem icon={LifeBuoy}   iconColor="dark:text-red-400"     label={t('nav.support')}  to="/support"  onClick={onClose} />
        <SidebarNavItem icon={User}       iconColor="dark:text-violet-400"  label={t('nav.profile')}  to="/profile"  onClick={onClose} />
        <SidebarNavItem icon={Settings}   iconColor="dark:text-slate-400"   label={t('nav.settings')} to="/settings" onClick={onClose} />
        {user?.is_admin && (
          <SidebarNavItem
            icon={ShieldCheck}
            label={t('nav.admin')}
            to="/admin"
            onClick={onClose}
            highlight
          />
        )}
      </div>
    </div>
  )
})

interface SidebarNavItemProps {
  icon: React.ComponentType<{ className?: string }>
  iconColor?: string  // цвет иконки в тёмной теме, например "dark:text-blue-400"
  label: string
  to: string
  onClick?: () => void
  highlight?: boolean
}

const SidebarNavItem = memo(function SidebarNavItem({ icon: Icon, iconColor, label, to, onClick, highlight }: SidebarNavItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
            : highlight
              ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('h-4 w-4 shrink-0', !isActive && !highlight && iconColor)} />
          {label}
        </>
      )}
    </NavLink>
  )
})
