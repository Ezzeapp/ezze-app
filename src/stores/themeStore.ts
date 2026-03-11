export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'ezze-theme'

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const root = window.document.documentElement
  const resolved = theme === 'system' ? getSystemTheme() : theme
  root.classList.toggle('dark', resolved === 'dark')
}

export function getStoredTheme(): Theme {
  return (localStorage.getItem(STORAGE_KEY) as Theme) || 'light'
}

export function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
}

export function initTheme() {
  const theme = getStoredTheme()
  applyTheme(theme)

  if (theme === 'system') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      applyTheme('system')
    })
  }
}
