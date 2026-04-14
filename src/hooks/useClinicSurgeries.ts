import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ClinicSurgery, ClinicOperatingRoom, SurgeryStatus } from '@/types'

export const CLINIC_SURGERY_KEY = 'clinic_surgeries'
export const CLINIC_OR_KEY = 'clinic_operating_rooms'

export function useClinicSurgeries(status?: SurgeryStatus) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [CLINIC_SURGERY_KEY, user?.id, status],
    queryFn: async () => {
      if (!user) return []
      let q = supabase
        .from('clinic_surgeries')
        .select('*, client:clients(first_name, last_name), hospitalization:clinic_hospitalizations(diagnosis), operating_room:clinic_operating_rooms(name)')
        .eq('master_id', user.id)
        .order('scheduled_date', { ascending: true })
      if (status) q = q.eq('status', status)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ClinicSurgery[]
    },
    enabled: !!user,
    staleTime: 30_000,
  })
}

export function useCreateSurgery() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: Omit<ClinicSurgery, 'id' | 'master_id' | 'created_at' | 'updated_at' | 'client' | 'hospitalization' | 'operating_room'>) => {
      const { error } = await supabase.from('clinic_surgeries').insert({ ...payload, master_id: user!.id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_SURGERY_KEY] }),
  })
}

export function useUpdateSurgery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ClinicSurgery> & { id: string }) => {
      const { error } = await supabase.from('clinic_surgeries').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_SURGERY_KEY] }),
  })
}

export function useDeleteSurgery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clinic_surgeries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_SURGERY_KEY] }),
  })
}

// Operating Rooms
export function useClinicOperatingRooms() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [CLINIC_OR_KEY, user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('clinic_operating_rooms')
        .select('*')
        .eq('master_id', user.id)
        .order('name')
      if (error) throw error
      return (data ?? []) as ClinicOperatingRoom[]
    },
    enabled: !!user,
    staleTime: 60_000,
  })
}

export function useCreateOperatingRoom() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: { name: string; equipment_notes?: string | null }) => {
      const { error } = await supabase.from('clinic_operating_rooms').insert({ ...payload, master_id: user!.id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_OR_KEY] }),
  })
}

export function useUpdateOperatingRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ClinicOperatingRoom> & { id: string }) => {
      const { error } = await supabase.from('clinic_operating_rooms').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_OR_KEY] }),
  })
}

export function useDeleteOperatingRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clinic_operating_rooms').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_OR_KEY] }),
  })
}
