import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { uploadFile } from '@/lib/storage'
import type { InventoryItem } from '@/types'

export const INVENTORY_KEY = 'inventory'

export function useInventoryPage(search = '', page = 1, perPage = 25, sort = 'name') {
  const { user } = useAuth()
  return useQuery({
    queryKey: [INVENTORY_KEY, 'paged', user?.id, search, page, sort],
    queryFn: async () => {
      const from = (page - 1) * perPage
      const to = page * perPage - 1
      const ascending = !sort.startsWith('-')
      const sortField = sort.replace(/^-/, '')

      let query = supabase
        .from('inventory_items')
        .select('*', { count: 'exact' })
        .eq('master_id', user!.id)
        .order(sortField, { ascending })
        .range(from, to)

      if (search.trim()) {
        const q = search.trim().replace(/'/g, "''")
        query = query.or(
          `name.ilike.%${q}%,sku.ilike.%${q}%,category.ilike.%${q}%`
        )
      }

      const { data, count, error } = await query
      if (error) throw error
      return {
        items: (data ?? []) as InventoryItem[],
        totalItems: count ?? 0,
        page,
        perPage,
        totalPages: Math.ceil((count ?? 0) / perPage),
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
  })
}

export function useInventory(_search = '') {
  const { user } = useAuth()

  return useQuery({
    queryKey: [INVENTORY_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('master_id', user!.id)
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []) as InventoryItem[]
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  })
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (
      data: Omit<InventoryItem, 'id' | 'master' | 'created' | 'updated' | 'collectionId' | 'collectionName'>
    ) => {
      const { _imageFile, ...rest } = data as any
      const payload = { ...rest, master_id: user!.id }

      if (_imageFile instanceof File) {
        const { data: created, error: insErr } = await supabase
          .from('inventory_items')
          .insert(payload)
          .select()
          .single()
        if (insErr) throw insErr
        const imagePath = await uploadFile('inventory', `${user!.id}/${created.id}`, _imageFile)
        const { data: updated, error: upErr } = await supabase
          .from('inventory_items')
          .update({ image: imagePath })
          .eq('id', created.id)
          .select()
          .single()
        if (upErr) throw upErr
        return updated as InventoryItem
      }

      const { data: created, error } = await supabase
        .from('inventory_items')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return created as InventoryItem
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY] }),
  })
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InventoryItem> & { _imageFile?: File } }) => {
      const { _imageFile, ...rest } = data as any
      let payload = { ...rest }

      if (_imageFile instanceof File) {
        const imagePath = await uploadFile('inventory', `${user!.id}/${id}`, _imageFile)
        payload.image = imagePath
      }

      const { data: updated, error } = await supabase
        .from('inventory_items')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return updated as InventoryItem
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY] }),
  })
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY] }),
  })
}
