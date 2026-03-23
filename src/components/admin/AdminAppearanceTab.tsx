import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Zap, Upload, Palette, Globe, ToggleLeft, ToggleRight, Users, Type, Send, Download, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/shared/Toaster'
import { CURRENCIES } from '@/lib/utils'
import {
  useAppSettings,
  useUpdateAppSetting,
  useUpdateAppLogo,
  useResetAppLogo,
  useTgConfig,
  useUpdateTgConfig,
  DEFAULT_TG_CONFIG,
  type TgConfig,
} from '@/hooks/useAppSettings'

// ── Цветовые пресеты ────────────────────────────────────────────────────────

const PRESET_COLORS = [
  { label: 'Indigo',  hsl: '239 84% 67%' },
  { label: 'Violet',  hsl: '262 83% 65%' },
  { label: 'Blue',    hsl: '217 91% 60%' },
  { label: 'Sky',     hsl: '199 89% 48%' },
  { label: 'Teal',    hsl: '172 66% 50%' },
  { label: 'Green',   hsl: '142 71% 45%' },
  { label: 'Amber',   hsl: '38 92% 50%' },
  { label: 'Orange',  hsl: '25 95% 53%' },
  { label: 'Rose',    hsl: '347 77% 50%' },
  { label: 'Pink',    hsl: '330 81% 60%' },
]

// ── Конвертация HEX → HSL ────────────────────────────────────────────────────

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

function hslToHex(hsl: string): string {
  const parts = hsl.match(/(\d+\.?\d*)/g)
  if (!parts || parts.length < 3) return '#6366f1'
  const h = parseFloat(parts[0]) / 360
  const s = parseFloat(parts[1]) / 100
  const l = parseFloat(parts[2]) / 100
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  let r: number, g: number, b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return '#' + [r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
}

// ── Списки языков и таймзон ──────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'kz', label: 'Қазақша', flag: '🇰🇿' },
  { code: 'uz', label: "O'zbekcha", flag: '🇺🇿' },
  { code: 'tg', label: 'Тоҷикӣ', flag: '🇹🇯' },
  { code: 'ky', label: 'Кыргызча', flag: '🇰🇬' },
  { code: 'by', label: 'Беларуская', flag: '🇧🇾' },
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
]

