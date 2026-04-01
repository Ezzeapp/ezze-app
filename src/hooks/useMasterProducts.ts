import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { MasterProduct } from '@/types'

export const PRODUCTS_KEY = 'master_products'

/** Products of the current authenticated master */
export function useMyProducts() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [PRODUCTS_KEY, 'my', user?.id],
    queryFn: async (): Promise<MasterProduct[]> => {
      const { data, error } = await supabase
        .from('master_products')
        .select('*')
        .eq('user_id', user!.id)
        .order('order_index', { ascending: true })
      if (error) throw error
      return (data ?? []) as MasterProduct[]
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  })
}

/** Public products for a master's profile page */
export function usePublicProducts(userId: string | undefined) {
  return useQuery({
    queryKey: [PRODUCTS_KEY, 'public', userId],
    queryFn: async (): Promise<MasterProduct[]> => {
      const { data, error } = await supabase
        .from('master_products')
        .select('*')
        .eq('user_id', userId!)
        .eq('is_available', true)
        .order('order_index', { ascending: true })
      if (error) throw error
      return (data ?? []) as MasterProduct[]
    },
    enabled: !!userId,
    staleTime: 120_000,
  })
}

/** Create or update a product */
export function useUpsertProduct() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (product: Partial<MasterProduct> & { name: string; price: number }) => {
      const payload = { ...product, user_id: user!.id }
      if (payload.id) {
        const { data, error } = await supabase
          .from('master_products')
          .update(payload)
          .eq('id', payload.id)
          .select()
          .single()
        if (error) throw error
        return data as MasterProduct
      } else {
        const { data, error } = await supabase
          .from('master_products')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        return data as MasterProduct
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
    },
  })
}

/** Delete a product */
export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('master_products').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
    },
  })
}
