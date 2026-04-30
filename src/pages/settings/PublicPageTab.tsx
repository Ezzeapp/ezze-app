import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Globe, Copy, Check, Share2, ExternalLink, QrCode, X,
  LayoutTemplate, Sparkles, Type, Zap, Cpu, Heart,
  Image as ImageIcon, MapPin, Link2, ImagePlus, Trash2, Clock,
  ScrollText, Briefcase, User as UserIcon, Camera,
  Instagram, Send, Phone, Mail, Youtube, Music2,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile, useUpsertProfile } from '@/hooks/useProfile'
import { useServices } from '@/hooks/useServices'
import { useAuth } from '@/contexts/AuthContext'
import { uploadImage } from '@/lib/storage'
import { toast } from '@/components/shared/Toaster'
import { formatCurrency } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
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

const BEAUTY_TEMPLATES: TemplateOption[] = [
  {
    id: 'glamour',
    label: 'Glamour',
    tagline: 'Премиум на чёрном с золотом, журнальный стиль',
    icon: Sparkles,
    preview: (
      <div className="rounded-lg overflow-hidden h-full" style={{ background: '#0e0d0c' }}>
        <div className="p-2.5 h-full flex flex-col gap-1.5">
          <div className="h-1 w-6 rounded" style={{ background: '#c9a14a' }} />
          <div className="h-2.5 w-3/4 rounded bg-white/85 mt-1" />
          <div className="h-2.5 w-1/2 rounded italic" style={{ background: '#c9a14a' }} />
          <div className="h-px w-6" style={{ background: '#c9a14a' }} />
          <div className="space-y-0.5 mt-0.5">
            <div className="h-0.5 w-full rounded bg-white/30" />
            <div className="h-0.5 w-3/4 rounded bg-white/30" />
          </div>
          <div className="h-3 rounded mt-auto" style={{ background: '#c9a14a' }} />
        </div>
      </div>
    ),
  },
  {
    id: 'soft',
    label: 'Soft Pastel',
    tagline: 'Кремовый+коралл, дружелюбный, универсальный',
    icon: Type,
    preview: (
      <div className="rounded-lg overflow-hidden h-full" style={{ background: '#fdf9f3' }}>
        <div className="p-2.5 h-full flex flex-col gap-1.5">
          <div className="h-2 w-2 rounded-lg" style={{ background: '#e8927c' }} />
          <div className="h-2.5 w-3/4 rounded bg-stone-800 mt-1" />
          <div className="h-2.5 w-1/2 rounded italic" style={{ background: '#d77a63' }} />
          <div className="grid grid-cols-2 gap-1 mt-0.5">
            <div className="h-4 rounded-lg bg-white border border-stone-200" />
            <div className="h-4 rounded-lg bg-white border border-stone-200" />
          </div>
          <div className="h-3 rounded-full mt-auto" style={{ background: '#e8927c' }} />
        </div>
      </div>
    ),
  },
  {
    id: 'editorial',
    label: 'Editorial Bold',
    tagline: 'Огромная типографика, fashion-edge',
    icon: Zap,
    preview: (
      <div className="rounded-lg overflow-hidden h-full border-2 border-stone-900" style={{ background: '#f5f1ea' }}>
        <div className="p-2 h-full flex flex-col gap-1">
          <div className="bg-stone-900 -mx-2 -mt-2 px-2 py-1 mb-1 flex items-center gap-1">
            <span className="h-0.5 w-4 rounded bg-amber-100" />
            <span className="h-0.5 w-3 rounded bg-amber-100/60" />
          </div>
          <div className="h-3 w-full rounded-sm bg-stone-900 mt-0.5" />
          <div className="h-3 w-5/6 rounded-sm" style={{ background: '#ff5b3a' }} />
          <div className="grid grid-cols-2 gap-1 mt-0.5">
            <div className="h-3 rounded-sm border border-stone-900" />
            <div className="h-3 rounded-sm border border-stone-900" />
          </div>
          <div className="h-3 rounded-sm mt-auto border-2 border-stone-900" style={{ background: '#ff5b3a' }} />
        </div>
      </div>
    ),
  },
]

