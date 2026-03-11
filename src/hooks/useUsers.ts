import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

/** List of all users — admin only */
export function useUsers() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, avatar, is_admin, plan, onboarded, disabled, created_at')
        .order('id')
      if (error) throw error
      return data
    },
    enabled: !!user?.is_admin,
    staleTime: 60_000,
  })
}

/** Update user plan */
export function useUpdateUserPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, plan }: { id: string; plan: string }) => {
      const { data, error } = await supabase
        .from('users')
        .update({ plan })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

/** Toggle is_admin role */
export function useToggleUserAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, currentValue }: { id: string; currentValue: boolean }) => {
      const { data, error } = await supabase
        .from('users')
        .update({ is_admin: !currentValue })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

/** Enable / disable a user (disabled field) */
export function useToggleUserDisabled() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, currentValue }: { id: string; currentValue: boolean }) => {
      const { data, error } = await supabase
        .from('users')
        .update({ disabled: !currentValue })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

/** Full cascade delete of a user and all their data (via Edge Function) */
export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: id },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
