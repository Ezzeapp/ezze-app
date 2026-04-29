import { Suspense, lazy, useEffect } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { PRODUCT } from '@/lib/config'
import { useHomeScreenConfig } from '@/hooks/useAppSettings'
import { HomeScreen } from '@/pages/home/HomeScreen'
import { HybridLight } from '@/pages/home/hybrids/HybridLight'
import { HybridDense } from '@/pages/home/hybrids/HybridDense'
import { HybridBento } from '@/pages/home/hybrids/HybridBento'

/** Главная страница: рендерится по mode из home_screen_config */
function DefaultRedirect() {
  const { data: config } = useHomeScreenConfig()
  switch (config?.mode) {
    case 'tiles':         return <HomeScreen />
    case 'hybrid_light':  return <HybridLight />
    case 'hybrid_dense':  return <HybridDense />
    case 'hybrid_bento':  return <HybridBento />
  }
  // sidebar-режим (или ещё не загрузилось) — редиректим на основной раздел продукта
  if (PRODUCT === 'cleaning') return <Navigate to="/orders" replace />
  if (PRODUCT === 'workshop') return <Navigate to="/orders" replace />
  if (PRODUCT === 'farm')     return <Navigate to="/farm" replace />
  return <Navigate to="/calendar" replace />
}
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { AuthProvider } from '@/contexts/AuthContext'
import { TeamProvider } from '@/contexts/TeamContext'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppLayout } from '@/components/layout/AppLayout'
import { Toaster } from '@/components/shared/Toaster'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useAppSettings } from '@/hooks/useAppSettings'
import { RealtimeSync } from '@/providers/RealtimeProvider'

// Static pages — всегда в главном бандле (нужны сразу или часто)
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { CalendarPage } from '@/pages/calendar/CalendarPage'
import { ClientsPage } from '@/pages/clients/ClientsPage'
import { SchedulePage } from '@/pages/schedule/SchedulePage'
import { ServicesPage } from '@/pages/services/ServicesPage'
import { CleaningServicesPage } from '@/pages/services/CleaningServicesPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

