import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { initMiniApp, isTelegramMiniApp } from '@/lib/telegramWebApp'
import { Zap } from 'lucide-react'

/**
 * Лёгкий лейаут для клиентских страниц Telegram Mini App.
 * Не требует авторизации, адаптирует тему под Telegram.
 */
export function MiniAppLayout() {
  useEffect(() => {
    if (isTelegramMiniApp()) {
      initMiniApp()
    }
  }, [])

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <main className="flex-1">
        <Outlet />
      </main>
      <div className="border-t py-3 text-center shrink-0">
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
          Работает на <Zap className="h-3 w-3 text-primary" /> Ezze
        </p>
      </div>
    </div>
  )
}
