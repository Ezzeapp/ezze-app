import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ActivityType, Specialty } from '@/types'

export const ACTIVITY_TYPES_KEY = 'activity_types'
export const SPECIALTIES_KEY = 'specialties'

// ── Public read (all users) ───────────────────────────────────────────────
export function useActivityTypes() {
  return useQuery({
    queryKey: [ACTIVITY_TYPES_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_types')
        .select('*')
        .order('order')
        .order('name')
      if (error) throw error
      return (data ?? []) as ActivityType[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useSpecialties(activityTypeId?: string) {
  return useQuery({
    queryKey: [SPECIALTIES_KEY, activityTypeId],
    queryFn: async () => {
      let query = supabase
        .from('specialties')
        .select('*, activity_type:activity_types(*)')
        .order('order')
        .order('name')
      if (activityTypeId) {
        query = query.eq('activity_type_id', activityTypeId)
      }
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Specialty[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useAllSpecialties() {
  return useQuery({
    queryKey: [SPECIALTIES_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('specialties')
        .select('*, activity_type:activity_types(*)')
        .order('order')
        .order('name')
      if (error) throw error
      return (data ?? []) as Specialty[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ── Admin CRUD — ActivityTypes ────────────────────────────────────────────
export function useCreateActivityType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Pick<ActivityType, 'name' | 'icon'>) => {
      const { data: result, error } = await supabase
        .from('activity_types')
        .insert(data)
        .select()
        .single()
      if (error) throw error
      return result as ActivityType
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ACTIVITY_TYPES_KEY] }),
  })
}

export function useUpdateActivityType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Pick<ActivityType, 'name' | 'icon' | 'order'>> }) => {
      const { data: result, error } = await supabase
        .from('activity_types')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return result as ActivityType
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ACTIVITY_TYPES_KEY] }),
  })
}

export function useDeleteActivityType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('activity_types').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ACTIVITY_TYPES_KEY] })
      qc.invalidateQueries({ queryKey: [SPECIALTIES_KEY] })
    },
  })
}

// ── Admin CRUD — Specialties ──────────────────────────────────────────────
export function useCreateSpecialty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; activity_type_id: string }) => {
      const { data: result, error } = await supabase
        .from('specialties')
        .insert(data)
        .select()
        .single()
      if (error) throw error
      return result as Specialty
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [SPECIALTIES_KEY] }),
  })
}

export function useUpdateSpecialty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Pick<Specialty, 'name' | 'activity_type_id' | 'order'>> }) => {
      const { data: result, error } = await supabase
        .from('specialties')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return result as Specialty
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [SPECIALTIES_KEY] }),
  })
}

export function useDeleteSpecialty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('specialties').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [SPECIALTIES_KEY] }),
  })
}

// ── Bulk import ───────────────────────────────────────────────────────────
export function useBulkImportSpecialties() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: Array<{ activity_type_name: string; name: string }>) => {
      // 1. Fetch or create activity types
      const { data: existingTypes } = await supabase.from('activity_types').select('*')
      const typeMap = new Map((existingTypes ?? []).map((t: any) => [t.name.toLowerCase(), t]))

      for (const item of items) {
        const key = item.activity_type_name.trim().toLowerCase()
        if (!typeMap.has(key)) {
          const { data: created } = await supabase
            .from('activity_types')
            .insert({ name: item.activity_type_name.trim() })
            .select()
            .single()
          if (created) typeMap.set(key, created)
        }
      }

      // 2. Fetch existing specialties to avoid duplicates
      const { data: existingSpecs } = await supabase.from('specialties').select('*')
      const specSet = new Set(
        (existingSpecs ?? []).map((s: any) => `${s.activity_type_id}::${s.name.toLowerCase()}`)
      )

      // 3. Create new specialties
      let created = 0
      for (const item of items) {
        const typeKey = item.activity_type_name.trim().toLowerCase()
        const typeRecord = typeMap.get(typeKey)
        if (!typeRecord) continue
        const specKey = `${typeRecord.id}::${item.name.trim().toLowerCase()}`
        if (!specSet.has(specKey)) {
          await supabase.from('specialties').insert({
            activity_type_id: typeRecord.id,
            name: item.name.trim(),
          })
          specSet.add(specKey)
          created++
        }
      }
      return created
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ACTIVITY_TYPES_KEY] })
      qc.invalidateQueries({ queryKey: [SPECIALTIES_KEY] })
    },
  })
}
