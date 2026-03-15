import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// ── Keys ──────────────────────────────────────────────────────────────────────
export const LOYALTY_SETTINGS_KEY  = 'loyalty_settings'
export const LOYALTY_POINTS_KEY    = 'loyalty_points'
export const REFERRALS_KEY         = 'referrals'
export const LOYALTY_HOLIDAYS_KEY  = 'loyalty_holidays'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface LoyaltySettings {
  id?: string
  master_id?: string
  enabled: boolean
  earn_per_1000: number
  redeem_per_100pts: number
  auto_redeem: boolean
  referral_enabled: boolean
  referrer_bonus: number
  referree_bonus: number
  level_regular_visits: number
  level_vip_visits: number
  level_premium_visits: number
  discount_regular: number
  discount_vip: number
  discount_premium: number
}

export interface LoyaltyPoint {
  id: string
  master_id: string
  client_id: string
  appointment_id?: string | null
  amount: number
  reason: string
  note?: string | null
  created_at: string
}

export interface Referral {
  id: string
  master_id: string
  referrer_client_id: string
  referred_client_id: string
  status: 'pending' | 'rewarded'
  rewarded_at?: string | null
  created_at: string
  referrer?: { first_name: string; last_name?: string }
  referred?: { first_name: string; last_name?: string }
}

export interface LoyaltyHoliday {
  id: string
  master_id: string
  name: string
  date_type: 'annual' | 'once'
  date_value: string        // 'MM-DD' for annual, 'YYYY-MM-DD' for once
  points_multiplier: number // 1.0 = no change, 2.0 = double
  bonus_points: number
  discount_pct: number
  enabled: boolean
  created_at: string
}

// Returns matching active holiday for a given 'YYYY-MM-DD' date
export function getActiveHolidayForDate(
  date: string,
  holidays: LoyaltyHoliday[],
): LoyaltyHoliday | null {
  const mmdd = date.slice(5) // 'MM-DD' from 'YYYY-MM-DD'
  return holidays.find(h => {
    if (!h.enabled) return false
    if (h.date_type === 'annual') return h.date_value === mmdd
    if (h.date_type === 'once')   return h.date_value === date
    return false
  }) ?? null
}

export type LoyaltyLevel = 'new' | 'regular' | 'vip' | 'premium'

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  enabled: false,
  earn_per_1000: 1,
  redeem_per_100pts: 1000,
  auto_redeem: false,
  referral_enabled: false,
  referrer_bonus: 100,
  referree_bonus: 50,
  level_regular_visits: 3,
  level_vip_visits: 10,
  level_premium_visits: 20,
  discount_regular: 5,
  discount_vip: 10,
  discount_premium: 15,
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function getLoyaltyLevel(visits: number, settings: LoyaltySettings): LoyaltyLevel {
  if (visits >= settings.level_premium_visits) return 'premium'
  if (visits >= settings.level_vip_visits) return 'vip'
  if (visits >= settings.level_regular_visits) return 'regular'
  return 'new'
}

export function getLevelDiscount(level: LoyaltyLevel, settings: LoyaltySettings): number {
  switch (level) {
    case 'premium': return settings.discount_premium
    case 'vip':     return settings.discount_vip
    case 'regular': return settings.discount_regular
    default:        return 0
  }
}

export function getLevelLabel(level: LoyaltyLevel): string {
  const map: Record<LoyaltyLevel, string> = {
    new:     '🆕',
    regular: '🥈',
    vip:     '🥇',
    premium: '💎',
  }
  return map[level]
}

export function getLevelColor(level: LoyaltyLevel): string {
  const map: Record<LoyaltyLevel, string> = {
    new:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    regular: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    vip:     'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    premium: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  }
  return map[level]
}

export function calculateEarnedPoints(price: number, earnPer1000: number): number {
  return Math.floor(price / 1000) * earnPer1000
}

// ── Settings hooks ─────────────────────────────────────────────────────────────
export function useLoyaltySettings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [LOYALTY_SETTINGS_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_settings')
        .select('*')
        .eq('master_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return (data as LoyaltySettings | null) ?? null
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  })
}

export function useUpdateLoyaltySettings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (settings: Omit<LoyaltySettings, 'id' | 'master_id'>) => {
      const { data, error } = await supabase
        .from('loyalty_settings')
        .upsert({ ...settings, master_id: user!.id }, { onConflict: 'master_id' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [LOYALTY_SETTINGS_KEY] }),
  })
}

