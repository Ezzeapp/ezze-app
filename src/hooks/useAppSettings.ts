import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { uploadFile, getFileUrl } from '@/lib/storage'
import { useAuth } from '@/contexts/AuthContext'

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
        .single()
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
        .upsert({ key: 'plan_limits', value }, { onConflict: 'key' })
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
        .single()
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
        .upsert({ key: 'plan_prices', value }, { onConflict: 'key' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [APP_SETTINGS_KEY, 'plan_prices'] }),
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
  const { data: records } = await supabase.from('app_settings').select('*')
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
        .upsert({ key, value }, { onConflict: 'key' })
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
        .single()
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
        .upsert({ key: 'email_config', value }, { onConflict: 'key' })
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
      await uploadFile('teams', 'app-logo', file)
      // Store a marker that logo exists
      const { data, error } = await supabase
        .from('app_settings')
        .upsert({ key: 'platform_logo', value: 'app-logo' }, { onConflict: 'key' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [APP_SETTINGS_KEY] }),
  })
}
