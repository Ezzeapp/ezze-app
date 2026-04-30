import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import type { RentalContract } from '@/types/rental'

export const RENTAL_CONTRACTS_KEY = 'rental_contracts'

export function useRentalContract(bookingId: string | undefined) {
  return useQuery({
    queryKey: [RENTAL_CONTRACTS_KEY, bookingId],
    queryFn: async () => {
      if (!bookingId) return null
      const { data, error } = await supabase
        .from('rental_contracts')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as RentalContract | null
    },
    enabled: !!bookingId,
    staleTime: 30_000,
  })
}

export interface UpsertContractPayload extends Partial<RentalContract> {
  booking_id: string
}

export function useUpsertRentalContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UpsertContractPayload) => {
      const isNew = !payload.id
      let contract_number = payload.contract_number
      if (isNew && !contract_number) {
        const { data, error } = await supabase.rpc('generate_rental_contract_number', { p_product: PRODUCT })
        if (error) throw error
        contract_number = data as string
      }
      const { data, error } = await supabase
        .from('rental_contracts')
        .upsert({ ...payload, product: PRODUCT, contract_number })
        .select()
        .single()
      if (error) throw error
      return data as RentalContract
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [RENTAL_CONTRACTS_KEY, vars.booking_id] })
    },
  })
}
