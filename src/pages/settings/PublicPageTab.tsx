import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Globe, Copy, Check, Share2, ExternalLink, QrCode, X,
  LayoutTemplate, Sparkles, Type, Zap,
  Image as ImageIcon, MapPin, Link2,
  Instagram, Send, Phone, Mail, Youtube, Music2,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile, useUpsertProfile } from '@/hooks/useProfile'
import { useAuth } from '@/contexts/AuthContext'
import { uploadImage } from '@/lib/storage'
import { toast } from '@/components/shared/Toaster'
import { PRODUCT } from '@/lib/config'
import type { LandingTemplate, LandingContent, PageSettings } from '@/types'
import { LandingContentEditor } from './LandingContentEditor'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

function storageUrl(bucket: string, path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`
}

// ── Шаблоны лендинга ────────────────────────────────────────────────────────

type TemplateOption = {
  id: LandingTemplate
  label: string
  tagline: string
  icon: React.ComponentType<{ className?: string }>
  preview: React.ReactNode
}

const CLEANING_TEMPLATES: TemplateOption[] = [
  {
    id: 'premium',
    label: 'Premium Glass',
    tagline: 'Тёмный, премиум-сегмент, glassmorphism',
    icon: Sparkles,
    preview: (
      <div className="rounded-lg overflow-hidden h-full" style={{ background: 'linear-gradient(135deg, #0b1226, #0f1d3a 60%, #1a3060)' }}>
        <div className="p-2.5 h-full flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded bg-cyan-300" />
            <div className="h-1 w-8 rounded bg-white/20" />
          </div>
          <div className="h-2 w-3/4 rounded bg-white/30 mt-1" />
          <div className="h-2 w-1/2 rounded bg-cyan-300/70" />
          <div className="grid grid-cols-2 gap-1 mt-1">
            <div className="h-5 rounded-md bg-white/10 border border-white/10" />
            <div className="h-5 rounded-md bg-white/10 border border-white/10" />
          </div>
          <div className="h-3 rounded bg-white mt-auto" />
        </div>
      </div>
    ),
  },
  {
    id: 'minimal',
    label: 'Clean Minimal',
    tagline: 'Белый, типографика, эко-эстетика',
    icon: Type,
    preview: (
      <div className="rounded-lg overflow-hidden h-full bg-white border border-slate-100">
        <div className="p-2.5 h-full flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="h-1.5 w-8 rounded bg-slate-900" />
            <div className="h-2 w-5 rounded-full bg-slate-900" />
          </div>
          <div className="h-2.5 w-full rounded bg-slate-900 mt-1.5" />
          <div className="h-2.5 w-3/5 rounded bg-emerald-600" />
          <div className="space-y-0.5 mt-1">
            <div className="h-1 w-full rounded bg-slate-200" />
            <div className="h-1 w-4/5 rounded bg-slate-200" />
          </div>
          <div className="h-3 rounded-full bg-slate-900 mt-auto" />
        </div>
      </div>
    ),
  },
  {
    id: 'bold',
    label: 'Vibrant Bold',
    tagline: 'Тёплый, дружелюбный, цветные блоки',
    icon: Zap,
    preview: (
      <div className="rounded-lg overflow-hidden h-full" style={{ background: 'linear-gradient(180deg, #FFF7E6, #FFE9CF, #FFD9E0)' }}>
        <div className="p-2.5 h-full flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <div className="h-2.5 w-2.5 rounded-md bg-slate-900 -rotate-6" />
            <div className="h-1 w-8 rounded bg-slate-900" />
          </div>
          <div className="h-2 w-2/3 rounded bg-slate-900 mt-1" />
          <div className="grid grid-cols-2 gap-1 mt-1">
            <div className="h-5 rounded-md bg-amber-300" />
            <div className="h-5 rounded-md bg-rose-300" />
            <div className="h-5 rounded-md bg-sky-300" />
            <div className="h-5 rounded-md bg-emerald-300" />
          </div>
          <div className="h-3 rounded-md bg-slate-900 mt-auto" />
        </div>
      </div>
    ),
  },
]

function TikTokIcon({ className }: { className?: string }) {
  return <Music2 className={className} />
}

// ── Card-обёртка ────────────────────────────────────────────────────────────

function Card({ title, description, icon: Icon, children }: {
  title: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

// ── Главный компонент ──────────────────────────────────────────────────────

export function PublicPageTab() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: profile, isLoading } = useProfile()
  const upsertProfile = useUpsertProfile()

  // Локальные drafts для контактов / соцсетей / адреса — комитим по blur.
  const [bio, setBio] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [notificationEmail, setNotificationEmail] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [instagram, setInstagram] = useState('')
  const [telegram, setTelegram] = useState('')
  const [youtube, setYoutube] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [website, setWebsite] = useState('')

  const [copied, setCopied] = useState(false)
  const [showBigQr, setShowBigQr] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const coverFileRef = useRef<HTMLInputElement>(null)

  const lastProfileIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!profile || profile.id === lastProfileIdRef.current) return
    lastProfileIdRef.current = profile.id
    setBio(profile.bio ?? '')
    setPhone(profile.phone ?? '')
    setWhatsapp(profile.whatsapp ?? '')
    setNotificationEmail(profile.notification_email ?? '')
    setCity(profile.city ?? '')
    setAddress(profile.address ?? '')
    setLat(profile.lat != null ? String(profile.lat) : '')
    setLng(profile.lng != null ? String(profile.lng) : '')
    setInstagram(profile.instagram ?? '')
    setTelegram(profile.telegram ?? '')
    setYoutube(profile.youtube ?? '')
    setTiktok(profile.tiktok ?? '')
    setWebsite(profile.website ?? '')
  }, [profile])

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
  }

  const pageSettings: PageSettings = profile?.page_settings ?? {}
  const pageUrl = `${window.location.origin}/p/${profile?.booking_slug ?? ''}`

  const up = (data: Record<string, unknown>) =>
    upsertProfile.mutateAsync({ id: profile?.id, data })

  const commit = async (data: Record<string, unknown>) => {
    try {
      await up(data)
    } catch {
      toast.error(t('common.saveError', 'Ошибка сохранения'))
    }
  }

  const commitWithToast = async (data: Record<string, unknown>) => {
    try {
      await up(data)
      toast.success(t('common.saved', 'Сохранено'))
    } catch {
      toast.error(t('common.saveError', 'Ошибка сохранения'))
    }
  }

  const togglePageEnabled = () => commit({ page_enabled: !profile?.page_enabled })

  const saveLandingTemplate = (template: LandingTemplate) =>
    commit({ page_settings: { ...pageSettings, landing_template: template } })

  const saveLandingContent = (content: LandingContent) =>
    commit({ page_settings: { ...pageSettings, landing_content: content } })

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setCoverUploading(true)
    try {
      const path = await uploadImage('covers', `${user.id}/cover`, file, 'banner')
      await up({ cover_url: path })
      toast.success(t('common.saved', 'Сохранено'))
    } catch {
      toast.error(t('common.uploadError', 'Ошибка загрузки'))
    } finally {
      setCoverUploading(false)
    }
  }

  const removeCover = () => commitWithToast({ cover_url: '' })

  const copyLink = () => {
    navigator.clipboard.writeText(pageUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sharePage = async () => {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: profile?.display_name || 'Ezze',
          text: t('publicPage.shareText', 'Посмотрите мою страницу'),
          url: pageUrl,
        })
      } catch { /* cancelled */ }
    } else {
      copyLink()
    }
  }

  const isCleaning = PRODUCT === 'cleaning'
  const templates = isCleaning ? CLEANING_TEMPLATES : []
  const activeTemplate = pageSettings.landing_template ?? 'premium'

  return (
    <div className="space-y-4 max-w-2xl">

      {/* ─── Статус и доступ ──────────────────────────────────────── */}
      <Card title={t('publicPage.pageStatus', 'Статус страницы')} icon={Globe}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {profile?.page_enabled !== false
                ? t('publicPage.pageEnabled', 'Страница активна')
                : t('publicPage.pageDisabled2', 'Страница отключена')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {profile?.page_enabled !== false
                ? t('publicPage.pageEnabledHint', 'Доступна всем по ссылке')
                : t('publicPage.pageDisabledHint', 'Никто не может открыть страницу')}
            </p>
          </div>
          <button
            onClick={togglePageEnabled}
            className={['relative inline-flex h-6 w-11 items-center rounded-full transition-colors', profile?.page_enabled !== false ? 'bg-primary' : 'bg-muted-foreground/30'].join(' ')}
          >
            <span className={['inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm', profile?.page_enabled !== false ? 'translate-x-6' : 'translate-x-1'].join(' ')} />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-0 px-3 py-2 bg-muted rounded-lg text-xs text-muted-foreground truncate font-mono">{pageUrl}</div>
          <Button size="sm" variant="outline" onClick={copyLink} className="gap-1.5 flex-shrink-0">
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t('common.copied', 'Скопировано') : t('publicPage.copyLink', 'Скопировать')}
          </Button>
          <Button size="sm" variant="outline" onClick={sharePage} className="gap-1.5 flex-shrink-0">
            <Share2 className="h-3.5 w-3.5" />
            {t('publicPage.share', 'Поделиться')}
          </Button>
          <a href={pageUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline"><ExternalLink className="h-3.5 w-3.5" /></Button>
          </a>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowBigQr(true)}
            className="bg-white p-1.5 rounded-lg border hover:border-primary transition-colors shrink-0"
            title={t('publicPage.openBigQr', 'Открыть большой QR')}
          >
            <QRCodeSVG value={pageUrl} size={88} level="M" />
          </button>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              {t('publicPage.qrHint', 'Разместите QR в Instagram или распечатайте для клиентов')}
            </p>
            <Button size="sm" variant="link" onClick={() => setShowBigQr(true)} className="h-auto p-0 mt-1 gap-1">
              <QrCode className="h-3.5 w-3.5" />
              {t('publicPage.openBigQr', 'Открыть большой QR')}
            </Button>
          </div>
        </div>
      </Card>

      {showBigQr && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowBigQr(false)}>
          <div className="bg-background rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{t('publicPage.qrShare', 'QR-код страницы')}</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowBigQr(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid place-items-center bg-white rounded-xl p-4">
              <QRCodeSVG value={pageUrl} size={260} level="M" />
            </div>
          </div>
        </div>
      )}

      {/* ─── Шаблон лендинга ────────────────────────────────────── */}
      {isCleaning && (
        <Card
          title={t('publicPage.landingTemplate', 'Шаблон лендинга')}
          description={t('publicPage.landingTemplateHint', 'Визуальный стиль публичной страницы. Услуги, цены и категории подтягиваются автоматически из раздела «Услуги».')}
          icon={LayoutTemplate}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {templates.map(tpl => {
              const isActive = activeTemplate === tpl.id
              const Icon = tpl.icon
              return (
                <button
                  key={tpl.id}
                  onClick={() => saveLandingTemplate(tpl.id)}
                  className={[
                    'rounded-xl border-2 transition-all text-left p-3 flex flex-col gap-2',
                    isActive ? 'border-primary shadow-md' : 'border-border hover:border-primary/50',
                  ].join(' ')}
                >
                  <div className="aspect-[4/5] w-full">{tpl.preview}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-sm font-semibold leading-tight">{tpl.label}</span>
                    {isActive && <Check className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">{tpl.tagline}</p>
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {/* ─── Hero и описание ─────────────────────────────────────── */}
      <Card
        title={t('publicPage.hero', 'Описание бизнеса')}
        description={t('publicPage.heroHint', 'Текст под заголовком и подзаголовок — отображаются на лендинге.')}
        icon={Sparkles}
      >
        <div className="space-y-1.5">
          <Label className="text-xs">{t('publicPage.bio', 'Описание (bio)')}</Label>
          <Textarea
            rows={3}
            placeholder="Например: Премиум химчистка с доставкой за 48 часов. Эко-средства, бережная обработка."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            onBlur={() => bio !== (profile?.bio ?? '') && commit({ bio })}
          />
          <p className="text-[11px] text-muted-foreground">Появляется в hero-блоке всех шаблонов.</p>
        </div>
      </Card>

      {/* ─── Контент лендинга (LandingContentEditor) ──────────────── */}
      {isCleaning && (
        <Card
          title={t('publicPage.landingContent', 'Контент лендинга')}
          description={t('publicPage.landingContentHint', 'Бейджи, числа, шаги «как работает» и отзывы.')}
          icon={LayoutTemplate}
        >
          <LandingContentEditor
            value={pageSettings.landing_content ?? {}}
            onCommit={saveLandingContent}
          />
        </Card>
      )}

      {/* ─── Обложка ────────────────────────────────────────────── */}
      <Card
        title={t('publicPage.coverPhoto', 'Обложка')}
        description={t('publicPage.coverHint', 'Большая картинка в hero (соотношение 16:6). Видна в шаблонах Minimal и Bold.')}
        icon={ImageIcon}
      >
        <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
        {profile?.cover_url ? (
          <div className="relative">
            <img src={storageUrl('covers', profile.cover_url)} alt="" className="w-full h-32 object-cover rounded-lg" />
            <button
              onClick={removeCover}
              className="absolute top-2 right-2 bg-black/50 rounded-full p-1 text-white hover:bg-black/70"
              title={t('common.delete', 'Удалить')}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => coverFileRef.current?.click()}
            disabled={coverUploading}
            className="w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary transition-colors"
          >
            <Globe className="h-6 w-6" />
            <span className="text-xs">{coverUploading ? t('common.uploading', 'Загрузка...') : t('publicPage.uploadCover', 'Загрузить обложку (16:6)')}</span>
          </button>
        )}
      </Card>

      {/* ─── Контакты ───────────────────────────────────────────── */}
      <Card
        title={t('publicPage.contacts', 'Контакты на лендинге')}
        description={t('publicPage.contactsHint', 'Видны клиентам в hero, header, футере и кнопках связи.')}
        icon={Phone}
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5"><Phone className="h-3 w-3" /> {t('profile.phone', 'Телефон')}</Label>
            <Input
              placeholder="+998 90 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => phone !== (profile?.phone ?? '') && commit({ phone })}
              readOnly={!!profile?.tg_chat_id}
              className={profile?.tg_chat_id ? 'bg-muted/40 cursor-not-allowed' : ''}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5"><Send className="h-3 w-3" /> WhatsApp</Label>
            <Input
              placeholder="+998 90 123 45 67"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              onBlur={() => whatsapp !== (profile?.whatsapp ?? '') && commit({ whatsapp })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5"><Mail className="h-3 w-3" /> {t('profile.notificationEmail', 'Email для уведомлений')}</Label>
          <Input
            type="email"
            placeholder="business@email.com"
            value={notificationEmail}
            onChange={(e) => setNotificationEmail(e.target.value)}
            onBlur={() => notificationEmail !== (profile?.notification_email ?? '') && commit({ notification_email: notificationEmail })}
          />
        </div>
      </Card>

      {/* ─── Адрес ─────────────────────────────────────────────── */}
      <Card
        title={t('publicPage.location', 'Адрес')}
        description={t('publicPage.locationHint', 'Появляется в footer + ссылка на Google Maps.')}
        icon={MapPin}
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('profile.city', 'Город')}</Label>
            <Input
              placeholder="Ташкент"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onBlur={() => city !== (profile?.city ?? '') && commit({ city })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('profile.address', 'Адрес')}</Label>
            <Input
              placeholder="ул. Амира Темура 12"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onBlur={() => address !== (profile?.address ?? '') && commit({ address })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Latitude ({t('common.optional', 'необязательно')})</Label>
            <Input
              type="number"
              step="any"
              placeholder="41.2995"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              onBlur={() => {
                const v = lat === '' ? null : Number(lat)
                if (v !== (profile?.lat ?? null)) commit({ lat: v })
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Longitude ({t('common.optional', 'необязательно')})</Label>
            <Input
              type="number"
              step="any"
              placeholder="69.2401"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              onBlur={() => {
                const v = lng === '' ? null : Number(lng)
                if (v !== (profile?.lng ?? null)) commit({ lng: v })
              }}
            />
          </div>
        </div>
      </Card>

      {/* ─── Соцсети ────────────────────────────────────────────── */}
      <Card
        title={t('publicPage.socialLinks', 'Социальные сети')}
        description={t('publicPage.socialHint', 'Иконки в шапке и футере лендинга.')}
        icon={Link2}
      >
        <div className="space-y-2">
          {([
            { key: 'instagram', icon: Instagram, label: 'Instagram', placeholder: '@username', value: instagram, set: setInstagram, commit: 'instagram' as const, current: profile?.instagram ?? '' },
            { key: 'telegram',  icon: Send,      label: 'Telegram',  placeholder: '@username или t.me/...', value: telegram, set: setTelegram, commit: 'telegram' as const, current: profile?.telegram ?? '' },
            { key: 'youtube',   icon: Youtube,   label: 'YouTube',   placeholder: '@channel или youtube.com/...', value: youtube, set: setYoutube, commit: 'youtube' as const, current: profile?.youtube ?? '' },
            { key: 'tiktok',    icon: TikTokIcon, label: 'TikTok',   placeholder: '@username', value: tiktok, set: setTiktok, commit: 'tiktok' as const, current: profile?.tiktok ?? '' },
            { key: 'website',   icon: Globe,     label: 'Сайт',      placeholder: 'https://...', value: website, set: setWebsite, commit: 'website' as const, current: profile?.website ?? '' },
          ]).map(({ key, icon: Icon, label, placeholder, value, set, commit: field, current }) => (
            <div key={key} className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                aria-label={label}
                placeholder={placeholder}
                value={value}
                onChange={(e) => set(e.target.value)}
                onBlur={() => value !== current && commit({ [field]: value })}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