// Lazy pages — грузятся только при переходе (редко посещаемые)
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage').then(m => ({ default: m.ProfilePage })))
const InventoryPage = lazy(() => import('@/pages/inventory/InventoryPage').then(m => ({ default: m.InventoryPage })))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const AdminPage = lazy(() => import('@/pages/admin/AdminPage').then(m => ({ default: m.AdminPage })))
const TeamPage = lazy(() => import('@/pages/team/TeamPage').then(m => ({ default: m.TeamPage })))
const JoinTeamPage = lazy(() => import('@/pages/team/JoinTeamPage').then(m => ({ default: m.JoinTeamPage })))
const TeamAnalyticsPage = lazy(() => import('@/pages/team/TeamAnalyticsPage').then(m => ({ default: m.TeamAnalyticsPage })))
const MarketingPage = lazy(() => import('@/pages/marketing/MarketingPage').then(m => ({ default: m.MarketingPage })))
const PromoPage = lazy(() => import('@/pages/promo/PromoPage').then(m => ({ default: m.PromoPage })))
const LoyaltyPage = lazy(() => import('@/pages/loyalty/LoyaltyPage').then(m => ({ default: m.LoyaltyPage })))
const BillingPage = lazy(() => import('@/pages/billing/BillingPage').then(m => ({ default: m.BillingPage })))
const PublicBookingPage = lazy(() => import('@/pages/booking/PublicBookingPage').then(m => ({ default: m.PublicBookingPage })))
const CancelBookingPage = lazy(() => import('@/pages/booking/CancelBookingPage').then(m => ({ default: m.CancelBookingPage })))
const TeamBookingPage = lazy(() => import('@/pages/booking/TeamBookingPage').then(m => ({ default: m.TeamBookingPage })))
const ClientCabinetPage = lazy(() => import('@/pages/booking/ClientCabinetPage').then(m => ({ default: m.ClientCabinetPage })))
const ClientRegisterPage = lazy(() => import('@/pages/booking/ClientRegisterPage').then(m => ({ default: m.ClientRegisterPage })))
const MasterSearchPage = lazy(() => import('@/pages/booking/MasterSearchPage').then(m => ({ default: m.MasterSearchPage })))
const PublicProfilePage = lazy(() => import('@/pages/public/PublicProfilePage').then(m => ({ default: m.PublicProfilePage })))
const MiniAppLayout = lazy(() => import('@/components/layout/MiniAppLayout').then(m => ({ default: m.MiniAppLayout })))
const TelegramEntryPage = lazy(() => import('@/pages/tg/TelegramEntryPage').then(m => ({ default: m.TelegramEntryPage })))
const PhoneSharePage = lazy(() => import('@/pages/tg/PhoneSharePage').then(m => ({ default: m.PhoneSharePage })))
const SupportPage = lazy(() => import('@/pages/support/SupportPage'))
const AIAssistantPage = lazy(() => import('@/pages/ai/AIAssistantPage').then(m => ({ default: m.AIAssistantPage })))
const OrdersListPage = lazy(() => import('@/pages/orders/OrdersListPage').then(m => ({ default: m.OrdersListPage })))
const OrderFormPage = lazy(() => import('@/pages/orders/OrderFormPage').then(m => ({ default: m.OrderFormPage })))
const OrderDetailPage = lazy(() => import('@/pages/orders/OrderDetailPage').then(m => ({ default: m.OrderDetailPage })))
const POSPage = lazy(() => import('@/pages/orders/POSPage').then(m => ({ default: m.POSPage })))
const OrderWizardPage = lazy(() => import('@/pages/orders/OrderWizardPage').then(m => ({ default: m.OrderWizardPage })))
const OrderDnDPage = lazy(() => import('@/pages/orders/OrderDnDPage').then(m => ({ default: m.OrderDnDPage })))
const CleaningStatsPage = lazy(() => import('@/pages/cleaning/CleaningStatsPage').then(m => ({ default: m.CleaningStatsPage })))
const CleaningReportsPage = lazy(() => import('@/pages/cleaning/CleaningReportsPage').then(m => ({ default: m.CleaningReportsPage })))
const CleaningTrackPage = lazy(() => import('@/pages/orders/CleaningTrackPage').then(m => ({ default: m.CleaningTrackPage })))
const DeliveryPage = lazy(() => import('@/pages/cleaning/DeliveryPage').then(m => ({ default: m.DeliveryPage })))
const WorkshopOrdersListPage = lazy(() => import('@/pages/workshop/WorkshopOrdersListPage').then(m => ({ default: m.WorkshopOrdersListPage })))
const WorkshopOrderFormPage  = lazy(() => import('@/pages/workshop/WorkshopOrderFormPage').then(m => ({ default: m.WorkshopOrderFormPage })))
const WorkshopOrderDetailPage = lazy(() => import('@/pages/workshop/WorkshopOrderDetailPage').then(m => ({ default: m.WorkshopOrderDetailPage })))
const WorkshopTrackPage       = lazy(() => import('@/pages/workshop/WorkshopTrackPage').then(m => ({ default: m.WorkshopTrackPage })))
const WorkshopApprovePage     = lazy(() => import('@/pages/workshop/WorkshopApprovePage').then(m => ({ default: m.WorkshopApprovePage })))
const WorkshopStatsPage       = lazy(() => import('@/pages/workshop/WorkshopStatsPage').then(m => ({ default: m.WorkshopStatsPage })))
const ClinicLabPage       = lazy(() => import('@/pages/clinic/LabPage').then(m => ({ default: m.LabPage })))
const ClinicPharmacyPage  = lazy(() => import('@/pages/clinic/PharmacyPage').then(m => ({ default: m.PharmacyPage })))
const ClinicWardPage      = lazy(() => import('@/pages/clinic/WardPage').then(m => ({ default: m.WardPage })))
const ClinicHospPage      = lazy(() => import('@/pages/clinic/HospitalizationsPage').then(m => ({ default: m.HospitalizationsPage })))
const ClinicSurgeryPage   = lazy(() => import('@/pages/clinic/SurgeryPage').then(m => ({ default: m.SurgeryPage })))
const ClinicNutritionPage = lazy(() => import('@/pages/clinic/NutritionPage').then(m => ({ default: m.NutritionPage })))
const FarmDashboardPage   = lazy(() => import('@/pages/farm/FarmDashboardPage').then(m => ({ default: m.FarmDashboardPage })))
const FarmAnimalsPage     = lazy(() => import('@/pages/farm/AnimalsPage').then(m => ({ default: m.AnimalsPage })))
const FarmAnimalDetailPage= lazy(() => import('@/pages/farm/AnimalDetailPage').then(m => ({ default: m.AnimalDetailPage })))
const FarmGroupsPage      = lazy(() => import('@/pages/farm/GroupsPage').then(m => ({ default: m.GroupsPage })))
const FarmFieldsPage      = lazy(() => import('@/pages/farm/FieldsPage').then(m => ({ default: m.FieldsPage })))
const FarmFeedStockPage   = lazy(() => import('@/pages/farm/FeedStockPage').then(m => ({ default: m.FeedStockPage })))
const FarmProductionPage  = lazy(() => import('@/pages/farm/ProductionPage').then(m => ({ default: m.ProductionPage })))
const FarmExpensesPage    = lazy(() => import('@/pages/farm/ExpensesPage').then(m => ({ default: m.ExpensesPage })))
const FarmSalesPage       = lazy(() => import('@/pages/farm/SalesPage').then(m => ({ default: m.SalesPage })))
const FarmEquipmentPage   = lazy(() => import('@/pages/farm/EquipmentPage').then(m => ({ default: m.EquipmentPage })))
const FarmPasturesPage    = lazy(() => import('@/pages/farm/PasturesPage').then(m => ({ default: m.PasturesPage })))
const FarmIncubatorPage   = lazy(() => import('@/pages/farm/IncubatorPage').then(m => ({ default: m.IncubatorPage })))
const FarmVetCalendarPage = lazy(() => import('@/pages/farm/VetCalendarPage').then(m => ({ default: m.VetCalendarPage })))
const FarmAdvisorPage     = lazy(() => import('@/pages/farm/AdvisorPage').then(m => ({ default: m.AdvisorPage })))
const FarmQrTagsPage      = lazy(() => import('@/pages/farm/QrTagsPage').then(m => ({ default: m.QrTagsPage })))
const FarmQrScannerPage   = lazy(() => import('@/pages/farm/QrScannerPage').then(m => ({ default: m.QrScannerPage })))
const FarmReproductionPage = lazy(() => import('@/pages/farm/ReproductionPage').then(m => ({ default: m.ReproductionPage })))

