import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ClinicExamRoom } from '@/types'

export const CLINIC_EXAM_ROOMS_KEY = 'clinic_exam_rooms'

export function useClinicExamRooms() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [CLINIC_EXAM_ROOMS_KEY, user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('clinic_exam_rooms')
        .select('*')
        .eq('master_id', user.id)
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as ClinicExamRoom[]
    },
    enabled: !!user,
    staleTime: 60_000,
  })
}

export function useCreateExamRoom() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: { name: string; floor?: number | null; notes?: string | null }) => {
      const { error } = await supabase.from('clinic_exam_rooms').insert({ ...payload, master_id: user!.id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_EXAM_ROOMS_KEY] }),
  })
}

export function useUpdateExamRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ClinicExamRoom> & { id: string }) => {
      const { error } = await supabase.from('clinic_exam_rooms').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_EXAM_ROOMS_KEY] }),
  })
}

export function useDeleteExamRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clinic_exam_rooms').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_EXAM_ROOMS_KEY] }),
  })
}
