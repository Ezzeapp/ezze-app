import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { CLINIC_WARDS_KEY } from './useClinicWards'
import type { ClinicHospitalization, ClinicDailyObservation, HospitalizationStatus } from '@/types'

export const CLINIC_HOSP_KEY = 'clinic_hospitalizations'

export function useClinicHospitalizations(status?: HospitalizationStatus) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [CLINIC_HOSP_KEY, user?.id, status],
    queryFn: async () => {
      if (!user) return []
      let q = supabase
        .from('clinic_hospitalizations')
        .select('*, client:clients(first_name, last_name), ward:clinic_wards(name), room:clinic_rooms(name), bed:clinic_beds(number)')
        .eq('master_id', user.id)
        .order('admission_date', { ascending: false })
      if (status) q = q.eq('status', status)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ClinicHospitalization[]
    },
    enabled: !!user,
    staleTime: 30_000,
  })
}

export function useClinicHospitalization(id: string | undefined) {
  return useQuery({
    queryKey: [CLINIC_HOSP_KEY, 'detail', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('clinic_hospitalizations')
        .select('*, client:clients(first_name, last_name), ward:clinic_wards(name), room:clinic_rooms(name), bed:clinic_beds(number)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as ClinicHospitalization
    },
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useActiveHospitalizations() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [CLINIC_HOSP_KEY, 'active', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('clinic_hospitalizations')
        .select('*, client:clients(first_name, last_name), ward:clinic_wards(name), room:clinic_rooms(name), bed:clinic_beds(number)')
        .eq('master_id', user.id)
        .neq('status', 'discharged')
        .order('admission_date', { ascending: false })
      if (error) throw error
      return (data ?? []) as ClinicHospitalization[]
    },
    enabled: !!user,
    staleTime: 30_000,
  })
}

export function useHospitalizationsByPatient(clientId: string | undefined) {
  return useQuery({
    queryKey: [CLINIC_HOSP_KEY, 'by_patient', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data, error } = await supabase
        .from('clinic_hospitalizations')
        .select('*, ward:clinic_wards(name), room:clinic_rooms(name), bed:clinic_beds(number)')
        .eq('client_id', clientId)
        .order('admission_date', { ascending: false })
      if (error) throw error
      return (data ?? []) as ClinicHospitalization[]
    },
    enabled: !!clientId,
    staleTime: 30_000,
  })
}

export function useAdmitPatient() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: {
      client_id: string
      visit_id?: string | null
      ward_id: string
      room_id: string
      bed_id: string
      diagnosis?: string | null
      diagnosis_code?: string | null
      reason?: string | null
      attending_doctor?: string | null
      notes?: string | null
    }) => {
      // 1. Create hospitalization
      const { data, error: hErr } = await supabase
        .from('clinic_hospitalizations')
        .insert({ ...payload, master_id: user!.id })
        .select()
        .single()
      if (hErr) throw hErr

      // 2. Mark bed as occupied
      const { error: bErr } = await supabase
        .from('clinic_beds')
        .update({ status: 'occupied' })
        .eq('id', payload.bed_id)
      if (bErr) throw bErr

      return data as ClinicHospitalization
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CLINIC_HOSP_KEY] })
      qc.invalidateQueries({ queryKey: [CLINIC_WARDS_KEY] })
    },
  })
}

export function useUpdateHospitalization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ClinicHospitalization> & { id: string }) => {
      const { error } = await supabase.from('clinic_hospitalizations').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_HOSP_KEY] }),
  })
}

export function useDischargePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, bed_id, discharge_summary, notes }: {
      id: string
      bed_id: string
      discharge_summary?: string | null
      notes?: string | null
    }) => {
      // 1. Update hospitalization
      const { error: hErr } = await supabase
        .from('clinic_hospitalizations')
        .update({
          status: 'discharged',
          discharge_date: new Date().toISOString(),
          discharge_summary,
          notes,
        })
        .eq('id', id)
      if (hErr) throw hErr

      // 2. Free bed
      const { error: bErr } = await supabase
        .from('clinic_beds')
        .update({ status: 'free' })
        .eq('id', bed_id)
      if (bErr) throw bErr
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CLINIC_HOSP_KEY] })
      qc.invalidateQueries({ queryKey: [CLINIC_WARDS_KEY] })
    },
  })
}

// Daily observations
export function useClinicObservations(hospitalizationId: string | undefined) {
  return useQuery({
    queryKey: [CLINIC_HOSP_KEY, 'observations', hospitalizationId],
    queryFn: async () => {
      if (!hospitalizationId) return []
      const { data, error } = await supabase
        .from('clinic_daily_observations')
        .select('*')
        .eq('hospitalization_id', hospitalizationId)
        .order('observation_date', { ascending: false })
      if (error) throw error
      return (data ?? []) as ClinicDailyObservation[]
    },
    enabled: !!hospitalizationId,
    staleTime: 30_000,
  })
}

export function useCreateObservation() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: Omit<ClinicDailyObservation, 'id' | 'master_id' | 'created_at'>) => {
      const { error } = await supabase
        .from('clinic_daily_observations')
        .insert({ ...payload, master_id: user!.id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_HOSP_KEY] }),
  })
}
