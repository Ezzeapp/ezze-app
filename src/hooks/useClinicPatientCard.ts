import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ClinicPatientCard } from '@/types'

export const PATIENT_CARD_KEY = 'clinic_patient_card'

export function useClinicPatientCard(clientId: string | undefined) {
  return useQuery({
    queryKey: [PATIENT_CARD_KEY, clientId],
    queryFn: async () => {
      if (!clientId) return null
      const { data, error } = await supabase
        .from('clinic_patient_cards')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()
      if (error) throw error
      return data as ClinicPatientCard | null
    },
    enabled: !!clientId,
    staleTime: 60_000,
  })
}

export function useUpsertPatientCard() {
  const qc = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (payload: Partial<ClinicPatientCard> & { client_id: string }) => {
      const { error } = await supabase
        .from('clinic_patient_cards')
        .upsert(
          { ...payload, master_id: user!.id },
          { onConflict: 'client_id' },
        )
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: [PATIENT_CARD_KEY, variables.client_id] })
    },
  })
}
