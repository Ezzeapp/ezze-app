import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronRight, ChevronLeft, Check,
  User, Briefcase, Globe, Camera, X, ImagePlus, Trash2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn, CURRENCIES, LANG_TO_CURRENCY } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getCategoriesForSpecialty } from '@/data/specialty-category-map'
import { toast } from '@/components/shared/Toaster'

// ─── Timezones ───────────────────────────────────────────────────────────────
const TIMEZONES_SHORT = [
  { value: 'Europe/Moscow',    label: 'Москва (UTC+3)' },
  { value: 'Europe/Minsk',     label: 'Минск (UTC+3)' },
  { value: 'Europe/Kiev',      label: 'Киев (UTC+2/+3)' },
  { value: 'Asia/Almaty',      label: 'Алматы (UTC+5)' },
  { value: 'Asia/Tashkent',    label: 'Ташкент (UTC+5)' },
  { value: 'Asia/Bishkek',     label: 'Бишкек (UTC+6)' },
  { value: 'Asia/Dushanbe',    label: 'Душанбе (UTC+5)' },
  { value: 'Europe/London',    label: 'Лондон (UTC+0/+1)' },
  { value: 'America/New_York', label: 'Нью-Йорк (UTC-5/-4)' },
  { value: 'UTC',              label: 'UTC (UTC+0)' },
]

// ─── Languages ───────────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
  { code: 'kz', label: 'Қазақша' },
  { code: 'uz', label: "O'zbek" },
  { code: 'ky', label: 'Кыргызча' },
  { code: 'tg', label: 'Тоҷикӣ' },
  { code: 'by', label: 'Беларуская' },
  { code: 'uk', label: 'Українська' },
]

// ─── Days ────────────────────────────────────────────────────────────────────
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
type Day = typeof DAYS[number]

const TIME_OPTIONS: string[] = []
for (let h = 6; h <= 23; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`)
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`)
}

interface DaySchedule { enabled: boolean; start: string; end: string }
type WeekSchedule = Record<Day, DaySchedule>

const DEFAULT_WEEK: WeekSchedule = {
  mon: { enabled: true,  start: '07:00', end: '21:00' },
  tue: { enabled: true,  start: '07:00', end: '21:00' },
  wed: { enabled: true,  start: '07:00', end: '21:00' },
  thu: { enabled: true,  start: '07:00', end: '21:00' },
  fri: { enabled: true,  start: '07:00', end: '21:00' },
  sat: { enabled: true,  start: '07:00', end: '21:00' },
  sun: { enabled: false, start: '07:00', end: '21:00' },
}

// ─── Profession suggestions ───────────────────────────────────────────────────
const PROFESSION_SUGGESTIONS = [
  'Парикмахер', 'Барбер', 'Мастер маникюра', 'Мастер педикюра', 'Косметолог',
  'Бровист', 'Лэшмейкер', 'Массажист', 'Визажист', 'Татуировщик', 'Нейл-мастер',
  'Персональный тренер', 'Фитнес-тренер', 'Йога-инструктор', 'Хореограф',
  'Репетитор', 'Психолог', 'Нутрициолог', 'Логопед', 'Коуч',
  'Фотограф', 'Видеограф', 'Дизайнер', 'Веб-разработчик', 'SMM-специалист',
  'Стилист', 'Швея', 'Портной', 'Ювелир',
  'Юрист', 'Бухгалтер', 'Переводчик', 'Ветеринар',
]

// ─── Props ───────────────────────────────────────────────────────────────────
interface WizardPrefill {
  name?: string; phone?: string; city?: string; address?: string
  profession?: string; activityTypeId?: string; activityTypeName?: string
  specialtyId?: string; specialtyName?: string
  currency?: string; timezone?: string; language?: string
}

interface Props {
  open: boolean
  onComplete: () => void
  onClose?: () => void
  prefill?: WizardPrefill
}

