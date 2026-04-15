import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { useAuth } from '@/contexts/AuthContext'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { initMiniApp, isTelegramMiniApp } from '@/lib/telegramWebApp'
import { useAppointmentsRealtime } from '@/hooks/useAppointmentsRealtime'
import { useClientsRealtime } from '@/hooks/useClientsRealtime'
import { useDynamicFavicon } from '@/hooks/useDynamicFavicon'
import { useProfile } from '@/hooks/useProfile'
import { supabase } from '@/lib/supabase'

const inTelegram = isTelegramMiniApp()

// Маршруты, которые занимают весь экран без padding-контейнера
const FULLSCREEN_ROUTES = ['/orders/pos']

export function AppLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const isFullscreen = FULLSCREEN_ROUTES.includes(location.pathname)
  const queryClient = useQueryClient()
  const { data: existingProfile } = useProfile()

  useAppointmentsRealtime()
  useClientsRealtime()
  useDynamicFavicon()

  // Expand to full screen if opened inside Telegram Mini App + track safe area insets
  useEffect(() => {
    if (!isTelegramMiniApp()) return
    const tg = window.Telegram!.WebApp

    const applyInsets = () => {
      const top = (tg.safeAreaInset?.top ?? 0) + (tg.contentSafeAreaInset?.top ?? 0)
      document.documentElement.style.setProperty('--app-tg-top-inset', `${top}px`)
    }

    initMiniApp()
    applyInsets()
    tg.onEvent?.('safeAreaChanged', applyInsets)
    tg.onEvent?.('contentSafeAreaChanged', applyInsets)
    return () => {
      tg.offEvent?.('safeAreaChanged', applyInsets)
      tg.offEvent?.('contentSafeAreaChanged', applyInsets)
    }
  }, [])

  // Use user-specific localStorage key so different accounts don't share the flag
  const lsKey = user ? `ezze_onboarded_${user.id}` : null
  const [onboardingDone, setOnboardingDone] = useState(() =>
    lsKey ? localStorage.getItem(lsKey) === '1' : false
  )

  // Show onboarding if: user exists, not previously onboarded in DB, and not dismissed this session
  // В TG-контексте мастер проходит SpecialtyStep через RegisterPage — полный визард не нужен
  const showOnboarding = !onboardingDone && user && user.onboarded !== true && !inTelegram

  // Данные для предзаполнения визарда (телефон и язык из Telegram-регистрации)
  const [wizardPrefill] = useState<{ phone?: string; language?: string; name?: string } | undefined>(() => {
    const phone = sessionStorage.getItem('ezze_prefill_phone') || ''
    const lang  = sessionStorage.getItem('ezze_prefill_lang')  || ''
    const name  = sessionStorage.getItem('ezze_prefill_name')  || ''
    if (phone) sessionStorage.removeItem('ezze_prefill_phone')
    if (lang)  sessionStorage.removeItem('ezze_prefill_lang')
    if (name)  sessionStorage.removeItem('ezze_prefill_name')
    return (phone || lang || name) ? { phone: phone || undefined, language: lang || undefined, name: name || undefined } : undefined
  })

  const handleOnboardingComplete = () => {
    if (lsKey) localStorage.setItem(lsKey, '1')
    setOnboardingDone(true)
    queryClient.invalidateQueries({ queryKey: ['master_profile'] })

    // Отправить приветствие в Telegram после завершения онбординга
    const tgNotifyId = sessionStorage.getItem('ezze_tg_notify_id')
    if (tgNotifyId) {
      sessionStorage.removeItem('ezze_tg_notify_id')
      const name = wizardPrefill?.name || user?.name || ''
      const lang = wizardPrefill?.language || 'ru'
      supabase.functions.invoke('tg-master-welcome', {
        body: {
          tg_chat_id: tgNotifyId,
          name,
          lang,
          product: import.meta.env.VITE_PRODUCT || 'beauty',
          app_url: import.meta.env.VITE_APP_URL || 'https://pro.ezze.site',
        },
      }).catch(() => { /* non-critical */ })
    }
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Desktop Sidebar — только lg+ */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0">
        <Sidebar />
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden lg:pl-60">
        <TopBar />
        <main className={isFullscreen ? 'flex-1 overflow-hidden flex flex-col' : 'flex-1 overflow-y-auto overflow-x-hidden'}>
          {isFullscreen ? (
            <Outlet />
          ) : (
            /* pb-20 на мобиле — отступ под нижнюю панель; pt-safe в Telegram — под нотч */
            <div className="container max-w-6xl mx-auto px-3 py-4 pb-20 lg:px-6 lg:py-6 lg:pb-6">
              <Outlet />
            </div>
          )}
        </main>
      </div>

      {/* Нижняя навигация — только на мобиле (lg:hidden внутри компонента) */}
      <BottomNav />

      {showOnboarding && (
        <OnboardingWizard
          open={true}
          onComplete={handleOnboardingComplete}
          prefill={{
            name:     wizardPrefill?.name     || existingProfile?.display_name || user?.name || '',
            phone:    wizardPrefill?.phone    || existingProfile?.phone        || '',
            city:     existingProfile?.city    || '',
            address:  existingProfile?.address || '',
            language: wizardPrefill?.language,
          }}
        />
      )}
    </div>
  )
}
