import { useState, useEffect } from 'react'
import { MoonStar, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getStoredTheme, setTheme, type Theme } from '@/stores/themeStore'

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)

  useEffect(() => {
    setTheme(theme)
  }, [theme])

  const toggle = () => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} title="Toggle theme">
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
    </Button>
  )
}
