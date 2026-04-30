import { NavLink } from 'react-router-dom'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, Users, Package, CalendarDays,
  Zap, X, UsersRound, Megaphone,
  ClipboardList, BarChart3, Beef, Wheat, Milk, Wallet, ShoppingCart,
  FlaskConical, Pill, Tractor, TreePine, Egg, Syringe, Sparkles, QrCode,
  BedDouble, UtensilsCrossed, Heart, Wrench, Tag, Gift, KeyRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useTeamScope } from '@/contexts/TeamContext'
import { useFeature } from '@/hooks/useFeatureFlags'
import { useMyTeam } from '@/hooks/useTeam'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useProfileIcon } from '@/hooks/useProfileIcon'
import { useTeamAccess, type TeamModule } from '@/hooks/useTeamAccess'
import { PRODUCT } from '@/lib/config'
import { PlanCard } from './PlanCard'

/** Пункт меню, который сам проверяет feature flag и не рендерится если нет доступа */
const NavItemGated = memo(function NavItemGated({
  icon, iconColor, label, to, onClick, feature, module,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor?: string
  label: string
  to: string
  onClick?: () => void
  feature: string | null
  module?: TeamModule
}) {
  // Хук вызывается безусловно (правила хуков), feature=null → всегда true
  const hasAccess = useFeature(feature ?? '')
  // module=undefined → доступ есть (хук возвращает true для не-team-only)
  const hasModuleAccess = useTeamAccess(module ?? 'orders')
  if (feature !== null && !hasAccess) return null
  if (module && !hasModuleAccess) return null
  return <SidebarNavItem icon={icon} iconColor={iconColor} label={label} to={to} onClick={onClick} />
})

