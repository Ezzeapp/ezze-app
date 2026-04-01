import { Zap } from 'lucide-react'
import { useAppSettings } from '@/hooks/useAppSettings'

/**
 * Брендовый экран загрузки для Telegram Mini App.
 * Показывается вместо обычного спиннера пока идёт TG-аутентификация.
 */
export function TelegramSplash() {
  const { data: settings } = useAppSettings()

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background z-50 gap-6 animate-in fade-in duration-300">

      {/* Логотип */}
      <div className="relative">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary shadow-2xl overflow-hidden">
          {settings?.logo_url
            ? <img src={settings.logo_url} alt="" className="h-24 w-24 object-cover" />
            : <Zap className="h-12 w-12 text-primary-foreground" />
          }
        </div>
        {/* Мягкое свечение за логотипом */}
        <div className="absolute inset-0 rounded-3xl bg-primary/20 blur-xl -z-10 scale-110" />
      </div>

      {/* Название платформы */}
      <h1 className="text-2xl font-bold text-foreground tracking-tight">
        {settings?.platform_name ?? 'Ezze'}
      </h1>

      {/* Анимированные точки */}
      <div className="flex gap-2 items-center">
        <span className="h-2 w-2 rounded-full bg-primary/80 animate-bounce [animation-delay:-0.32s]" />
        <span className="h-2 w-2 rounded-full bg-primary/80 animate-bounce [animation-delay:-0.16s]" />
        <span className="h-2 w-2 rounded-full bg-primary/80 animate-bounce" />
      </div>

    </div>
  )
}
