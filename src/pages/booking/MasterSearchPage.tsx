import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, X, ChevronRight, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getFileUrl } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { initMiniApp, isTelegramMiniApp } from '@/lib/telegramWebApp'
import { useEffect } from 'react'

interface MasterResult {
  booking_slug: string
  profession: string | null
  avatar: string | null
  user: { name: string } | null
}

export function MasterSearchPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState('')

  // Параметры из бота (для передачи в страницу записи)
  const tgPhone    = searchParams.get('tg_phone') || ''
  const tgName     = searchParams.get('tg_name')  || ''
  const tgId       = searchParams.get('tg_id')    || ''

  useEffect(() => {
    if (isTelegramMiniApp()) initMiniApp()
  }, [])

  const { data: masters = [], isLoading } = useQuery<MasterResult[]>({
    queryKey: ['master_search'],
    queryFn: async () => {
      const { data } = await supabase
        .from('master_profiles')
        .select('booking_slug, profession, avatar, user:users(name)')
        .not('booking_slug', 'is', null)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(200)
      return (data ?? []) as unknown as MasterResult[]
    },
    staleTime: 2 * 60_000,
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return masters
    return masters.filter((m) => {
      const name = (m.user?.name ?? '').toLowerCase()
      const prof = (m.profession ?? '').toLowerCase()
      return name.includes(q) || prof.includes(q)
    })
  }, [masters, query])

  const openBooking = (slug: string) => {
    const params = new URLSearchParams()
    if (tgPhone) params.set('tg_phone', tgPhone)
    if (tgName)  params.set('tg_name',  tgName)
    if (tgId)    params.set('tg_id',    tgId)
    const qs = params.toString()
    navigate(`/book/${slug}${qs ? '?' + qs : ''}`)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 pt-4 pb-3 space-y-3">
        <h1 className="text-lg font-semibold">Найти мастера</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Имя или специальность..."
            className="pl-9 pr-9"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-border">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-11 w-11 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <User className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {query ? 'Мастера не найдены' : 'Нет доступных мастеров'}
            </p>
            {query && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                Попробуйте другой запрос
              </p>
            )}
          </div>
        ) : (
          filtered.map((master) => {
            const name = master.user?.name ?? 'Мастер'
            const avatarUrl = master.avatar
              ? getFileUrl('master_profiles', master.avatar)
              : undefined
            const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

            return (
              <button
                key={master.booking_slug}
                type="button"
                onClick={() => openBooking(master.booking_slug)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 active:bg-muted transition-colors text-left"
              >
                <Avatar className="h-11 w-11 shrink-0">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="text-sm font-medium bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm leading-tight truncate">{name}</p>
                  {master.profession && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {master.profession}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              </button>
            )
          })
        )}
      </div>

      {/* Count */}
      {!isLoading && filtered.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-4">
          {filtered.length} {filtered.length === 1 ? 'мастер' : filtered.length < 5 ? 'мастера' : 'мастеров'}
        </p>
      )}
    </div>
  )
}
