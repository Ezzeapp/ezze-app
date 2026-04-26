import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'

export interface ClientStats {
  count: number
  spent: number
  unpaidAmount: number
  lastDate: string | null
}

export function useCleaningClientStats(clientId: string | null) {
  return useQuery<ClientStats | null>({
    queryKey: ['cleaning_client_stats', clientId, PRODUCT],
    queryFn: async () => {
      if (!clientId) return null
      const { data } = await supabase
        .from('cleaning_orders')
        .select('id, total_amount, paid_amount, payment_status, created_at')
        .eq('client_id', clientId)
        .eq('product', PRODUCT)
        .order('created_at', { ascending: false })
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