/** Пункт меню без feature-gate, с проверкой team module access */
const NavItemAccess = memo(function NavItemAccess({
  icon, iconColor, label, to, onClick, module,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor?: string
  label: string
  to: string
  onClick?: () => void
  module: TeamModule
}) {
  const has = useTeamAccess(module)
  if (!has) return null
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
  const { data: teamData } = useMyTeam()
  const teamScope = useTeamScope()
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
        {PRODUCT === 'cleaning' ? (
          <NavItemAccess icon={BarChart3} iconColor="dark:text-blue-400" label={t('nav.stats')} to="/stats" module="dashboard" onClick={onClose} />
        ) : PRODUCT === 'workshop' ? (
          <NavItemAccess icon={BarChart3} iconColor="dark:text-blue-400" label={t('nav.stats')} to="/stats" module="dashboard" onClick={onClose} />
        ) : PRODUCT === 'farm' ? (
          <SidebarNavItem icon={LayoutDashboard} iconColor="dark:text-blue-400" label={t('farm.nav.dashboard')} to="/farm" end onClick={onClose} />
        ) : (
          <NavItemGated icon={LayoutDashboard} iconColor="dark:text-blue-400" label={t('nav.dashboard')} to="/dashboard" feature={null} module="dashboard" onClick={onClose} />
        )}
        {PRODUCT === 'cleaning' ? (<>
          <SidebarNavItem icon={ClipboardList} iconColor="dark:text-indigo-400" label={t('nav.orders')} to="/orders" onClick={onClose} />
        </>) : PRODUCT === 'workshop' ? (
          <SidebarNavItem icon={Wrench} iconColor="dark:text-indigo-400" label={t('workshop.nav.orders', 'Заказы в ремонт')} to="/orders" onClick={onClose} />
        ) : PRODUCT === 'rental' ? (
          <>
            <SidebarNavItem icon={ClipboardList} iconColor="dark:text-indigo-400" label={t('rental.nav.bookings', 'Брони')} to="/rental/bookings" onClick={onClose} />
            <SidebarNavItem icon={CalendarDays}  iconColor="dark:text-blue-400"   label={t('rental.nav.availability', 'Календарь')} to="/rental/availability" onClick={onClose} />
          </>
        ) : PRODUCT === 'farm' ? null : (
          <NavItemGated icon={CalendarDays} iconColor="dark:text-indigo-400" label={PRODUCT === 'clinic' ? t('clinic.nav.appointments') : t('nav.calendar')} to="/calendar" feature="calendar" onClick={onClose} />
        )}
        {PRODUCT !== 'farm' && (
          <NavItemGated icon={Users} iconColor="dark:text-emerald-400" label={PRODUCT === 'clinic' ? t('clinic.nav.patients') : t('nav.clients')} to="/clients" feature="clients" module="clients" onClick={onClose} />
        )}
        {/* Промокоды/Лояльность для cleaning и workshop вынесены в табы /orders;
            для beauty — иконки в шапке Календаря. Для остальных — отдельные пункты. */}
        {PRODUCT !== 'farm' && PRODUCT !== 'cleaning' && PRODUCT !== 'workshop' && PRODUCT !== 'beauty' && (
          <>
            <NavItemAccess icon={Tag}  iconColor="dark:text-orange-400" label={t('marketing.tabPromo')}   to="/promo"   module="promo"   onClick={onClose} />
            <NavItemAccess icon={Gift} iconColor="dark:text-rose-400"   label={t('marketing.tabLoyalty')} to="/loyalty" module="loyalty" onClick={onClose} />
          </>
        )}
        {PRODUCT === 'clinic' && (
          <>
            <SidebarNavItem icon={FlaskConical} iconColor="dark:text-teal-400" label={t('clinic.nav.lab')} to="/clinic/lab" onClick={onClose} />
            <SidebarNavItem icon={Pill} iconColor="dark:text-rose-400" label={t('clinic.nav.pharmacy')} to="/clinic/pharmacy" onClick={onClose} />
            <SidebarNavItem icon={BedDouble} iconColor="dark:text-amber-400" label={t('clinic.nav.wards')} to="/clinic/wards" onClick={onClose} />
            <SidebarNavItem icon={Syringe} iconColor="dark:text-purple-400" label={t('clinic.nav.surgery')} to="/clinic/surgery" onClick={onClose} />
            <SidebarNavItem icon={UtensilsCrossed} iconColor="dark:text-orange-400" label={t('clinic.nav.nutrition')} to="/clinic/nutrition" onClick={onClose} />
          </>
        )}

        {PRODUCT === 'farm' ? (
          <>
            <SidebarNavItem icon={Beef}      iconColor="dark:text-emerald-400" label={t('farm.nav.animals')}    to="/farm/animals"    onClick={onClose} />
            <SidebarNavItem icon={UsersRound} iconColor="dark:text-cyan-400"   label={t('farm.nav.groups')}     to="/farm/groups"     onClick={onClose} />
            <SidebarGroupLabel label={t('nav.groupCatalog')} />
            <SidebarNavItem icon={Wheat}     iconColor="dark:text-amber-400"   label={t('farm.nav.fields')}     to="/farm/fields"     onClick={onClose} />
            <SidebarNavItem icon={Package}   iconColor="dark:text-orange-400"  label={t('farm.nav.feed')}       to="/farm/feed"       onClick={onClose} />
            <SidebarNavItem icon={Milk}      iconColor="dark:text-sky-400"     label={t('farm.nav.production')} to="/farm/production" onClick={onClose} />
            <SidebarNavItem icon={ShoppingCart} iconColor="dark:text-emerald-400" label={t('farm.nav.sales')}   to="/farm/sales"      onClick={onClose} />
            <SidebarNavItem icon={Wallet}    iconColor="dark:text-rose-400"    label={t('farm.nav.expenses')}   to="/farm/expenses"   onClick={onClose} />
            <SidebarNavItem icon={Tractor}   iconColor="dark:text-slate-400"   label={t('farm.nav.equipment')}  to="/farm/equipment"  onClick={onClose} />
            <SidebarNavItem icon={TreePine}  iconColor="dark:text-lime-400"    label={t('farm.nav.pastures')}   to="/farm/pastures"   onClick={onClose} />
            <SidebarNavItem icon={Egg}       iconColor="dark:text-amber-400"   label={t('farm.nav.incubator')}  to="/farm/incubator"  onClick={onClose} />
            <SidebarNavItem icon={Syringe}   iconColor="dark:text-fuchsia-400" label={t('farm.nav.vet')}        to="/farm/vet"        onClick={onClose} />
            <SidebarNavItem icon={Heart}     iconColor="dark:text-rose-400"    label={t('farm.nav.reproduction')} to="/farm/reproduction" onClick={onClose} />
            <SidebarNavItem icon={QrCode}    iconColor="dark:text-slate-300"   label={t('farm.nav.qr')}         to="/farm/qr"         onClick={onClose} />
            <SidebarNavItem icon={Sparkles}  iconColor="dark:text-purple-400"  label={t('farm.nav.advisor')}    to="/farm/advisor"    onClick={onClose} />
          </>
        ) : (
          <>
            {/* ── Каталог ── */}
            <SidebarGroupLabel label={t('nav.groupCatalog')} />
            {PRODUCT === 'rental' ? (
              <>
                <SidebarNavItem icon={KeyRound} iconColor="dark:text-amber-400" label={t('rental.nav.items', 'Объекты аренды')} to="/rental/items" onClick={onClose} />
                <SidebarNavItem icon={Wrench}   iconColor="dark:text-rose-400"  label={t('rental.nav.maintenance', 'Тех. обслуживание')} to="/rental/maintenance" onClick={onClose} />
              </>
            ) : (
              <>
                <NavItemGated icon={ServiceIcon} iconColor="dark:text-purple-400"  label={t('nav.services')}  to="/services"  feature={null}       module="services"  onClick={onClose} />
                {PRODUCT !== 'cleaning' && PRODUCT !== 'beauty' && (
                  <NavItemGated icon={Package}     iconColor="dark:text-orange-400"  label={t('nav.inventory')} to="/inventory" feature="inventory"  module="inventory" onClick={onClose} />
                )}
              </>
            )}
          </>
        )}

        {/* Маркетинг — скрыт пока модуль не готов. Конфиг фичи остаётся
            в features.ts для админ-панели. Чтобы вернуть: убрать `false &&` */}
        {false && PRODUCT !== 'farm' && (
          <>
            {/* ── Маркетинг ── */}
            <SidebarGroupLabel label={t('nav.groupMarketing')} />
            <NavItemGated icon={Megaphone} iconColor="dark:text-pink-400" label={t('nav.marketing')} to="/marketing" feature="marketing" module="marketing" onClick={onClose} />
          </>
        )}

        {/* ── Команда ── */}
        {/* Сотрудники команды и владельцы видят пункт всегда. Остальным — по фиче (план Pro+) */}
        {(teamScope.isMember || teamScope.isOwner || teamScope.isTeamOnly) ? (
          <>
            <SidebarGroupLabel label={t('nav.groupTeam')} />
            <SidebarNavItem icon={UsersRound} iconColor="dark:text-cyan-400" label={t('nav.team')} to="/team" onClick={onClose} />
          </>
        ) : (
          <>
            <SidebarGroupLabel label={t('nav.groupTeam')} />
            <NavItemGated icon={UsersRound} iconColor="dark:text-cyan-400" label={t('nav.team')} to="/team" feature="teams" onClick={onClose} />
          </>
        )}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* Карточка тарифа: ссылка на /billing с прогрессом подписки.
          Поддержка/Настройки/Админ переехали в TopBar (на десктопе) и в BottomNav More (на мобиле). */}
      <PlanCard />
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
  end?: boolean       // точное совпадение пути (для роутов-родителей типа /farm)
}

const SidebarNavItem = memo(function SidebarNavItem({ icon: Icon, iconColor, label, to, onClick, highlight, end }: SidebarNavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
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
