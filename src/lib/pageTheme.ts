import type { PageSettings } from '@/types'

interface ThemePreset {
  bg:       string
  text:     string
  subtext:  string
  card:     string
  border:   string
  accent:   string
}

const PRESETS: Record<string, ThemePreset> = {
  minimal: {
    bg:      '#ffffff',
    text:    '#09090b',
    subtext: '#71717a',
    card:    '#f4f4f5',
    border:  '#e4e4e7',
    accent:  '#6366f1',
  },
  dark: {
    bg:      '#18181b',
    text:    '#fafafa',
    subtext: '#a1a1aa',
    card:    '#27272a',
    border:  '#3f3f46',
    accent:  '#a78bfa',
  },
  bold: {
    bg:      '#f0f4ff',
    text:    '#1e1b4b',
    subtext: '#4338ca',
    card:    '#e0e7ff',
    border:  '#c7d2fe',
    accent:  '#4f46e5',
  },
  elegant: {
    bg:      '#faf7f4',
    text:    '#1c1917',
    subtext: '#78716c',
    card:    '#f5f0eb',
    border:  '#e7e5e4',
    accent:  '#92400e',
  },
}

export function buildTheme(s?: PageSettings): Record<string, string> {
  const preset = PRESETS[s?.template ?? 'minimal'] ?? PRESETS.minimal
  return {
    '--page-bg':      s?.bg === 'custom' && s.bg_custom ? s.bg_custom : preset.bg,
    '--page-text':    preset.text,
    '--page-subtext': preset.subtext,
    '--page-card':    preset.card,
    '--page-border':  preset.border,
    '--page-accent':  s?.accent ?? preset.accent,
    '--btn-radius':
      s?.btn_shape === 'pill'   ? '9999px' :
      s?.btn_shape === 'square' ? '4px'    : '12px',
    '--page-font':    s?.font ?? 'inter',
  }
}

export const TEMPLATE_LIST = [
  { id: 'minimal',  label: 'Минимал',  bg: '#ffffff', accent: '#6366f1' },
  { id: 'dark',     label: 'Тёмный',   bg: '#18181b', accent: '#a78bfa' },
  { id: 'bold',     label: 'Смелый',   bg: '#f0f4ff', accent: '#4f46e5' },
  { id: 'elegant',  label: 'Элегант',  bg: '#faf7f4', accent: '#92400e' },
] as const
