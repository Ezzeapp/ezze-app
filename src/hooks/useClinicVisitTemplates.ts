import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ClinicVisitTemplate } from '@/types'

export const VISIT_TEMPLATES_KEY = 'clinic_visit_templates'

export function useClinicVisitTemplates() {
  const { user } = useAuth()

  return useQuery({
    queryKey: [VISIT_TEMPLATES_KEY, user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('clinic_visit_templates')
        .select('*')
        .eq('master_id', user.id)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as ClinicVisitTemplate[]
    },
    enabled: !!user,
    staleTime: 60_000,
  })
}

export function useUpsertVisitTemplate() {
  const qc = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (payload: Partial<ClinicVisitTemplate> & { name: string }) => {
      const row = { ...payload, master_id: user!.id }
      if (payload.id) {
        const { error } = await supabase
          .from('clinic_visit_templates')
          .update(row)
          .eq('id', payload.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('clinic_visit_templates')
          .insert(row)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [VISIT_TEMPLATES_KEY] }),
  })
}

export function useDeleteVisitTemplate() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clinic_visit_templates')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [VISIT_TEMPLATES_KEY] }),
  })
}
