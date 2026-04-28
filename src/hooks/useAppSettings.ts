import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { uploadImage, getFileUrl } from "@/lib/storage"
import { useAuth } from '@/contexts/AuthContext'
import { PRODUCT } from '@/lib/config'

export const APP_SETTINGS_KEY = 'app_settings'

// ── Plan Limits ──────────────────────────────────────────────────────────────

export interface PlanLimitRow {
  key: string        // 'clients' | 'services' | 'appts_month'
  enabled: boolean   // whether this limit type is active
  free: number | null        // null = unlimited (∞)
  pro: number | null
  enterprise: number | null
}

export const DEFAULT_PLAN_LIMITS: PlanLimitRow[] = [
  { key: 'clients',     enabled: true, free: 50,  pro: null, enterprise: null },
  { key: 'services',    enabled: true, free: 20,  pro: null, enterprise: null },
  { key: 'appts_month', enabled: true, free: 100, pro: null, enterprise: null },
]

export function usePlanLimits() {
  return useQuery({
    queryKey: [APP_SETTINGS_KEY, 'plan_limits'],
    queryFn: async (): Promise<PlanLimitRow[]> => {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'plan_limits')
        .eq('product', PRODUCT)
        .maybeSingle()
      if (!data) return DEFAULT_PLAN_LIMITS
      try {
        return JSON.parse(data.value) as PlanLimitRow[]
      } catch {
        return DEFAULT_PLAN_LIMITS
      }
    },
    staleTime: 5 * 60_000,
  })
}

export function useUpdatePlanLimits() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rows: PlanLimitRow[]) => {
      const value = JSON.stringify(rows)
      const { data, error } = await supabase
        .from('app_settings')
        .upsert({ product: PRODUCT, key: 'plan_limits', value }, { onConflict: 'product,key' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [APP_SETTINGS_KEY, 'plan_limits'] }),
  })
}

// ── Plan Prices ───────────────────────────────────────────────────────────────

export interface PlanPricesConfig {
  pro: number
  enterprise: number
}

export const DEFAULT_PLAN_PRICES: PlanPricesConfig = {
  pro:        99_000,
  enterprise: 299_000,
}

export function usePlanPrices() {
  return useQuery({
    queryKey: [APP_SETTINGS_KEY, 'plan_prices'],
    queryFn: async (): Promise<PlanPricesConfig> => {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'plan_prices')
        .eq('product', PRODUCT)
        .maybeSingle()
      if (!data) return DEFAULT_PLAN_PRICES
      try {
        return JSON.parse(data.value) as PlanPricesConfig
      } catch {
        return DEFAULT_PLAN_PRICES
      }
    },
    staleTime: 5 * 60_000,
  })
}

export function useUpdatePlanPrices() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (prices: PlanPricesConfig) => {
      const value = JSON.stringify(prices)
      const { data, error } = await supabase
        .from('app_settings')
        .upsert({ product: PRODUCT, key: 'plan_prices', value }, { onConflict: 'product,key' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [APP_SETTINGS_KEY, 'plan_prices'] }),
  })
}

// ── Plan Names ────────────────────────────────────────────────────────────────

export interface PlanNamesConfig {
  free: string
  pro: string
  enterprise: string
}

export const DEFAULT_PLAN_NAMES: PlanNamesConfig = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

export function usePlanNames() {
  return useQuery({
    queryKey: [APP_SETTINGS_KEY, 'plan_names'],
    queryFn: async (): Promise<PlanNamesConfig> => {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'plan_names')
        .eq('product', PRODUCT)
        .maybeSingle()
      if (!data) return DEFAULT_PLAN_NAMES
      try {
        return { ...DEFAULT_PLAN_NAMES, ...JSON.parse(data.value) } as PlanNamesConfig
      } catch {
        return DEFAULT_PLAN_NAMES
      }
    },
    staleTime: 5 * 60_000,
  })
}

export function useUpdatePlanNames() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (names: PlanNamesConfig) => {
      const value = JSON.stringify(names)
      const { data, error } = await supabase
        .from('app_settings')
        .upsert({ product: PRODUCT, key: 'plan_names', value }, { onConflict: 'product,key' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [APP_SETTINGS_KEY, 'plan_names'] }),
  })
}

// ── Plan Features ─────────────────────────────────────────────────────────────

