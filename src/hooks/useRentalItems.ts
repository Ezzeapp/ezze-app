import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import type { RentalItem, GlobalRentalItem } from '@/types/rental'

export const RENTAL_ITEMS_KEY        = 'rental_items'
export const GLOBAL_RENTAL_ITEMS_KEY = 'global_rental_items'

export function useRentalItems() {
  return useQuery({
    queryKey: [RENTAL_ITEMS_KEY, PRODUCT],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rental_items')
        .select('*')
        .eq('product', PRODUCT)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as RentalItem[]
    },
    staleTime: 30_000,
  })
}

export function useUpsertRentalItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<RentalItem> & { name: string }) => {
      const { data, error } = await supabase
        .from('rental_items')
        .upsert({ ...payload, product: PRODUCT })
        .select()
        .single()
      if (error) throw error
      return data as RentalItem
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [RENTAL_ITEMS_KEY] }),
  })
}

export function useDeleteRentalItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rental_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [RENTAL_ITEMS_KEY] }),
  })
}

export function useGlobalRentalItems() {
  return useQuery({
    queryKey: [GLOBAL_RENTAL_ITEMS_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_rental_items')
        .select('*')
        .eq('product', 'rental')
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as GlobalRentalItem[]
    },
    staleTime: 5 * 60_000,
  })
}