// ── Points hooks ──────────────────────────────────────────────────────────────
export function useClientLoyaltyBalance(clientId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [LOYALTY_POINTS_KEY, 'balance', user?.id, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_points')
        .select('amount')
        .eq('master_id', user!.id)
        .eq('client_id', clientId!)
      if (error) throw error
      return (data || []).reduce((s, r) => s + r.amount, 0)
    },
    enabled: !!user && !!clientId,
    staleTime: 1000 * 60 * 2,
  })
}

export function useClientLoyaltyPoints(clientId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [LOYALTY_POINTS_KEY, 'list', user?.id, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_points')
        .select('*')
        .eq('master_id', user!.id)
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as LoyaltyPoint[]
    },
    enabled: !!user && !!clientId,
    staleTime: 1000 * 60 * 2,
  })
}

// Map of clientId → balance for all clients
export function useAllClientsLoyaltyBalances() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [LOYALTY_POINTS_KEY, 'all_balances', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_points')
        .select('client_id, amount')
        .eq('master_id', user!.id)
      if (error) throw error
      const map: Record<string, number> = {}
      for (const row of data || []) {
        map[row.client_id] = (map[row.client_id] || 0) + row.amount
      }
      return map
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  })
}

export function useAddLoyaltyPoints() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      clientId,
      amount,
      reason,
      note,
      appointmentId,
    }: {
      clientId: string
      amount: number
      reason: string
      note?: string
      appointmentId?: string
    }) => {
      const { data, error } = await supabase
        .from('loyalty_points')
        .insert({
          master_id: user!.id,
          client_id: clientId,
          amount,
          reason,
          note: note || null,
          appointment_id: appointmentId || null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [LOYALTY_POINTS_KEY] })
    },
  })
}

// Award points automatically when appointment is marked done
export function useAwardAppointmentPoints() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      appointmentId,
      clientId,
      price,
      date,
    }: {
      appointmentId: string
      clientId: string | null
      price: number
      date?: string  // YYYY-MM-DD — for holiday matching
    }) => {
      if (!clientId || !user || price <= 0) return null

      // Get loyalty settings (must be enabled)
      const { data: settings } = await supabase
        .from('loyalty_settings')
        .select('*')
        .eq('master_id', user.id)
        .eq('enabled', true)
        .maybeSingle()

      if (!settings) return null

      // Check if points already awarded for this appointment
      const { count } = await supabase
        .from('loyalty_points')
        .select('id', { count: 'exact', head: true })
        .eq('appointment_id', appointmentId)
        .gt('amount', 0)

      if (count && count > 0) return null

      // Check for active holiday on this date
      const { data: holidayRows } = await supabase
        .from('loyalty_holidays')
        .select('*')
        .eq('master_id', user.id)
        .eq('enabled', true)

      const activeHoliday = date
        ? getActiveHolidayForDate(date, (holidayRows || []) as LoyaltyHoliday[])
        : null

      // Check if this is the first visit (for first_visit reason)
      const { count: prevDone } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('master_id', user.id)
        .eq('client_id', clientId)
        .eq('status', 'done')
        .neq('id', appointmentId)

      const isFirstVisit = (prevDone ?? 0) === 0
      const multiplier = activeHoliday?.points_multiplier ?? 1
      const earnedPoints = Math.floor(calculateEarnedPoints(price, settings.earn_per_1000) * multiplier)
      const inserts: any[] = []

      if (earnedPoints > 0) {
        inserts.push({
          master_id: user.id,
          client_id: clientId,
          appointment_id: appointmentId,
          amount: earnedPoints,
          reason: isFirstVisit ? 'first_visit' : 'visit',
        })
      }

      // Holiday flat bonus points (separate entry)
      if (activeHoliday && activeHoliday.bonus_points > 0) {
        inserts.push({
          master_id: user.id,
          client_id: clientId,
          appointment_id: appointmentId,
          amount: activeHoliday.bonus_points,
          reason: 'holiday',
          note: activeHoliday.name,
        })
      }

      // Auto-redeem: deduct points as discount
      if (settings.auto_redeem) {
        const { data: pointRows } = await supabase
          .from('loyalty_points')
          .select('amount')
          .eq('master_id', user.id)
          .eq('client_id', clientId)

        const currentBalance = (pointRows || []).reduce((s: number, r: any) => s + r.amount, 0)

        if (currentBalance >= 100) {
          const maxDiscount = Math.floor(currentBalance / 100) * settings.redeem_per_100pts
          const discount = Math.min(maxDiscount, price)
          const pointsToRedeem = Math.ceil(discount / settings.redeem_per_100pts) * 100

          if (pointsToRedeem > 0) {
            inserts.push({
              master_id: user.id,
              client_id: clientId,
              appointment_id: appointmentId,
              amount: -pointsToRedeem,
              reason: 'redeem',
              note: `Автосписание: скидка ${discount}`,
            })
          }
        }
      }

      if (inserts.length > 0) {
        const { error } = await supabase.from('loyalty_points').insert(inserts)
        if (error) throw error
      }

      return { earnedPoints, isFirstVisit, activeHoliday }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOYALTY_POINTS_KEY] })
    },
  })
}