const router = createBrowserRouter([
  // Public routes
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/book/team/:teamSlug', element: <TeamBookingPage /> },
  { path: '/book/:masterId', element: <PublicBookingPage /> },
  { path: '/p/:slug', element: <PublicProfilePage /> },
  { path: '/cancel/:token', element: <CancelBookingPage /> },
  { path: '/join/:code', element: <JoinTeamPage /> },
  { path: '/track/:number', element: PRODUCT === 'cleaning' ? <CleaningTrackPage /> : <WorkshopTrackPage /> },
  { path: '/approve/:token', element: <WorkshopApprovePage /> },

  // Client Mini App routes (no auth required)
  {
    path: '/my',
    element: <MiniAppLayout />,
    children: [
      { index: true, element: <ClientCabinetPage /> },
    ],
  },
  { path: '/client-register', element: <ClientRegisterPage /> },

  // Master search (public, for clients in Telegram)
  { path: '/search', element: <MasterSearchPage /> },

  // Telegram Mini App entry (no auth required — авторизует через tg-auth и редиректит)
  {
    path: '/tg',
    element: <MiniAppLayout />,
    children: [
      { index: true, element: <TelegramEntryPage /> },
      { path: 'phone', element: <PhoneSharePage /> },
    ],
  },

  // Protected routes
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <DefaultRedirect /> },
      { path: 'dashboard', element: PRODUCT === 'workshop' ? <Navigate to="/stats" replace /> : <DashboardPage /> },
      { path: 'profile', element: PRODUCT === 'cleaning' ? <Navigate to="/settings" replace /> : <ProfilePage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'services', element: PRODUCT === 'cleaning' ? <CleaningServicesPage /> : <ServicesPage /> },
      { path: 'schedule', element: PRODUCT === 'workshop' ? <Navigate to="/orders" replace /> : <SchedulePage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'calendar', element: PRODUCT === 'workshop' ? <Navigate to="/orders" replace /> : <CalendarPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: 'team', element: <TeamPage /> },
      { path: 'team/analytics', element: <TeamAnalyticsPage /> },
      { path: 'marketing', element: <MarketingPage /> },
      { path: 'promo', element: <PromoPage /> },
      { path: 'promo-codes', element: <Navigate to="/promo" replace /> },
      { path: 'reviews', element: <Navigate to="/marketing?tab=reviews" replace /> },
      { path: 'billing', element: <BillingPage /> },
      { path: 'support', element: <SupportPage /> },
      { path: 'loyalty', element: <LoyaltyPage /> },
      { path: 'ai', element: <AIAssistantPage /> },
      { path: 'orders',     element: PRODUCT === 'workshop' ? <WorkshopOrdersListPage /> : <OrdersListPage /> },
      { path: 'orders/new', element: PRODUCT === 'workshop' ? <WorkshopOrderFormPage /> : <OrderFormPage /> },
      { path: 'orders/pos', element: <POSPage /> },
      { path: 'orders/wizard', element: <OrderWizardPage /> },
      { path: 'orders/dnd', element: <OrderDnDPage /> },
      { path: 'orders/:id', element: PRODUCT === 'workshop' ? <WorkshopOrderDetailPage /> : <OrderDetailPage /> },
      ...(PRODUCT === 'cleaning' ? [
        { path: 'stats', element: <CleaningStatsPage /> },
        { path: 'reports', element: <CleaningReportsPage /> },
        { path: 'delivery', element: <DeliveryPage /> },
      ] : []),
      ...(PRODUCT === 'workshop' ? [
        { path: 'stats', element: <WorkshopStatsPage /> },
      ] : []),
      ...(PRODUCT === 'clinic' ? [
        { path: 'clinic/lab', element: <ClinicLabPage /> },
        { path: 'clinic/pharmacy', element: <ClinicPharmacyPage /> },
        { path: 'clinic/wards', element: <ClinicWardPage /> },
        { path: 'clinic/hospitalizations', element: <ClinicHospPage /> },
        { path: 'clinic/surgery', element: <ClinicSurgeryPage /> },
        { path: 'clinic/nutrition', element: <ClinicNutritionPage /> },
      ] : []),
      ...(PRODUCT === 'farm' ? [
        { path: 'farm',                 element: <FarmDashboardPage /> },
        { path: 'farm/animals',         element: <FarmAnimalsPage /> },
        { path: 'farm/animals/:id',     element: <FarmAnimalDetailPage /> },
        { path: 'farm/groups',          element: <FarmGroupsPage /> },
        { path: 'farm/fields',          element: <FarmFieldsPage /> },
        { path: 'farm/feed',            element: <FarmFeedStockPage /> },
        { path: 'farm/production',      element: <FarmProductionPage /> },
        { path: 'farm/expenses',        element: <FarmExpensesPage /> },
        { path: 'farm/sales',           element: <FarmSalesPage /> },
        { path: 'farm/equipment',       element: <FarmEquipmentPage /> },
        { path: 'farm/pastures',        element: <FarmPasturesPage /> },
        { path: 'farm/incubator',       element: <FarmIncubatorPage /> },
        { path: 'farm/vet',             element: <FarmVetCalendarPage /> },
        { path: 'farm/advisor',         element: <FarmAdvisorPage /> },
        { path: 'farm/qr',              element: <FarmQrTagsPage /> },
        { path: 'farm/qr/scan',         element: <FarmQrScannerPage /> },
        { path: 'farm/reproduction',    element: <FarmReproductionPage /> },
      ] : []),
    ],
  },

  // 404
  { path: '*', element: <NotFoundPage /> },
])

