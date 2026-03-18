import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Camera, Copy, Download, ExternalLink, Globe, Instagram, Mail, MessageCircle, Phone, Send, BellRing, CheckCircle2, XCircle, ImagePlus, Trash2, MapPin, Navigation, Wand2, User, Settings, QrCode, ArrowLeftRight, Sparkles, GripVertical, Loader2 } from 'lucide-react'
import { buildClientBookingLink } from '@/lib/telegramWebApp'
import { BOOKING_THEMES } from '@/lib/bookingThemes'
import { useQueryClient } from '@tanstack/react-query'
import { useProfile, useUpsertProfile, PROFILE_KEY } from '@/hooks/useProfile'
import { useAIConfig } from '@/hooks/useAppSettings'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useMyTeam } from '@/hooks/useTeam'
import { useActivityTypes } from '@/hooks/useSpecialties'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { toast } from '@/components/shared/Toaster'
import { cn, generateSlug, getFileUrl } from '@/lib/utils'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, rectSortingStrategy, sortableKeyboardCoordinates,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { DataTransferSection } from '@/components/profile/DataTransferSection'
import { FeatureGate } from '@/components/shared/FeatureGate'

const schema = z.object({
  display_name: z.string().max(100).optional(),
  profession: z.string().min(2).max(100),
  bio: z.string().max(1000).optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  website: z.string().optional(),
  instagram: z.string().optional(),
  telegram: z.string().optional(),
  whatsapp: z.string().optional(),
  vk: z.string().optional(),
  booking_slug: z.string().regex(/^[a-z0-9-]+$/, 'Only letters, numbers, hyphens').min(3).max(50),
  is_public: z.boolean(),
  booking_theme: z.string().optional(),
  currency: z.string(),
  notification_email: z.string().email().optional().or(z.literal('')),
})
type FormValues = z.infer<typeof schema>

const MAX_PORTFOLIO = 9

