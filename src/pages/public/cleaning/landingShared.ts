import { useQuery } from '@tanstack/react-query'
import { type LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import {
  getOrderTypeIcon, useCleaningEnabledOrderTypes,
  type CleaningOrderTypeConfig,
} from '@/hooks/useCleaningOrders'
import type { LandingContent, LandingHowStep, MasterProfile } from '@/types'

export interface CleaningPriceRow {
  id: string
  name: string
  default_price: number
  category: string | null
  sort_order: number
}

export type CleaningOrderTypeRow = CleaningOrderTypeConfig

export interface PublicPromoCode {
  id: string
  code: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  valid_until: string | null
}

export function usePublicCleaningPrices() {
  return useQuery({
    queryKey: ['public-cleaning-prices', PRODUCT],
    queryFn: async (): Promise<CleaningPriceRow[]> => {
      const { data } = await supabase
        .from('cleaning_item_types')
        .select('id, name, default_price, category, sort_order')
        .eq('product', PRODUCT)
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true })
      return (data ?? []) as CleaningPriceRow[]
    },
    enabled: PRODUCT === 'cleaning',
    staleTime: 300_000,
  })
}

export const usePublicCleaningOrderTypes = useCleaningEnabledOrderTypes

export interface CleaningLandingProps {
  profile: MasterProfile
  prices: CleaningPriceRow[]
  orderTypes: CleaningOrderTypeRow[]
  promoCodes: PublicPromoCode[]
  avatarUrl: string | null
  coverUrl: string | null
  bookingUrl: string
  content: ResolvedLandingContent
}

export interface ResolvedLandingContent {
  heroBadge: string
  businessSubtitle: string
  turnaroundHours: number
  freePickupThreshold: number
  workingHours: string
  showEcoBadge: boolean
  showQualityBadge: boolean
  howSteps: LandingHowStep[]
  reviews: NonNullable<LandingContent['reviews']>
}

const DEFAULT_HOW_STEPS: LandingHowStep[] = [
  { title: 'Оставляете заявку',  description: 'Через сайт, бот или звонок. 2 минуты вашего времени.' },
  { title: 'Курьер забирает',    description: 'В удобное окно. Бесплатно от {free_pickup}.' },
  { title: 'Чистим и гладим',    description: 'Эко-средства, индивидуальная программа под материал.' },
  { title: 'Привозим обратно',   description: 'Через {turnaround_hours} часов в фирменной упаковке.' },
]

export function resolveLandingContent(content?: LandingContent): ResolvedLandingContent {
  return {
    heroBadge:           content?.hero_badge          ?? 'Доставка 24/7',
    businessSubtitle:    content?.business_subtitle   ?? 'Премиум химчистка',
    turnaroundHours:     content?.turnaround_hours    ?? 48,
    freePickupThreshold: content?.free_pickup_threshold ?? 200_000,
    workingHours:        content?.working_hours       ?? '9:00 — 21:00, ежедневно',
    showEcoBadge:        content?.show_eco_badge      ?? true,
    showQualityBadge:    content?.show_quality_badge  ?? true,
    howSteps:            (content?.how_steps?.length ? content.how_steps : DEFAULT_HOW_STEPS).slice(0, 4),
    reviews:             content?.reviews ?? [],
  }
}

export function interpolateStep(text: string, c: ResolvedLandingContent, formatPrice: (n: number) => string): string {
  return text
    .replace('{free_pickup}', formatPrice(c.freePickupThreshold))
    .replace('{turnaround_hours}', String(c.turnaroundHours))
}

const CATEGORY_LABELS: Record<string, string> = {
  clothing:  'Одежда',
  carpet:    'Ковры',
  furniture: 'Мебель',
  shoes:     'Обувь',
  curtains:  'Шторы',
  bedding:   'Постельное',
  extras:    'Доп. услуги',
}

export interface PriceGroup {
  slug: string
  label: string
  icon: LucideIcon
  description?: string
  items: CleaningPriceRow[]
  minPrice: number | null
  unitPerSquareMeter: boolean
}

const DEFAULT_ICON_BY_SLUG: Record<string, string> = {
  clothing:  'Shirt',
  carpet:    'LayoutGrid',
  furniture: 'Sofa',
  shoes:     'Footprints',
  curtains:  'Wind',
  bedding:   'BedDouble',
  extras:    'Sparkles',
}

export function buildPriceGroups(
  prices: CleaningPriceRow[],
  orderTypes: CleaningOrderTypeRow[],
): PriceGroup[] {
  const grouped = prices.reduce<Record<string, CleaningPriceRow[]>>((acc, p) => {
    const key = p.category || 'extras'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  const orderedKeys = orderTypes.length
    ? orderTypes.map(t => t.slug).filter(s => grouped[s])
    : Object.keys(grouped)

  for (const k of Object.keys(grouped)) {
    if (!orderedKeys.includes(k)) orderedKeys.push(k)
  }

  return orderedKeys.map(slug => {
    const ot = orderTypes.find(t => t.slug === slug)
    const items = grouped[slug] ?? []
    const minPrice = items.length ? Math.min(...items.map(i => i.default_price)) : null
    return {
      slug,
      label: ot?.label ?? CATEGORY_LABELS[slug] ?? slug,
      icon: getOrderTypeIcon(ot?.icon ?? DEFAULT_ICON_BY_SLUG[slug] ?? 'Package'),
      description: ot?.description,
      items,
      minPrice,
      unitPerSquareMeter: slug === 'carpet',
    }
  }).filter(g => g.items.length > 0)
}

export function yearsInBusiness(createdIso?: string): number | null {
  if (!createdIso) return null
  const start = new Date(createdIso).getTime()
  if (isNaN(start)) return null
  const years = (Date.now() - start) / (365.25 * 24 * 3600 * 1000)
  return years >= 1 ? Math.floor(years) : null
}

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

export function buildMapsHref(profile: MasterProfile): string | null {
  const parts = [profile.address, profile.city].filter(Boolean)
  if (!parts.length) return null
  return `https://maps.google.com/?q=${encodeURIComponent(parts.join(', '))}`
}