export interface PlanFeaturesConfig {
  free: string[]
  pro: string[]
  enterprise: string[]
}

export const DEFAULT_PLAN_FEATURES: PlanFeaturesConfig = {
  free: [],
  pro: [
    'Telegram-уведомления',
    'Email-уведомления',
    'Расширенная аналитика',
  ],
  enterprise: [
    'Telegram-уведомления',
    'Email-уведомления',
    'Расширенная аналитика',
    'Управление командой',
    'Приоритетная поддержка',
  ],
}

export function usePlanFeatures() {
  return useQuery({
    queryKey: [APP_SETTINGS_KEY, 'plan_features'],
    queryFn: async (): Promise<PlanFeaturesConfig> => {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'plan_features')
        .eq('product', PRODUCT)
        .maybeSingle()
      if (!data) return DEFAULT_PLAN_FEATURES
      try {
        return JSON.parse(data.value) as PlanFeaturesConfig
      } catch {
        return DEFAULT_PLAN_FEATURES
      }
    },
    staleTime: 5 * 60_000,
  })
}

export function useUpdatePlanFeatures() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (features: PlanFeaturesConfig) => {
      const value = JSON.stringify(features)
      const { data, error } = await supabase
        .from('app_settings')
        .upsert({ product: PRODUCT, key: 'plan_features', value }, { onConflict: 'product,key' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [APP_SETTINGS_KEY, 'plan_features'] }),
  })
}

// ── Plan Seat Pricing (per-seat биллинг для команд) ──────────────────────────

export interface SeatPricingTier {
  seats_included:        number   // включено в базовую цену
  additional_seat_price: number   // цена за каждое доп. место (UZS)
  max_seats:             number   // лимит мест в этом тарифе
}

export interface PlanSeatPricingConfig {
  free:       SeatPricingTier
  pro:        SeatPricingTier
  enterprise: SeatPricingTier
}

export const DEFAULT_PLAN_SEAT_PRICING: PlanSeatPricingConfig = {
  free:       { seats_included: 1, additional_seat_price: 0,     max_seats: 1 },
  pro:        { seats_included: 1, additional_seat_price: 0,     max_seats: 1 },
  enterprise: { seats_included: 3, additional_seat_price: 30000, max_seats: 15 },
}

export function usePlanSeatPricing() {
  return useQuery({
    queryKey: [APP_SETTINGS_KEY, 'plan_seat_pricing'],
    queryFn: async (): Promise<PlanSeatPricingConfig> => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'plan_seat_pricing')
        .eq('product', PRODUCT)
        .maybeSingle()
      if (!data?.value) return DEFAULT_PLAN_SEAT_PRICING
      try {
        return { ...DEFAULT_PLAN_SEAT_PRICING, ...JSON.parse(data.value) } as PlanSeatPricingConfig
      } catch {
        return DEFAULT_PLAN_SEAT_PRICING
      }
    },
    staleTime: 5 * 60_000,
  })
}

export function useUpdatePlanSeatPricing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config: PlanSeatPricingConfig) => {
      const value = JSON.stringify(config)
      const { data, error } = await supabase
        .from('app_settings')
        .upsert({ product: PRODUCT, key: 'plan_seat_pricing', value }, { onConflict: 'product,key' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [APP_SETTINGS_KEY, 'plan_seat_pricing'] }),
  })
}


// ── Plan Active (флаги включения тарифов) ───────────────────────────────────

export interface PlanActiveConfig {
  free:       boolean
  pro:        boolean
  enterprise: boolean
}

export const DEFAULT_PLAN_ACTIVE: PlanActiveConfig = {
  free: true, pro: true, enterprise: true,
}

export function usePlanActive() {
  return useQuery({
    queryKey: [APP_SETTINGS_KEY, 'plan_active'],
    queryFn: async (): Promise<PlanActiveConfig> => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'plan_active')
        .eq('product', PRODUCT)
        .maybeSingle()
      if (!data?.value) return DEFAULT_PLAN_ACTIVE
      try {
        return { ...DEFAULT_PLAN_ACTIVE, ...JSON.parse(data.value) } as PlanActiveConfig
      } catch {
        return DEFAULT_PLAN_ACTIVE
      }
    },
    staleTime: 5 * 60_000,
  })
}

