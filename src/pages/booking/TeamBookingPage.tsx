import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Users, Zap } from 'lucide-react'
import { useTeamBySlug, usePublicTeamMembers } from '@/hooks/useTeam'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { getFileUrl } from '@/lib/utils'
import { initMiniApp, isTelegramMiniApp } from '@/lib/telegramWebApp'
import type { MasterProfile } from '@/types'

export function TeamBookingPage() {
  const { teamSlug = '' } = useParams<{ teamSlug: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Инициализируем Telegram Mini App при открытии
  useEffect(() => {
    if (isTelegramMiniApp()) {
      initMiniApp()
    }
  }, [])

  // Параметры Telegram пользователя из URL (если переданы через бота)
  const tgId    = searchParams.get('tg_id')    ?? undefined
  const tgName  = searchParams.get('tg_name')  ?? undefined
  const tgPhone = searchParams.get('tg_phone') ?? undefined

  const { data: team, isLoading: teamLoading } = useTeamBySlug(teamSlug)
  const { data: members = [], isLoading: membersLoading } = usePublicTeamMembers(team?.id ?? '')

  // Загружаем master_profiles для всех участников
  const [profiles, setProfiles] = useState<MasterProfile[]>([])
  const [profilesLoading, setProfilesLoading] = useState(false)

  // Стабильная строка из ID участников + владелец команды
  // Используем raw-колонки: team_members.user_id и teams.owner_id
  const memberIdsKey = useMemo(() => {
    const ids = members.map(m => (m as any).user_id).filter(Boolean) as string[]
    const ownerId: string | undefined = (team as any)?.owner_id
    if (ownerId && !ids.includes(ownerId)) {
      ids.unshift(ownerId)
    }
    return ids.join(',')
  }, [members, team])

  useEffect(() => {
    if (!memberIdsKey) { setProfiles([]); setProfilesLoading(false); return }
    const userIds = memberIdsKey.split(',')

    setProfilesLoading(true)
    supabase
      .from('master_profiles')
      .select('*')
      .in('user_id', userIds)
      .then(({ data, error }) => {
        setProfilesLoading(false)
        if (error) { console.error('TeamBookingPage profiles error:', error); setProfiles([]); return }
        setProfiles((data ?? []) as unknown as MasterProfile[])
      }, (err) => {
        console.error('TeamBookingPage profiles catch:', err)
        setProfiles([])
        setProfilesLoading(false)
      })
  }, [memberIdsKey])

  const loading = teamLoading || membersLoading || profilesLoading

  // Не найдена команда
  if (!teamLoading && !team) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold mb-2">{t('booking.notFound')}</h1>
          <p className="text-muted-foreground text-sm">{t('booking.notFoundDesc')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Шапка команды */}
      <div className="border-b py-6 px-4 bg-background">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('common.back')}
          </button>
          <div className="flex items-center gap-4">
            {/* Логотип/иконка команды */}
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
              {team?.logo ? (
                <img
                  src={getFileUrl('teams', team.logo)}
                  className="h-16 w-16 object-cover"
                  alt={team.name}
                />
              ) : (
                <Users className="h-8 w-8 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">
                {teamLoading ? '...' : team?.name}
              </h1>
              {team?.description && (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                  {team.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Список мастеров */}
      <div className="flex-1 max-w-2xl mx-auto w-full p-4 space-y-4">
        <h2 className="font-semibold text-lg">
          {t('team.booking.selectMaster')}
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>{t('team.booking.noMasters')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map(profile => {
              const profileUserId = (profile as any).user_id
              const member = members.find(m => (m as any).user_id === profileUserId)
              const isOwner = profileUserId === (team as any)?.owner_id
              const ownerUser = isOwner ? (team?.expand as any)?.owner : null
              const memberUser = (member as any)?.user  // joined object from user:users(*)
              const displayName =
                (memberUser && typeof memberUser === 'object' ? memberUser.name : null) ??
                ownerUser?.name ??
                (profile as any).user?.name ??
                profile.profession ??
                '—'

              const avatarUrl = profile.avatar
                ? getFileUrl('master_profiles', profile.avatar)
                : undefined

              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => {
                  const params = new URLSearchParams({ team: teamSlug })
                  if (tgId)    params.set('tg_id', tgId)
                  if (tgName)  params.set('tg_name', tgName)
                  if (tgPhone) params.set('tg_phone', tgPhone)
                  navigate(`/book/${profile.booking_slug}?${params.toString()}`)
                }}
                  className="w-full text-left"
                >
                  <Card className="hover:border-primary/60 hover:shadow-sm transition-all cursor-pointer">
                    <CardContent className="p-4 flex items-center gap-4">
                      <Avatar className="h-14 w-14 shrink-0">
                        {avatarUrl && <AvatarImage src={avatarUrl} />}
                        <AvatarFallback className="text-lg font-semibold">
                          {displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{displayName}</p>
                        {profile.profession && (
                          <p className="text-sm text-muted-foreground truncate">
                            {profile.profession}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Футер */}
      <div className="border-t py-4 text-center">
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
          {t('booking.poweredBy')}
          <Zap className="h-3 w-3 text-primary inline-block" />
          <span className="font-medium text-foreground">Ezze</span>
        </p>
      </div>
    </div>
  )
}
