import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Users, Zap } from 'lucide-react'
import { useTeamBySlug, usePublicTeamMembers } from '@/hooks/useTeam'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import pb from '@/lib/pocketbase'
import type { MasterProfile } from '@/types'

export function TeamBookingPage() {
  const { teamSlug = '' } = useParams<{ teamSlug: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: team, isLoading: teamLoading } = useTeamBySlug(teamSlug)
  const { data: members = [], isLoading: membersLoading } = usePublicTeamMembers(team?.id ?? '')

  // Загружаем master_profiles для всех участников
  const [profiles, setProfiles] = useState<MasterProfile[]>([])
  const [profilesLoading, setProfilesLoading] = useState(false)

  // Стабильная строка из ID участников + владелец команды
  const memberIdsKey = useMemo(() => {
    const ids = members.map(m => m.user).filter(Boolean)
    // Владелец команды не в team_members — добавляем первым
    if (team?.owner && !ids.includes(team.owner)) {
      ids.unshift(team.owner)
    }
    return ids.join(',')
  }, [members, team?.owner])

  useEffect(() => {
    if (!memberIdsKey) { setProfiles([]); return }
    const userIds = memberIdsKey.split(',')

    setProfilesLoading(true)
    const filter = `(${userIds.map(id => `user="${id}"`).join(' || ')}) && is_public=true`
    pb.collection('master_profiles')
      .getFullList<MasterProfile>({ filter, expand: 'user' })
      .then(setProfiles)
      .catch(() => setProfiles([]))
      .finally(() => setProfilesLoading(false))
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
          <div className="flex items-center gap-4">
            {/* Логотип/иконка команды */}
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
              {team?.logo ? (
                <img
                  src={pb.getFileUrl(team as any, team.logo, { thumb: '80x80' })}
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
              const member = members.find(m => m.user === profile.user)
              // Для владельца member будет undefined — берём из team.expand.owner
              const isOwner = profile.user === team?.owner
              const ownerUser = isOwner ? (team?.expand as any)?.owner : null
              const displayName =
                member?.expand?.user?.name ??
                ownerUser?.name ??
                (profile as any).expand?.user?.name ??
                '—'

              const avatarUrl = profile.avatar
                ? pb.getFileUrl(profile as any, profile.avatar as any, { thumb: '100x100' })
                : undefined

              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => navigate(`/book/${profile.booking_slug}?team=${teamSlug}`)}
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
