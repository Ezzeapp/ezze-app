import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, Trash2, AlertTriangle, Copy, Check, ExternalLink, Camera, X } from 'lucide-react'
import { useUpdateTeam, useDeleteTeam } from '@/hooks/useTeam'
import { generateSlug, getPbFileUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/components/shared/Toaster'
import type { Team } from '@/types'

interface Props {
  team: Team
}

export function TeamSettingsTab({ team }: Props) {
  const { t } = useTranslation()

  const [name,        setName]        = useState(team.name)
  const [slug,        setSlug]        = useState(team.slug)
  const [description, setDescription] = useState(team.description || '')
  const [isPublic,    setIsPublic]    = useState(team.is_public)
  const [slugEdited,  setSlugEdited]  = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copied, setCopied] = useState(false)

  // Логотип
  const [logoFile,    setLogoFile]    = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [removeLogo,  setRemoveLogo]  = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const updateTeam = useUpdateTeam()
  const deleteTeam = useDeleteTeam()

  // Синхронизируем если team обновилась снаружи
  useEffect(() => {
    setName(team.name)
    setSlug(team.slug)
    setDescription(team.description || '')
    setIsPublic(team.is_public)
    setSlugEdited(false)
    setLogoFile(null)
    setLogoPreview(null)
    setRemoveLogo(false)
  }, [team.id])

  const handleNameChange = (v: string) => {
    setName(v)
    if (!slugEdited) setSlug(generateSlug(v))
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    setRemoveLogo(false)
  }

  const handleRemoveLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
    setRemoveLogo(true)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return
    try {
      const fd = new FormData()
      fd.append('name', name.trim())
      fd.append('slug', slug.trim())
      fd.append('description', description.trim())
      fd.append('is_public', String(isPublic))
      if (logoFile) {
        fd.append('logo', logoFile)
      } else if (removeLogo) {
        // Очищаем поле логотипа — пустой Blob
        fd.append('logo', new File([], ''))
      }
      await updateTeam.mutateAsync({ id: team.id, data: fd })
      toast.success(t('common.saved'))
      setLogoFile(null)
      setRemoveLogo(false)
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const bookingUrl = `${window.location.origin}/book/team/${slug}`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleDeleteConfirmed = async () => {
    try {
      await deleteTeam.mutateAsync(team.id)
      toast.success(t('team.deleteSuccess'))
    } catch {
      toast.error(t('common.saveError'))
    } finally {
      setConfirmDelete(false)
    }
  }

  // Текущий URL логотипа (из БД или превью нового)
  const currentLogoUrl = logoPreview
    ?? (team.logo && !removeLogo ? getPbFileUrl(team as any, team.logo, '160x160') : null)

  return (
    <div className="space-y-4 max-w-xl">
      {/* Основные настройки */}
      <form onSubmit={handleSave} className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t('team.settings.general')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">

            {/* Логотип команды */}
            <div className="space-y-1">
              <Label className="text-xs">{t('team.settings.logo')}</Label>
              <div className="flex items-center gap-3">
                {/* Превью */}
                <div
                  className="h-16 w-16 rounded-xl border bg-muted flex items-center justify-center shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => logoInputRef.current?.click()}
                  title={t('team.settings.uploadLogo')}
                >
                  {currentLogoUrl ? (
                    <img
                      src={currentLogoUrl}
                      alt="logo"
                      className="h-16 w-16 object-cover"
                    />
                  ) : (
                    <Camera className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>

                {/* Кнопки */}
                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Camera className="h-3 w-3 mr-1.5" />
                    {t('team.settings.uploadLogo')}
                  </Button>
                  {(currentLogoUrl) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={handleRemoveLogo}
                    >
                      <X className="h-3 w-3 mr-1.5" />
                      {t('team.settings.removeLogo')}
                    </Button>
                  )}
                </div>

                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleLogoChange}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t('team.settings.logoHint')}</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{t('team.teamName')}</Label>
              <Input
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{t('team.teamSlug')}</Label>
              <Input
                value={slug}
                onChange={e => { setSlug(e.target.value); setSlugEdited(true) }}
                pattern="[a-z0-9-]+"
                required
              />
              <p className="text-xs text-muted-foreground">{t('team.teamSlugHint')}</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{t('team.description')}</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t('team.descriptionPlaceholder')}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t('team.settings.publicBooking')}</p>
                <p className="text-xs text-muted-foreground">{t('team.settings.publicBookingHint')}</p>
              </div>
              <Switch
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>

            {/* Ссылка на публичную страницу */}
            <div className={`rounded-lg border bg-muted/40 p-3 space-y-2 transition-opacity ${!isPublic ? 'opacity-40' : ''}`}>
              <p className="text-xs text-muted-foreground font-medium">{t('team.settings.bookingLink')}</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-mono text-foreground flex-1 min-w-0 truncate">
                  {bookingUrl}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={handleCopyLink}
                  disabled={!isPublic}
                  title={t('common.copy')}
                >
                  {copied
                    ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                    : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-accent transition-colors ${!isPublic ? 'pointer-events-none' : ''}`}
                  title={t('common.open')}
                  tabIndex={!isPublic ? -1 : undefined}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" loading={updateTeam.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {t('common.save')}
        </Button>
      </form>

      {/* Опасная зона */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {t('team.settings.dangerZone')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('team.deleteTeam')}
          </Button>
        </CardContent>
      </Card>

      {/* Диалог подтверждения удаления */}
      <Dialog open={confirmDelete} onOpenChange={v => { if (!v) setConfirmDelete(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              {t('team.deleteTeam')}
            </DialogTitle>
            <DialogDescription>{t('team.deleteTeamConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirmed}
              loading={deleteTeam.isPending}
            >
              {t('team.deleteTeam')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
