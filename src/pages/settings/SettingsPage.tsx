import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Moon, Sun, Globe, User, Lock, DollarSign, Clock, Layout, FileText, Layers, FlaskConical, BedDouble, Syringe, UtensilsCrossed, DoorOpen,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/shared/PageHeader'
import { toast } from '@/components/shared/Toaster'
import { getStoredTheme, setTheme, type Theme } from '@/stores/themeStore'
import { supabase } from '@/lib/supabase'
import { cn, CURRENCIES, LANG_TO_CURRENCY } from '@/lib/utils'
import { useProfile, useUpsertProfile } from '@/hooks/useProfile'
import { ScheduleTab } from '@/pages/schedule/ScheduleTab'
import { PublicPageTab } from './PublicPageTab'
import { ReceiptSettingsTab } from './ReceiptSettingsTab'
import { OrderTypesSettingsTab } from './OrderTypesSettingsTab'
import { VisitTemplatesSettingsTab } from './VisitTemplatesSettingsTab'
import { LabTestsCatalogSettingsTab } from './LabTestsCatalogSettingsTab'
import { WardsSettingsTab } from './WardsSettingsTab'
import { OperatingRoomsSettingsTab } from './OperatingRoomsSettingsTab'
import { DietTablesSettingsTab } from './DietTablesSettingsTab'
import { ExamRoomsSettingsTab } from './ExamRoomsSettingsTab'
import { PRODUCT } from '@/lib/config'

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

