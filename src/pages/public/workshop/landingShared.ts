import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import type { LandingContent, LandingHowStep, LandingReview, MasterProfile } from '@/types'

// ── Данные мастера: типы устройств (workshop_item_types) ────────────────────

export interface WorkshopDeviceRow {
  id: string
  name: string
  category: string | null
  default_diagnostic_price: number
  default_days: number
  default_warranty_days: number
  icon: string | null
  sort_order: number
}

export function usePublicWorkshopDevices() {
  return useQuery({
    queryKey: ['public-workshop-devices', PRODUCT],
    queryFn: async (): Promise<WorkshopDeviceRow[]> => {
      const { data } = await supabase
        .from('workshop_item_types')
        .select('id, name, category, default_diagnostic_price, default_days, default_warranty_days, icon, sort_order')
        .eq('product', PRODUCT)
        .eq('active', true)
        .order('sort_order', { ascending: true })
      return (data ?? []) as WorkshopDeviceRow[]
    },
    enabled: PRODUCT === 'workshop',
    staleTime: 300_000,
  })
}

// ── Услуги мастера (services таблица) — для прайса ──────────────────────────

export interface WorkshopServiceRow {
  id: string
  name: string
  price: number
  duration: number
  description: string | null
}

export function usePublicWorkshopServices(userId: string | undefined) {
  return useQuery({
    queryKey: ['public-workshop-services', userId],
    queryFn: async (): Promise<WorkshopServiceRow[]> => {
      const { data } = await supabase
        .from('services')
        .select('id, name, price, duration, description')
        .eq('user_id', userId!)
        .eq('is_active', true)
        .order('order_index', { ascending: true })
        .limit(20)
      return (data ?? []) as WorkshopServiceRow[]
    },
    enabled: !!userId && PRODUCT === 'workshop',
    staleTime: 300_000,
  })
}

// ── Контент / контракт ─────────────────────────────────────────────────────

export interface WorkshopLandingProps {
  profile: MasterProfile
  devices: WorkshopDeviceRow[]
  services: WorkshopServiceRow[]
  avatarUrl: string | null
  coverUrl: string | null
  bookingUrl: string
  content: ResolvedWorkshopContent
}

export interface ResolvedWorkshopContent {
  heroBadge: string
  businessSubtitle: string
  warrantyMonths: number
  diagnosticsFree: boolean
  diagnosticsMinutes: number
  successRatePercent: number
  totalRepairs: number
  yearsInBusiness: number
  workingHours: string
  howSteps: LandingHowStep[]
  reviews: LandingReview[]
}

const DEFAULT_HOW_STEPS: LandingHowStep[] = [
  { title: 'Заявка', description: 'Опишите неисправность в форме или Telegram-боте. Ответим за 5 минут.' },
  { title: 'Диагностика', description: 'Бесплатная диагностика {diagnostics_minutes} мин. Точная цена и срок до начала работ.' },
  { title: 'Ремонт', description: 'Сертифицированный мастер. Оригинальные запчасти. Статус онлайн.' },
  { title: 'Выдача', description: 'Тестирование при вас. Гарантийный талон. {warranty_months} мес. гарантии.' },
]

export function resolveWorkshopContent(content?: LandingContent): ResolvedWorkshopContent {
  return {
    heroBadge:           content?.hero_badge          ?? 'Гарантия 6 месяцев',
    businessSubtitle:    content?.business_subtitle   ?? 'Профессиональный ремонт техники',
    warrantyMonths:      content?.warranty_months     ?? 6,
    diagnosticsFree:     content?.diagnostics_free    ?? true,
    diagnosticsMinutes:  content?.diagnostics_minutes ?? 30,
    successRatePercent:  content?.success_rate_percent ?? 98,
    totalRepairs:        content?.total_repairs       ?? 0,
    yearsInBusiness:     content?.years_in_business   ?? 0,
    workingHours:        content?.working_hours       ?? 'Пн–Сб 9:00–20:00',
    howSteps:            (content?.how_steps?.length ? content.how_steps : DEFAULT_HOW_STEPS).slice(0, 4),
    reviews:             content?.reviews ?? [],
  }
}

export function interpolateStep(text: string, c: ResolvedWorkshopContent): string {
  return text
    .replace('{warranty_months}', String(c.warrantyMonths))
    .replace('{diagnostics_minutes}', String(c.diagnosticsMinutes))
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function buildPhoneHref(phone?: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : null
}

export function buildWhatsappHref(phone?: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : null
}

export function buildTelegramHref(handle?: string): string | null {
  if (!handle) return null
  if (handle.startsWith('http')) return handle
  return `https://t.me/${handle.replace('@', '')}`
}

export function buildMapsHref(profile: MasterProfile): string | null {
  const parts = [profile.address, profile.city].filter(Boolean)
  if (!parts.length) return null
  return `https://maps.google.com/?q=${encodeURIComponent(parts.join(', '))}`
}

// Иконка Lucide по slug категории / icon-полю записи
const ICON_BY_CATEGORY: Record<string, string> = {
  phone: 'Smartphone',
  smartphone: 'Smartphone',
  laptop: 'Laptop',
  computer: 'Monitor',
  tv: 'Tv',
  appliance: 'WashingMachine',
  watch: 'Watch',
  audio: 'Headphones',
  drone: 'Plane',
  other: 'Wrench',
}

export function getDeviceIconName(row: WorkshopDeviceRow): string {
  if (row.icon) return row.icon
  const cat = (row.category ?? '').toLowerCase()
  return ICON_BY_CATEGORY[cat] ?? 'Wrench'
}

// Группировка по категории для отображения
export interface DeviceGroup {
  category: string
  label: string
  devices: WorkshopDeviceRow[]
  minPrice: number | null
}

const CATEGORY_LABELS: Record<string, string> = {
  phone: 'Смартфоны',
  smartphone: 'Смартфоны',
  laptop: 'Ноутбуки',
  computer: 'Компьютеры',
  tv: 'Телевизоры',
  appliance: 'Бытовая техника',
  watch: 'Часы',
  audio: 'Аудиотехника',
  drone: 'Дроны',
  other: 'Прочее',
}

export function buildDeviceGroups(devices: WorkshopDeviceRow[]): DeviceGroup[] {
  const grouped = devices.reduce<Record<string, WorkshopDeviceRow[]>>((acc, d) => {
    const key = (d.category ?? 'other').toLowerCase()
    if (!acc[key]) acc[key] = []
    acc[key].push(d)
    return acc
  }, {})

  return Object.keys(grouped).map(cat => {
    const items = grouped[cat]
    const minPrice = items.length ? Math.min(...items.map(d => d.default_diagnostic_price || Infinity).filter(Number.isFinite)) : null
    return {
      category: cat,
      label: CATEGORY_LABELS[cat] ?? cat,
      devices: items,
      minPrice: minPrice === Infinity ? null : minPrice,
    }
  })
}
