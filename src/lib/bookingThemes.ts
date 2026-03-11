import type { CSSProperties } from 'react'

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
