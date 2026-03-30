import { Suspense, lazy, useEffect } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'

/** Всегда → Календарь */
function DefaultRedirect() {
  return <Navigate to="/calendar" replace />
}
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { AuthProvider } from '@/contexts/AuthContext'
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
import { NotFoundPage } from '@/pages/NotFoundPage'

// Lazy pages — грузятся только при переходе (редко посещаемые)
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage').then(m => ({ default: m.ProfilePage })))
const InventoryPage = lazy(() => import('@/pages/inventory/InventoryPage').then(m => ({ default: m.InventoryPage })))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const AdminPage = lazy(() => import('@/pages/admin/AdminPage').then(m => ({ default: m.AdminPage })))
const TeamPage = lazy(() => import('@/pages/team/TeamPage').then(m => ({ default: m.TeamPage })))
const JoinTeamPage = lazy(() => import('@/pages/team/JoinTeamPage').then(m => ({ default: m.JoinTeamPage })))
const TeamAnalyticsPage = lazy(() => import('@/pages/team/TeamAnalyticsPage').then(m => ({ default: m.TeamAnalyticsPage })))
const PromoCodesPage = lazy(() => import('@/pages/promo/PromoCodesPage').then(m => ({ default: m.PromoCodesPage })))
const ReviewsPage = lazy(() => import('@/pages/reviews/ReviewsPage').then(m => ({ default: m.ReviewsPage })))
const BillingPage = lazy(() => import('@/pages/billing/BillingPage').then(m => ({ default: m.BillingPage })))
const PublicBookingPage = lazy(() => import('@/pages/booking/PublicBookingPage').then(m => ({ default: m.PublicBookingPage })))
const CancelBookingPage = lazy(() => import('@/pages/booking/CancelBookingPage').then(m => ({ default: m.CancelBookingPage })))
const TeamBookingPage = lazy(() => import('@/pages/booking/TeamBookingPage').then(m => ({ default: m.TeamBookingPage })))
const ClientCabinetPage = lazy(() => import('@/pages/booking/ClientCabinetPage').then(m => ({ default: m.ClientCabinetPage })))
const MasterSearchPage = lazy(() => import('@/pages/booking/MasterSearchPage').then(m => ({ default: m.MasterSearchPage })))
const MiniAppLayout = lazy(() => import('@/components/layout/MiniAppLayout').then(m => ({ default: m.MiniAppLayout })))
const TelegramEntryPage = lazy(() => import('@/pages/tg/TelegramEntryPage').then(m => ({ default: m.TelegramEntryPage })))
const PhoneSharePage = lazy(() => import('@/pages/tg/PhoneSharePage').then(m => ({ default: m.PhoneSharePage })))
const SupportPage = lazy(() => import('@/pages/support/SupportPage'))
const LoyaltyPage = lazy(() => import('@/pages/loyalty/LoyaltyPage'))
const AIAssistantPage = lazy(() => import('@/pages/ai/AIAssistantPage').then(m => ({ default: m.AIAssistantPage })))

const router = createBrowserRouter([
  // Public routes
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/book/team/:teamSlug', element: <TeamBookingPage /> },
  { path: '/book/:masterId', element: <PublicBookingPage /> },
  { path: '/cancel/:token', element: <CancelBookingPage /> },
  { path: '/join/:code', element: <JoinTeamPage /> },

  // Client Mini App routes (no auth required)
  {
    path: '/my',
    element: <MiniAppLayout />,
    children: [
      { index: true, element: <ClientCabinetPage /> },
    ],
  },

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
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'services', element: <ServicesPage /> },
      { path: 'schedule', element: <SchedulePage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: 'team', element: <TeamPage /> },
      { path: 'team/analytics', element: <TeamAnalyticsPage /> },
      { path: 'promo-codes', element: <PromoCodesPage /> },
      { path: 'reviews', element: <ReviewsPage /> },
      { path: 'billing', element: <BillingPage /> },
      { path: 'support', element: <SupportPage /> },
      { path: 'loyalty', element: <LoyaltyPage /> },
      { path: 'ai', element: <AIAssistantPage /> },
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
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none"><rect width="32" height="32" fill="${hslColor}"/><polygon points="17.3,2.7 4,18.7 16,18.7 14.7,29.3 28,13.3 16,13.3" fill="white"/></svg>`
    const faviconUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach(l => l.parentNode?.removeChild(l))
    const faviconLink = document.createElement('link')
    faviconLink.rel = 'icon'; faviconLink.type = 'image/svg+xml'
    faviconLink.setAttribute('sizes', 'any'); faviconLink.href = faviconUrl
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
        <Suspense fallback={<LoadingSpinner fullScreen />}>
          <RouterProvider router={router} />
        </Suspense>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  )
}
