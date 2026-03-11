import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Schedule, ScheduleBreak } from '@/types'

export const SCHEDULE_KEY = 'schedule'
export const BREAKS_KEY = 'schedule_breaks'

const DEFAULT_SCHEDULE: Partial<Schedule> = {
  mon_enabled: true, mon_start: '09:00', mon_end: '18:00',
  tue_enabled: true, tue_start: '09:00', tue_end: '18:00',
  wed_enabled: true, wed_start: '09:00', wed_end: '18:00',
  thu_enabled: true, thu_start: '09:00', thu_end: '18:00',
  fri_enabled: true, fri_start: '09:00', fri_end: '18:00',
  sat_enabled: false, sat_start: '10:00', sat_end: '16:00',
  sun_enabled: false, sun_start: '10:00', sun_end: '16:00',
  slot_duration: 30,
  advance_days: 30,
}

export function useSchedule() {
  const { user } = useAuth()

  return useQuery({
    queryKey: [SCHEDULE_KEY, user?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('schedules')
          .select('*')
          .eq('master_id', user!.id)
          .single()
        if (error) return null
        return data as Schedule
      } catch {
        return null
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 60,
  })
}

export function useUpsertSchedule() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Partial<Schedule> }) => {
      if (id) {
        const { data: updated, error } = await supabase
          .from('schedules')
          .update(data)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return updated as Schedule
      } else {
        const { data: upserted, error } = await supabase
          .from('schedules')
          .upsert(
            { ...DEFAULT_SCHEDULE, ...data, master_id: user!.id },
            { onConflict: 'master_id' }
          )
          .select()
          .single()
        if (error) throw error
        return upserted as Schedule
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [SCHEDULE_KEY] }),
  })
}

export function useScheduleBreaks() {
  const { user } = useAuth()

  return useQuery({
    queryKey: [BREAKS_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_breaks')
        .select('*')
        .eq('master_id', user!.id)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true })
      if (error) throw error
      return (data ?? []) as ScheduleBreak[]
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 60,
  })
}

export function useCreateBreak() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (
      data: Omit<ScheduleBreak, 'id' | 'master' | 'created' | 'updated' | 'collectionId' | 'collectionName'>
    ) => {
      const { data: created, error } = await supabase
        .from('schedule_breaks')
        .insert({ ...data, master_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return created as ScheduleBreak
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BREAKS_KEY] }),
  })
}

export function useDeleteBreak() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('schedule_breaks')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BREAKS_KEY] }),
  })
}
