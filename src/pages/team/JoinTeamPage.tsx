import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users, AlertTriangle, LogIn } from 'lucide-react'
import { useValidateInviteCode, useJoinTeam } from '@/hooks/useTeamInvites'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/shared/Toaster'

export function JoinTeamPage() {
  const { code = '' } = useParams<{ code: string }>()
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()

  const { data: validated, isLoading } = useValidateInviteCode(code)
  const joinTeam = useJoinTeam()

  const handleJoin = async () => {
    try {
      await joinTeam.mutateAsync({ code })
      toast.success(t('team.joinSuccess'))
      navigate('/team')
    } catch (err: any) {
      if (err.message === 'already_member') {
        toast.error(t('team.alreadyMember'))
      } else if (err.message === 'invite_inactive' || err.message === 'invite_expired') {
        toast.error(t('team.expiredInvite'))
      } else {
        toast.error(t('team.invalidInvite'))
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">E</span>
            </div>
            <span className="text-xl font-bold">Ezze</span>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-muted-foreground">{t('common.loading')}</p>
            </CardContent>
          </Card>
        ) : !validated ? (
          <Card>
            <CardContent className="py-10 text-center">
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
              <p className="font-semibold">{t('team.invalidInvite')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('team.expiredInvite')}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3 text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mx-auto mb-2">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('team.inviteTeam')}</p>
              <CardTitle className="text-xl">{validated.teamName}</CardTitle>
              {validated.ownerName && (
                <p className="text-sm text-muted-foreground">
                  {t('team.inviteFrom')} {validated.ownerName}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {user ? (
                <Button
                  className="w-full"
                  onClick={handleJoin}
                  disabled={joinTeam.isPending}
                >
                  {joinTeam.isPending ? t('team.joining') : t('team.joinTeam')}
                </Button>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground text-center">
                    {t('team.notLoggedIn')}
                  </p>
                  <Button className="w-full" asChild>
                    <Link to={`/login?redirect=/join/${code}`}>
                      <LogIn className="h-4 w-4 mr-2" />
                      {t('auth.login')}
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to={`/register?invite=${code}`}>
                      {t('team.registerToJoin')}
                    </Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
