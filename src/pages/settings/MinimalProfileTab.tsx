import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BellRing, Camera, CheckCircle2, ExternalLink, ImagePlus, Mail,
  Phone, Send, Trash2, User, XCircle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile, useUpsertProfile } from '@/hooks/useProfile'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/shared/Toaster'
import { getFileUrl } from '@/lib/utils'
import { MASTER_BOT } from '@/lib/config'

export function MinimalProfileTab() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const upsertProfile = useUpsertProfile()

  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [deletingAvatar, setDeletingAvatar] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [notificationEmail, setNotificationEmail] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Reset form only when switching to a different profile (id), not on every refetch —
  // otherwise unsaved edits get clobbered by background revalidation.
  const lastProfileIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!profile || profile.id === lastProfileIdRef.current) return
    lastProfileIdRef.current = profile.id
    setDisplayName(profile.display_name || '')
    setPhone(profile.phone || '')
    setNotificationEmail(profile.notification_email || '')
  }, [profile])

  // Revoke blob URLs to prevent memory leaks.
  useEffect(() => {
    if (!avatarPreview) return
    return () => URL.revokeObjectURL(avatarPreview)
  }, [avatarPreview])

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const handleDeleteAvatar = async () => {
    setPhotoModalOpen(false)
    if (avatarPreview) {
      setAvatarPreview(null)
      setAvatarFile(null)
      if (!profile?.avatar) return
    }
    if (!profile?.avatar || !profile?.id) return
    setDeletingAvatar(true)
    try {
      await upsertProfile.mutateAsync({ id: profile.id, data: { _avatarFile: null } })
      toast.success(t('profile.photoDeleted'))
    } catch {
      toast.error(t('common.deleteError'))
    } finally {
      setDeletingAvatar(false)
    }
  }

  const saveProfileBasics = async () => {
    if (!profile?.id) return
    setSavingProfile(true)
    try {
      const payload: Record<string, any> = {
        display_name: displayName,
        phone,
        notification_email: notificationEmail,
      }
      if (avatarFile) payload._avatarFile = avatarFile
      await upsertProfile.mutateAsync({ id: profile.id, data: payload })
      toast.success(t('common.saved'))
      setAvatarFile(null)
      setAvatarPreview(null)
    } catch {
      toast.error(t('common.saveError'))
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            {t('profile.basicInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={onAvatarChange}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onAvatarChange}
          />

          <div className="flex items-center gap-4">
            <div
              className="relative cursor-pointer group shrink-0"
              onClick={() => setPhotoModalOpen(true)}
            >
              <Avatar className="h-20 w-20">
                <AvatarImage
                  src={
                    avatarPreview ||
                    (profile?.avatar ? getFileUrl('master_profiles', profile.avatar) : undefined)
                  }
                />
                <AvatarFallback className="text-xl">
                  {user?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm group-hover:bg-primary/90 transition-colors">
                {deletingAvatar ? (
                  <span className="h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </div>
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>

          <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
            <DialogContent className="max-w-xs">
              <DialogHeader>
                <DialogTitle>{t('profile.photoTitle')}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => { setPhotoModalOpen(false); setTimeout(() => cameraInputRef.current?.click(), 100) }}
                >
                  <Camera className="h-4 w-4" />
                  {t('profile.takePhoto')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => { setPhotoModalOpen(false); setTimeout(() => fileInputRef.current?.click(), 100) }}
                >
                  <ImagePlus className="h-4 w-4" />
                  {t('profile.chooseGallery')}
                </Button>
                {(avatarPreview || (profile?.avatar && !deletingAvatar)) && (
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full justify-start gap-2"
                    onClick={handleDeleteAvatar}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('profile.deletePhotoBtn')}
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <div className="space-y-2">
            <Label>{t('profile.displayName')}</Label>
            <Input
              placeholder={t('profile.displayNamePlaceholder')}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              {t('profile.phone')}
            </Label>
            <Input
              placeholder="+998 00 000 00 00"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              readOnly={!!profile?.tg_chat_id}
              className={profile?.tg_chat_id ? 'bg-muted/40 cursor-not-allowed' : ''}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {t('profile.notificationEmail')}
            </Label>
            <Input
              type="email"
              placeholder={user?.email || 'your@email.com'}
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('profile.notificationEmailHint')}</p>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="button" loading={savingProfile} onClick={saveProfileBasics}>
              {t('common.save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" />
            {t('profile.telegramNotifications')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile?.tg_chat_id ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  {t('profile.telegramConnected')}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {t('profile.telegramConnectedDesc')}
                </p>
              </div>
              <a
                href={`https://t.me/${MASTER_BOT}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors text-emerald-600 shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border">
              <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{t('profile.telegramNotConnected')}</p>
                <p className="text-xs text-muted-foreground">{t('profile.telegramNotConnectedDesc')}</p>
              </div>
            </div>
          )}

          <a
            href={`https://t.me/${MASTER_BOT}?start=${profile?.booking_slug ?? ''}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-lg px-4 py-2.5 text-sm font-medium bg-[#2AABEE] hover:bg-[#2AABEE]/90 text-white transition-colors"
          >
            <Send className="h-4 w-4" />
            {profile?.tg_chat_id ? t('profile.telegramReconnect') : t('profile.telegramConnect')}
          </a>

          <p className="text-xs text-muted-foreground text-center">
            {t('profile.telegramHint')}
          </p>
        </CardContent>
      </Card>
    </>
  )
}