export function useUpdatePlanActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cfg: PlanActiveConfig) => {
      const value = JSON.stringify(cfg)
      const { data, error } = await supabase
        .from('app_settings')
        .upsert({ product: PRODUCT, key: 'plan_active', value }, { onConflict: 'product,key' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [APP_SETTINGS_KEY, 'plan_active'] }),
  })
}


// ── Subscription Price (расчёт с учётом seats) ─────────────────────────────

export interface SubscriptionPriceArgs {
  plan: 'free' | 'pro' | 'enterprise'
  seats?: number   // для enterprise — фактическое кол-во активных сотрудников
}

/**
 * Рассчитывает итоговую месячную цену подписки с учётом per-seat биллинга.
 * Все значения берутся из app_settings — ничего не хардкодится.
 *
 * @example
 *   const { data: price } = useSubscriptionPrice({ plan: 'enterprise', seats: 5 })
 *   // плановая база 120000 + (5-3) * 30000 = 180000
 */
export function useSubscriptionPrice(args: SubscriptionPriceArgs) {
  const { data: prices } = usePlanPrices()
  const { data: seatPricing } = usePlanSeatPricing()

  const plan = args.plan
  const seats = Math.max(0, args.seats ?? 0)

  return useQuery({
    queryKey: [APP_SETTINGS_KEY, 'subscription_price', plan, seats, prices, seatPricing],
    queryFn: async () => {
      const basePrice = plan === 'free' ? 0
        : plan === 'pro' ? (prices?.pro ?? 0)
        : (prices?.enterprise ?? 0)

      if (plan !== 'enterprise') return basePrice

      const cfg = seatPricing?.enterprise ?? DEFAULT_PLAN_SEAT_PRICING.enterprise
      const additionalSeats = Math.max(0, seats - cfg.seats_included)
      return basePrice + additionalSeats * cfg.additional_seat_price
    },
    enabled: !!prices && !!seatPricing,
    staleTime: 60_000,
  })
}


// ── Plan Limit Check ─────────────────────────────────────────────────────────

export interface PlanLimitCheckResult {
  isEnabled: boolean
  isReached: boolean   // currentCount >= limit
  isWarning: boolean   // 80%+ used but not yet reached
  limit: number | null // null = unlimited
  percent: number      // 0–100+
}

/**
 * Checks whether a user is hitting a plan limit.
 * @param key          - 'clients' | 'services' | 'appts_month'
 * @param currentCount - current number of records
 */
export function usePlanLimitCheck(key: string, currentCount: number): PlanLimitCheckResult {
  const { user } = useAuth()
  const { data: limits } = usePlanLimits()

  const plan = (user?.plan ?? 'free') as 'free' | 'pro' | 'enterprise'
  const rows = limits ?? DEFAULT_PLAN_LIMITS
  const row = rows.find(r => r.key === key)

  if (!row || !row.enabled) {
    return { isEnabled: false, isReached: false, isWarning: false, limit: null, percent: 0 }
  }

  const limit = row[plan]
  if (limit === null) {
    // unlimited on this plan
    return { isEnabled: true, isReached: false, isWarning: false, limit: null, percent: 0 }
  }

  const percent = limit > 0 ? Math.round((currentCount / limit) * 100) : 100
  return {
    isEnabled: true,
    isReached: currentCount >= limit,
    isWarning: percent >= 80 && currentCount < limit,
    limit,
    percent,
  }
}

// ── App Settings ─────────────────────────────────────────────────────────────

export interface AppSettings {
  primary_color: string
  font_size: 'small' | 'medium' | 'large'
  platform_name: string
  registration_open: boolean
  web_registration_enabled: boolean  // false → /register только через Telegram Mini App
  web_access_enabled: boolean        // false → /login только через Telegram Mini App
  default_language: string
  default_currency: string
  default_timezone: string
  logo_url?: string
  // Подписки / платёжные провайдеры (только публичные ID, не ключи)
  payme_merchant_id?: string
  click_service_id?: string
  click_merchant_id?: string
  payment_providers?: string[]  // ['payme', 'click'] — активные провайдеры
}