const TIMEZONES = [
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Minsk', label: 'Минск (UTC+3)' },
  { value: 'Europe/Kiev', label: 'Киев (UTC+2/+3)' },
  { value: 'Europe/Riga', label: 'Рига (UTC+2/+3)' },
  { value: 'Europe/Tallinn', label: 'Таллин (UTC+2/+3)' },
  { value: 'Europe/Vilnius', label: 'Вильнюс (UTC+2/+3)' },
  { value: 'Europe/Istanbul', label: 'Стамбул (UTC+3)' },
  { value: 'Asia/Yerevan', label: 'Ереван (UTC+4)' },
  { value: 'Asia/Baku', label: 'Баку (UTC+4)' },
  { value: 'Asia/Tbilisi', label: 'Тбилиси (UTC+4)' },
  { value: 'Asia/Tashkent', label: 'Ташкент (UTC+5)' },
  { value: 'Asia/Almaty', label: 'Алматы (UTC+5)' },
  { value: 'Asia/Bishkek', label: 'Бишкек (UTC+6)' },
  { value: 'Asia/Dushanbe', label: 'Душанбе (UTC+5)' },
  { value: 'Asia/Ashgabat', label: 'Ашхабад (UTC+5)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Omsk', label: 'Омск (UTC+6)' },
  { value: 'Asia/Novosibirsk', label: 'Новосибирск (UTC+7)' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
  { value: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
  { value: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { value: 'Europe/London', label: 'Лондон (UTC+0/+1)' },
  { value: 'Europe/Berlin', label: 'Берлин (UTC+1/+2)' },
  { value: 'Europe/Paris', label: 'Париж (UTC+1/+2)' },
  { value: 'America/New_York', label: 'Нью-Йорк (UTC-5/-4)' },
  { value: 'America/Los_Angeles', label: 'Лос-Анджелес (UTC-8/-7)' },
  { value: 'UTC', label: 'UTC (UTC+0)' },
]

// ── Основной компонент ───────────────────────────────────────────────────────

export function AdminAppearanceTab() {
  const { t } = useTranslation()
  const { data: settings, isLoading } = useAppSettings()
  const updateSetting = useUpdateAppSetting()
  const updateLogo = useUpdateAppLogo()
  const resetLogo = useResetAppLogo()
  const { data: tgConfig } = useTgConfig()
  const updateTgConfig = useUpdateTgConfig()

  // Branding state
  const [platformName, setPlatformName] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Color state
  const [customHex, setCustomHex] = useState('#6366f1')
  const [colorSaving, setColorSaving] = useState(false)

  // Font size state
  const [fontSizeSaving, setFontSizeSaving] = useState(false)

  // Registration state
  const [regSaving, setRegSaving] = useState(false)

  // Web Access state
  const [webSaving, setWebSaving] = useState(false)

  // Defaults state
  const [defLang, setDefLang] = useState('')
  const [defCurrency, setDefCurrency] = useState('')
  const [defTimezone, setDefTimezone] = useState('')
  const [defSaving, setDefSaving] = useState(false)

  // Telegram state
  const [tgClientLabel, setTgClientLabel] = useState('Ezze')
  const [tgMasterLabel, setTgMasterLabel] = useState('Ezze')
  const [tgWelcomeText, setTgWelcomeText] = useState(DEFAULT_TG_CONFIG.welcome_text ?? '')
  const [tgSaving, setTgSaving] = useState(false)

  useEffect(() => {
    if (tgConfig) {
      setTgClientLabel(tgConfig.client_label)
      setTgMasterLabel(tgConfig.master_label)
      setTgWelcomeText(tgConfig.welcome_text ?? DEFAULT_TG_CONFIG.welcome_text ?? '')
    }
  }, [tgConfig])

  useEffect(() => {
    if (settings) {
      setPlatformName(settings.platform_name)
      setCustomHex(hslToHex(settings.primary_color))
      setDefLang(settings.default_language)
      setDefCurrency(settings.default_currency)
      setDefTimezone(settings.default_timezone)
    }
  }, [settings])

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function savePlatformName() {
    if (!platformName.trim()) return
    setNameSaving(true)
    try {
      await updateSetting.mutateAsync({ key: 'platform_name', value: platformName.trim() })
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.saveError'))
    } finally {
      setNameSaving(false)
    }
  }

  async function saveColor(hsl: string) {
    setColorSaving(true)
    try {
      await updateSetting.mutateAsync({ key: 'primary_color', value: hsl })
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.saveError'))
    } finally {
      setColorSaving(false)
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    setLogoPreview(preview)
    try {
      await updateLogo.mutateAsync(file)
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.saveError'))
      setLogoPreview(null)
    }
  }

  async function handleDownloadLogo() {
    const src = currentLogo ?? '/logo-default.svg'
    try {
      const resp = await fetch(src)
      const blob = await resp.blob()
      const ext = blob.type.includes('png') ? 'png'
        : blob.type.includes('svg') ? 'svg'
        : blob.type.includes('webp') ? 'webp'
        : blob.type.includes('gif') ? 'gif'
        : 'jpg'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `logo.${ext}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  async function handleResetLogo() {
    try {
      await resetLogo.mutateAsync()
      setLogoPreview(null)
      toast.success('Логотип восстановлен по умолчанию')
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  async function saveFontSize(size: 'small' | 'medium' | 'large') {
    setFontSizeSaving(true)
    try {
      await updateSetting.mutateAsync({ key: 'font_size', value: size })
      const fontSizeMap = { small: '14px', medium: '16px', large: '18px' }
      document.documentElement.style.fontSize = fontSizeMap[size]
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.saveError'))
    } finally {
      setFontSizeSaving(false)
    }
  }

  async function toggleRegistration() {
    if (!settings) return
    setRegSaving(true)
    try {
      const next = settings.registration_open ? 'false' : 'true'
      await updateSetting.mutateAsync({ key: 'registration_open', value: next })
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.saveError'))
    } finally {
      setRegSaving(false)
    }
  }

  async function toggleWebAccess() {
    if (!settings) return
    setWebSaving(true)
    const next = (settings.web_registration_enabled && settings.web_access_enabled) ? 'false' : 'true'
    try {
      await Promise.all([
        updateSetting.mutateAsync({ key: 'web_registration_enabled', value: next }),
        updateSetting.mutateAsync({ key: 'web_access_enabled', value: next }),
      ])
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.saveError'))
    } finally {
      setWebSaving(false)
    }
  }

  async function saveDefaults() {
    setDefSaving(true)
    try {
      await Promise.all([
        updateSetting.mutateAsync({ key: 'default_language', value: defLang }),
        updateSetting.mutateAsync({ key: 'default_currency', value: defCurrency }),
        updateSetting.mutateAsync({ key: 'default_timezone', value: defTimezone }),
      ])
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.saveError'))
    } finally {
      setDefSaving(false)
    }
  }

  async function saveTgConfig() {
    setTgSaving(true)
    try {
      await updateTgConfig.mutateAsync({
        client_label: tgClientLabel.trim() || 'Ezze',
        master_label: tgMasterLabel.trim() || 'Ezze',
        welcome_text: tgWelcomeText.trim() || DEFAULT_TG_CONFIG.welcome_text,
      })
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.saveError'))
    } finally {
      setTgSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40 w-full" />)}
      </div>
    )
  }

  const currentLogo = logoPreview ?? settings?.logo_url

  return (
    <div className="space-y-6">

      {/* ── 1. Брендинг ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            {t('admin.branding')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Логотип */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary shrink-0 overflow-hidden">
              {currentLogo
                ? <img src={currentLogo} alt="" className="h-14 w-14 object-cover" />
                : <Zap className="h-7 w-7 text-primary-foreground" />
              }
            </div>
            <div>
              <p className="text-sm font-medium">{t('admin.platformLogo')}</p>
              <p className="text-xs text-muted-foreground mb-2">{t('admin.logoHint')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={updateLogo.isPending}
                  className="flex items-center gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {t('admin.uploadLogo')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadLogo}
                  className="flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Скачать
                </Button>
                {settings?.logo_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetLogo}
                    disabled={resetLogo.isPending}
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    По умолчанию
                  </Button>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoChange}
              />
            </div>
          </div>

          {/* Название */}
          <div className="space-y-2">
            <Label>{t('admin.platformName')}</Label>
            <div className="flex gap-2">
              <Input
                value={platformName}
                onChange={e => setPlatformName(e.target.value)}
                placeholder="Ezze"
                className="max-w-xs"
              />
              <Button onClick={savePlatformName} disabled={nameSaving || !platformName.trim()} size="sm">
                {t('common.save')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Основной цвет ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" />
            {t('admin.primaryColor')}
          </CardTitle>
          <CardDescription>{t('admin.colorPresets')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Пресеты */}
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {PRESET_COLORS.map(c => {
              const isActive = settings?.primary_color === c.hsl
              return (
                <button
                  key={c.hsl}
                  title={c.label}
                  disabled={colorSaving}
                  onClick={() => saveColor(c.hsl)}
                  className={`
                    h-9 w-full rounded-lg border-2 transition-all
                    ${isActive ? 'border-foreground scale-105 shadow-md' : 'border-transparent hover:scale-105'}
                  `}
                  style={{ backgroundColor: `hsl(${c.hsl})` }}
                />
              )
            })}
          </div>

          {/* Произвольный цвет */}
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t('admin.customColor')}</p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customHex}
                  onChange={e => setCustomHex(e.target.value)}
                  className="h-9 w-14 cursor-pointer rounded-lg border border-input bg-transparent p-0.5"
                />
                <Input
                  value={customHex}
                  onChange={e => {
                    const v = e.target.value
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setCustomHex(v)
                  }}
                  className="w-28 font-mono text-sm"
                  placeholder="#6366f1"
                />
                <Button
                  size="sm"
                  disabled={colorSaving || customHex.length !== 7}
                  onClick={() => saveColor(hexToHsl(customHex))}
                >
                  {t('common.apply')}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Размер шрифта ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Type className="h-4 w-4" />
            {t('admin.fontSize')}
          </CardTitle>
          <CardDescription>{t('admin.fontSizeDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: 'small',  labelKey: 'admin.fontSmall',  px: '14px', preview: 'text-xs' },
              { value: 'medium', labelKey: 'admin.fontMedium', px: '16px', preview: 'text-sm' },
              { value: 'large',  labelKey: 'admin.fontLarge',  px: '18px', preview: 'text-base' },
            ] as const).map(opt => {
              const isActive = (settings?.font_size ?? 'medium') === opt.value
              return (
                <button
                  key={opt.value}
                  disabled={fontSizeSaving}
                  onClick={() => saveFontSize(opt.value)}
                  className={`
                    flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 py-4 px-2 transition-all
                    ${isActive
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                    }
                  `}
                >
                  <span className={`font-semibold ${opt.preview}`}>Аа</span>
                  <span className="text-xs font-medium">{t(opt.labelKey)}</span>
                  <span className="text-[10px] text-muted-foreground">{opt.px}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── 5. Регистрация ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('admin.registration')}
          </CardTitle>
          <CardDescription>{t('admin.registrationDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <button
            onClick={toggleRegistration}
            disabled={regSaving}
            className="flex items-center gap-3 w-full p-3 rounded-xl border hover:bg-muted/40 transition-colors text-left"
          >
            {settings?.registration_open
              ? <ToggleRight className="h-6 w-6 text-primary shrink-0" />
              : <ToggleLeft className="h-6 w-6 text-muted-foreground shrink-0" />
            }
            <div>
              <p className="text-sm font-medium">
                {settings?.registration_open
                  ? t('admin.registrationOpen')
                  : t('admin.registrationClosed')
                }
              </p>
              {!settings?.registration_open && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('admin.registrationDesc')}
                </p>
              )}
            </div>
          </button>
        </CardContent>
      </Card>

      {/* ── 6. Веб-доступ ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Веб-доступ
          </CardTitle>
          <CardDescription>Управление доступом через браузер vs Telegram Mini App</CardDescription>
        </CardHeader>
        <CardContent>
          <button
            onClick={toggleWebAccess}
            disabled={webSaving}
            className="flex items-center gap-3 w-full p-3 rounded-xl border hover:bg-muted/40 transition-colors text-left"
          >
            {(settings?.web_registration_enabled && settings?.web_access_enabled)
              ? <ToggleRight className="h-6 w-6 text-primary shrink-0" />
              : <ToggleLeft className="h-6 w-6 text-muted-foreground shrink-0" />
            }
            <div>
              <p className="text-sm font-medium">Веб-доступ</p>
              <p className="text-xs text-muted-foreground">
                {(settings?.web_registration_enabled && settings?.web_access_enabled)
                  ? 'Регистрация и вход доступны через браузер и Telegram'
                  : 'Доступ только через Telegram Mini App'}
              </p>
            </div>
          </button>
        </CardContent>
      </Card>

      {/* ── 7. Настройки по умолчанию ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {t('admin.defaultSettings')}
          </CardTitle>
          <CardDescription>{t('admin.defaultSettingsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Язык */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t('settings.language')}</Label>
              <Select value={defLang} onValueChange={setDefLang}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(l => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.flag} {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Валюта */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t('settings.currency')}</Label>
              <Select value={defCurrency} onValueChange={setDefCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Таймзона */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t('settings.timezone')}</Label>
              <Select value={defTimezone} onValueChange={setDefTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={saveDefaults} disabled={defSaving} size="sm">
            {t('common.save')}
          </Button>
        </CardContent>
      </Card>

      {/* ── Telegram кнопка меню ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" />
            Telegram — кнопка меню
          </CardTitle>
          <CardDescription className="space-y-1">
            <span className="block">Название кнопки рядом с полем ввода. Макс. 16 символов.</span>
            <span className="block text-xs">
              <span className="font-medium text-foreground">@ezzeclient_bot</span> — для клиентов &nbsp;·&nbsp;
              <span className="font-medium text-foreground">@ezzeapp_bot</span> — для мастеров
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">
                Кнопка для клиентов
                <span className="ml-1.5 text-muted-foreground font-normal">(@ezzeclient_bot)</span>
              </Label>
              <Input
                value={tgClientLabel}
                onChange={e => setTgClientLabel(e.target.value.slice(0, 16))}
                placeholder="Ezze"
                maxLength={16}
              />
              <p className="text-xs text-muted-foreground">{tgClientLabel.length}/16</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Кнопка для мастеров
                <span className="ml-1.5 text-muted-foreground font-normal">(@ezzeapp_bot)</span>
              </Label>
              <Input
                value={tgMasterLabel}
                onChange={e => setTgMasterLabel(e.target.value.slice(0, 16))}
                placeholder="Ezze"
                maxLength={16}
              />
              <p className="text-xs text-muted-foreground">{tgMasterLabel.length}/16</p>
            </div>
          </div>

          {/* Текст приветствия */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Текст приветствия при первом запуске бота
            </Label>
            <Textarea
              value={tgWelcomeText}
              onChange={e => setTgWelcomeText(e.target.value)}
              placeholder={DEFAULT_TG_CONFIG.welcome_text}
              rows={5}
              className="text-sm font-mono resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Используй <code className="bg-muted px-1 rounded text-xs">{'{'+'name'+'}'}</code> для подстановки имени мастера. Поддерживается HTML-разметка Telegram: <code className="bg-muted px-1 rounded text-xs">&lt;b&gt;</code>, <code className="bg-muted px-1 rounded text-xs">&lt;i&gt;</code>.
            </p>
          </div>

          <Button onClick={saveTgConfig} disabled={tgSaving} size="sm">
            {t('common.save')}
          </Button>
        </CardContent>
      </Card>

    </div>
  )
}
