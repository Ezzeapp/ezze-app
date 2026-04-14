import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'

export interface CleaningItemType {
  id: string
  product: string
  name: string
  category: string          // order type slug: 'clothing' | 'carpet' | etc.
  default_price: number
  default_days: number
  sort_order: number
  created_at: string
}

export const ITEM_TYPES_KEY = 'cleaning_item_types'

export function useCleaningItemTypes() {
  return useQuery({
    queryKey: [ITEM_TYPES_KEY, PRODUCT],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cleaning_item_types')
        .select('*')
        .eq('product', PRODUCT)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as CleaningItemType[]
    },
    staleTime: 60_000,
  })
}

export function useUpsertItemType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<CleaningItemType> & { name: string }) => {
      const { error } = await supabase
        .from('cleaning_item_types')
        .upsert({ ...payload, product: PRODUCT }, { onConflict: 'product,name' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ITEM_TYPES_KEY] }),
  })
}

export function useDeleteItemType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cleaning_item_types')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ITEM_TYPES_KEY] }),
  })
}
