import type { CSSProperties } from 'react'
import type { BookingSettings } from '@/types'

// Старые simple-палитры (на случай если booking_theme=simple-id)
export const BOOKING_THEMES = [
  { id: 'blue',   label: 'Синий',      primary: '221 83% 53%', fg: '0 0% 100%' },
  { id: 'violet', label: 'Фиолетовый', primary: '262 83% 58%', fg: '0 0% 100%' },
  { id: 'green',  label: 'Зелёный',    primary: '142 71% 45%', fg: '0 0% 100%' },
  { id: 'teal',   label: 'Бирюзовый',  primary: '172 66% 40%', fg: '0 0% 100%' },
  { id: 'orange', label: 'Оранжевый',  primary: '25 95% 53%',  fg: '0 0% 100%' },
  { id: 'pink',   label: 'Розовый',    primary: '330 81% 60%', fg: '0 0% 100%' },
  { id: 'red',    label: 'Красный',    primary: '0 72% 51%',   fg: '0 0% 100%' },
  { id: 'slate',  label: 'Тёмный',     primary: '215 20% 35%', fg: '0 0% 100%' },
]

export function getThemeVars(themeId?: string): CSSProperties {
  const theme = BOOKING_THEMES.find(t => t.id === themeId)
  if (!theme || themeId === 'blue') return {}
  return {
    '--primary': theme.primary,
    '--primary-foreground': theme.fg,
    '--ring': theme.primary,
  } as CSSProperties
}

// ── Темы страницы записи (Elegant / Glamour / Playful) ─────────────────────

const FONT_STACKS = {
  inter:      `'Inter', system-ui, sans-serif`,
  manrope:    `'Manrope', system-ui, sans-serif`,
  montserrat: `'Montserrat', system-ui, sans-serif`,
  playfair:   `'Playfair Display', 'Cormorant Garamond', Georgia, serif`,
} as const

const RADIUS = {
  square:  { btn: '8px',    card: '10px', input: '8px'    },
  rounded: { btn: '14px',   card: '18px', input: '12px'   },
  pill:    { btn: '9999px', card: '24px', input: '9999px' },
} as const

// Хексовый цвет → "r g b" для использования внутри rgba(var(--accent-rgb) / .5)
function hexToRgbTriplet(hex: string): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0').slice(0, 6)
  const num = parseInt(full, 16)
  if (Number.isNaN(num)) return '37 99 235'
  const r = (num >> 16) & 0xff
  const g = (num >> 8) & 0xff
  const b = num & 0xff
  return `${r} ${g} ${b}`
}

