import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Copy, Check, Instagram, Send, Phone, Youtube, Link2, MapPin, ShoppingBag, Plus, Pencil, Trash2, X, ExternalLink, Share2, QrCode, Sparkles, Type, Zap, LayoutTemplate } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile, useUpsertProfile } from '@/hooks/useProfile'
import { useMyProducts, useUpsertProduct, useDeleteProduct } from '@/hooks/useMasterProducts'
import { useAuth } from '@/contexts/AuthContext'
import { uploadImage } from '@/lib/storage'
import { TEMPLATE_LIST } from '@/lib/pageTheme'
import { toast } from '@/components/shared/Toaster'
import { formatCurrency } from '@/lib/utils'
import { PRODUCT } from '@/lib/config'
import type { MasterProduct, PageSettings, LandingTemplate } from '@/types'

const LANDING_TEMPLATES: { id: LandingTemplate; label: string; tagline: string; icon: typeof Sparkles; preview: React.ReactNode }[] = [
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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

function storageUrl(bucket: string, path: string) {
  return SUPABASE_URL + '/storage/v1/object/public/' + bucket + '/' + path
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
    </svg>
  )
}

function Card({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{className?:string}>; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  )
}
interface ProductDialogProps {
  product: Partial<MasterProduct> | null
  onClose: () => void
}

