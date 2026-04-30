import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Sparkles, Palette, Type, ScrollText, CalendarDays,
  UserCheck, ShieldCheck, MessageCircle, Globe,
  Check, Eye, EyeOff, Tag, Bell, AlertCircle,
  Square, Circle, Pill,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useProfile, useUpsertProfile } from '@/hooks/useProfile'
import { toast } from '@/components/shared/Toaster'
import { cn } from '@/lib/utils'
import type { BookingSettings, PageSettings } from '@/types'

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULTS: BookingSettings = {
  theme: 'elegant',
  accent_color: '#1e293b',
  bg_style: 'light',
  btn_shape: 'rounded',
  font_family: 'inter',
  show_cover: true,
  hero_title: '',
  hero_subtitle: '',

  group_by_category: false,
  show_descriptions: true,
  show_service_image: true,
  show_duration: true,
  multi_select: true,
  hide_priceless: false,
  service_sort: 'manual',

  min_lead_hours: 1,
  max_advance_days: 30,
  slot_step_min: 30,
  show_busy_slots: true,
  default_calendar_open: false,

  fields_email: false,
  fields_telegram: true,
  fields_notes: true,
  notes_placeholder: '',
  require_consent: false,
  consent_text: '',
  enable_promo: true,

  thanks_title: '',
  thanks_text: '',
  show_add_to_calendar: true,
  show_review_form: true,
  redirect_telegram: false,

  auto_confirm: true,
  daily_limit_per_client: 0,
  prepay_enabled: false,
  prepay_percent: 0,

  notify_telegram: true,
  notify_email: false,
  remind_hours_before: 2,

  seo_title: '',
  seo_description: '',
}

// ── Card обёртка ────────────────────────────────────────────────────────────

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

function SwitchRow({
  label, hint, checked, onChange,
}: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function Tile<T extends string | number>({
  active, onClick, children, disabled,
}: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; value?: T }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-lg border-2 px-3 py-2.5 text-xs font-medium transition-all flex items-center justify-center gap-1.5 text-center',
        active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  )
}

// ── Тематические превью ────────────────────────────────────────────────────

const THEMES: { id: 'elegant' | 'glamour' | 'playful'; label: string; tagline: string; preview: React.ReactNode }[] = [
  {
    id: 'elegant',
    label: 'Elegant Minimal',
    tagline: 'Светлая, минимализм, серый+бежевый',
    preview: (
      <div className="rounded-md overflow-hidden h-full bg-stone-50 border border-stone-200">
        <div className="p-2 h-full flex flex-col gap-1">
          <div className="h-2 w-3/4 rounded bg-stone-900" />
          <div className="h-1 w-1/2 rounded bg-stone-400" />
          <div className="h-px bg-stone-200 my-0.5" />
          <div className="space-y-0.5">
            <div className="h-3 rounded bg-white border border-stone-200" />
            <div className="h-3 rounded bg-white border border-stone-200" />
            <div className="h-3 rounded bg-white border border-stone-200" />
          </div>
          <div className="h-2.5 rounded bg-stone-900 mt-auto" />
        </div>
      </div>
    ),
  },
  {
    id: 'glamour',
    label: 'Glamour Premium',
    tagline: 'Тёмный фон, золото, серьёзный стиль',
    preview: (
      <div className="rounded-md overflow-hidden h-full" style={{ background: '#0e0d0c' }}>
        <div className="p-2 h-full flex flex-col gap-1">
          <div className="h-1 w-6 rounded" style={{ background: '#c9a14a' }} />
          <div className="h-2 w-3/4 rounded bg-white/85" />
          <div className="h-2 w-1/2 rounded italic" style={{ background: '#c9a14a' }} />
          <div className="space-y-0.5 mt-1">
            <div className="h-3 rounded bg-white/5 border border-white/10" />
            <div className="h-3 rounded bg-white/5 border border-white/10" />
          </div>
          <div className="h-2.5 rounded mt-auto" style={{ background: '#c9a14a' }} />
        </div>
      </div>
    ),
  },
  {
    id: 'playful',
    label: 'Playful Pastel',
    tagline: 'Цветные градиенты, дружелюбный',
    preview: (
      <div className="rounded-md overflow-hidden h-full" style={{ background: 'linear-gradient(135deg,#FFE6F0,#E6E8FF,#E0F7F4)' }}>
        <div className="p-2 h-full flex flex-col gap-1">
          <div className="h-2 w-2 rounded-full bg-rose-400" />
          <div className="h-2 w-2/3 rounded bg-stone-900" />
          <div className="grid grid-cols-2 gap-1 mt-0.5">
            <div className="h-3 rounded bg-rose-300/70" />
            <div className="h-3 rounded bg-sky-300/70" />
            <div className="h-3 rounded bg-emerald-300/70" />
            <div className="h-3 rounded bg-amber-300/70" />
          </div>
          <div className="h-2.5 rounded-full bg-stone-900 mt-auto" />
        </div>
      </div>
    ),
  },
]

