import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ClinicLabTest } from '@/types'

export const CLINIC_LAB_TESTS_KEY = 'clinic_lab_tests'

export function useClinicLabTests() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [CLINIC_LAB_TESTS_KEY, user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('clinic_lab_tests')
        .select('*')
        .eq('master_id', user.id)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as ClinicLabTest[]
    },
    enabled: !!user,
    staleTime: 60_000,
  })
}

export function useUpsertLabTest() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: Partial<ClinicLabTest> & { name: string }) => {
      const row = { ...payload, master_id: user!.id }
      if (payload.id) {
        const { error } = await supabase.from('clinic_lab_tests').update(row).eq('id', payload.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('clinic_lab_tests').insert(row)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_LAB_TESTS_KEY] }),
  })
}

export function useDeleteLabTest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clinic_lab_tests').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_LAB_TESTS_KEY] }),
  })
}
