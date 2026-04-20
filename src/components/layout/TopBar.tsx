import { useState, useEffect } from 'react'
import { LogOut, User, ExternalLink, Search, ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useHomeScreenConfig } from '@/hooks/useAppSettings'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { GlobalSearch } from '@/components/shared/GlobalSearch'

export function TopBar() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const { data: homeScreenConfig } = useHomeScreenConfig()
  const showHomeButton = homeScreenConfig?.mode === 'tiles' && location.pathname !== '/'

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'ME'

  return (
    <>
      <header className="border-b bg-background pt-tg-safe">
        <div className="flex h-14 items-center gap-4 px-4 lg:px-6">
        {/* Кнопка "← Главная" в tiles-режиме */}
        {showHomeButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground px-2"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="text-sm">{t('homeScreen.back')}</span>
          </Button>
        )}
        {/* Search trigger — slim input-like button on desktop, icon on mobile */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSearchOpen(true)}
          className="hidden sm:flex items-center gap-2 text-muted-foreground h-8 px-3 text-sm font-normal"
        >
          <Search className="h-3.5 w-3.5" />
          {t('search.placeholder')}
          <kbd className="ml-2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-60">
            ⌘K
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSearchOpen(true)}
          className="sm:hidden h-8 w-8"
        >
          <Search className="h-4 w-4" />
        </Button>

        <div className="ml-auto flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full hidden lg:flex">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar ? `http://127.0.0.1:8090/api/files/users/${user.id}/${user.avatar}?thumb=100x100` : undefined} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="mr-2 h-4 w-4" />
                {t('nav.profile')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <ExternalLink className="mr-2 h-4 w-4" />
                {t('nav.settings')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                {t('auth.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