// ─── Sortable portfolio item ──────────────────────────────────────────────────
function SortablePortfolioItem({ id, url, isDeleting, onDelete }: {
  id: string; url: string; isDeleting: boolean; onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  }
  return (
    <div ref={setNodeRef} style={style} className="relative group aspect-square">
      <img
        src={url}
        alt="Portfolio"
        className={cn('w-full h-full object-cover rounded-xl border-2 border-border', isDeleting && 'opacity-40')}
      />
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1.5 left-1.5 p-1 rounded-md bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      {/* Delete */}
      {isDeleting ? (
        <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-black/20">
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        </div>
      ) : (
        <button
          type="button"
          onClick={onDelete}
          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

export function ProfilePage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { data: profile, isLoading } = useProfile()
  const upsert = useUpsertProfile()
  const { data: teamData } = useMyTeam()
  const qc = useQueryClient()
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [deletingAvatar, setDeletingAvatar] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [portfolioFiles, setPortfolioFiles] = useState<File[]>([])
  const [portfolioDeleting, setPortfolioDeleting] = useState<Set<string>>(new Set())
  const [portfolioOrder, setPortfolioOrder] = useState<string[]>([])
  const portfolioInputRef = useRef<HTMLInputElement>(null)
  const [activityTypeId, setActivityTypeId] = useState('')
  const [specialtyId, setSpecialtyId] = useState('')
  const [activityTypeName, setActivityTypeName] = useState('')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [profileTab, setProfileTab] = useState<'main' | 'contacts' | 'settings' | 'transfer'>('main')
  const [generatingBio, setGeneratingBio] = useState(false)
  const { data: aiConfig } = useAIConfig()
  const { data: activityTypes } = useActivityTypes()

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: '',
      profession: '',
      bio: '',
      phone: '',
      city: '',
      address: '',
      website: '',
      instagram: '',
      telegram: '',
      whatsapp: '',
      vk: '',
      booking_slug: generateSlug(user?.name || 'master'),
      is_public: false,
      booking_theme: 'blue',
      currency: 'RUB',
      notification_email: '',
    },
  })

  useEffect(() => {
    if (profile) {
      reset({
        display_name: profile.display_name || '',
        profession: profile.profession || '',
        bio: profile.bio || '',
        phone: profile.phone || '',
        city: profile.city || '',
        address: profile.address || '',
        website: profile.website || '',
        instagram: profile.instagram || '',
        telegram: profile.telegram || '',
        whatsapp: profile.whatsapp || '',
        vk: profile.vk || '',
        booking_slug: profile.booking_slug || generateSlug(user?.name || 'master'),
        is_public: profile.is_public || false,
        booking_theme: profile.booking_theme || 'blue',
        currency: profile.currency || 'RUB',
        notification_email: profile.notification_email || '',
      })
      if (profile.activity_type) {
        setActivityTypeId(profile.activity_type)
        const found = activityTypes?.find(a => a.id === profile.activity_type)
        if (found) setActivityTypeName(found.name)
      }
      if (profile.specialty) setSpecialtyId(profile.specialty)
      setPortfolioOrder(profile.portfolio ?? [])
    }
  }, [profile, reset, user?.name, activityTypes])

  const bookingSlug = watch('booking_slug')
  const isPublic = watch('is_public')
  const bookingTheme = watch('booking_theme') || 'blue'
  const watchCity = watch('city')
  const watchAddress = watch('address')
  const bookingUrl = `${window.location.origin}/book/${bookingSlug}`
  const tgBookingUrl = buildClientBookingLink(bookingSlug)

  // ── Portfolio DnD ────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const handlePortfolioDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setPortfolioOrder(prev => {
      const oldIdx = prev.indexOf(active.id as string)
      const newIdx = prev.indexOf(over.id as string)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(tgBookingUrl)}`

  // Строка для Google Maps из адреса + города
  const locationQuery = [watchAddress, watchCity].filter(Boolean).join(', ')
  const mapsUrl = locationQuery
    ? `https://maps.google.com/?q=${encodeURIComponent(locationQuery)}`
    : null
  const mapsEmbedUrl = locationQuery
    ? `https://maps.google.com/maps?q=${encodeURIComponent(locationQuery)}&output=embed&z=15`
    : null

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const handleDeleteAvatar = async () => {
    setPhotoModalOpen(false)
    // If only a pending upload (not yet saved), just clear the preview
    if (avatarPreview) {
      setAvatarPreview(null)
      setAvatarFile(null)
      return
    }
    if (!profile?.avatar || !profile?.id) return
    setDeletingAvatar(true)
    try {
      await upsert.mutateAsync({ id: profile.id, data: { _avatarFile: null } })
      toast.success(t('profile.photoDeleted'))
    } catch {
      toast.error(t('common.deleteError'))
    } finally {
      setDeletingAvatar(false)
    }
  }

  const onSubmit = async (values: FormValues) => {
    try {
      const payload: Record<string, any> = { ...values }
      if (avatarFile) payload._avatarFile = avatarFile
      if (activityTypeId) payload.activity_type = activityTypeId
      if (specialtyId) payload.specialty = specialtyId
      if (portfolioFiles.length > 0) payload._portfolioFiles = portfolioFiles
      payload.portfolio = portfolioOrder  // always save current order

      await upsert.mutateAsync({ id: profile?.id, data: payload })
      toast.success(t('common.saved'))
      setAvatarFile(null)
      setPortfolioFiles([])
    } catch (e: any) {
      const errData = e?.response?.data || {}
      const firstField = Object.keys(errData)[0]
      const msg = firstField
        ? `${firstField}: ${errData[firstField]?.message}`
        : t('common.saveError')
      toast.error(msg)
    }
  }

  const copyBookingLink = () => {
    navigator.clipboard.writeText(bookingUrl)
    toast.success(t('profile.linkCopied'))
  }

  const onPortfolioAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const allowed = Math.max(0, MAX_PORTFOLIO - portfolioOrder.length - portfolioFiles.length)
    setPortfolioFiles(prev => [...prev, ...files.slice(0, allowed)])
    e.target.value = ''
  }

  const onPortfolioDelete = async (filename: string) => {
    if (!profile?.id) return
    setPortfolioDeleting(prev => new Set(prev).add(filename))
    try {
      const newPortfolio = portfolioOrder.filter((p: string) => p !== filename)
      setPortfolioOrder(newPortfolio)
      await upsert.mutateAsync({ id: profile.id, data: { portfolio: newPortfolio } })
      toast.success(t('profile.photoDeleted'))
    } catch {
      toast.error(t('common.deleteError'))
    } finally {
      setPortfolioDeleting(prev => { const s = new Set(prev); s.delete(filename); return s })
    }
  }

  const generateBio = async () => {
    setGeneratingBio(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-generate-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          type: 'bio',
          context: {
            name: user?.name,
            profession: watch('profession'),
            specialty: activityTypeName,
            city: watch('city'),
          },
        }),
      })
      const { text } = await resp.json()
      if (text) setValue('bio', text, { shouldDirty: true })
    } catch {
      toast.error(t('profile.generateFailed'))
    } finally {
      setGeneratingBio(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        </div>
      </div>
    )
  }

  const avatarUrl = profile?.avatar
    ? getFileUrl('master_profiles', profile.avatar)
    : null

  // Prefill object for wizard from current profile data
  const wizardPrefill = profile ? {
    name: user?.name,
    phone: profile.phone,
    city: profile.city,
    address: profile.address,
    profession: profile.profession !== user?.name ? profile.profession : undefined,
    activityTypeId: profile.activity_type,
    specialtyId: profile.specialty,
    currency: profile.currency,
    timezone: user?.timezone,
    language: (user as any)?.language || i18n.language?.split('-')[0] || 'ru',
  } : undefined

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <PageHeader title={t('nav.profile')} description={t('profile.subtitle')} className="items-center sm:items-start">
        {/* Мастер настройки: иконка на мобиле, текст на десктопе */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="sm:hidden"
          onClick={() => setWizardOpen(true)}
          title={t('profile.setupWizard')}
        >
          <Wand2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setWizardOpen(true)}
          className="hidden sm:flex items-center gap-1.5"
        >
          <Wand2 className="h-4 w-4" />
          {t('profile.setupWizard')}
        </Button>
        <Button type="submit" loading={upsert.isPending} disabled={!isDirty && !avatarFile && portfolioFiles.length === 0}>
          {t('common.save')}
        </Button>
      </PageHeader>

      <OnboardingWizard
        open={wizardOpen}
        onComplete={() => {
          setWizardOpen(false)
          qc.invalidateQueries({ queryKey: [PROFILE_KEY] })
        }}
        onClose={() => setWizardOpen(false)}
        prefill={wizardPrefill}
      />

      {/* Вкладки */}
      <div className="grid grid-cols-4 gap-1">
        {([
          { id: 'main',     label: t('profile.tabMain'),     icon: User           },
          { id: 'contacts', label: t('profile.contacts'),    icon: Phone          },
          { id: 'settings', label: t('profile.tabBooking'),  icon: Settings       },
          { id: 'transfer', label: t('profile.transfer'),    icon: ArrowLeftRight },
        ] as const).map(tab => (
          <button key={tab.id} type="button" title={tab.label} onClick={() => setProfileTab(tab.id)}
            className={cn(
              'flex flex-col items-center gap-1 px-1 py-2 rounded-lg text-xs font-medium transition-colors',
              profileTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted/40 text-muted-foreground'
            )}>
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:block truncate w-full text-center leading-tight">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Вкладка Перенос данных — вне основного грида */}
      {profileTab === 'transfer' && (
        <div className="mt-2">
          <FeatureGate feature="data_transfer">
            <DataTransferSection />
          </FeatureGate>
        </div>
      )}

      <div className={cn("grid gap-6 lg:grid-cols-3", profileTab === 'transfer' && 'hidden')}>
        {/* Avatar Card */}
        <Card className={cn(profileTab !== 'main' && 'hidden')}>
          <CardHeader><CardTitle className="text-base">{t('profile.photo')}</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {/* Clickable avatar → photo modal */}
            <div
              className="relative cursor-pointer group"
              onClick={() => setPhotoModalOpen(true)}
            >
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarPreview || avatarUrl || undefined} />
                <AvatarFallback className="text-2xl">
                  {user?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm group-hover:bg-primary/90 transition-colors">
                {deletingAvatar ? (
                  <span className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </div>
            </div>

            {/* Hidden file inputs */}
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

            {/* Photo modal */}
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

            <div className="text-center">
              <p className="font-medium">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {teamData?.team && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary rounded-full px-2.5 py-1">
                  <span className="font-medium">
                    {teamData.isOwner ? t('team.owner') : t('team.member')}:
                  </span>
                  <span>{teamData.team.name}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Info */}
        <Card className={cn("lg:col-span-2", profileTab !== 'main' && 'hidden')}>
          <CardHeader><CardTitle className="text-base">{t('profile.basicInfo')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Имя (отображаемое имя / ФИО) */}
            <div className="space-y-2">
              <Label>{t('profile.displayName')}</Label>
              <Input placeholder={t('profile.displayNamePlaceholder')} {...register('display_name')} />
            </div>
            {/* Сфера деятельности (read-only) */}
            {activityTypeName && (
              <div className="space-y-2">
                <Label>{t('specialty.activityType')}</Label>
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                  {activityTypeName}
                </div>
              </div>
            )}
            {/* Профессия (только отображение) */}
            {watch('profession') && (
              <div className="space-y-2">
                <Label>{t('profile.profession')}</Label>
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                  {watch('profession')}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('profile.bio')}</Label>
                {aiConfig?.enabled && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground hover:text-primary"
                    onClick={generateBio}
                    disabled={generatingBio}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {generatingBio ? t('profile.generating') : t('profile.generate')}
                  </Button>
                )}
              </div>
              <Textarea rows={3} placeholder={t('profile.bioPlaceholder')} {...register('bio')} />
            </div>
          </CardContent>
        </Card>

        {/* Portfolio Card — full width row below photo+info */}
        <Card className={cn("lg:col-span-3", profileTab !== 'main' && 'hidden')}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ImagePlus className="h-4 w-4" />
              {t('profile.portfolioTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">{t('profile.portfolioHint')}</p>

            {/* Hidden file input — triggered by empty slot clicks */}
            <input
              ref={portfolioInputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={onPortfolioAdd}
            />

            {/* 3×3 sortable grid */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePortfolioDragEnd}>
              <SortableContext items={portfolioOrder} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9 gap-2">

                  {/* Saved & sorted photos */}
                  {portfolioOrder.map(filename => (
                    <SortablePortfolioItem
                      key={filename}
                      id={filename}
                      url={getFileUrl('master_profiles', filename)}
                      isDeleting={portfolioDeleting.has(filename)}
                      onDelete={() => onPortfolioDelete(filename)}
                    />
                  ))}

                  {/* Pending new photos (not yet saved) */}
                  {portfolioFiles.map((file, i) => (
                    <div key={`new-${i}`} className="relative group aspect-square">
                      <img
                        src={URL.createObjectURL(file)}
                        alt="New"
                        className="w-full h-full object-cover rounded-xl border-2 border-primary/40 opacity-80"
                      />
                      <button
                        type="button"
                        onClick={() => setPortfolioFiles(prev => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  {/* Empty frames — clickable to add */}
                  {portfolioOrder.length + portfolioFiles.length < MAX_PORTFOLIO &&
                    Array.from({ length: MAX_PORTFOLIO - portfolioOrder.length - portfolioFiles.length }).map((_, i) => (
                      <button
                        key={`empty-${i}`}
                        type="button"
                        onClick={() => portfolioInputRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 flex items-center justify-center transition-colors group"
                      >
                        <ImagePlus className="h-6 w-6 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                      </button>
                    ))
                  }
                </div>
              </SortableContext>
            </DndContext>

            {portfolioOrder.length + portfolioFiles.length >= MAX_PORTFOLIO && (
              <p className="text-xs text-muted-foreground">{t('profile.portfolioMax')}</p>
            )}
          </CardContent>
        </Card>

        {/* Location */}
        <Card className={cn("lg:col-span-3", profileTab !== 'contacts' && 'hidden')}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              {t('profile.location')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('profile.city')}</Label>
                <Input placeholder={t('profile.cityPlaceholder')} {...register('city')} />
              </div>
              <div className="space-y-2">
                <Label>{t('profile.address')}</Label>
                <Input placeholder={t('profile.addressPlaceholder')} {...register('address')} />
              </div>
            </div>

            {/* Map preview */}
            {mapsEmbedUrl ? (
              <div className="space-y-2">
                <div className="rounded-xl overflow-hidden border h-52 relative">
                  <iframe
                    src={mapsEmbedUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen={false}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="map"
                  />
                </div>
                <a
                  href={mapsUrl!}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <Navigation className="h-3 w-3" />
                  {t('profile.openInMaps')}
                </a>
              </div>
            ) : (
              <div className="flex items-center justify-center h-28 rounded-xl border border-dashed text-sm text-muted-foreground gap-2">
                <MapPin className="h-4 w-4" />
                {t('profile.locationHint')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card className={cn("lg:col-span-2", profileTab !== 'contacts' && 'hidden')}>
          <CardHeader><CardTitle className="text-base">{t('profile.contacts')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{t('profile.phone')}</Label>
                <Input placeholder="+998 00 000 00 00" {...register('phone')} readOnly={!!profile?.tg_chat_id} className={profile?.tg_chat_id ? 'bg-muted/40 cursor-not-allowed' : ''} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />{t('profile.website')}</Label>
                <Input placeholder="https://..." {...register('website')} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Instagram className="h-3.5 w-3.5" />Instagram</Label>
                <Input placeholder="@username" {...register('instagram')} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Send className="h-3.5 w-3.5" />Telegram</Label>
                <Input placeholder="@username" {...register('telegram')} readOnly={!!profile?.tg_chat_id} className={profile?.tg_chat_id ? 'bg-muted/40 cursor-not-allowed' : ''} />
                {profile?.tg_chat_id ? (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    {t('profile.tgBotConnected')}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t('profile.tgEnterUsername')}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</Label>
                <Input placeholder="+998 00 000 00 00" {...register('whatsapp')} />
              </div>
              <div className="space-y-2">
                <Label>VK</Label>
                <Input placeholder="vk.com/username" {...register('vk')} />
              </div>
            </div>
            {/* Email для уведомлений */}
            <div className="pt-2 border-t space-y-2">
              <Label className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {t('profile.notificationEmail')}
              </Label>
              <Input
                type="email"
                placeholder={user?.email || 'your@email.com'}
                {...register('notification_email')}
              />
              <p className="text-xs text-muted-foreground">{t('profile.notificationEmailHint')}</p>
              {errors.notification_email && (
                <p className="text-xs text-destructive">{errors.notification_email.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Settings tab: Booking + Telegram — равные колонки */}
        <div className={cn("lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start", profileTab !== 'settings' && 'hidden')}>

        {/* Booking Settings */}
        <FeatureGate feature="public_booking" className="rounded-xl">
        <Card>
          <CardHeader><CardTitle className="text-base">{t('profile.bookingSettings')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t('profile.publicBooking')}</Label>
              <Switch
                checked={isPublic}
                onCheckedChange={(v) => setValue('is_public', v, { shouldDirty: true })}
              />
            </div>
            {/* Тема оформления */}
            <div className="space-y-2">
              <Label>{t('profile.theme')}</Label>
              <div className="flex gap-2 flex-wrap">
                {BOOKING_THEMES.map(theme => (
                  <button
                    key={theme.id}
                    type="button"
                    title={theme.label}
                    onClick={() => setValue('booking_theme', theme.id, { shouldDirty: true })}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      bookingTheme === theme.id
                        ? 'border-foreground scale-110 shadow-md'
                        : 'border-transparent hover:border-foreground/30 hover:scale-105'
                    }`}
                    style={{ backgroundColor: `hsl(${theme.primary})` }}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {BOOKING_THEMES.find(t => t.id === bookingTheme)?.label}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t('profile.bookingSlug')}</Label>
              <Input placeholder="my-studio" {...register('booking_slug')} />
              {errors.booking_slug && <p className="text-xs text-destructive">{errors.booking_slug.message}</p>}
            </div>
            {/* QR-коды для клиентов */}
            {isPublic && (
              <div className="space-y-3">
                {/* Веб-ссылка — для всех */}
                <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-primary" />
                    <p className="text-xs font-medium">{t('profile.qrWeb')}</p>
                  </div>
                  <div className="flex gap-3 items-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(bookingUrl)}`}
                      alt={t('profile.qrAlt')}
                      className="h-20 w-20 rounded-lg border bg-white shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <code className="text-xs truncate text-muted-foreground block">{bookingUrl}</code>
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs min-w-0"
                          onClick={() => { navigator.clipboard.writeText(bookingUrl); toast.success(t('profile.linkCopied')) }}
                        >
                          <Copy className="h-3 w-3 mr-1 shrink-0" />
                          <span className="truncate">{t('profile.copy')}</span>
                        </Button>
                        <a
                          href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(bookingUrl)}&download=1`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md border text-xs hover:bg-accent transition-colors shrink-0"
                          title="↓ PNG"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        <a
                          href={bookingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md border hover:bg-accent transition-colors text-muted-foreground shrink-0"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Telegram Mini App — только Pro */}
                <FeatureGate feature="client_cabinet">
                <div className="p-3 rounded-lg border bg-[#2AABEE]/5 border-[#2AABEE]/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-[#2AABEE]" />
                    <p className="text-xs font-medium text-[#2AABEE]">{t('profile.qrTelegram')}</p>
                  </div>
                  <div className="flex gap-3 items-center">
                    <img
                      src={qrApiUrl}
                      alt="QR-код Telegram"
                      className="h-20 w-20 rounded-lg border bg-white shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <code className="text-xs truncate text-muted-foreground block">{tgBookingUrl}</code>
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs min-w-0"
                          onClick={() => { navigator.clipboard.writeText(tgBookingUrl); toast.success(t('profile.linkCopied')) }}
                        >
                          <Copy className="h-3 w-3 mr-1 shrink-0" />
                          <span className="truncate">{t('profile.copy')}</span>
                        </Button>
                        <a
                          href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(tgBookingUrl)}&download=1`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md border text-xs hover:bg-accent transition-colors shrink-0"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        <a
                          href={tgBookingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md border hover:bg-accent transition-colors text-muted-foreground shrink-0"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('profile.tgBookingHint')}
                      </p>
                    </div>
                  </div>
                </div>
                </FeatureGate>
              </div>
            )}
          </CardContent>
        </Card>
        </FeatureGate>

        {/* Telegram Notifications */}
        <FeatureGate feature="telegram" className="rounded-xl">
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
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    {t('profile.telegramConnected')}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    {t('profile.telegramConnectedDesc')}
                  </p>
                </div>
                <a
                  href={`https://t.me/ezzeapp_bot`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors text-emerald-600"
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
              href={`https://t.me/ezzeapp_bot?start=${bookingSlug}`}
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
        </FeatureGate>

        </div>{/* end settings grid */}

      </div>
    </form>
  )
}