// Хексовый цвет → "H S% L%" для перекрытия --primary в tailwind hsl-стилях
function hexToHsl(hex: string): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0').slice(0, 6)
  const num = parseInt(full, 16)
  if (Number.isNaN(num)) return '221 83% 53%'
  const r = ((num >> 16) & 0xff) / 255
  const g = ((num >> 8) & 0xff) / 255
  const b = (num & 0xff) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let hh = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: hh = (g - b) / d + (g < b ? 6 : 0); break
      case g: hh = (b - r) / d + 2; break
      case b: hh = (r - g) / d + 4; break
    }
    hh /= 6
  }
  return `${Math.round(hh * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

const DEFAULTS = {
  theme:       'elegant' as const,
  accent:      '#1c1917',
  bg_style:    'light' as const,
  btn_shape:   'rounded' as const,
  font_family: 'inter' as const,
}

export function buildBookingTheme(settings?: BookingSettings | null): CSSProperties {
  const s = settings ?? {}
  const theme = s.theme ?? DEFAULTS.theme
  const accent = s.accent_color || DEFAULTS.accent
  const accentRgb = hexToRgbTriplet(accent)
  const radius = RADIUS[s.btn_shape ?? DEFAULTS.btn_shape]
  const font = FONT_STACKS[s.font_family ?? DEFAULTS.font_family]
  const serif = theme === 'glamour'
    ? `'Cormorant Garamond', 'Playfair Display', Georgia, serif`
    : (s.font_family === 'playfair' ? font : `'Manrope', 'Inter', sans-serif`)

  let palette: Record<string, string>

  if (theme === 'glamour') {
    palette = {
      '--bk-bg':          '#0e0d0c',
      '--bk-bg-image':    'none',
      '--bk-bg2':         '#15130f',
      '--bk-text':        '#f7f3ec',
      '--bk-subtext':     'rgba(247,243,236,0.55)',
      '--bk-card':        'rgba(247,243,236,0.04)',
      '--bk-card-border': 'rgba(247,243,236,0.10)',
      '--bk-accent-fg':   '#0e0d0c',
      '--bk-shadow':      '0 0 30px rgba(201,161,74,0.18), inset 0 0 0 1px rgba(201,161,74,0.4)',
      '--bk-divider':     'rgba(247,243,236,0.10)',
    }
  } else if (theme === 'playful') {
    // Сильнее насыщаем градиент чтобы тема была визуально различима;
    // декоративные «blobs» добавляются через ::before/::after в index.css.
    palette = {
      '--bk-bg':          '#FFF6FA',
      '--bk-bg-image':    'radial-gradient(at 20% 0%, rgba(251,207,232,0.85) 0%, transparent 55%), radial-gradient(at 80% 8%, rgba(186,230,253,0.85) 0%, transparent 55%), radial-gradient(at 50% 100%, rgba(254,240,138,0.65) 0%, transparent 55%), radial-gradient(at 0% 60%, rgba(167,243,208,0.65) 0%, transparent 55%)',
      '--bk-bg2':         '#ffffff',
      '--bk-text':        '#1f2937',
      '--bk-subtext':     '#6b7280',
      '--bk-card':        '#ffffff',
      '--bk-card-border': '#fce7f3',
      '--bk-accent-fg':   '#ffffff',
      '--bk-shadow':      '0 12px 40px -12px rgba(236,72,153,0.25)',
      '--bk-divider':     '#fce7f3',
    }
  } else {
    // Elegant Minimal (default) — учитываем bg_style
    const dark = s.bg_style === 'dark'
    palette = {
      '--bk-bg':          dark ? '#0c0a09' : '#fafaf9',
      '--bk-bg-image':    s.bg_style === 'gradient'
        ? 'radial-gradient(at 50% 0%, rgba(0,0,0,0.04), transparent 60%)'
        : 'none',
      '--bk-bg2':         dark ? '#15130f' : '#ffffff',
      '--bk-text':        dark ? '#fafaf9' : '#0c0a09',
      '--bk-subtext':     dark ? 'rgba(250,250,249,0.6)' : '#78716c',
      '--bk-card':        dark ? '#1c1917' : '#ffffff',
      '--bk-card-border': dark ? '#2a2522'  : '#e7e5e4',
      '--bk-accent-fg':   '#ffffff',
      '--bk-shadow':      '0 4px 20px rgba(0,0,0,0.05)',
      '--bk-divider':     dark ? '#2a2522' : '#e7e5e4',
    }
  }

  return {
    ...palette,
    '--bk-accent':        accent,
    '--bk-accent-rgb':    accentRgb,
    '--bk-radius-btn':    radius.btn,
    '--bk-radius-card':   radius.card,
    '--bk-radius-input':  radius.input,
    '--bk-font':          font,
    '--bk-serif':         serif,
    // Перекрываем shadcn-токены чтобы accent применялся к tailwind primary-классам
    '--primary':            hexToHsl(accent),
    '--primary-foreground': theme === 'glamour' ? '20 14% 4%' : '0 0% 100%',
    '--ring':               hexToHsl(accent),
    backgroundColor:      `var(--bk-bg)`,
    backgroundImage:      `var(--bk-bg-image)`,
    color:                `var(--bk-text)`,
    fontFamily:           `var(--bk-font)`,
  } as CSSProperties
}

// Хелперы для получения BookingSettings из master.page_settings
export function getBookingSettings(pageSettings: any): BookingSettings | undefined {
  if (!pageSettings || typeof pageSettings !== 'object') return undefined
  return (pageSettings.booking_settings ?? undefined) as BookingSettings | undefined
}