async function fetchAppSettings(): Promise<AppSettings> {
  const { data: records } = await supabase.from('app_settings').select('*').eq('product', PRODUCT)
  const map: Record<string, string> = {}
  ;(records ?? []).forEach((r: any) => { map[r.key] = r.value })

  let paymentProviders: string[] = []
  try {
    paymentProviders = map.payment_providers ? JSON.parse(map.payment_providers) : []
  } catch { /* ignore */ }

  const logoPath = map.platform_logo ?? null
  const logoUrl = logoPath ? getFileUrl('teams', `app-logo`) : undefined

  return {
    primary_color: map.primary_color ?? '239 84% 67%',
    font_size: (map.font_size as AppSettings['font_size']) ?? 'medium',
    platform_name: map.platform_name ?? 'Ezze',
    registration_open: map.registration_open !== 'false',
    web_registration_enabled: map.web_registration_enabled !== 'false',
    web_access_enabled: map.web_access_enabled !== 'false',
    default_language: map.default_language ?? 'ru',
    default_currency: map.default_currency ?? 'RUB',
    default_timezone: map.default_timezone ?? 'Europe/Moscow',
    logo_url: logoUrl,
    payme_merchant_id: map.payme_merchant_id ?? '',
    click_service_id:  map.click_service_id  ?? '',
    click_merchant_id: map.click_merchant_id ?? '',
    payment_providers: paymentProviders,
  }
}

export function useAppSettings() {
  return useQuery({
    queryKey: [APP_SETTINGS_KEY],
    queryFn: fetchAppSettings,
    staleTime: 5 * 60_000,
  })
}

export function useUpdateAppSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { data, error } = await supabase
        .from('app_settings')
        .upsert({ product: PRODUCT, key, value }, { onConflict: 'product,key' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [APP_SETTINGS_KEY] }),
  })
}

// ── Email Config ──────────────────────────────────────────────────────────────

export interface EmailConfig {
  enabled: boolean
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_pass: string
  from_address: string
  from_name: string
}

export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  enabled: false,
  smtp_host: 'smtp.resend.com',
  smtp_port: 587,
  smtp_user: 'resend',
  smtp_pass: '',
  from_address: '',
  from_name: 'Ezze',
}

export function useEmailConfig() {
  return useQuery({
    queryKey: [APP_SETTINGS_KEY, 'email_config'],
    queryFn: async (): Promise<EmailConfig> => {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'email_config')
        .eq('product', PRODUCT)
        .maybeSingle()
      if (!data) return DEFAULT_EMAIL_CONFIG
      try {
        return JSON.parse(data.value) as EmailConfig
      } catch {
        return DEFAULT_EMAIL_CONFIG
      }
    },
    staleTime: 5 * 60_000,
  })
}

export function useUpdateEmailConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config: EmailConfig) => {
      const value = JSON.stringify(config)
      const { data, error } = await supabase
        .from('app_settings')
        .upsert({ product: PRODUCT, key: 'email_config', value }, { onConflict: 'product,key' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [APP_SETTINGS_KEY, 'email_config'] }),
  })
}

export function useUpdateAppLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      await uploadImage("teams", "app-logo", file, "logo")
      // Store a marker that logo exists
      const { data, error } = await supabase
        .from('app_settings')
        .upsert({ product: PRODUCT, key: 'platform_logo', value: 'app-logo' }, { onConflict: 'product,key' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [APP_SETTINGS_KEY] }),
  })
}

export function useResetAppLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('app_settings')
        .delete()
        .eq('key', 'platform_logo')
        .eq('product', PRODUCT)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [APP_SETTINGS_KEY] }),
  })
}

// ── AI Config ─────────────────────────────────────────────────────────────────

export interface AIConfig {
  enabled: boolean
  provider: string   // 'anthropic' | 'openai' | 'gemini' | 'deepseek' | 'qwen' | 'custom'
  api_key: string
  model: string
  max_tokens: number
  base_url?: string  // для provider='custom'
}

/** Sentinel: если api_key === AI_KEY_MASK → ключ не изменился (сохраняем старый) */
export const AI_KEY_MASK = '●●●●●●●●'

export const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: false,
  provider: 'anthropic',
  api_key: '',
  model: 'claude-haiku-4-5',
  max_tokens: 1024,
}

