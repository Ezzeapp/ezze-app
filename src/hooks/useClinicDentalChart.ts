import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ClinicDentalChart, ToothStatus } from '@/types'

export const DENTAL_CHART_KEY = 'clinic_dental_chart'

export function useClinicDentalChart(clientId: string | undefined) {
  return useQuery({
    queryKey: [DENTAL_CHART_KEY, clientId],
    queryFn: async () => {
      if (!clientId) return null
      const { data, error } = await supabase
        .from('clinic_dental_charts')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()
      if (error) throw error
      return data as ClinicDentalChart | null
    },
    enabled: !!clientId,
    staleTime: 60_000,
  })
}

/** Обновить статус/заметки одного зуба */
export function useUpdateTooth() {
  const qc = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      clientId,
      toothNumber,
      status,
      notes,
    }: {
      clientId: string
      toothNumber: number
      status: ToothStatus
      notes?: string
    }) => {
      // Сначала получаем текущую карту
      const { data: existing } = await supabase
        .from('clinic_dental_charts')
        .select('id, teeth')
        .eq('client_id', clientId)
        .maybeSingle()

      const teeth = (existing?.teeth as Record<number, { status: ToothStatus; notes?: string }>) ?? {}
      teeth[toothNumber] = { status, ...(notes ? { notes } : {}) }

      if (existing) {
        const { error } = await supabase
          .from('clinic_dental_charts')
          .update({ teeth })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('clinic_dental_charts')
          .insert({ client_id: clientId, master_id: user!.id, teeth })
        if (error) throw error
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: [DENTAL_CHART_KEY, variables.clientId] })
    },
  })
}

/** Сбросить всю зубную формулу */
export function useResetDentalChart() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('clinic_dental_charts')
        .update({ teeth: {} })
        .eq('client_id', clientId)
      if (error) throw error
    },
    onSuccess: (_data, clientId) => {
      qc.invalidateQueries({ queryKey: [DENTAL_CHART_KEY, clientId] })
    },
  })
}