const ACCENT_PRESETS = [
  '#1e293b', '#0f766e', '#9333ea', '#db2777',
  '#dc2626', '#f59e0b', '#0ea5e9', '#16a34a',
  '#c9a14a', '#000000',
]

// ── Главный компонент ──────────────────────────────────────────────────────

export function BookingSettingsTab() {
  const { t } = useTranslation()
  const { data: profile, isLoading } = useProfile()
  const upsertProfile = useUpsertProfile()

  const pageSettings: PageSettings = profile?.page_settings ?? {}
  const cur: BookingSettings = { ...DEFAULTS, ...(pageSettings.booking_settings ?? {}) }

  // Локальные drafts для текстовых полей — комитим по blur
  const [heroTitle, setHeroTitle] = useState('')
  const [heroSubtitle, setHeroSubtitle] = useState('')
  const [notesPlaceholder, setNotesPlaceholder] = useState('')
  const [consentText, setConsentText] = useState('')
  const [thanksTitle, setThanksTitle] = useState('')
  const [thanksText, setThanksText] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [accentColor, setAccentColor] = useState(cur.accent_color ?? DEFAULTS.accent_color!)

  const lastIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!profile || profile.id === lastIdRef.current) return
    lastIdRef.current = profile.id
    setHeroTitle(cur.hero_title ?? '')
    setHeroSubtitle(cur.hero_subtitle ?? '')
    setNotesPlaceholder(cur.notes_placeholder ?? '')
    setConsentText(cur.consent_text ?? '')
    setThanksTitle(cur.thanks_title ?? '')
    setThanksText(cur.thanks_text ?? '')
    setSeoTitle(cur.seo_title ?? '')
    setSeoDescription(cur.seo_description ?? '')
    setAccentColor(cur.accent_color ?? DEFAULTS.accent_color!)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  if (isLoading) {
    return <div className="space-y-4 max-w-2xl">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
  }

  const save = async (patch: Partial<BookingSettings>) => {
    const next: BookingSettings = { ...cur, ...patch }
    try {
      await upsertProfile.mutateAsync({
        id: profile?.id,
        data: { page_settings: { ...pageSettings, booking_settings: next } },
      })
    } catch {
      toast.error(t('common.saveError', 'Ошибка сохранения'))
    }
  }

  const previewUrl = `${window.location.origin}/book/${profile?.booking_slug ?? ''}`

  return (
    <div className="space-y-4 max-w-2xl">
      {/* ─── Шапка с предпросмотром ─── */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/0 p-4 flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Настройки страницы онлайн-записи</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Эти настройки управляют видом и поведением страницы, которую видят клиенты при записи.
          </p>
        </div>
        {profile?.booking_slug && (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="gap-1.5"><Eye className="h-3.5 w-3.5" />Открыть</Button>
          </a>
        )}
      </div>

      {/* ─── Тема / Оформление ─── */}
      <Card
        title="Визуальная тема"
        description="Готовый стиль страницы — фон, типографика, акцентные цвета."
        icon={Palette}
      >
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map(thm => {
            const active = cur.theme === thm.id
            return (
              <button
                key={thm.id}
                type="button"
                onClick={() => save({ theme: thm.id })}
                className={cn(
                  'rounded-xl border-2 transition-all text-left p-2 flex flex-col gap-1.5',
                  active ? 'border-primary shadow-md' : 'border-border hover:border-primary/40',
                )}
              >
                <div className="aspect-[4/5] w-full">{thm.preview}</div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold leading-tight truncate">{thm.label}</span>
                  {active && <Check className="h-3 w-3 text-primary ml-auto shrink-0" />}
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">{thm.tagline}</p>
              </button>
            )
          })}
        </div>
      </Card>

      {/* ─── Стилизация ─── */}
      <Card title="Цвет, фон, кнопки" icon={Type}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs mb-2 block">Акцентный цвет</Label>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => { setAccentColor(c); save({ accent_color: c }) }}
                  className={cn(
                    'h-7 w-7 rounded-full ring-offset-2 transition-all',
                    cur.accent_color === c ? 'ring-2 ring-primary' : 'ring-0 hover:scale-110',
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                onBlur={() => accentColor !== cur.accent_color && save({ accent_color: accentColor })}
                className="h-7 w-7 rounded cursor-pointer border"
                title="Свой цвет"
              />
              <span className="text-xs text-muted-foreground font-mono ml-1">{cur.accent_color}</span>
            </div>
          </div>

          <div>
            <Label className="text-xs mb-2 block">Фон страницы</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'light',    l: 'Светлый' },
                { v: 'dark',     l: 'Тёмный' },
                { v: 'gradient', l: 'Градиент' },
              ] as const).map(o => (
                <Tile key={o.v} active={cur.bg_style === o.v} onClick={() => save({ bg_style: o.v })}>{o.l}</Tile>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs mb-2 block">Скругление кнопок</Label>
            <div className="grid grid-cols-3 gap-2">
              <Tile active={cur.btn_shape === 'square'} onClick={() => save({ btn_shape: 'square' })}><Square className="h-3.5 w-3.5" />Прямые</Tile>
              <Tile active={cur.btn_shape === 'rounded'} onClick={() => save({ btn_shape: 'rounded' })}><Circle className="h-3.5 w-3.5" />Скруглённые</Tile>
              <Tile active={cur.btn_shape === 'pill'} onClick={() => save({ btn_shape: 'pill' })}><Pill className="h-3.5 w-3.5" />Pill</Tile>
            </div>
          </div>

          <div>
            <Label className="text-xs mb-2 block">Шрифт</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                { v: 'inter',       l: 'Inter' },
                { v: 'manrope',     l: 'Manrope' },
                { v: 'montserrat',  l: 'Montserrat' },
                { v: 'playfair',    l: 'Playfair' },
              ] as const).map(o => (
                <Tile key={o.v} active={cur.font_family === o.v} onClick={() => save({ font_family: o.v })}>{o.l}</Tile>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* ─── Hero ─── */}
      <Card title="Шапка страницы" description="Заголовок, подзаголовок и обложка над списком услуг." icon={Sparkles}>
        <SwitchRow
          label="Показывать обложку"
          hint="Большое фоновое изображение в hero (если загружено в «Моя страница»)"
          checked={!!cur.show_cover}
          onChange={(v) => save({ show_cover: v })}
        />
        <div className="space-y-1.5">
          <Label className="text-xs">Заголовок hero</Label>
          <Input
            placeholder="Запишись онлайн"
            value={heroTitle}
            onChange={(e) => setHeroTitle(e.target.value)}
            onBlur={() => heroTitle !== (cur.hero_title ?? '') && save({ hero_title: heroTitle })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Подзаголовок / слоган</Label>
          <Input
            placeholder="Выбери услугу — забронируй удобное время"
            value={heroSubtitle}
            onChange={(e) => setHeroSubtitle(e.target.value)}
            onBlur={() => heroSubtitle !== (cur.hero_subtitle ?? '') && save({ hero_subtitle: heroSubtitle })}
          />
        </div>
      </Card>

      {/* ─── Услуги ─── */}
      <Card title="Список услуг" description="Что показывать клиенту в шаге «Выбор услуги»." icon={ScrollText}>
        <SwitchRow label="Группировать по категориям"
          checked={!!cur.group_by_category} onChange={(v) => save({ group_by_category: v })} />
        <SwitchRow label="Показывать описания"
          checked={!!cur.show_descriptions} onChange={(v) => save({ show_descriptions: v })} />
        <SwitchRow label="Показывать фото услуг"
          checked={!!cur.show_service_image} onChange={(v) => save({ show_service_image: v })} />
        <SwitchRow label="Показывать длительность"
          checked={!!cur.show_duration} onChange={(v) => save({ show_duration: v })} />
        <SwitchRow label="Мультивыбор услуг"
          hint="Клиент может выбрать несколько услуг в одну запись"
          checked={!!cur.multi_select} onChange={(v) => save({ multi_select: v })} />
        <SwitchRow label="Скрывать услуги без цены"
          hint='Услуги "По договорённости" не появятся в списке'
          checked={!!cur.hide_priceless} onChange={(v) => save({ hide_priceless: v })} />

        <div>
          <Label className="text-xs mb-2 block">Сортировка</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              { v: 'manual',     l: 'Ручная' },
              { v: 'name',       l: 'По имени' },
              { v: 'price_asc',  l: 'Цена ↑' },
              { v: 'price_desc', l: 'Цена ↓' },
            ] as const).map(o => (
              <Tile key={o.v} active={cur.service_sort === o.v} onClick={() => save({ service_sort: o.v })}>{o.l}</Tile>
            ))}
          </div>
        </div>
      </Card>

      {/* ─── Календарь и слоты ─── */}
      <Card title="Календарь и слоты" description="Когда и как клиенты видят свободное время." icon={CalendarDays}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Минимум часов до записи</Label>
            <Input
              type="number" min={0} max={168}
              value={cur.min_lead_hours ?? 0}
              onChange={(e) => save({ min_lead_hours: Math.max(0, Number(e.target.value) || 0) })}
            />
            <p className="text-[10px] text-muted-foreground">Запретить запись «прямо сейчас»</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">На сколько дней вперёд</Label>
            <Input
              type="number" min={1} max={365}
              value={cur.max_advance_days ?? 30}
              onChange={(e) => save({ max_advance_days: Math.max(1, Number(e.target.value) || 1) })}
            />
            <p className="text-[10px] text-muted-foreground">Сколько дней доступно для записи</p>
          </div>
        </div>

        <div>
          <Label className="text-xs mb-2 block">Шаг слотов</Label>
          <div className="grid grid-cols-3 gap-2">
            {([15, 30, 60] as const).map(v => (
              <Tile key={v} active={cur.slot_step_min === v} onClick={() => save({ slot_step_min: v })}>{v} мин</Tile>
            ))}
          </div>
        </div>

        <SwitchRow label="Показывать занятые слоты"
          hint="Если выкл — занятые часы скрываются вместо «зачёркнутого»"
          checked={!!cur.show_busy_slots} onChange={(v) => save({ show_busy_slots: v })} />
        <SwitchRow label="Календарь раскрыт по умолчанию"
          hint="Месячный вид сразу, а не свёрнутая неделя"
          checked={!!cur.default_calendar_open} onChange={(v) => save({ default_calendar_open: v })} />
      </Card>

      {/* ─── Форма клиента ─── */}
      <Card title="Форма клиента" description="Какие поля заполняет клиент перед подтверждением." icon={UserCheck}>
        <SwitchRow label="Email" checked={!!cur.fields_email} onChange={(v) => save({ fields_email: v })} />
        <SwitchRow label="Telegram (@username)" checked={!!cur.fields_telegram} onChange={(v) => save({ fields_telegram: v })} />
        <SwitchRow label="Поле «Комментарий»" checked={!!cur.fields_notes} onChange={(v) => save({ fields_notes: v })} />

        {cur.fields_notes && (
          <div className="space-y-1.5">
            <Label className="text-xs">Подсказка в комментарии</Label>
            <Input
              placeholder="Например: пожелания, аллергии, удобное время связи"
              value={notesPlaceholder}
              onChange={(e) => setNotesPlaceholder(e.target.value)}
              onBlur={() => notesPlaceholder !== (cur.notes_placeholder ?? '') && save({ notes_placeholder: notesPlaceholder })}
            />
          </div>
        )}

        <SwitchRow label="Включить промокоды"
          hint="Поле для ввода промокода со скидкой"
          checked={!!cur.enable_promo} onChange={(v) => save({ enable_promo: v })} />

        <SwitchRow label="Согласие с правилами"
          hint="Чек-бокс с обязательной галочкой и текстом"
          checked={!!cur.require_consent} onChange={(v) => save({ require_consent: v })} />
        {cur.require_consent && (
          <div className="space-y-1.5">
            <Label className="text-xs">Текст согласия</Label>
            <Textarea
              rows={2}
              placeholder="Я ознакомлен(а) с правилами отмены и переноса записи"
              value={consentText}
              onChange={(e) => setConsentText(e.target.value)}
              onBlur={() => consentText !== (cur.consent_text ?? '') && save({ consent_text: consentText })}
            />
          </div>
        )}
      </Card>

      {/* ─── Правила и безопасность ─── */}
      <Card title="Правила записи" description="Подтверждение, лимиты и предоплата." icon={ShieldCheck}>
        <SwitchRow label="Авто-подтверждение записей"
          hint="Запись подтверждается сразу. Если выкл — мастер должен вручную одобрить."
          checked={!!cur.auto_confirm} onChange={(v) => save({ auto_confirm: v })} />

        <div className="space-y-1.5">
          <Label className="text-xs">Лимит записей в день на одного клиента</Label>
          <Input
            type="number" min={0} max={20}
            value={cur.daily_limit_per_client ?? 0}
            onChange={(e) => save({ daily_limit_per_client: Math.max(0, Number(e.target.value) || 0) })}
          />
          <p className="text-[10px] text-muted-foreground">0 — без ограничений</p>
        </div>

        <SwitchRow label="Депозит при записи"
          hint="Запросить часть суммы вперёд через онлайн-оплату"
          checked={!!cur.prepay_enabled} onChange={(v) => save({ prepay_enabled: v })} />
        {cur.prepay_enabled && (
          <div className="space-y-1.5">
            <Label className="text-xs">Размер депозита, %</Label>
            <Input
              type="number" min={1} max={100}
              value={cur.prepay_percent ?? 0}
              onChange={(e) => save({ prepay_percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
            />
          </div>
        )}
      </Card>

      {/* ─── После записи ─── */}
      <Card title="После записи" description="Что видит клиент сразу после подтверждения." icon={MessageCircle}>
        <div className="space-y-1.5">
          <Label className="text-xs">Заголовок «Спасибо»</Label>
          <Input
            placeholder="Запись подтверждена ✨"
            value={thanksTitle}
            onChange={(e) => setThanksTitle(e.target.value)}
            onBlur={() => thanksTitle !== (cur.thanks_title ?? '') && save({ thanks_title: thanksTitle })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Текст подтверждения</Label>
          <Textarea
            rows={2}
            placeholder="Жду тебя в назначенное время. Если планы изменятся — напиши заранее."
            value={thanksText}
            onChange={(e) => setThanksText(e.target.value)}
            onBlur={() => thanksText !== (cur.thanks_text ?? '') && save({ thanks_text: thanksText })}
          />
        </div>

        <SwitchRow label="Кнопка «Добавить в календарь»"
          checked={!!cur.show_add_to_calendar} onChange={(v) => save({ show_add_to_calendar: v })} />
        <SwitchRow label="Просьба оставить отзыв"
          hint="После визита клиент сможет поставить оценку"
          checked={!!cur.show_review_form} onChange={(v) => save({ show_review_form: v })} />
        <SwitchRow label="Перевод в Telegram-чат"
          hint="После записи открывается чат с ботом для напоминаний"
          checked={!!cur.redirect_telegram} onChange={(v) => save({ redirect_telegram: v })} />
      </Card>

      {/* ─── Уведомления ─── */}
      <Card title="Уведомления клиенту" description="Как и когда напоминать о записи." icon={Bell}>
        <SwitchRow label="Telegram"
          checked={!!cur.notify_telegram} onChange={(v) => save({ notify_telegram: v })} />
        <SwitchRow label="Email"
          checked={!!cur.notify_email} onChange={(v) => save({ notify_email: v })} />

        <div>
          <Label className="text-xs mb-2 block">Напоминание перед визитом</Label>
          <div className="grid grid-cols-4 gap-2">
            {([
              { v: 0,  l: 'Выкл' },
              { v: 1,  l: 'За 1 ч' },
              { v: 2,  l: 'За 2 ч' },
              { v: 24, l: 'За сутки' },
            ] as const).map(o => (
              <Tile key={o.v} active={cur.remind_hours_before === o.v} onClick={() => save({ remind_hours_before: o.v })}>{o.l}</Tile>
            ))}
          </div>
        </div>
      </Card>

      {/* ─── SEO ─── */}
      <Card title="SEO и шеринг" description="Что увидят при шеринге ссылки в соцсетях." icon={Globe}>
        <div className="space-y-1.5">
          <Label className="text-xs">Title</Label>
          <Input
            placeholder="Запись к мастеру"
            maxLength={70}
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            onBlur={() => seoTitle !== (cur.seo_title ?? '') && save({ seo_title: seoTitle })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Textarea
            rows={2}
            maxLength={200}
            placeholder="Удобная онлайн-запись на услуги. Выберите время и забронируйте за 1 минуту."
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            onBlur={() => seoDescription !== (cur.seo_description ?? '') && save({ seo_description: seoDescription })}
          />
        </div>
      </Card>

      {/* ─── Превью / линк ─── */}
      <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
        <p className="flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />
          Изменения сохраняются автоматически. Чтобы посмотреть результат — откройте свою страницу:
        </p>
        {profile?.booking_slug && (
          <a className="text-primary hover:underline font-mono break-all" href={previewUrl} target="_blank" rel="noopener noreferrer">
            {previewUrl}
          </a>
        )}
        <p>
          Дизайн-варианты: <Link to="/design-preview/index.html" className="text-primary hover:underline">/design-preview/</Link>
        </p>
      </div>
    </div>
  )
}
