import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ClinicWard, ClinicRoom, ClinicBed } from '@/types'

export const CLINIC_WARDS_KEY = 'clinic_wards'

export function useClinicWards() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [CLINIC_WARDS_KEY, user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('clinic_wards')
        .select('*, rooms:clinic_rooms(*, beds:clinic_beds(*))')
        .eq('master_id', user.id)
        .order('name')
      if (error) throw error
      return (data ?? []) as ClinicWard[]
    },
    enabled: !!user,
    staleTime: 60_000,
  })
}

export function useCreateWard() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: Partial<ClinicWard> & { name: string }) => {
      const { error } = await supabase.from('clinic_wards').insert({ ...payload, master_id: user!.id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_WARDS_KEY] }),
  })
}

export function useUpdateWard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ClinicWard> & { id: string }) => {
      const { error } = await supabase.from('clinic_wards').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_WARDS_KEY] }),
  })
}

export function useDeleteWard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clinic_wards').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_WARDS_KEY] }),
  })
}

export function useCreateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { ward_id: string; name: string; capacity?: number; notes?: string | null }) => {
      const { error } = await supabase.from('clinic_rooms').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_WARDS_KEY] }),
  })
}

export function useUpdateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ClinicRoom> & { id: string }) => {
      const { error } = await supabase.from('clinic_rooms').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_WARDS_KEY] }),
  })
}

export function useDeleteRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clinic_rooms').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_WARDS_KEY] }),
  })
}

export function useCreateBed() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { room_id: string; number: string }) => {
      const { error } = await supabase.from('clinic_beds').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_WARDS_KEY] }),
  })
}

export function useUpdateBed() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ClinicBed> & { id: string }) => {
      const { error } = await supabase.from('clinic_beds').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_WARDS_KEY] }),
  })
}

export function useDeleteBed() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clinic_beds').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_WARDS_KEY] }),
  })
}

export function useFreeBeds(wardId?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [CLINIC_WARDS_KEY, 'free_beds', user?.id, wardId],
    queryFn: async () => {
      if (!user) return []
      let q = supabase
        .from('clinic_beds')
        .select('*, room:clinic_rooms(name, ward_id, ward:clinic_wards(name))')
        .eq('status', 'free')
      if (wardId) {
        q = q.eq('room.ward_id', wardId)
      }
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ClinicBed[]
    },
    enabled: !!user,
    staleTime: 30_000,
  })
}