export function useAIConfig() {
  return useQuery({
    queryKey: [APP_SETTINGS_KEY, 'ai_config'],
    queryFn: async (): Promise<AIConfig> => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'ai_config')
        .eq('product', PRODUCT)
        .maybeSingle()
      if (!data?.value) return DEFAULT_AI_CONFIG
      try {
        const cfg = { ...DEFAULT_AI_CONFIG, ...JSON.parse(data.value) } as AIConfig
        // Маскируем ключ: он не должен попадать в React Query cache или DevTools
        return { ...cfg, api_key: cfg.api_key ? AI_KEY_MASK : '' }
      } catch {
        return DEFAULT_AI_CONFIG
      }
    },
    staleTime: 2 * 60_000,
  })
}

export function useUpdateAIConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config: AIConfig) => {
      let finalConfig = config
      // Если api_key не изменился (пользователь не вводил новый ключ),
      // подгружаем существующий ключ из БД, чтобы не затереть его
      if (config.api_key === AI_KEY_MASK || config.api_key === '') {
        const { data: existing } = await supabase
          .from('app_settings').select('value').eq('key', 'ai_config').maybeSingle()
        if (existing?.value) {
          try {
            const existingCfg = JSON.parse(existing.value)
            finalConfig = { ...config, api_key: existingCfg.api_key || '' }
          } catch { /* оставляем как есть */ }
        }
      }
      const value = JSON.stringify(finalConfig)
      const { data, error } = await supabase
        .from('app_settings')
        .upsert({ product: PRODUCT, key: 'ai_config', value }, { onConflict: 'product,key' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [APP_SETTINGS_KEY, 'ai_config'] }),
  })
}

// ── Telegram Config ───────────────────────────────────────────────────────────

export interface TgConfig {
  client_label: string   // Название кнопки для клиента (default "Ezze")
  master_label: string   // Название кнопки для мастера (default "Ezze")
  welcome_text?: string  // Текст приветствия при /start. Используй {name} для имени мастера.
}

export const DEFAULT_TG_CONFIG: TgConfig = {
  client_label: 'Ezze',
  master_label: 'Ezze',
  welcome_text: '👋 <b>Привет, {name}!</b>\n\nДобро пожаловать в <b>Ezze</b>.\n\n🌐 <b>Выберите язык:</b>',
}

export function useTgConfig() {
  return useQuery({
    queryKey: [APP_SETTINGS_KEY, 'tg_config'],
    queryFn: async (): Promise<TgConfig> => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'tg_config')
        .eq('product', PRODUCT)
        .maybeSingle()
      if (!data?.value) return DEFAULT_TG_CONFIG
      try {
        return { ...DEFAULT_TG_CONFIG, ...JSON.parse(data.value) } as TgConfig
      } catch {
        return DEFAULT_TG_CONFIG
      }
    },
    staleTime: 5 * 60_000,
  })
}

export function useUpdateTgConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config: TgConfig) => {
      const value = JSON.stringify(config)
      const { data, error } = await supabase
        .from('app_settings')
        .upsert({ product: PRODUCT, key: 'tg_config', value }, { onConflict: 'product,key' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [APP_SETTINGS_KEY, 'tg_config'] }),
  })
}

// ── Home Screen Config ─────────────────────────────────────────────────────

export interface HomeScreenTile {
  id: string
  label: Record<string, string>  // { ru, en, kz, uz, ... }
  icon: string
  route: string
  visible: boolean
  order: number
}

export interface HomeScreenConfig {
  mode: 'sidebar' | 'tiles'
  tiles: HomeScreenTile[]
}

const DEFAULT_HOME_SCREEN_CONFIG: HomeScreenConfig = { mode: 'sidebar', tiles: [] }

export function useHomeScreenConfig() {
  return useQuery({
    queryKey: [APP_SETTINGS_KEY, 'home_screen_config'],
    queryFn: async (): Promise<HomeScreenConfig> => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'home_screen_config')
        .eq('product', PRODUCT)
        .maybeSingle()
      if (!data?.value) return DEFAULT_HOME_SCREEN_CONFIG
      try {
        return JSON.parse(data.value) as HomeScreenConfig
      } catch {
        return DEFAULT_HOME_SCREEN_CONFIG
      }
    },
    staleTime: 5 * 60_000,
  })
}

export function useUpdateHomeScreenConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config: HomeScreenConfig) => {
      const value = JSON.stringify(config)
      const { data, error } = await supabase
        .from('app_settings')
        .upsert({ product: PRODUCT, key: 'home_screen_config', value }, { onConflict: 'product,key' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [APP_SETTINGS_KEY, 'home_screen_config'] }),
  })
}
