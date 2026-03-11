import { useTranslation } from 'react-i18next'
import { Shield, ShieldOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useUsers, useToggleUserAdmin } from '@/hooks/useUsers'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/shared/Toaster'
import { getFileUrl } from '@/lib/utils'
import dayjs from 'dayjs'

interface Props {
  open: boolean
  onClose: () => void
}

export function AdminUsersDialog({ open, onClose }: Props) {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const { data: users, isLoading } = useUsers()
  const toggleAdmin = useToggleUserAdmin()

  const handleToggle = async (userId: string, currentIsAdmin: boolean) => {
    try {
      await toggleAdmin.mutateAsync({ id: userId, currentValue: currentIsAdmin })
      toast.success(currentIsAdmin ? t('admin.removeAdminSuccess') : t('admin.makeAdminSuccess'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const getAvatarUrl = (u: any) => {
    if (!u.avatar) return ''
    return getFileUrl('avatars', u.avatar)
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent mobileFullscreen className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-600" />
            {t('admin.usersTitle')}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-1">{t('admin.usersDesc')}</p>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {/* Loading skeletons */}
          {isLoading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          ))}

          {/* Empty state */}
          {!isLoading && (!users || users.length === 0) && (
            <p className="text-center text-sm text-muted-foreground py-8">{t('admin.usersEmpty')}</p>
          )}

          {/* User list */}
          {!isLoading && users?.map((u) => {
            const isSelf = u.id === currentUser?.id
            const isAdmin = !!u.is_admin

            return (
              <div
                key={u.id}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
              >
                {/* Avatar */}
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={getAvatarUrl(u)} alt={u.name} />
                  <AvatarFallback className="text-xs font-medium">
                    {getInitials(u.name || u.email)}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{u.name || '—'}</span>
                    {isSelf && (
                      <span className="text-xs text-muted-foreground">({t('admin.youLabel')})</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {dayjs((u as any).created_at).format('DD.MM.YYYY')}
                  </p>
                </div>

                {/* Badge */}
                <Badge
                  variant={isAdmin ? 'default' : 'secondary'}
                  className={isAdmin
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800 shrink-0'
                    : 'shrink-0'
                  }
                >
                  {isAdmin
                    ? <><Shield className="h-3 w-3 mr-1" />{t('admin.roleAdmin')}</>
                    : t('admin.roleMaster')
                  }
                </Badge>

                {/* Toggle */}
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={isAdmin}
                    disabled={isSelf || toggleAdmin.isPending}
                    onCheckedChange={() => handleToggle(u.id, isAdmin)}
                    title={isSelf
                      ? t('admin.cannotSelf')
                      : isAdmin
                        ? t('admin.removeAdmin')
                        : t('admin.makeAdmin')
                    }
                  />
                  {isAdmin
                    ? <Shield className="h-4 w-4 text-amber-500 shrink-0" />
                    : <ShieldOff className="h-4 w-4 text-muted-foreground shrink-0" />
                  }
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