// Map of clientId → done visits count (for level calculation)
export function useAllClientsDoneVisits() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['appointments', 'done_counts_loyalty', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('client_id')
        .eq('master_id', user!.id)
        .eq('status', 'done')
        .not('client_id', 'is', null)
      if (error) throw error
      const map: Record<string, number> = {}
      for (const row of data || []) {
        if (row.client_id) map[row.client_id] = (map[row.client_id] || 0) + 1
      }
      return map
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  })
}

// ── Referrals hooks ───────────────────────────────────────────────────────────
export function useReferrals() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [REFERRALS_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referrals')
        .select(`
          *,
          referrer:clients!referrer_client_id(first_name, last_name),
          referred:clients!referred_client_id(first_name, last_name)
        `)
        .eq('master_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as Referral[]
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  })
}

export function useCreateReferral() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      referrerClientId,
      referredClientId,
    }: {
      referrerClientId: string
      referredClientId: string
    }) => {
      const { data, error } = await supabase
        .from('referrals')
        .insert({
          master_id: user!.id,
          referrer_client_id: referrerClientId,
          referred_client_id: referredClientId,
          status: 'pending',
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [REFERRALS_KEY] }),
  })
}

export function useRewardReferral() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      referralId,
      referrerClientId,
      referredClientId,
      referrerBonus,
      referreeBonus,
    }: {
      referralId: string
      referrerClientId: string
      referredClientId: string
      referrerBonus: number
      referreeBonus: number
    }) => {
      // Award points to both
      const inserts = [
        { master_id: user!.id, client_id: referrerClientId, amount: referrerBonus,  reason: 'referral', note: 'Бонус за приглашение' },
        { master_id: user!.id, client_id: referredClientId, amount: referreeBonus,  reason: 'referral', note: 'Бонус нового клиента' },
      ]
      const { error: pErr } = await supabase.from('loyalty_points').insert(inserts)
      if (pErr) throw pErr

      // Mark referral as rewarded
      const { error: rErr } = await supabase
        .from('referrals')
        .update({ status: 'rewarded', rewarded_at: new Date().toISOString() })
        .eq('id', referralId)
      if (rErr) throw rErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REFERRALS_KEY] })
      queryClient.invalidateQueries({ queryKey: [LOYALTY_POINTS_KEY] })
    },
  })
}

// ── Holidays hooks ────────────────────────────────────────────────────────────
export function useLoyaltyHolidays() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [LOYALTY_HOLIDAYS_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_holidays')
        .select('*')
        .eq('master_id', user!.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data || []) as LoyaltyHoliday[]
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  })
}

export function useCreateLoyaltyHoliday() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<LoyaltyHoliday, 'id' | 'master_id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('loyalty_holidays')
        .insert({ ...payload, master_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data as LoyaltyHoliday
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [LOYALTY_HOLIDAYS_KEY] }),
  })
}

export function useUpdateLoyaltyHoliday() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<Omit<LoyaltyHoliday, 'master_id' | 'created_at'>> & { id: string }) => {
      const { data, error } = await supabase
        .from('loyalty_holidays')
        .update(payload)
        .eq('id', id)
        .eq('master_id', user!.id)
        .select()
        .single()
      if (error) throw error
      return data as LoyaltyHoliday
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [LOYALTY_HOLIDAYS_KEY] }),
  })
}

export function useDeleteLoyaltyHoliday() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('loyalty_holidays')
        .delete()
        .eq('id', id)
        .eq('master_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [LOYALTY_HOLIDAYS_KEY] }),
  })
}
