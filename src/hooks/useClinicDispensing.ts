import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { CLINIC_PHARMACY_KEY } from './useClinicPharmacy'
import type { ClinicDispensing } from '@/types'

export const CLINIC_DISPENSING_KEY = 'clinic_dispensing'

export function useClinicDispensing() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [CLINIC_DISPENSING_KEY, user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('clinic_dispensing')
        .select('*, item:clinic_pharmacy_items(name), client:clients(first_name, last_name)')
        .eq('master_id', user.id)
        .order('dispensed_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as ClinicDispensing[]
    },
    enabled: !!user,
    staleTime: 30_000,
  })
}

export function useDispensingByPatient(clientId: string | undefined) {
  return useQuery({
    queryKey: [CLINIC_DISPENSING_KEY, 'by_patient', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data, error } = await supabase
        .from('clinic_dispensing')
        .select('*, item:clinic_pharmacy_items(name)')
        .eq('client_id', clientId)
        .order('dispensed_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ClinicDispensing[]
    },
    enabled: !!clientId,
    staleTime: 30_000,
  })
}

export function useDispensingByVisit(visitId: string | undefined) {
  return useQuery({
    queryKey: [CLINIC_DISPENSING_KEY, 'by_visit', visitId],
    queryFn: async () => {
      if (!visitId) return []
      const { data, error } = await supabase
        .from('clinic_dispensing')
        .select('*, item:clinic_pharmacy_items(name)')
        .eq('visit_id', visitId)
        .order('dispensed_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ClinicDispensing[]
    },
    enabled: !!visitId,
    staleTime: 30_000,
  })
}

export function useCreateDispensing() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: {
      client_id: string
      visit_id?: string | null
      items: Array<{ item_id: string; quantity: number; price?: number | null; notes?: string | null }>
    }) => {
      for (const item of payload.items) {
        // Check stock
        const { data: stock, error: sErr } = await supabase
          .from('clinic_pharmacy_items')
          .select('quantity, name')
          .eq('id', item.item_id)
          .single()
        if (sErr) throw sErr
        if ((stock.quantity || 0) < item.quantity) {
          throw new Error(`Insufficient stock for ${stock.name}`)
        }

        // Insert dispensing record
        const { error: dErr } = await supabase
          .from('clinic_dispensing')
          .insert({
            master_id: user!.id,
            client_id: payload.client_id,
            visit_id: payload.visit_id,
            item_id: item.item_id,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes,
          })
        if (dErr) throw dErr

        // Deduct stock
        const { error: uErr } = await supabase
          .from('clinic_pharmacy_items')
          .update({ quantity: (stock.quantity || 0) - item.quantity })
          .eq('id', item.item_id)
        if (uErr) throw uErr
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CLINIC_DISPENSING_KEY] })
      qc.invalidateQueries({ queryKey: [CLINIC_PHARMACY_KEY] })
    },
  })
}
