import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { GlobalService, GlobalProduct } from '@/types'

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL SERVICES
// ═══════════════════════════════════════════════════════════════════════════

export const GLOBAL_SERVICES_KEY = 'global_services'

export function useGlobalServices(search = '') {
  return useQuery({
    queryKey: [GLOBAL_SERVICES_KEY, search],
    queryFn: async () => {
      let query = supabase
        .from('global_services')
        .select('*')
        .order('category')
        .order('order')
        .order('name')
      if (search) {
        query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%`)
      }
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as GlobalService[]
    },
    staleTime: 5 * 60_000,
  })
}

export function useCreateGlobalService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<GlobalService>) => {
      const { data: result, error } = await supabase
        .from('global_services')
        .insert(data)
        .select()
        .single()
      if (error) throw error
      return result as GlobalService
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [GLOBAL_SERVICES_KEY] }),
  })
}

export function useUpdateGlobalService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<GlobalService> }) => {
      const { data: result, error } = await supabase
        .from('global_services')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return result as GlobalService
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [GLOBAL_SERVICES_KEY] }),
  })
}

export function useDeleteGlobalService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('global_services').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [GLOBAL_SERVICES_KEY] }),
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════

export const GLOBAL_PRODUCTS_KEY = 'global_products'

export function useGlobalProducts(search = '') {
  return useQuery({
    queryKey: [GLOBAL_PRODUCTS_KEY, search],
    queryFn: async () => {
      let query = supabase
        .from('global_products')
        .select('*')
        .order('category')
        .order('order')
        .order('name')
      if (search) {
        query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%`)
      }
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as GlobalProduct[]
    },
    staleTime: 5 * 60_000,
  })
}

export function useCreateGlobalProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<GlobalProduct>) => {
      const { data: result, error } = await supabase
        .from('global_products')
        .insert(data)
        .select()
        .single()
      if (error) throw error
      return result as GlobalProduct
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [GLOBAL_PRODUCTS_KEY] }),
  })
}

export function useUpdateGlobalProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<GlobalProduct> }) => {
      const { data: result, error } = await supabase
        .from('global_products')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return result as GlobalProduct
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [GLOBAL_PRODUCTS_KEY] }),
  })
}

export function useDeleteGlobalProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('global_products').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [GLOBAL_PRODUCTS_KEY] }),
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// BULK IMPORT
// ═══════════════════════════════════════════════════════════════════════════

export function useBulkImportGlobalServices() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: Array<{ category: string; name: string; duration_min?: number; price?: number }>) => {
      const { data: existing } = await supabase.from('global_services').select('*')
      const existingSet = new Set(
        (existing ?? []).map((s: any) => `${(s.category ?? '').toLowerCase()}::${s.name.toLowerCase()}`)
      )
      let created = 0
      for (const item of items) {
        const key = `${(item.category || '').toLowerCase()}::${item.name.toLowerCase()}`
        if (!existingSet.has(key)) {
          await supabase.from('global_services').insert(item)
          created++
        }
      }
      return created
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [GLOBAL_SERVICES_KEY] }),
  })
}

export function useBulkImportGlobalProducts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: Array<{ category: string; name: string; unit?: string; price?: number }>) => {
      const { data: existing } = await supabase.from('global_products').select('*')
      const existingSet = new Set(
        (existing ?? []).map((p: any) => `${(p.category ?? '').toLowerCase()}::${p.name.toLowerCase()}`)
      )
      let created = 0
      for (const item of items) {
        const key = `${(item.category || '').toLowerCase()}::${item.name.toLowerCase()}`
        if (!existingSet.has(key)) {
          await supabase.from('global_products').insert(item)
          created++
        }
      }
      return created
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [GLOBAL_PRODUCTS_KEY] }),
  })
}
