import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, X, ChevronRight, User, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getFileUrl } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { initMiniApp, isTelegramMiniApp } from '@/lib/telegramWebApp'

interface MasterResult {
  booking_slug: string
  profession: string | null
  avatar: string | null
  user: { name: string } | null
}

interface TeamResult {
  id: string
  name: string
  slug: string
  description: string | null
  logo: string | null
}

export function MasterSearchPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState('')

  const tgPhone = searchParams.get('tg_phone') || ''
  const tgName  = searchParams.get('tg_name')  || ''
  const tgId    = searchParams.get('tg_id')    || ''

  useEffect(() => {
    if (isTelegramMiniApp()) initMiniApp()
  }, [])

  const { data: masters = [], isLoading: mastersLoading } = useQuery<MasterResult[]>({
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

  const { data: teams = [], isLoading: teamsLoading } = useQuery<TeamResult[]>({
    queryKey: ['public_teams_search'],
    queryFn: async () => {
      const { data } = await supabase
        .from('teams')
        .select('id, name, slug, description, logo')
        .eq('is_public', true)
        .order('name')
      return (data ?? []) as TeamResult[]
    },
    staleTime: 2 * 60_000,
  })

  const isLoading = mastersLoading || teamsLoading

  const q = query.trim().toLowerCase()

  const filteredTeams = useMemo(() => {
    if (!q) return teams
    return teams.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.description ?? '').toLowerCase().includes(q)
    )
  }, [teams, q])

  const filteredMasters = useMemo(() => {
    if (!q) return masters
    return masters.filter(m => {
      const name = (m.user?.name ?? '').toLowerCase()
      const prof = (m.profession ?? '').toLowerCase()
      return name.includes(q) || prof.includes(q)
    })
  }, [masters, q])

  const totalCount = filteredTeams.length + filteredMasters.length
  const hasBoth = filteredTeams.length > 0 && filteredMasters.length > 0

  const buildQs = () => {
    const p = new URLSearchParams()
    if (tgPhone) p.set('tg_phone', tgPhone)
    if (tgName)  p.set('tg_name',  tgName)
    if (tgId)    p.set('tg_id',    tgId)
    const s = p.toString()
    return s ? '?' + s : ''
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
            placeholder="Имя, специальность или команда..."
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
        ) : totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <User className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {query ? 'Ничего не найдено' : 'Нет доступных мастеров'}
            </p>
            {query && (
              <p className="text-xs text-muted-foreground/60 mt-1">Попробуйте другой запрос</p>
            )}
          </div>
        ) : (
          <>
            {/* ── Teams ── */}
            {filteredTeams.length > 0 && (
              <>
                {hasBoth && (
                  <div className="px-4 py-2 bg-muted/30">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Команды</span>
                  </div>
                )}
                {filteredTeams.map((team) => {
                  const logoUrl = team.logo ? getFileUrl('teams', team.logo) : undefined
                  const initials = team.name.slice(0, 2).toUpperCase()
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => navigate(`/book/team/${team.slug}${buildQs()}`)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 active:bg-muted transition-colors text-left"
                    >
                      <div className="h-11 w-11 shrink-0 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                        {logoUrl
                          ? <img src={logoUrl} alt={team.name} className="h-11 w-11 object-cover" />
                          : <span className="text-sm font-semibold text-primary">{initials}</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm leading-tight truncate">{team.name}</p>
                          <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium text-primary/70 bg-primary/10 rounded-full px-1.5 py-0.5 leading-none">
                            <Users className="h-2.5 w-2.5" />
                            команда
                          </span>
                        </div>
                        {team.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{team.description}</p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    </button>
                  )
                })}
              </>
            )}

            {/* ── Masters ── */}
            {filteredMasters.length > 0 && (
              <>
                {hasBoth && (
                  <div className="px-4 py-2 bg-muted/30">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Мастера</span>
                  </div>
                )}
                {filteredMasters.map((master) => {
                  const name = master.user?.name ?? 'Мастер'
                  const avatarUrl = master.avatar ? getFileUrl('master_profiles', master.avatar) : undefined
                  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
                  return (
                    <button
                      key={master.booking_slug}
                      type="button"
                      onClick={() => navigate(`/book/${master.booking_slug}${buildQs()}`)}
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
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{master.profession}</p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    </button>
                  )
                })}
              </>
            )}
          </>
        )}
      </div>

      {/* Footer count */}
      {!isLoading && totalCount > 0 && (
        <p className="text-center text-xs text-muted-foreground py-4">
          {totalCount}{' '}
          {totalCount === 1 ? 'результат' : totalCount < 5 ? 'результата' : 'результатов'}
        </p>
      )}
    </div>
  )
}