type Tab = 'profile' | 'interface' | 'schedule' | 'public' | 'receipt' | 'order_types' | 'visit_templates' | 'lab_catalog' | 'wards_config' | 'or_config' | 'diet_config' | 'exam_rooms'

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()

  const [tab, setTab] = useState<Tab>('profile')

  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  const [pwLoading, setPwLoading] = useState(false)
  const [currency, setCurrency] = useState<string>('')
  const [timezone, setTimezone] = useState<string>('')
  const { data: profile } = useProfile()
  const upsertProfile = useUpsertProfile()

  const { register: regPw, handleSubmit: handlePw, reset: resetPw } = useForm<{
    oldPassword: string; password: string; passwordConfirm: string
  }>()

  useEffect(() => {
    if (profile?.currency) {
      setCurrency(profile.currency)
    } else {
      setCurrency(LANG_TO_CURRENCY[i18n.language] || 'RUB')
    }
  }, [profile, i18n.language])

  useEffect(() => {
    if (user?.timezone) {
      setTimezone(user.timezone)
    } else {
      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
        setTimezone(detected || 'Europe/Moscow')
      } catch {
        setTimezone('Europe/Moscow')
      }
    }
  }, [user])

  const onLanguageChange = (code: string) => {
    i18n.changeLanguage(code)
    if (!profile?.currency) {
      setCurrency(LANG_TO_CURRENCY[code] || 'RUB')
    }
  }

  const onCurrencyChange = async (val: string) => {
    setCurrency(val)
    try {
      await upsertProfile.mutateAsync({ id: profile?.id, data: { currency: val } })
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const onTimezoneChange = async (val: string) => {
    setTimezone(val)
    try {
      await supabase.from('users').update({ timezone: val }).eq('id', user!.id)
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }


  const onThemeChange = (th: Theme) => {
    setThemeState(th)
    setTheme(th)
  }

  const onChangePassword = async (values: { oldPassword: string; password: string; passwordConfirm: string }) => {
    if (values.password !== values.passwordConfirm) {
      toast.error(t('settings.passwordMismatch'))
      return
    }
    try {
      setPwLoading(true)
      const { error } = await supabase.auth.updateUser({ password: values.password })
      if (error) throw error
      toast.success(t('settings.passwordChanged'))
      resetPw()
    } catch {
      toast.error(t('settings.passwordError'))
    } finally {
      setPwLoading(false)
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'profile',   label: t('settings.tabProfile'),                        icon: User     },
    { id: 'interface', label: t('settings.tabInterface'),                      icon: Sun      },
    { id: 'schedule',  label: t('nav.schedule'),                               icon: Clock    },
    { id: 'public',    label: t('settings.tabPublicPage', 'Моя страница'),     icon: Layout   },
    ...(PRODUCT === 'cleaning' ? [
      { id: 'receipt' as Tab,     label: 'Квитанция',   icon: FileText },
      { id: 'order_types' as Tab, label: 'Типы',        icon: Layers   },
    ] : []),
    ...(PRODUCT === 'clinic' ? [
      { id: 'visit_templates' as Tab, label: t('clinic.settings.visitTemplates'), icon: FileText },
      { id: 'lab_catalog' as Tab, label: t('clinic.lab.testCatalog'), icon: FlaskConical },
      { id: 'wards_config' as Tab, label: t('clinic.settings.wardsConfig'), icon: BedDouble },
      { id: 'or_config' as Tab, label: t('clinic.settings.orConfig'), icon: Syringe },
      { id: 'diet_config' as Tab, label: t('clinic.settings.dietConfig'), icon: UtensilsCrossed },
      { id: 'exam_rooms' as Tab, label: t('clinic.settings.examRooms'), icon: DoorOpen },
    ] : []),
  ]

  return (
    <div className="max-w-2xl space-y-0">
      <PageHeader title={t('nav.settings')} />

      {/* Tabs */}
      <div className={cn('grid gap-1 mb-6', tabs.length >= 6 ? 'grid-cols-6' : tabs.length === 5 ? 'grid-cols-5' : 'grid-cols-4')}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors',
              tab === id
                ? 'bg-primary/10 text-primary'
                : 'bg-muted/40 text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Профиль ── */}
      {tab === 'profile' && (
        <div className="space-y-6">
          {/* Account info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                {t('settings.account')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-sm">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" />
                {t('settings.changePassword')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePw(onChangePassword)} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('settings.currentPassword')}</Label>
                  <Input type="password" {...regPw('oldPassword')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.newPassword')}</Label>
                  <Input type="password" {...regPw('password')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.confirmPassword')}</Label>
                  <Input type="password" {...regPw('passwordConfirm')} />
                </div>
                <Button type="submit" loading={pwLoading}>{t('settings.updatePassword')}</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Расписание ── */}
      {tab === 'schedule' && <ScheduleTab />}

      {/* ── Моя страница ── */}
      {tab === 'public' && <PublicPageTab />}

      {/* ── Квитанция ── */}
      {tab === 'receipt' && <ReceiptSettingsTab />}

      {/* ── Типы заказов (только cleaning) ── */}
      {tab === 'order_types' && <OrderTypesSettingsTab />}

      {/* ── Шаблоны приёмов (только clinic) ── */}
      {tab === 'visit_templates' && <VisitTemplatesSettingsTab />}

      {/* ── Справочник анализов (только clinic) ── */}
      {tab === 'lab_catalog' && <LabTestsCatalogSettingsTab />}

      {/* ── Палаты (только clinic) ── */}
      {tab === 'wards_config' && <WardsSettingsTab />}

      {/* ── Операционные (только clinic) ── */}
      {tab === 'or_config' && <OperatingRoomsSettingsTab />}

      {/* ── Диетстолы (только clinic) ── */}
      {tab === 'diet_config' && <DietTablesSettingsTab />}

      {/* ── Кабинеты (только clinic) ── */}
      {tab === 'exam_rooms' && <ExamRoomsSettingsTab />}

      {/* ── Интерфейс ── */}
      {tab === 'interface' && (
        <div className="space-y-6">
          {/* Theme */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sun className="h-4 w-4" />
                {t('settings.appearance')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: 'light', label: t('settings.light'), icon: Sun },
                  { value: 'dark',  label: t('settings.dark'),  icon: Moon },
                  { value: 'system',label: t('settings.system'),icon: Globe },
                ] as const).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onThemeChange(value)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors',
                      theme === value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Language */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {t('settings.language')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => onLanguageChange(lang.code)}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg border-2 text-sm transition-colors',
                      i18n.language === lang.code
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <span className="text-lg">{lang.flag}</span>
                    <span className="font-medium">{lang.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Currency & Timezone */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {t('settings.currencyTimezone')}
              </CardTitle>
              <CardDescription>{t('settings.currencyTimezoneDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    {t('settings.currency')}
                  </Label>
                  {currency && (
                    <Select value={currency} onValueChange={onCurrencyChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {t('settings.timezone')}
                  </Label>
                  {timezone && (
                    <Select value={timezone} onValueChange={onTimezoneChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}


    </div>
  )
}
