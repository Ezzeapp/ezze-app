import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import type { RentalMaintenance } from '@/types/rental'

export const RENTAL_MAINTENANCE_KEY = 'rental_maintenance'

export function useRentalMaintenance(itemId?: string) {
  return useQuery({
    queryKey: [RENTAL_MAINTENANCE_KEY, PRODUCT, itemId ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('rental_maintenance')
        .select('*')
        .eq('product', PRODUCT)
        .order('planned_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (itemId) q = q.eq('item_id', itemId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as RentalMaintenance[]
    },
    staleTime: 30_000,
  })
}

export function useUpsertRentalMaintenance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<RentalMaintenance> & { item_id: string; title: string }) => {
      const { data, error } = await supabase
        .from('rental_maintenance')
        .upsert({ ...payload, product: PRODUCT })
        .select()
        .single()
      if (error) throw error
      return data as RentalMaintenance
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [RENTAL_MAINTENANCE_KEY] }),
  })
}

export function useDeleteRentalMaintenance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rental_maintenance').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [RENTAL_MAINTENANCE_KEY] }),
  })
}