function AppSettingsInitializer() {
  const { data: appSettings } = useAppSettings()

  // Apply primary color CSS vars + favicon + font size whenever settings load/change
  useEffect(() => {
    if (!appSettings) return

    // Цвет
    const color = appSettings.primary_color
    document.documentElement.style.setProperty('--primary', color)
    document.documentElement.style.setProperty('--ring', color)
    document.documentElement.style.setProperty('--sidebar-primary', color)
    const hslColor = `hsl(${color})`
    try { localStorage.setItem('ezze_primary_cache', hslColor) } catch { /* ignore */ }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${hslColor}"/><polygon points="17.3,2.7 4,18.7 16,18.7 14.7,29.3 28,13.3 16,13.3" fill="white"/></svg>`
    const faviconUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach(l => l.parentNode?.removeChild(l))
    const faviconLink = document.createElement('link')
    faviconLink.rel = 'icon'; faviconLink.type = 'image/svg+xml'; faviconLink.href = faviconUrl
    document.head.appendChild(faviconLink)

    // Размер шрифта: мобильный — выбранный, десктоп — компактнее
    const mobileFontMap = { small: '14px', medium: '16px', large: '18px' }
    const desktopFontMap = { small: '13px', medium: '14px', large:  '15px' }
    document.documentElement.style.setProperty('--font-size-mobile', mobileFontMap[appSettings.font_size] ?? '16px')
    document.documentElement.style.setProperty('--font-size-desktop', desktopFontMap[appSettings.font_size] ?? '14px')
    // Убираем прямой override, теперь управляем через CSS переменные в index.css
    document.documentElement.style.removeProperty('font-size')
  }, [appSettings])

  // Prefetch lazy chunks in background after app loads
  useEffect(() => {
    const id = setTimeout(() => {
      import('@/pages/profile/ProfilePage')
      import('@/pages/inventory/InventoryPage')
      import('@/pages/settings/SettingsPage')
      import('@/pages/team/TeamPage')
      import('@/pages/admin/AdminPage')
    }, 3000)
    return () => clearTimeout(id)
  }, [])
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppSettingsInitializer />
      <RealtimeSync />
      <AuthProvider>
        <TeamProvider>
          <Suspense fallback={<LoadingSpinner fullScreen />}>
            <RouterProvider router={router} />
          </Suspense>
          <Toaster />
        </TeamProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