function ProductDialog({ product, onClose }: ProductDialogProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const upsert = useUpsertProduct()
  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [price, setPrice] = useState(String(product?.price ?? ''))
  const [isAvailable, setIsAvailable] = useState(product?.is_available ?? true)
  const [photoUrl, setPhotoUrl] = useState(product?.photo_url ?? '')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setUploading(true)
    try {
      const path = await uploadImage('products', user.id + '/' + Date.now(), file, 'service')
      setPhotoUrl(storageUrl('products', path))
    } catch { toast.error('Ошибка загрузки') }
    finally { setUploading(false) }
  }

  const handleSave = async () => {
    if (!name.trim()) return
    try {
      await upsert.mutateAsync({
        ...(product?.id ? { id: product.id } : {}),
        name: name.trim(),
        description: description.trim() || undefined,
        price: Number(price) || 0,
        is_available: isAvailable,
        photo_url: photoUrl || undefined,
        order_index: product?.order_index ?? 0,
      })
      toast.success(t('common.saved', 'Сохранено'))
      onClose()
    } catch { toast.error(t('common.error', 'Ошибка')) }
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {product?.id ? t('publicPage.editProduct', 'Редактировать товар') : t('publicPage.addProduct', 'Добавить товар')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            {photoUrl ? (
              <div className="relative">
                <img src={photoUrl} alt="" className="w-full h-36 object-cover rounded-lg" />
                <button
                  onClick={() => setPhotoUrl('')}
                  className="absolute top-2 right-2 bg-black/50 rounded-full p-1 text-white hover:bg-black/70"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary transition-colors"
              >
                <ShoppingBag className="h-6 w-6" />
                <span className="text-xs">{uploading ? t('common.uploading', 'Загрузка...') : t('common.addPhoto', 'Добавить фото')}</span>
              </button>
            )}
          </div>
          <div>
            <Label>{t('common.name', 'Название')}</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('publicPage.productNamePlaceholder', 'Например: Маска для волос')} />
          </div>
          <div>
            <Label>{t('common.description', 'Описание')}</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder={t('common.optional', 'Необязательно')} />
          </div>
          <div>
            <Label>{t('billing.price', 'Цена')} (UZS)</Label>
            <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isAvailable} onChange={e => setIsAvailable(e.target.checked)} className="h-4 w-4 rounded" />
            <span className="text-sm">{t('publicPage.isAvailable', 'В наличии')}</span>
          </label>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              {t('common.cancel', 'Отмена')}
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={!name.trim() || upsert.isPending}>
              {t('common.save', 'Сохранить')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
export function PublicPageTab() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { data: profile, isLoading } = useProfile()
  const upsertProfile = useUpsertProfile()
  const { data: products = [], isLoading: productsLoading } = useMyProducts()
  const deleteProduct = useDeleteProduct()
  const [copied, setCopied] = useState(false)
  const [showBigQr, setShowBigQr] = useState(false)
  const [editProduct, setEditProduct] = useState<Partial<MasterProduct> | null>(null)
  const [coverUploading, setCoverUploading] = useState(false)
  const coverFileRef = useRef<HTMLInputElement>(null)
  const [socials, setSocials] = useState({
    instagram: profile?.instagram ?? '',
    telegram:  profile?.telegram  ?? '',
    whatsapp:  profile?.whatsapp  ?? '',
    vk:        profile?.vk        ?? '',
    youtube:   profile?.youtube   ?? '',
    tiktok:    profile?.tiktok    ?? '',
    website:   profile?.website   ?? '',
  })
  const [address, setAddress] = useState(profile?.address ?? '')
  const [city, setCity]       = useState(profile?.city    ?? '')
  const [lat, setLat]         = useState(String(profile?.lat ?? ''))
  const [lng, setLng]         = useState(String(profile?.lng ?? ''))
  const [pageSettings, setPageSettings] = useState<PageSettings>(profile?.page_settings ?? {})

  if (profile && socials.instagram === '' && profile.instagram) {
    setSocials({
      instagram: profile.instagram ?? '',
      telegram:  profile.telegram  ?? '',
      whatsapp:  profile.whatsapp  ?? '',
      vk:        profile.vk        ?? '',
      youtube:   profile.youtube   ?? '',
      tiktok:    profile.tiktok    ?? '',
      website:   profile.website   ?? '',
    })
  }
  if (!isLoading && profile && isLoading === false) {
    if (address === '' && profile.address) setAddress(profile.address)
    if (city === '' && profile.city) setCity(profile.city)
    if (lat === '' && profile.lat) setLat(String(profile.lat))
    if (lng === '' && profile.lng) setLng(String(profile.lng))
  }

  const pageUrl = window.location.origin + '/p/' + (profile?.booking_slug ?? '')

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
      } catch { /* user cancelled */ }
    } else {
      copyLink()
    }
  }

  const up = (data: Record<string, unknown>) =>
    upsertProfile.mutateAsync({ id: profile?.id, data })

  const saveSocials = async () => {
    try {
      await up({ ...socials })
      toast.success(t('common.saved', 'Сохранено'))
    } catch { toast.error(t('common.error', 'Ошибка')) }
  }

  const saveLocation = async () => {
    try {
      await up({
        address: address || undefined,
        city:    city    || undefined,
        lat:     lat     ? Number(lat) : undefined,
        lng:     lng     ? Number(lng) : undefined,
      })
      toast.success(t('common.saved', 'Сохранено'))
    } catch { toast.error(t('common.error', 'Ошибка')) }
  }

  const togglePageEnabled = async () => {
    try { await up({ page_enabled: !profile?.page_enabled }) }
    catch { toast.error(t('common.error', 'Ошибка')) }
  }

  const saveDesign = async (settings: PageSettings) => {
    setPageSettings(settings)
    try {
      await up({ page_settings: settings })
      toast.success(t('common.saved', 'Сохранено'))
    } catch { toast.error(t('common.error', 'Ошибка')) }
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setCoverUploading(true)
    try {
      const path = await uploadImage('covers', user.id + '/cover', file, 'banner')
      await up({ cover_url: path })
      toast.success(t('common.saved', 'Сохранено'))
    } catch { toast.error('Ошибка загрузки') }
    finally { setCoverUploading(false) }
  }

  if (isLoading) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
  }

  const currentSettings = pageSettings
  return (
    <div className="space-y-4 max-w-xl">
      <Card title={t('publicPage.pageStatus', 'Статус страницы')} icon={Globe}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {profile?.page_enabled !== false
                ? t('publicPage.pageEnabled', 'Страница активна')
                : t('publicPage.pageDisabled2', 'Страница отключена')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {profile?.page_enabled !== false ? '🟢' : '🔴'}{' '}
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
            className="bg-white p-1.5 rounded-lg border hover:border-primary transition-colors"
            title={t('publicPage.openBigQr', 'Открыть большой QR')}
          >
            <QRCodeSVG value={pageUrl} size={96} level="M" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              {t('publicPage.qrHint', 'Разместите QR-код в своём Instagram или распечатайте для клиентов')}
            </p>
            <Button size="sm" variant="link" onClick={() => setShowBigQr(true)} className="h-auto p-0 mt-1 gap-1">
              <QrCode className="h-3.5 w-3.5" />
              {t('publicPage.openBigQr', 'Открыть большой QR')}
            </Button>
          </div>
        </div>
      </Card>

      {/* Большой QR */}
      {showBigQr && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowBigQr(false)}
        >
          <div
            className="bg-background rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{t('publicPage.qrShare', 'QR-код страницы')}</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowBigQr(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('publicPage.qrShareHint', 'Покажите клиенту экран — он отсканирует и откроет вашу страницу.')}
            </p>
            <div className="grid place-items-center bg-white rounded-xl p-4">
              <QRCodeSVG value={pageUrl} size={260} level="M" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyLink} className="flex-1 gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t('common.copied', 'Скопировано') : t('publicPage.copyLink', 'Скопировать')}
              </Button>
              <Button size="sm" variant="outline" onClick={sharePage} className="flex-1 gap-1.5">
                <Share2 className="h-3.5 w-3.5" />
                {t('publicPage.share', 'Поделиться')}
              </Button>
            </div>
          </div>
        </div>
      )}
      {PRODUCT === 'cleaning' && (
        <Card title={t('publicPage.landingTemplate', 'Шаблон лендинга')} icon={LayoutTemplate}>
          <p className="text-xs text-muted-foreground -mt-2">
            {t('publicPage.landingTemplateHint', 'Выберите визуальный стиль публичной страницы. Категории, цены и контакты подтягиваются автоматически.')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {LANDING_TEMPLATES.map(tpl => {
              const isActive = (currentSettings.landing_template ?? 'premium') === tpl.id
              const Icon = tpl.icon
              return (
                <button
                  key={tpl.id}
                  onClick={() => saveDesign({ ...currentSettings, landing_template: tpl.id })}
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

      <Card title={t('publicPage.design', 'Дизайн страницы')} icon={Globe}>
        <div>
          <p className="text-xs text-muted-foreground mb-2">{t('publicPage.template', 'Шаблон')}</p>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATE_LIST.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => saveDesign({ ...currentSettings, template: tpl.id as PageSettings['template'] })}
                className={['p-3 rounded-lg border-2 text-left transition-all', currentSettings.template === tpl.id || (!currentSettings.template && tpl.id === 'minimal') ? 'border-primary' : 'border-border hover:border-primary/50'].join(' ')}
                style={{ backgroundColor: tpl.bg }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: tpl.accent }} />
                  <div className="h-2 w-12 rounded-full bg-gray-300/50" />
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-200/50 mb-1" />
                <div className="h-1.5 w-3/4 rounded-full bg-gray-200/50" />
                <p className="text-[10px] font-medium mt-2" style={{ color: tpl.accent }}>{tpl.label}</p>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-2">{t('publicPage.accentColor', 'Цвет акцента')}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {['#6366f1','#ec4899','#f59e0b','#10b981','#ef4444','#0ea5e9'].map(color => (
              <button
                key={color}
                onClick={() => saveDesign({ ...currentSettings, accent: color })}
                className={['h-7 w-7 rounded-full border-2 transition-transform hover:scale-110', currentSettings.accent === color ? 'border-zinc-900 dark:border-white scale-110' : 'border-transparent'].join(' ')}
                style={{ backgroundColor: color }}
              />
            ))}
            <input
              type="color"
              value={currentSettings.accent ?? '#6366f1'}
              onChange={e => saveDesign({ ...currentSettings, accent: e.target.value })}
              className="h-7 w-7 rounded-full cursor-pointer border-0 bg-transparent"
              title={t('publicPage.customColor', 'Свой цвет')}
            />
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-2">{t('publicPage.btnShape', 'Форма кнопок')}</p>
          <div className="flex gap-2">
            {([{id:'rounded',label:t('publicPage.btnRounded','Скруглённые'),radius:'12px'},{id:'pill',label:t('publicPage.btnPill','Пилюля'),radius:'9999px'},{id:'square',label:t('publicPage.btnSquare','Прямые'),radius:'4px'}] as const).map(({id,label,radius}) => (
              <button
                key={id}
                onClick={() => saveDesign({ ...currentSettings, btn_shape: id })}
                className={['flex-1 py-2 text-xs font-medium border transition-colors', currentSettings.btn_shape === id || (!currentSettings.btn_shape && id === 'rounded') ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'].join(' ')}
                style={{ borderRadius: radius }}
              >{label}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-2">{t('publicPage.font', 'Шрифт')}</p>
          <div className="flex gap-2">
            {([{id:'inter',label:'Inter'},{id:'montserrat',label:'Montserrat'},{id:'playfair',label:'Playfair'}] as const).map(({id,label}) => (
              <button
                key={id}
                onClick={() => saveDesign({ ...currentSettings, font: id })}
                className={['flex-1 py-2 text-xs font-medium border rounded-lg transition-colors', currentSettings.font === id || (!currentSettings.font && id === 'inter') ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'].join(' ')}
              >{label}</button>
            ))}
          </div>
        </div>
      </Card>
      <Card title={t('publicPage.coverPhoto', 'Обложка')} icon={Globe}>
        <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
        {profile?.cover_url ? (
          <div className="relative">
            <img src={storageUrl('covers', profile.cover_url)} alt="" className="w-full h-28 object-cover rounded-lg" />
            <button
              onClick={() => up({ cover_url: '' })}
              className="absolute top-2 right-2 bg-black/50 rounded-full p-1 text-white hover:bg-black/70"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => coverFileRef.current?.click()}
            disabled={coverUploading}
            className="w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary transition-colors"
          >
            <Globe className="h-6 w-6" />
            <span className="text-xs">
              {coverUploading ? t('common.uploading', 'Загрузка...') : t('publicPage.uploadCover', 'Загрузить обложку (16:6)')}
            </span>
          </button>
        )}
      </Card>

      <Card title={t('publicPage.socialLinks', 'Социальные сети')} icon={Link2}>
        <div className="space-y-2">
          {([{key:'instagram',icon:Instagram,placeholder:'@username'},{key:'telegram',icon:Send,placeholder:'@username или t.me/...'},{key:'whatsapp',icon:Phone,placeholder:'+998901234567'},{key:'youtube',icon:Youtube,placeholder:'@channel или youtube.com/...'},{key:'tiktok',icon:TikTokIcon,placeholder:'@username'},{key:'website',icon:Globe,placeholder:'https://...'}] as const).map(({key,icon:Icon,placeholder}) => (
            <div key={key} className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input value={socials[key]} onChange={e => setSocials(prev => ({...prev,[key]:e.target.value}))} placeholder={placeholder} className="h-8 text-sm" />
            </div>
          ))}
        </div>
        <Button onClick={saveSocials} disabled={upsertProfile.isPending} size="sm" className="w-full">{t('common.save', 'Сохранить')}</Button>
      </Card>

      <Card title={t('publicPage.location', 'Местоположение')} icon={MapPin}>
        <div className="space-y-2">
          <div>
            <Label className="text-xs">{t('profile.city', 'Город')}</Label>
            <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Ташкент" className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">{t('profile.address', 'Адрес')}</Label>
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="ул. Амира Темура, 1" className="h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Latitude ({t('common.optional', 'необязательно')})</Label>
              <Input value={lat} onChange={e => setLat(e.target.value)} type="number" step="any" placeholder="41.2995" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Longitude ({t('common.optional', 'необязательно')})</Label>
              <Input value={lng} onChange={e => setLng(e.target.value)} type="number" step="any" placeholder="69.2401" className="h-8 text-sm" />
            </div>
          </div>
        </div>
        <Button onClick={saveLocation} disabled={upsertProfile.isPending} size="sm" className="w-full">{t('common.save', 'Сохранить')}</Button>
      </Card>
      <Card title={t('publicPage.products', 'Товары')} icon={ShoppingBag}>
        {productsLoading ? (
          <div className="space-y-2">
            {[1,2].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {products.map(product => (
              <div key={product.id} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
                {product.photo_url ? (
                  <img src={product.photo_url} alt="" className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(product.price, 'UZS', i18n.language)}
                    {!product.is_available && (
                      <span className="ml-2 text-amber-600">{t('publicPage.outOfStock', 'Нет в наличии')}</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditProduct(product)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteProduct.mutate(product.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setEditProduct({ is_available: true, order_index: products.length, price: 0 })}
            >
              <Plus className="h-4 w-4" />
              {t('publicPage.addProduct', 'Добавить товар')}
            </Button>
          </div>
        )}
      </Card>
      {editProduct !== null && (
        <ProductDialog product={editProduct} onClose={() => setEditProduct(null)} />
      )}
    </div>
  )
}
