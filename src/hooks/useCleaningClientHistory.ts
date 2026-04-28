import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useTeamScope } from '@/contexts/TeamContext'
import { PRODUCT } from '@/lib/config'

export interface RecentOrder {
  id: string
  number: string
  status: string
  total_amount: number
  paid_amount: number
  created_at: string
}

export interface TopItem {
  name: string
  count: number
}

export interface ClientHistory {
  recent: RecentOrder[]
  topItems: TopItem[]
}

export function useCleaningClientHistory(clientId: string | null) {
  const teamScope = useTeamScope()
  return useQuery<ClientHistory | null>({
    // teamId в queryKey: при смене контекста (вход/выход из команды) кэш не смешивается
    queryKey: ['cleaning_client_history', clientId, PRODUCT, teamScope.effectiveTeamId],
    queryFn: async () => {
      if (!clientId) return null
      let q = supabase
        .from('cleaning_orders')
        .select('id, number, status, total_amount, paid_amount, created_at, items:cleaning_order_items(item_type_name)')
        .eq('client_id', clientId)
        .eq('product', PRODUCT)
        .order('created_at', { ascending: false })
        .limit(30)
      // В команде — фильтруем по team_id (дублирует RLS, но даёт явный контракт + лучший cache)
      if (teamScope.effectiveTeamId) {
        q = q.eq('team_id', teamScope.effectiveTeamId)
      }
      const { data } = await q
      const orders = (data ?? []) as Array<RecentOrder & { items: { item_type_name: string }[] }>

      const counts = new Map<string, number>()
      for (const o of orders) {
        for (const it of o.items ?? []) {
          if (!it.item_type_name) continue
          counts.set(it.item_type_name, (counts.get(it.item_type_name) ?? 0) + 1)
        }
      }
      const topItems: TopItem[] = Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)

      const recent: RecentOrder[] = orders.slice(0, 5).map(o => ({
        id: o.id,
        number: o.number,
        status: o.status,
        total_amount: o.total_amount,
        paid_amount: o.paid_amount,
        created_at: o.created_at,
      }))

      return { recent, topItems }
    },
    enabled: !!clientId,
    staleTime: 30_000,
  })
}
