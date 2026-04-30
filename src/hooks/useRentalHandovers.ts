import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import type { RentalHandover } from '@/types/rental'
import { RENTAL_BOOKINGS_KEY } from './useRentalBookings'

export const RENTAL_HANDOVERS_KEY = 'rental_handovers'

export function useRentalHandovers(bookingId: string | undefined) {
  return useQuery({
    queryKey: [RENTAL_HANDOVERS_KEY, bookingId],
    queryFn: async () => {
      if (!bookingId) return []
      const { data, error } = await supabase
        .from('rental_handovers')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as RentalHandover[]
    },
    enabled: !!bookingId,
    staleTime: 10_000,
  })
}

export interface CreateHandoverPayload extends Partial<RentalHandover> {
  booking_id: string
  type: 'pickup' | 'return'
}

export function useCreateRentalHandover() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateHandoverPayload) => {
      const { data, error } = await supabase
        .from('rental_handovers')
        .insert({ ...payload, product: PRODUCT })
        .select()
        .single()
      if (error) throw error
      return data as RentalHandover
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [RENTAL_HANDOVERS_KEY, vars.booking_id] })
      qc.invalidateQueries({ queryKey: [RENTAL_BOOKINGS_KEY] })
    },
  })
}
