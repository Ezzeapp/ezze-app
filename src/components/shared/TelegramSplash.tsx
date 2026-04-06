import { Zap } from 'lucide-react'
import { useAppSettings } from '@/hooks/useAppSettings'

/**
 * Брендовый экран загрузки для Telegram Mini App.
 * Показывается вместо обычного спиннера пока идёт TG-аутентификация.
 */
export function TelegramSplash() {
  const { data: settings } = useAppSettings()

  // Читаем кешированный цвет сразу из localStorage — без ожидания API.
  // Это предотвращает мигание от дефолтного indigo к фактическому цвету.
  const cachedColor: string | null =
    typeof window !== 'undefined'
      ? localStorage.getItem('ezze_primary_cache')
      : null

  // Inline-style перекрывает bg-primary и применяется мгновенно.
  const bgStyle = cachedColor ? { backgroundColor: cachedColor } : undefined
  const dotStyle = cachedColor ? { backgroundColor: cachedColor, opacity: 0.8 } : undefined
  const glowStyle = cachedColor ? { backgroundColor: cachedColor, opacity: 0.2 } : undefined

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background z-50 gap-6 animate-in fade-in duration-300">

      {/* Логотип */}
      <div className="relative">
        <div
          style={bgStyle}
          className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary shadow-2xl overflow-hidden"
        >
          {settings?.logo_url
            ? <img src={settings.logo_url} alt="" className="h-24 w-24 object-cover" />
            : <Zap className="h-12 w-12 text-primary-foreground" />
          }
        </div>
        {/* Мягкое свечение за логотипом */}
        <div
          style={glowStyle}
          className="absolute inset-0 rounded-3xl bg-primary/20 blur-xl -z-10 scale-110"
        />
      </div>

      {/* Название платформы */}
      <h1 className="text-2xl font-bold text-foreground tracking-tight">
        {settings?.platform_name ?? 'Ezze'}
      </h1>

      {/* Анимированные точки */}
      <div className="flex gap-2 items-center">
        <span style={dotStyle} className="h-2 w-2 rounded-full bg-primary/80 animate-bounce [animation-delay:-0.32s]" />
        <span style={dotStyle} className="h-2 w-2 rounded-full bg-primary/80 animate-bounce [animation-delay:-0.16s]" />
        <span style={dotStyle} className="h-2 w-2 rounded-full bg-primary/80 animate-bounce" />
      </div>

    </div>
  )
}
