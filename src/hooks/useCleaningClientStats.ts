import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useTeamScope } from '@/contexts/TeamContext'
import { PRODUCT } from '@/lib/config'

export interface ClientStats {
  count: number
  spent: number
  unpaidAmount: number
  lastDate: string | null
}

export function useCleaningClientStats(clientId: string | null) {
  const teamScope = useTeamScope()
  return useQuery<ClientStats | null>({
    queryKey: ['cleaning_client_stats', clientId, PRODUCT, teamScope.effectiveTeamId],
    queryFn: async () => {
      if (!clientId) return null
      let q = supabase
        .from('cleaning_orders')
        .select('id, total_amount, paid_amount, payment_status, created_at')
        .eq('client_id', clientId)
        .eq('product', PRODUCT)
        .order('created_at', { ascending: false })
      // team_id команды ИЛИ legacy без team_id (совпадает с RLS 065)
      if (teamScope.effectiveTeamId) {
        q = q.or(`team_id.eq.${teamScope.effectiveTeamId},team_id.is.null`)
      }
      const { data } = await q
      const orders = data ?? []
      const spent = orders
        .filter(o => o.payment_status === 'paid')
        .reduce((s, o) => s + (o.total_amount || 0), 0)
      const unpaidAmount = orders
        .filter(o => (o.payment_status ?? 'unpaid') !== 'paid')
        .reduce((s, o) => s + Math.max(0, (o.total_amount || 0) - (o.paid_amount || 0)), 0)
      return {
        count: orders.length,
        spent,
        unpaidAmount,
        lastDate: orders[0]?.created_at ?? null,
      }
    },
    enabled: !!clientId,
    staleTime: 30_000,
  })
}