// ─── Component ───────────────────────────────────────────────────────────────
export function OnboardingWizard({ open, onComplete, onClose, prefill }: Props) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [showWelcome, setShowWelcome] = useState(false)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [photoModalOpen, setPhotoModalOpen] = useState(false)

  // ── Step 0 ────────────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(prefill?.name || '')
  const [phone, setPhone]           = useState(prefill?.phone   || '')
  const [city, setCity]             = useState(prefill?.city    || '')
  const [address, setAddress]       = useState(prefill?.address || '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // ── Step 2 ────────────────────────────────────────────────────────────────
  const [profession,         setProfession]         = useState(prefill?.profession || '')
  const [professionQuery,    setProfessionQuery]    = useState(prefill?.profession || '')
  const [showProfSuggestions, setShowProfSuggestions] = useState(false)
  const [week,               setWeek]               = useState<WeekSchedule>(DEFAULT_WEEK)
  const profContainerRef = useRef<HTMLDivElement>(null)
  const [catalogCounts, setCatalogCounts] = useState<{ svc: number; prod: number } | null>(null)

  // Fetch counts from global catalog when profession changes
  useEffect(() => {
    if (!profession) { setCatalogCounts(null); return }
    const { serviceCategories, productCategories } = getCategoriesForSpecialty('', profession)
    if (serviceCategories.length === 0 && productCategories.length === 0) { setCatalogCounts(null); return }
    let cancelled = false
    ;(async () => {
      const [svcRes, prodRes] = await Promise.all([
        serviceCategories.length > 0
          ? supabase.from('global_services').select('id', { count: 'exact', head: true }).in('category', serviceCategories)
          : Promise.resolve({ count: 0 }),
        productCategories.length > 0
          ? supabase.from('global_products').select('id', { count: 'exact', head: true }).in('category', productCategories)
          : Promise.resolve({ count: 0 }),
      ])
      if (!cancelled) setCatalogCounts({ svc: svcRes.count ?? 0, prod: prodRes.count ?? 0 })
    })()
    return () => { cancelled = true }
  }, [profession])

  // ── Shared schedule time ──────────────────────────────────────────────────
  const [workStart, setWorkStart] = useState('07:00')
  const [workEnd,   setWorkEnd]   = useState('21:00')

  // ── Step 3 ────────────────────────────────────────────────────────────────
  const defaultCurrency = LANG_TO_CURRENCY[i18n.language] || 'UZS'
  const defaultTimezone = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow' } catch { return 'Europe/Moscow' }
  })()
  const [language, setLanguage] = useState(prefill?.language || i18n.language?.split('-')[0] || 'ru')
  const [currency, setCurrency] = useState(prefill?.currency || defaultCurrency)
  const [timezone, setTimezone] = useState(prefill?.timezone || defaultTimezone)

  // ── Reset on open ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setShowWelcome(false)
    setStep(0)
    setAvatarFile(null); setAvatarPreview(null)
    setDisplayName(prefill?.name || ''); setPhone(prefill?.phone || '')
    setCity(prefill?.city || ''); setAddress(prefill?.address || '')
    setProfession(prefill?.profession || '')
    setProfessionQuery(prefill?.profession || '')
    setShowProfSuggestions(false)
    setWorkStart('07:00'); setWorkEnd('21:00')
    setLanguage(prefill?.language || i18n.language?.split('-')[0] || 'ru')
    setCurrency(prefill?.currency || defaultCurrency)
    setTimezone(prefill?.timezone || defaultTimezone)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ── Steps meta ────────────────────────────────────────────────────────────
  const STEPS = [
    { icon: User,      label: t('onboarding.step1') },
    { icon: Briefcase, label: t('onboarding.step2') },
    { icon: Globe,     label: t('onboarding.step3') },
  ]

  const toggleDay = (day: Day) =>
    setWeek((w) => ({ ...w, [day]: { ...w[day], enabled: !w[day].enabled } }))
  const setDayTime = (day: Day, field: 'start' | 'end', val: string) =>
    setWeek((w) => ({ ...w, [day]: { ...w[day], [field]: val } }))

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setPhotoModalOpen(false)
  }

  // ── Auto-import ───────────────────────────────────────────────────────────
  const autoImport = async () => {
    if (!profession) return
    const { serviceCategories, productCategories } = getCategoriesForSpecialty('', profession)

    // Fetch from global catalog tables (not seed files)
    const [svcRes, prodRes] = await Promise.all([
      serviceCategories.length > 0
        ? supabase.from('global_services').select('name, category').in('category', serviceCategories)
        : Promise.resolve({ data: [] as { name: string; category: string | null }[] }),
      productCategories.length > 0
        ? supabase.from('global_products').select('name, category, unit').in('category', productCategories)
        : Promise.resolve({ data: [] as { name: string; category: string | null; unit: string | null }[] }),
    ])
    const servicesToImport = svcRes.data ?? []
    const productsToImport = prodRes.data ?? []
    if (servicesToImport.length === 0 && productsToImport.length === 0) return
    try {
      const { data: existingSvcCats } = await supabase
        .from('service_categories').select('id, name').eq('master_id', user!.id)
      const existingSvcCatNames = new Set((existingSvcCats ?? []).map((c: any) => c.name.toLowerCase()))
      const categoryIdMap: Record<string, string> = {}
      for (const c of (existingSvcCats ?? [])) categoryIdMap[(c as any).name.toLowerCase()] = (c as any).id
      for (const cat of serviceCategories) {
        if (!existingSvcCatNames.has(cat.toLowerCase())) {
          try {
            const { data: created } = await supabase
              .from('service_categories').insert({ name: cat, master_id: user!.id }).select().single()
            if (created) categoryIdMap[cat.toLowerCase()] = (created as any).id
          } catch { /* ignore */ }
        }
      }
      const { data: existingServices } = await supabase
        .from('services').select('name').eq('master_id', user!.id)
      const existingSvcNames = new Set((existingServices ?? []).map((s: any) => s.name.toLowerCase()))
      for (const svc of servicesToImport) {
        if (!existingSvcNames.has(svc.name.toLowerCase())) {
          try {
            await supabase.from('services').insert({
              name: svc.name, duration_min: 60, master_id: user!.id,
              category_id: categoryIdMap[(svc.category ?? '').toLowerCase()] || undefined,
              is_active: true, is_bookable: true,
            })
          } catch { /* ignore */ }
        }
      }
      const { data: existingProducts } = await supabase
        .from('inventory_items').select('name').eq('master_id', user!.id)
      const existingProdNames = new Set((existingProducts ?? []).map((p: any) => p.name.toLowerCase()))
      for (const prod of productsToImport) {
        if (!existingProdNames.has(prod.name.toLowerCase())) {
          try {
            await supabase.from('inventory_items').insert({
              name: prod.name, category: prod.category || undefined,
              unit: prod.unit || undefined, quantity: 0, master_id: user!.id,
            })
          } catch { /* ignore */ }
        }
      }
    } catch { /* don't block */ }
  }

  const saveSchedule = async () => {
    const scheduleData: Record<string, any> = { master_id: user!.id }
    for (const day of DAYS) {
      scheduleData[`${day}_enabled`] = week[day].enabled
      scheduleData[`${day}_start`]   = week[day].start
      scheduleData[`${day}_end`]     = week[day].end
    }
    try {
      const { data: existing } = await supabase
        .from('schedules').select('id').eq('master_id', user!.id).maybeSingle()
      if (existing) {
        await supabase.from('schedules').update(scheduleData).eq('id', existing.id)
      } else {
        await supabase.from('schedules').insert({ slot_duration: 30, advance_days: 30, ...scheduleData })
      }
    } catch { /* ignore */ }
  }

  const generateSlug = () => {
    const base = (displayName || user?.name || '').trim().toLowerCase().replace(/\s+/g, '') || 'master'
    return `${base}${Math.random().toString(36).slice(2, 7)}`
  }

  const saveProfile = async (profileData: Record<string, any> | FormData) => {
    const { data: existing } = await supabase
      .from('master_profiles').select('id').eq('user_id', user!.id).maybeSingle()
    if (existing) {
      if (profileData instanceof FormData) {
        const obj: Record<string, any> = {}
        profileData.forEach((v, k) => { obj[k] = v })
        await supabase.from('master_profiles').update(obj).eq('id', existing.id)
      } else {
        await supabase.from('master_profiles').update(profileData).eq('id', existing.id)
      }
    } else {
      if (profileData instanceof FormData) {
        const obj: Record<string, any> = { user_id: user!.id, booking_slug: generateSlug() }
        profileData.forEach((v, k) => { obj[k] = v })
        await supabase.from('master_profiles').insert(obj)
      } else {
        await supabase.from('master_profiles').insert({ ...profileData, user_id: user!.id, booking_slug: generateSlug() })
      }
    }
  }

  const handleFinish = async () => {
    setLoading(true)
    try {
      await supabase.from('users').update({ language, timezone, onboarded: true }).eq('id', user!.id)
      if (language !== i18n.language) i18n.changeLanguage(language)
      const profileData: Record<string, any> = {
        display_name: displayName.trim() || undefined,
        profession: profession.trim() || 'Мастер',
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
        address: address.trim() || undefined,
        currency,
      }
      if (avatarFile) {
        const fd = new FormData()
        Object.entries(profileData).forEach(([k, v]) => { if (v !== undefined) fd.append(k, String(v)) })
        fd.append('avatar', avatarFile)
        await saveProfile(fd as any)
      } else {
        await saveProfile(profileData)
      }
      await saveSchedule()
      await autoImport()
      onComplete()
    } catch (err: any) {
      console.error('Onboarding error:', err)
      toast.error(err?.message || 'Ошибка сохранения')
      onComplete()
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    if (step === 1 && !profession.trim()) return // профессия обязательна
    if (step < STEPS.length - 1) setStep((s) => s + 1)
    else handleFinish()
  }

  // ─────────────────────────────────────────────────────────────────────────
  const progressPct = ((step + 1) / STEPS.length) * 100

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && onClose) onClose() }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden flex flex-col gap-0" hideClose mobileFullscreen>

        {/* ── Welcome screen ─────────────────────────────────────────────── */}
        {showWelcome && (
          <>
            <div className="flex flex-col items-center justify-center flex-1 px-8 py-12 gap-6 text-center">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-10 w-10 text-primary/60" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('onboarding.welcomeGreeting')}</p>
                <h2 className="text-2xl font-bold">{user?.name || '—'}</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {t('onboarding.welcomeDesc')}
                </p>
              </div>
            </div>
            <div className="px-6 pb-6 pt-2 border-t bg-background">
              <Button className="w-full gap-1" onClick={() => setShowWelcome(false)}>
                {t('onboarding.startBtn')} <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {/* ── Wizard (header + steps + footer) ──────────────────────────── */}
        {!showWelcome && (<>
        <div className="px-6 pt-6 pb-4">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold leading-tight">{t('onboarding.title')}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {STEPS[step].label}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                {step + 1} / {STEPS.length}
              </span>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* ── Step Content ───────────────────────────────────────────────── */}
        <div className="px-6 pb-2 space-y-4 flex-1 overflow-y-auto">

          {/* ── Step 0: Личные данные ──────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">

              {/* Avatar — centered, clickable */}
              <div className="flex flex-col items-center pt-2 pb-1 gap-2">
                <button
                  type="button"
                  onClick={() => setPhotoModalOpen(true)}
                  className="group relative w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-primary/30 hover:border-primary/60 bg-primary/5 transition-colors"
                >
                  {avatarPreview
                    ? <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                    : (
                      <div className="flex flex-col items-center justify-center h-full gap-1.5">
                        <Camera className="h-7 w-7 text-primary/40" />
                        <span className="text-[11px] text-primary/50 font-medium">Фото</span>
                      </div>
                    )
                  }
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                    <Camera className="h-5 w-5 text-white" />
                  </div>
                </button>
                <span className="text-xs text-muted-foreground">
                  {avatarPreview ? 'Нажмите для замены' : t('onboarding.photoHint')}
                </span>
              </div>

              {/* Hidden file inputs */}
              <input ref={fileInputRef}   type="file" accept="image/*"                    className="sr-only" onChange={onAvatarChange} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onAvatarChange} />

              <div className="space-y-1.5">
                <Label className="text-xs">{t('profile.displayName')}</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('profile.displayNamePlaceholder')}
                  readOnly={!!prefill?.name}
                  autoFocus={!prefill?.name}
                  className={cn(prefill?.name && "bg-muted/40 cursor-default select-text")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('profile.phone')}</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998 99 000-00-00"
                  type="tel"
                  readOnly={!!prefill?.phone}
                  className={cn(prefill?.phone && "bg-muted/40 cursor-default select-text")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('profile.city')}</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ташкент" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('profile.address')}</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ул. Амира Темура 11" />
              </div>
            </div>
          )}

          {/* ── Step 1: Профессия + График ──────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Profession combobox */}
              <div className="space-y-1.5" ref={profContainerRef}>
                <Label className="text-xs">
                  {t('profile.profession')}
                  <span className="text-destructive ml-0.5">*</span>
                </Label>
                <div className="relative">
                  <Input
                    value={professionQuery}
                    onChange={(e) => {
                      setProfessionQuery(e.target.value)
                      setProfession(e.target.value)
                      setShowProfSuggestions(true)
                    }}
                    onFocus={() => setShowProfSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowProfSuggestions(false), 150)}
                    placeholder="Парикмахер, Тренер, Репетитор..."
                    autoFocus
                    className={cn(!profession.trim() && 'border-destructive/50 focus-visible:ring-destructive/30')}
                  />
                  {showProfSuggestions && (() => {
                    const q = professionQuery.trim().toLowerCase()
                    const filtered = PROFESSION_SUGGESTIONS.filter((p) =>
                      !q || p.toLowerCase().includes(q)
                    ).slice(0, 8)
                    if (!filtered.length) return null
                    return (
                      <div className="absolute z-50 top-full mt-1 w-full bg-white dark:bg-zinc-900 border rounded-lg shadow-xl overflow-hidden">
                        {filtered.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onMouseDown={() => {
                              setProfession(p)
                              setProfessionQuery(p)
                              setShowProfSuggestions(false)
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )
                  })()}
                </div>
                {!profession.trim() && (
                  <p className="text-xs text-destructive">Укажите вашу профессию</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('onboarding.workSchedule')}</Label>
                {/* Compact day toggles */}
                <div className="flex gap-1.5">
                  {DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={cn(
                        'flex-1 h-9 rounded-lg text-xs font-medium transition-colors',
                        week[day].enabled
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      {t(`schedule.days.${day}`)}
                    </button>
                  ))}
                </div>
                {/* Shared time range */}
                <div className="flex items-center gap-2 pt-0.5">
                  <Select value={workStart} onValueChange={(v) => {
                    setWorkStart(v)
                    setWeek(w => Object.fromEntries(DAYS.map(d => [d, { ...w[d], start: v }])) as WeekSchedule)
                  }}>
                    <SelectTrigger className="flex-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{TIME_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground shrink-0">—</span>
                  <Select value={workEnd} onValueChange={(v) => {
                    setWorkEnd(v)
                    setWeek(w => Object.fromEntries(DAYS.map(d => [d, { ...w[d], end: v }])) as WeekSchedule)
                  }}>
                    <SelectTrigger className="flex-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{TIME_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">Детальная настройка — в разделе «Расписание»</p>
              </div>
            </div>
          )}

          {/* ── Step 2: Язык + Валюта + TZ ─────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('settings.language')}</Label>
                <Select value={language} onValueChange={(val) => {
                  setLanguage(val)
                  const suggestedCurrency = LANG_TO_CURRENCY[val]
                  if (suggestedCurrency) setCurrency(suggestedCurrency)
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('settings.currency')}</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('settings.timezone')}</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIMEZONES_SHORT.map((tz) => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Auto-import notice — counts from global catalog */}
              {profession && catalogCounts && (catalogCounts.svc > 0 || catalogCounts.prod > 0) && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-1">
                  <p className="text-xs font-semibold text-primary">{t('onboarding.autoImportTitle')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('onboarding.autoImportDesc', { specialty: profession, svcCount: catalogCounts.svc, prodCount: catalogCounts.prod })}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-background">
          <Button
            variant="ghost"
            onClick={() => step > 0 && setStep((s) => s - 1)}
            disabled={step === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('onboarding.back')}
          </Button>

          <div className="flex gap-2">
            {step < STEPS.length - 1 && (
              <Button variant="ghost" onClick={() => setStep((s) => s + 1)} className="text-muted-foreground">
                {t('onboarding.skip')}
              </Button>
            )}
            <Button onClick={handleNext} loading={loading} className="gap-1">
              {step < STEPS.length - 1 ? (
                <>{t('onboarding.next')}<ChevronRight className="h-4 w-4" /></>
              ) : (
                <><Check className="h-4 w-4" />{t('onboarding.finish')}</>
              )}
            </Button>
          </div>
        </div>
        </>)}

      </DialogContent>

      {/* ── Photo picker modal ──────────────────────────────────────────────── */}
      <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base">Фото профиля</DialogTitle>
          </DialogHeader>

          {/* Avatar preview */}
          {avatarPreview && (
            <div className="flex justify-center py-2">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/20">
                <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pb-1">
            <Button
              variant="outline"
              className="w-full gap-2 justify-center"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              Сделать фото
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2 justify-center"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
              Выбрать из галереи
            </Button>

            {avatarPreview && (
              <Button
                variant="ghost"
                className="w-full gap-2 justify-center text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setAvatarFile(null)
                  setAvatarPreview(null)
                  setPhotoModalOpen(false)
                }}
              >
                <Trash2 className="h-4 w-4" />
                Удалить фото
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </Dialog>
  )
}