const WORKSHOP_TEMPLATES: TemplateOption[] = [
  {
    id: 'pro_tech',
    label: 'Pro Tech',
    tagline: 'Тёмный, профессиональный — для сервисных центров',
    icon: Cpu,
    preview: (
      <div className="rounded-lg overflow-hidden h-full" style={{ background: '#0a0e1a' }}>
        <div className="p-2.5 h-full flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }} />
            <div className="h-1 w-8 rounded bg-white/20" />
          </div>
          <div className="h-2.5 w-3/4 rounded bg-white/85 mt-1" />
          <div className="h-2.5 w-1/2 rounded" style={{ background: 'linear-gradient(135deg, #60a5fa, #c084fc)' }} />
          <div className="grid grid-cols-2 gap-1 mt-1">
            <div className="h-5 rounded-md border border-blue-500/30 bg-blue-500/10" />
            <div className="h-5 rounded-md border border-blue-500/30 bg-blue-500/10" />
          </div>
          <div className="h-3 rounded-md mt-auto" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }} />
        </div>
      </div>
    ),
  },
  {
    id: 'minimal_clean',
    label: 'Minimal Clean',
    tagline: 'Светлый, минималистичный — для современных мастерских',
    icon: Type,
    preview: (
      <div className="rounded-lg overflow-hidden h-full bg-zinc-50 border border-zinc-200">
        <div className="p-2.5 h-full flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="h-1.5 w-8 rounded bg-zinc-900" />
            <div className="h-2 w-5 rounded-full bg-zinc-900" />
          </div>
          <div className="h-2.5 w-full rounded bg-zinc-900 mt-1.5" />
          <div className="h-2.5 w-3/5 rounded bg-amber-500" />
          <div className="grid grid-cols-3 gap-0.5 mt-1">
            <div className="h-4 rounded bg-white border border-zinc-200" />
            <div className="h-4 rounded bg-white border border-zinc-200" />
            <div className="h-4 rounded bg-white border border-zinc-200" />
          </div>
          <div className="h-3 rounded-full bg-zinc-900 mt-auto" />
        </div>
      </div>
    ),
  },
  {
    id: 'local_friendly',
    label: 'Local Friendly',
    tagline: 'Тёплый, домашний — для местной мастерской "у мастера"',
    icon: Heart,
    preview: (
      <div className="rounded-lg overflow-hidden h-full bg-stone-50">
        <div className="p-2.5 h-full flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-md bg-orange-500" />
            <div className="h-1 w-8 rounded bg-stone-900" />
          </div>
          <div className="h-2.5 w-3/4 rounded bg-stone-900 mt-1" />
          <div className="h-2.5 w-2/5 rounded italic bg-orange-500" />
          <div className="grid grid-cols-2 gap-1 mt-1">
            <div className="h-5 rounded-md bg-amber-100" />
            <div className="h-5 rounded-md bg-orange-200" />
          </div>
          <div className="h-3 rounded-full bg-orange-500 mt-auto" />
        </div>
      </div>
    ),
  },
]

