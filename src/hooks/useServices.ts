import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { uploadFile } from '@/lib/storage'
import type { Service, ServiceCategory } from '@/types'

export const SERVICES_KEY = 'services'
export const CATEGORIES_KEY = 'service_categories'

export function useServicesPage(search = '', page = 1, perPage = 25, sort = 'name') {
  const { user } = useAuth()
  return useQuery({
    queryKey: [SERVICES_KEY, 'paged', user?.id, search, page, sort],
    queryFn: async () => {
      const from = (page - 1) * perPage
      const to = page * perPage - 1
      const ascending = !sort.startsWith('-')
      const sortField = sort.replace(/^-/, '')

      let query = supabase
        .from('services')
        .select('*, category:service_categories(*)', { count: 'exact' })
        .eq('master_id', user!.id)
        .order(sortField, { ascending })
        .range(from, to)

      if (search.trim()) {
        const q = search.trim().replace(/'/g, "''")
        query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`)
      }

      const { data, count, error } = await query
      if (error) throw error
      return {
        items: (data ?? []) as Service[],
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

export function useServices() {
  const { user } = useAuth()

  return useQuery({
    queryKey: [SERVICES_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*, category:service_categories(*)')
        .eq('master_id', user!.id)
        .order('order', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []) as Service[]
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
  })
}

export function useServiceCategories() {
  const { user } = useAuth()

  return useQuery({
    queryKey: [CATEGORIES_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('master_id', user!.id)
        .order('order', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []) as ServiceCategory[]
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
  })
}

export function useServicesNoCatCount() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [SERVICES_KEY, 'count_no_cat', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('master_id', user!.id)
        .is('category_id', null)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  })
}

export function useCreateService() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (
      data: Omit<Service, 'id' | 'master' | 'created' | 'updated' | 'collectionId' | 'collectionName' | 'expand'>
    ) => {
      const { _imageFile, ...rest } = data as any
      let payload = { ...rest, master_id: user!.id }

      if (_imageFile instanceof File) {
        // Image path will be set after we have the ID — insert first, then update
        const { data: created, error: insErr } = await supabase
          .from('services')
          .insert(payload)
          .select()
          .single()
        if (insErr) throw insErr
        const imagePath = await uploadFile('services', `${user!.id}/${created.id}`, _imageFile)
        const { data: updated, error: upErr } = await supabase
          .from('services')
          .update({ image: imagePath })
          .eq('id', created.id)
          .select()
          .single()
        if (upErr) throw upErr
        return updated as Service
      }

      const { data: created, error } = await supabase
        .from('services')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return created as Service
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [SERVICES_KEY] }),
  })
}

export function useUpdateService() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Service> & { _imageFile?: File } }) => {
      const { _imageFile, ...rest } = data as any
      let payload = { ...rest }

      if (_imageFile instanceof File) {
        const imagePath = await uploadFile('services', `${user!.id}/${id}`, _imageFile)
        payload.image = imagePath
      }

      const { data: updated, error } = await supabase
        .from('services')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return updated as Service
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [SERVICES_KEY] }),
  })
}

export function useDeleteService() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [SERVICES_KEY] }),
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (data: Pick<ServiceCategory, 'name' | 'color'>) => {
      const { data: created, error } = await supabase
        .from('service_categories')
        .insert({ ...data, master_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return created as ServiceCategory
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CATEGORIES_KEY] }),
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Pick<ServiceCategory, 'name' | 'color'>> }) => {
      const { data: updated, error } = await supabase
        .from('service_categories')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return updated as ServiceCategory
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CATEGORIES_KEY] }),
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('service_categories')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CATEGORIES_KEY] })
      queryClient.invalidateQueries({ queryKey: [SERVICES_KEY] })
    },
  })
}
