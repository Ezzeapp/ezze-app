import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { uploadFile } from '@/lib/storage'
import type { Client } from '@/types'

export const CLIENTS_KEY = 'clients'

export function useClientSummary() {
  const { user } = useAuth()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data: newData } = useQuery({
    queryKey: [CLIENTS_KEY, 'count_new', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('master_id', user!.id)
        .gte('created_at', `${since}T00:00:00`)
      if (error) throw error
      return count
    },
    enabled: !!user,
    staleTime: 0,
  })

  const { data: phoneData } = useQuery({
    queryKey: [CLIENTS_KEY, 'count_phone', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('master_id', user!.id)
        .neq('phone', '')
        .not('phone', 'is', null)
      if (error) throw error
      return count
    },
    enabled: !!user,
    staleTime: 0,
  })

  return {
    newThisMonth: newData ?? null,
    withPhone: phoneData ?? null,
  }
}

export function useClientsPaged(search = '', page = 1, perPage = 25) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [CLIENTS_KEY, 'paged', user?.id, search, page],
    queryFn: async () => {
      const from = (page - 1) * perPage
      const to = page * perPage - 1

      let query = supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .eq('master_id', user!.id)
        .order('first_name', { ascending: true })
        .range(from, to)

      if (search.trim()) {
        const q = search.trim().replace(/'/g, "''")
        query = query.or(
          `first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`
        )
      }

      const { data, count, error } = await query
      if (error) throw error
      return {
        items: (data ?? []) as Client[],
        totalItems: count ?? 0,
        page,
        perPage,
        totalPages: Math.ceil((count ?? 0) / perPage),
      }
    },
    enabled: !!user,
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
}

export function useClients() {
  const { user } = useAuth()

  return useQuery({
    queryKey: [CLIENTS_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('master_id', user!.id)
        .order('first_name', { ascending: true })
      if (error) throw error
      return (data ?? []) as Client[]
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
  })
}

export function useClient(id: string) {
  return useQuery({
    queryKey: [CLIENTS_KEY, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Client
    },
    enabled: !!id,
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (
      data: Omit<Client, 'id' | 'master' | 'created' | 'updated' | 'collectionId' | 'collectionName'>
    ) => {
      const { data: created, error } = await supabase
        .from('clients')
        .insert({ ...data, master_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return created as Client
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] }),
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Client> }) => {
      const { data: updated, error } = await supabase
        .from('clients')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return updated as Client
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] }),
  })
}

export function useUpdateClientAvatar() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File | null }) => {
      let avatar: string | null = null
      if (file) {
        avatar = await uploadFile('avatars', `clients/${id}/avatar`, file)
      }
      const { data: updated, error } = await supabase
        .from('clients')
        .update({ avatar })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return updated as Client
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] }),
  })
}

export function useDeleteClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] }),
  })
}
