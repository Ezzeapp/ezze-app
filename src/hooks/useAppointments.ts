import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Appointment, AppointmentService, Service } from '@/types'
import dayjs from 'dayjs'

export const APPOINTMENTS_KEY = 'appointments'

// ── Select string for all queries ────────────────────────────────────────────
const APPT_SELECT = '*, client:clients(*), service:services(*), appointment_services(*)'

// ── Normalize Supabase response → PocketBase-compatible shape ─────────────────
// Exported for use in components that query appointments directly
// Supabase returns: { master_id, client_id, service_id, client: {...}, service: {...}, appointment_services: [...] }
// Components expect: { master, client (FK string), service (FK string), expand: { client, service, 'appointment_services(appointment)' } }
export function normalizeAppointment(raw: any): Appointment {
  return {
    ...raw,
    master: raw.master_id ?? raw.master,
    client: raw.client_id ?? raw.client ?? '',
    service: raw.service_id ?? raw.service ?? '',
    expand: {
      client: (raw.client && typeof raw.client === 'object') ? raw.client : undefined,
      service: (raw.service && typeof raw.service === 'object') ? raw.service : undefined,
      'appointment_services(appointment)': (raw.appointment_services ?? []).map((as: any) => ({
        ...as,
        service: as.service_id,
      })),
    },
  }
}

// ── Normalize write data: PocketBase field names → Supabase column names ──────
function normalizeWriteData(data: Record<string, any>): Record<string, any> {
  const { client, service, master, expand, collectionId, collectionName, created, updated, ...rest } = data
  const out: Record<string, any> = { ...rest }
  if (client !== undefined && !('client_id' in out)) out.client_id = client || null
  if (service !== undefined && !('service_id' in out)) out.service_id = service || null
  return out
}

// ── Helper: get list of services from appointment record ─────────────────────
// Priority:
//   1. appointment_services (new format)
//   2. notes prefix "[Service1, Service2]\n..." (legacy)
//   3. expand.service (fallback — single service)
export function getAppointmentServices(
  appt: Appointment,
  allServices?: Service[],
): Service[] {
  // 1. New format
  const apptSvcs = appt.expand?.['appointment_services(appointment)'] as AppointmentService[] | undefined
  if (apptSvcs && apptSvcs.length > 0 && allServices) {
    const sorted = [...apptSvcs].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const found = sorted.map(as => allServices.find(s => s.id === as.service)).filter(Boolean) as Service[]
    if (found.length > 0) return found
  }

  // 2. Legacy notes prefix
  const notes = appt.notes || ''
  const multiMatch = notes.match(/^\[(.+)\]\n?/)
  if (multiMatch && allServices) {
    const names = multiMatch[1].split(', ').map(n => n.trim().replace(/×\d+$/, ''))
    const found = names.map(name => allServices.find(s => s.name === name)).filter(Boolean) as Service[]
    if (found.length > 0) return found
  }

  // 3. Fallback: primary service from expand
  if (appt.expand?.service) return [appt.expand.service]

  return []
}

// Returns comma-separated service names or '—'
export function getAppointmentServiceNames(appt: Appointment, allServices?: Service[]): string {
  const svcs = getAppointmentServices(appt, allServices)
  return svcs.length > 0 ? svcs.map(s => s.name).join(', ') : '—'
}

// Strips the notes prefix from a notes string
export function cleanAppointmentNotes(notes?: string): string {
  if (!notes) return ''
  return notes.replace(/^\[.+\]\n?/, '').trim()
}

// ── Upsert appointment_services for an appointment ───────────────────────────
async function upsertAppointmentServices(appointmentId: string, services: Service[]): Promise<void> {
  // Delete existing records
  const { error: delError } = await supabase
    .from('appointment_services')
    .delete()
    .eq('appointment_id', appointmentId)
  if (delError) throw delError

  // Insert new records
  if (services.length > 0) {
    const { error: insError } = await supabase
      .from('appointment_services')
      .insert(
        services.map((svc, i) => ({
          appointment_id: appointmentId,
          service_id: svc.id,
          sort_order: i,
        }))
      )
    if (insError) throw insError
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useAppointments(startDate?: string, endDate?: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: [APPOINTMENTS_KEY, user?.id, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select(APPT_SELECT)
        .eq('master_id', user!.id)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })

      if (startDate) query = query.gte('date', startDate)
      if (endDate) query = query.lte('date', endDate)

      const { data, error } = await query
      if (error) throw error
      return (data ?? []).map(normalizeAppointment) as Appointment[]
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  })
}

export function useTodayAppointments() {
  const today = dayjs().format('YYYY-MM-DD')
  return useAppointments(today, today)
}

export function useWeekAppointments() {
  const start = dayjs().startOf('week').format('YYYY-MM-DD')
  const end = dayjs().endOf('week').format('YYYY-MM-DD')
  return useAppointments(start, end)
}

export function useMonthAppointments(year: number, month: number) {
  const start = dayjs().year(year).month(month).startOf('month').format('YYYY-MM-DD')
  const end = dayjs().year(year).month(month).endOf('month').format('YYYY-MM-DD')
  return useAppointments(start, end)
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Create appointment + appointment_services in one call */
export function useCreateAppointmentWithServices() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      data,
      services,
    }: {
      data: Omit<Appointment, 'id' | 'master' | 'created' | 'updated' | 'collectionId' | 'collectionName' | 'expand'>
      services: Service[]
    }) => {
      const { data: appt, error } = await supabase
        .from('appointments')
        .insert({ ...normalizeWriteData(data as any), master_id: user!.id })
        .select(APPT_SELECT)
        .single()
      if (error) throw error
      await upsertAppointmentServices(appt.id, services)
      return normalizeAppointment(appt) as Appointment
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] })
      queryClient.invalidateQueries({ queryKey: ['client_stats'] })
    },
  })
}

/** Update appointment + appointment_services in one call */
export function useUpdateAppointmentWithServices() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
      services,
    }: {
      id: string
      data: Partial<Appointment>
      services: Service[]
    }) => {
      const { data: appt, error } = await supabase
        .from('appointments')
        .update(normalizeWriteData(data as any))
        .eq('id', id)
        .select(APPT_SELECT)
        .single()
      if (error) throw error
      await upsertAppointmentServices(id, services)
      return normalizeAppointment(appt) as Appointment
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] })
      queryClient.invalidateQueries({ queryKey: ['client_stats'] })
    },
  })
}

// Legacy hooks for compatibility (do not use appointment_services)
export function useCreateAppointment() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (
      data: Omit<Appointment, 'id' | 'master' | 'created' | 'updated' | 'collectionId' | 'collectionName' | 'expand'>
    ) => {
      const { data: appt, error } = await supabase
        .from('appointments')
        .insert({ ...normalizeWriteData(data as any), master_id: user!.id })
        .select(APPT_SELECT)
        .single()
      if (error) throw error
      return normalizeAppointment(appt) as Appointment
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] })
      queryClient.invalidateQueries({ queryKey: ['client_stats'] })
    },
  })
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Appointment> }) => {
      const { data: appt, error } = await supabase
        .from('appointments')
        .update(normalizeWriteData(data as any))
        .eq('id', id)
        .select(APPT_SELECT)
        .single()
      if (error) throw error
      return normalizeAppointment(appt) as Appointment
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] })
      queryClient.invalidateQueries({ queryKey: ['client_stats'] })
    },
  })
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] })
      queryClient.invalidateQueries({ queryKey: ['client_stats'] })
    },
  })
}

export function useConfirmAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('appointments')
        .update({ confirmed_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return normalizeAppointment(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] })
    },
  })
}
