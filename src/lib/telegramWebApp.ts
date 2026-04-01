/**
 * Утилиты для работы с Telegram Mini App (TWA)
 * Документация: https://core.telegram.org/bots/webapps
 */

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
  is_premium?: boolean
}

export interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: TelegramUser
    start_param?: string
    auth_date?: number
    hash?: string
    query_id?: string
  }
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  themeParams: {
    bg_color?: string
    text_color?: string
    hint_color?: string
    link_color?: string
    button_color?: string
    button_text_color?: string
    secondary_bg_color?: string
    header_bg_color?: string
    bottom_bar_bg_color?: string
    accent_text_color?: string
    section_bg_color?: string
    section_header_text_color?: string
    subtitle_text_color?: string
    destructive_text_color?: string
  }
  isExpanded: boolean
  viewportHeight: number
  viewportStableHeight: number
  headerColor: string
  backgroundColor: string
  isClosingConfirmationEnabled: boolean
  BackButton: {
    isVisible: boolean
    show: () => void
    hide: () => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
  }
  MainButton: {
    text: string
    color: string
    textColor: string
    isVisible: boolean
    isActive: boolean
    isProgressVisible: boolean
    setText: (text: string) => void
    show: () => void
    hide: () => void
    enable: () => void
    disable: () => void
    showProgress: (leaveActive?: boolean) => void
    hideProgress: () => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
  }
  isFullscreen: boolean
  safeAreaInset: { top: number; bottom: number; left: number; right: number }
  contentSafeAreaInset: { top: number; bottom: number; left: number; right: number }
  ready: () => void
  expand: () => void
  requestFullscreen: () => void
  exitFullscreen: () => void
  close: () => void
  onEvent: (eventType: string, callback: () => void) => void
  offEvent: (eventType: string, callback: () => void) => void
  showAlert: (message: string, callback?: () => void) => void
  showConfirm: (message: string, callback: (confirmed: boolean) => void) => void
  showPopup: (params: object, callback?: (id: string) => void) => void
  openLink: (url: string) => void
  openTelegramLink: (url: string) => void
  sendData: (data: string) => void
  requestContact: (callback: (shared: boolean, response: { contact?: { phone_number: string; first_name?: string } } | null) => void) => boolean | void
  switchInlineQuery: (query: string, choose_chat_types?: string[]) => void
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}

/** Проверить, запущено ли приложение внутри Telegram Mini App */
export function isTelegramMiniApp(): boolean {
  return !!(window.Telegram?.WebApp?.initData)
}

/** Получить данные пользователя Telegram (только в Mini App) */
export function getTelegramUser(): TelegramUser | null {
  return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null
}

/** Получить Telegram ID текущего пользователя */
export function getTelegramUserId(): string | null {
  const user = getTelegramUser()
  return user ? String(user.id) : null
}

/** Получить параметр startapp из URL Mini App */
export function getTelegramStartParam(): string | null {
  return window.Telegram?.WebApp?.initDataUnsafe?.start_param ?? null
}

/** Получить отображаемое имя пользователя Telegram */
export function getTelegramDisplayName(): string {
  const user = getTelegramUser()
  if (!user) return ''
  return [user.first_name, user.last_name].filter(Boolean).join(' ')
}

/** Получить цветовую схему из Telegram (light/dark) */
export function getTelegramColorScheme(): 'light' | 'dark' {
  return window.Telegram?.WebApp?.colorScheme ?? 'light'
}

/** Инициализировать Mini App — вызывать один раз при монтировании */
export function initMiniApp(): void {
  if (!window.Telegram?.WebApp) return
  window.Telegram.WebApp.ready()
  // Запросить полноэкранный режим (Bot API 8.0+) — убирает нативную шапку Telegram
  try {
    if (typeof window.Telegram.WebApp.requestFullscreen === 'function') {
      window.Telegram.WebApp.requestFullscreen()
    } else {
      window.Telegram.WebApp.expand()
    }
  } catch {
    // Fallback для версий Telegram, которые не поддерживают requestFullscreen
    try { window.Telegram.WebApp.expand() } catch { /* ignore */ }
  }
}

/** Получить язык пользователя из Telegram */
export function getTelegramLanguageCode(): string {
  return window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code ?? 'ru'
}

/** Закрыть Mini App */
export function closeMiniApp(): void {
  window.Telegram?.WebApp?.close()
}

/** Показать кнопку назад в Telegram */
export function showTelegramBackButton(callback: () => void): void {
  if (!window.Telegram?.WebApp?.BackButton) return
  window.Telegram.WebApp.BackButton.onClick(callback)
  window.Telegram.WebApp.BackButton.show()
}

/** Скрыть кнопку назад в Telegram */
export function hideTelegramBackButton(): void {
  window.Telegram?.WebApp?.BackButton?.hide()
}

/** Haptic feedback — при успешном действии */
export function hapticSuccess(): void {
  window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success')
}

/** Haptic feedback — при нажатии кнопки */
export function hapticImpact(): void {
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
}

/**
 * Сформировать ссылку для клиентов.
 * Клиентский бот: @ezzeprogo_bot
 * Формат: t.me/ezzeprogo_bot?start=book_{slug}
 */
export function buildClientBookingLink(bookingSlug: string): string {
  return `https://t.me/ezzeprogo_bot?start=book_${bookingSlug}`
}

/**
 * Сформировать ссылку на публичную запись команды через Telegram Mini App.
 * Формат: t.me/ezzeprogo_bot?start=team_{teamSlug}
 */
export function buildTeamBookingLink(teamSlug: string): string {
  return `https://t.me/ezzeprogo_bot?start=team_${teamSlug}`
}

/** Сформировать ссылку на личный кабинет клиента */
export function buildClientCabinetLink(): string {
  return `https://t.me/ezzeprogo_bot`
}
