import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Subscription } from '@/types'

export const SUBSCRIPTIONS_KEY = 'subscriptions'

// ── useMySubscription ─────────────────────────────────────────────────────────

/** Активная или последняя подписка текущего пользователя */
export function useMySubscription() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [SUBSCRIPTIONS_KEY, 'my', user?.id],
    queryFn: async (): Promise<Subscription | null> => {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .maybeSingle()
      return (data as Subscription | null) ?? null
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  })
}

// ── useSubscriptionHistory ────────────────────────────────────────────────────

/** История всех подписок текущего пользователя */
export function useSubscriptionHistory() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [SUBSCRIPTIONS_KEY, 'history', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Subscription[]
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  })
}

// ── useAllSubscriptions (admin) ───────────────────────────────────────────────

/** Все подписки всех пользователей — только для admin */
export function useAllSubscriptions(page = 1, perPage = 30) {
  return useQuery({
    queryKey: [SUBSCRIPTIONS_KEY, 'all', page],
    queryFn: async () => {
      const from = (page - 1) * perPage
      const to = from + perPage - 1
      const { data, error, count } = await supabase
        .from('subscriptions')
        .select('*, user:users(*)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
      if (error) throw error
      return {
        items: (data ?? []) as Subscription[],
        totalItems: count ?? 0,
        page,
        perPage,
        totalPages: Math.ceil((count ?? 0) / perPage),
      }
    },
    staleTime: 30_000,
  })
}
