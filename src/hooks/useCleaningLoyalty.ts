import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface LoyaltyData {
  id: string
  client_id: string
  total_orders: number
  total_spent: number
  current_discount_pct: number
  tier: LoyaltyTier
}

export const TIER_CONFIG: Record<LoyaltyTier, {
  label: string
  color: string
  bg: string
  icon: string
  minOrders: number
  discount: number
}> = {
  bronze:   { label: 'Бронза',    color: 'text-amber-700',   bg: 'bg-amber-100',   icon: 'Medal',  minOrders: 0,  discount: 0 },
  silver:   { label: 'Серебро',   color: 'text-gray-500',    bg: 'bg-gray-100',    icon: 'Award',  minOrders: 5,  discount: 3 },
  gold:     { label: 'Золото',    color: 'text-yellow-600',  bg: 'bg-yellow-100',  icon: 'Star',   minOrders: 15, discount: 5 },
  platinum: { label: 'Платина',   color: 'text-violet-600',  bg: 'bg-violet-100',  icon: 'Crown',  minOrders: 30, discount: 10 },
}

const LOYALTY_KEY = 'cleaning_loyalty'

export function useClientLoyalty(clientId: string | null) {
  return useQuery({
    queryKey: [LOYALTY_KEY, clientId],
    queryFn: async () => {
      if (!clientId) return null
      const { data } = await supabase
        .from('cleaning_loyalty')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()
      return data as LoyaltyData | null
    },
    enabled: !!clientId,
    staleTime: 60_000,
  })
}

export function useRecalcLoyalty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase.rpc('recalc_cleaning_loyalty', { p_client_id: clientId })
      if (error) throw error
    },
    onSuccess: (_, clientId) => {
      qc.invalidateQueries({ queryKey: [LOYALTY_KEY, clientId] })
    },
  })
}