const DEFAULT_TEMPLATE: Record<string, LandingTemplate> = { cleaning: 'premium', beauty: 'soft', workshop: 'pro_tech' }

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
  const { data: services = [] } = useServices()
  const upsertProfile = useUpsertProfile()
  const currency = useCurrency()

  // Локальные drafts для контактов / соцсетей / адреса — комитим по blur.
  const [displayName, setDisplayName] = useState('')
  const [profession, setProfession] = useState('')
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
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [portfolioUploading, setPortfolioUploading] = useState(false)
  const coverFileRef = useRef<HTMLInputElement>(null)
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const portfolioFileRef = useRef<HTMLInputElement>(null)

  const lastProfileIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!profile || profile.id === lastProfileIdRef.current) return
    lastProfileIdRef.current = profile.id
    setDisplayName(profile.display_name ?? '')
    setProfession(profile.profession ?? '')
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
  const isBeauty = PRODUCT === 'beauty'
  const isWorkshop = PRODUCT === 'workshop'
  const templates = isBeauty
    ? BEAUTY_TEMPLATES
    : isCleaning
      ? CLEANING_TEMPLATES
      : isWorkshop
        ? WORKSHOP_TEMPLATES
        : []
  const defaultTpl = DEFAULT_TEMPLATE[PRODUCT] ?? 'premium'
  const activeTemplate = pageSettings.landing_template ?? defaultTpl
  const lc = pageSettings.landing_content ?? {}
  const patchLandingContent = (patch: Partial<LandingContent>) =>
    saveLandingContent({ ...lc, ...patch })

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
      {(isCleaning || isBeauty || isWorkshop) && (
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

      {/* ─── О мастере / Hero ─────────────────────────────────────── */}
      <Card
        title={t('publicPage.hero', 'О мастере')}
        description={t('publicPage.heroHint', 'Название, профессия и описание показываются в hero-блоке лендинга.')}
        icon={Briefcase}
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Название (отображается в шапке)</Label>
            <Input
              placeholder="Камила · Brow studio"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={() => displayName !== (profile?.display_name ?? '') && commit({ display_name: displayName })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Профессия / специализация</Label>
            <Input
              placeholder="Brow & lash artist"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              onBlur={() => profession !== (profile?.profession ?? '') && commit({ profession })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('publicPage.bio', 'Описание (bio)')}</Label>
          <Textarea
            rows={3}
            placeholder="Например: 7 лет опыта, сертифицированный мастер. Работаю с премиум-материалами."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            onBlur={() => bio !== (profile?.bio ?? '') && commit({ bio })}
          />
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

      {/* ─── Контент лендинга для workshop ─────────────────────────── */}
      {isWorkshop && (
        <Card
          title="Настройки лендинга"
          description="Бейджи, числа и счётчики, которые показываются на публичной странице. Услуги и цены подтягиваются автоматически из раздела «Услуги»."
          icon={LayoutTemplate}
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Подзаголовок (hero)</Label>
              <Input
                placeholder="Профессиональный ремонт техники"
                defaultValue={lc.business_subtitle ?? ''}
                onBlur={(e) => e.target.value !== (lc.business_subtitle ?? '') && patchLandingContent({ business_subtitle: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Бейдж в hero</Label>
              <Input
                placeholder="Гарантия 6 месяцев"
                defaultValue={lc.hero_badge ?? ''}
                onBlur={(e) => e.target.value !== (lc.hero_badge ?? '') && patchLandingContent({ hero_badge: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Гарантия, мес.</Label>
              <Input
                type="number"
                min={0}
                placeholder="6"
                defaultValue={lc.warranty_months ?? ''}
                onBlur={(e) => {
                  const v = e.target.value === '' ? undefined : Number(e.target.value)
                  if (v !== lc.warranty_months) patchLandingContent({ warranty_months: v })
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Диагностика, мин.</Label>
              <Input
                type="number"
                min={0}
                placeholder="30"
                defaultValue={lc.diagnostics_minutes ?? ''}
                onBlur={(e) => {
                  const v = e.target.value === '' ? undefined : Number(e.target.value)
                  if (v !== lc.diagnostics_minutes) patchLandingContent({ diagnostics_minutes: v })
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">% успешных</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="98"
                defaultValue={lc.success_rate_percent ?? ''}
                onBlur={(e) => {
                  const v = e.target.value === '' ? undefined : Number(e.target.value)
                  if (v !== lc.success_rate_percent) patchLandingContent({ success_rate_percent: v })
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Всего ремонтов</Label>
              <Input
                type="number"
                min={0}
                placeholder="1200"
                defaultValue={lc.total_repairs ?? ''}
                onBlur={(e) => {
                  const v = e.target.value === '' ? undefined : Number(e.target.value)
                  if (v !== lc.total_repairs) patchLandingContent({ total_repairs: v })
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Лет в работе</Label>
              <Input
                type="number"
                min={0}
                placeholder="5"
                defaultValue={lc.years_in_business ?? ''}
                onBlur={(e) => {
                  const v = e.target.value === '' ? undefined : Number(e.target.value)
                  if (v !== lc.years_in_business) patchLandingContent({ years_in_business: v })
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Часы работы</Label>
              <Input
                placeholder="Пн–Сб 9:00–20:00"
                defaultValue={lc.working_hours ?? ''}
                onBlur={(e) => e.target.value !== (lc.working_hours ?? '') && patchLandingContent({ working_hours: e.target.value })}
              />
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 cursor-pointer rounded-lg border p-3 bg-muted/30">
            <div className="min-w-0">
              <div className="text-sm font-medium">Бесплатная диагностика</div>
              <div className="text-[11px] text-muted-foreground">Бейдж «Бесплатная диагностика» в hero и CTA</div>
            </div>
            <Switch
              checked={lc.diagnostics_free ?? true}
              onCheckedChange={(v) => patchLandingContent({ diagnostics_free: v })}
            />
          </label>
        </Card>
      )}

      {/* ─── Отзывы (workshop) ───────────────────────────────────── */}
      {isWorkshop && (
        <Card
          title={`Отзывы клиентов (${(lc.reviews ?? []).length}/6)`}
          description="Показываются на лендинге в отдельной секции. Если оставить пустым — секция не отобразится."
          icon={ScrollText}
        >
          <div className="space-y-3">
            {(lc.reviews ?? []).map((r, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2 bg-background">
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Имя клиента"
                    defaultValue={r.name}
                    onBlur={(e) => {
                      const next = [...(lc.reviews ?? [])]
                      next[i] = { ...next[i], name: e.target.value }
                      patchLandingContent({ reviews: next })
                    }}
                  />
                  <select
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    defaultValue={r.rating ?? 5}
                    onChange={(e) => {
                      const next = [...(lc.reviews ?? [])]
                      next[i] = { ...next[i], rating: Number(e.target.value) }
                      patchLandingContent({ reviews: next })
                    }}
                  >
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}★</option>)}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => patchLandingContent({ reviews: (lc.reviews ?? []).filter((_, idx) => idx !== i) })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  placeholder="Текст отзыва"
                  defaultValue={r.text}
                  onBlur={(e) => {
                    const next = [...(lc.reviews ?? [])]
                    next[i] = { ...next[i], text: e.target.value }
                    patchLandingContent({ reviews: next })
                  }}
                />
                <Input
                  placeholder='Подпись (например, "iPhone 13 · 2 недели назад")'
                  defaultValue={r.date ?? ''}
                  onBlur={(e) => {
                    const next = [...(lc.reviews ?? [])]
                    next[i] = { ...next[i], date: e.target.value }
                    patchLandingContent({ reviews: next })
                  }}
                />
              </div>
            ))}
            {(lc.reviews ?? []).length < 6 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => patchLandingContent({ reviews: [...(lc.reviews ?? []), { name: '', text: '', rating: 5 }] })}
              >
                Добавить отзыв
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* ─── Аватар ────────────────────────────────────────────── */}
      <Card
        title={t('publicPage.avatar', 'Аватар / фото')}
        description={t('publicPage.avatarHint', 'Круглое фото в hero и шапке лендинга. Квадратный кадр, до 2 МБ.')}
        icon={UserIcon}
      >
        <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file || !user?.id) return
          setAvatarUploading(true)
          try {
            const path = await uploadImage('avatars', `${user.id}/avatar`, file, 'avatar')
            await up({ avatar: path })
            toast.success(t('common.saved', 'Сохранено'))
          } catch { toast.error(t('common.uploadError', 'Ошибка загрузки')) }
          finally { setAvatarUploading(false); e.target.value = '' }
        }} />
        <div className="flex items-center gap-4">
          {profile?.avatar ? (
            <div className="relative">
              <img src={storageUrl('avatars', profile.avatar)} alt="" className="h-20 w-20 rounded-full object-cover" />
              <button
                onClick={() => commitWithToast({ avatar: '' })}
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow"
                title={t('common.delete', 'Удалить')}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground">
              {(displayName || profession || '?')[0].toUpperCase()}
            </div>
          )}
          <Button variant="outline" size="sm" disabled={avatarUploading} onClick={() => avatarFileRef.current?.click()}>
            <Camera className="h-3.5 w-3.5 mr-1.5" />
            {avatarUploading ? t('common.uploading', 'Загрузка...') : t('publicPage.uploadAvatar', 'Загрузить')}
          </Button>
        </div>
      </Card>

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

      {/* ─── График работы (ссылка на отдельную вкладку) ─────────── */}
      <Card
        title={t('publicPage.workingHours', 'График работы')}
        description={t('publicPage.workingHoursHint', 'Часы работы по дням редактируются на отдельной вкладке «Расписание». Они автоматически отображаются на лендинге и используются при онлайн-записи.')}
        icon={Clock}
      >
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => window.dispatchEvent(new CustomEvent('settings:set-tab', { detail: 'schedule' }))}
        >
          <Clock className="h-3.5 w-3.5 mr-1.5" />
          {t('publicPage.openSchedule', 'Открыть расписание')}
        </Button>
      </Card>

      {/* ─── Портфолио ────────────────────────────────────────────── */}
      <Card
        title={`${t('publicPage.portfolio', 'Портфолио')} (${(profile?.portfolio ?? []).length}/12)`}
        description={t('publicPage.portfolioHint', 'Фото работ — отображаются в галерее лендинга. До 12 снимков.')}
        icon={ImagePlus}
      >
        <input ref={portfolioFileRef} type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
          const files = Array.from(e.target.files ?? [])
          if (!files.length || !user?.id) return
          setPortfolioUploading(true)
          try {
            const current = profile?.portfolio ?? []
            const remaining = Math.max(0, 12 - current.length)
            const toUpload = files.slice(0, remaining)
            const paths = await Promise.all(
              toUpload.map((f, i) => uploadImage('portfolio', `${user.id}/portfolio-${Date.now()}-${i}`, f, 'service'))
            )
            await up({ portfolio: [...current, ...paths] })
            toast.success(t('common.saved', 'Сохранено'))
          } catch { toast.error(t('common.uploadError', 'Ошибка загрузки')) }
          finally { setPortfolioUploading(false); e.target.value = '' }
        }} />
        {(profile?.portfolio ?? []).length === 0 ? (
          <button
            onClick={() => portfolioFileRef.current?.click()}
            disabled={portfolioUploading}
            className="w-full py-10 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary transition-colors"
          >
            <ImagePlus className="h-7 w-7" />
            <span className="text-xs">{portfolioUploading ? t('common.uploading', 'Загрузка...') : t('publicPage.uploadPortfolio', 'Загрузить фото работ')}</span>
          </button>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {(profile?.portfolio ?? []).map(filename => (
                <div key={filename} className="relative group aspect-square">
                  <img src={storageUrl('portfolio', filename)} alt="" className="w-full h-full object-cover rounded-lg" />
                  <button
                    onClick={() => commit({ portfolio: (profile?.portfolio ?? []).filter(f => f !== filename) })}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    title={t('common.delete', 'Удалить')}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            {(profile?.portfolio ?? []).length < 12 && (
              <Button variant="outline" size="sm" onClick={() => portfolioFileRef.current?.click()} disabled={portfolioUploading} className="w-full mt-2">
                <ImagePlus className="h-3.5 w-3.5 mr-1.5" />
                {portfolioUploading ? t('common.uploading', 'Загрузка...') : t('publicPage.addPhotos', 'Добавить ещё')}
              </Button>
            )}
          </>
        )}
      </Card>

      {/* ─── Услуги (read-only превью) ────────────────────────────── */}
      <Card
        title={`${t('publicPage.services', 'Услуги на лендинге')} (${services.length})`}
        description={t('publicPage.servicesHint', 'Услуги и цены подтягиваются автоматически из раздела «Услуги». Здесь только просмотр — для редактирования перейдите в раздел Услуг.')}
        icon={ScrollText}
      >
        <Link
          to="/services"
          className="inline-flex w-full items-center justify-center gap-1.5 h-8 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {t('publicPage.editServices', 'Изменить услуги')}
        </Link>
        {services.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
            <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-40" />
            {t('publicPage.noServices', 'Пока нет услуг')}
          </div>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {services.slice(0, 30).map(s => (
              <div key={s.id} className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm ${s.is_active ? '' : 'opacity-50'}`}>
                <span className="truncate flex-1">{s.name}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{s.duration_min} {t('services.minutes', 'мин')}</span>
                <span className="font-semibold whitespace-nowrap min-w-[80px] text-right">{formatCurrency(s.price, currency)}</span>
              </div>
            ))}
            {services.length > 30 && (
              <p className="text-[11px] text-center text-muted-foreground pt-2">
                … и ещё {services.length - 30}.
              </p>
            )}
          </div>
        )}
      </Card>

    </div>
  )
}
