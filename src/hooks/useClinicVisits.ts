import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ClinicVisit, Prescription } from '@/types'
import dayjs from 'dayjs'

export const CLINIC_VISITS_KEY = 'clinic_visits'

/** Получить запись приёма по appointment_id */
export function useClinicVisit(appointmentId: string | undefined) {
  return useQuery({
    queryKey: [CLINIC_VISITS_KEY, 'by_appointment', appointmentId],
    queryFn: async () => {
      if (!appointmentId) return null
      const { data, error } = await supabase
        .from('clinic_visits')
        .select('*')
        .eq('appointment_id', appointmentId)
        .maybeSingle()
      if (error) throw error
      return data as ClinicVisit | null
    },
    enabled: !!appointmentId,
    staleTime: 30_000,
  })
}

/** Все приёмы пациента, отсортированные по дате */
export function useClinicVisitsByPatient(clientId: string | undefined) {
  return useQuery({
    queryKey: [CLINIC_VISITS_KEY, 'by_patient', clientId],
    queryFn: async () => {
      if (!clientId) return []
      // Получаем appointments для клиента, затем clinic_visits
      const { data: appts, error: apptErr } = await supabase
        .from('appointments')
        .select('id, date, start_time, service:services(name)')
        .eq('client_id', clientId)
        .order('date', { ascending: false })
      if (apptErr) throw apptErr
      if (!appts?.length) return []

      const apptIds = appts.map(a => a.id)
      const { data: visits, error: visitErr } = await supabase
        .from('clinic_visits')
        .select('*')
        .in('appointment_id', apptIds)
      if (visitErr) throw visitErr

      // Объединяем visits с appointment info
      return (visits ?? []).map(v => {
        const appt = appts.find(a => a.id === v.appointment_id)
        return {
          ...v,
          prescriptions: v.prescriptions as Prescription[],
          attachments: v.attachments as { url: string; name: string; type: string }[],
          appointment_date: appt?.date,
          appointment_time: appt?.start_time,
          service_name: (appt?.service as unknown as { name: string } | null)?.name,
        }
      }).sort((a, b) => (b.appointment_date ?? '').localeCompare(a.appointment_date ?? ''))
    },
    enabled: !!clientId,
    staleTime: 30_000,
  })
}

/** Создать запись приёма */
export function useCreateClinicVisit() {
  const qc = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (payload: Omit<ClinicVisit, 'id' | 'master_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('clinic_visits')
        .insert({ ...payload, master_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data as ClinicVisit
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CLINIC_VISITS_KEY] })
    },
  })
}

/** Обновить запись приёма */
export function useUpdateClinicVisit() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ClinicVisit> & { id: string }) => {
      const { error } = await supabase
        .from('clinic_visits')
        .update(payload)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CLINIC_VISITS_KEY] })
    },
  })
}

/** Статистика для dashboard: приёмы сегодня, завершённые, повторные */
export function useClinicVisitStats() {
  const { user } = useAuth()

  return useQuery({
    queryKey: [CLINIC_VISITS_KEY, 'stats', user?.id],
    queryFn: async () => {
      if (!user) return { patientsToday: 0, visitsCompleted: 0, followUpsThisWeek: 0 }

      const today = dayjs().format('YYYY-MM-DD')
      const weekEnd = dayjs().add(7, 'day').format('YYYY-MM-DD')

      // Приёмы на сегодня
      const { count: patientsToday } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('master_id', user.id)
        .eq('date', today)
        .in('status', ['scheduled', 'done'])

      // Завершённые приёмы сегодня
      const { count: visitsCompleted } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('master_id', user.id)
        .eq('date', today)
        .eq('status', 'done')

      // Повторные приёмы на этой неделе
      const { count: followUpsThisWeek } = await supabase
        .from('clinic_visits')
        .select('id', { count: 'exact', head: true })
        .eq('master_id', user.id)
        .gte('next_visit_date', today)
        .lte('next_visit_date', weekEnd)

      return {
        patientsToday: patientsToday ?? 0,
        visitsCompleted: visitsCompleted ?? 0,
        followUpsThisWeek: followUpsThisWeek ?? 0,
      }
    },
    enabled: !!user,
    staleTime: 60_000,
  })
}
