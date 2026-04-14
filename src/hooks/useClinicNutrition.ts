import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ClinicDietTable, ClinicMealPlan, ClinicMealRecord, MealType } from '@/types'

export const CLINIC_NUTRITION_KEY = 'clinic_nutrition'
export const CLINIC_DIET_KEY = 'clinic_diet_tables'

// Diet Tables
export function useClinicDietTables() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [CLINIC_DIET_KEY, user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('clinic_diet_tables')
        .select('*')
        .eq('master_id', user.id)
        .order('number')
      if (error) throw error
      return (data ?? []) as ClinicDietTable[]
    },
    enabled: !!user,
    staleTime: 60_000,
  })
}

export function useCreateDietTable() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: Partial<ClinicDietTable> & { number: string; name: string }) => {
      const { error } = await supabase.from('clinic_diet_tables').insert({ ...payload, master_id: user!.id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_DIET_KEY] }),
  })
}

export function useUpdateDietTable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ClinicDietTable> & { id: string }) => {
      const { error } = await supabase.from('clinic_diet_tables').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_DIET_KEY] }),
  })
}

export function useDeleteDietTable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clinic_diet_tables').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_DIET_KEY] }),
  })
}

export function usePreseedPevznerDiets() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async () => {
      const diets = [
        { number: '1', name: 'Язвенная болезнь (обострение)', calories_target: 2800 },
        { number: '2', name: 'Гастрит с пониженной кислотностью', calories_target: 3000 },
        { number: '3', name: 'Запоры', calories_target: 2900 },
        { number: '4', name: 'Заболевания кишечника (диарея)', calories_target: 2000 },
        { number: '5', name: 'Заболевания печени и желчевыводящих путей', calories_target: 2500 },
        { number: '6', name: 'Подагра, мочекаменная болезнь', calories_target: 2700 },
        { number: '7', name: 'Заболевания почек', calories_target: 2500 },
        { number: '8', name: 'Ожирение', calories_target: 1800 },
        { number: '9', name: 'Сахарный диабет', calories_target: 2300 },
        { number: '10', name: 'Заболевания сердечно-сосудистой системы', calories_target: 2500 },
        { number: '11', name: 'Туберкулёз', calories_target: 3400 },
        { number: '12', name: 'Заболевания нервной системы', calories_target: 2500 },
        { number: '13', name: 'Острые инфекционные заболевания', calories_target: 2200 },
        { number: '14', name: 'Мочекаменная болезнь (фосфатурия)', calories_target: 2800 },
        { number: '15', name: 'Общий (рациональное питание)', calories_target: 2600 },
      ]
      const rows = diets.map(d => ({ ...d, master_id: user!.id }))
      const { error } = await supabase.from('clinic_diet_tables').insert(rows)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_DIET_KEY] }),
  })
}

// Meal Plans
export function useClinicMealPlans(hospitalizationId?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [CLINIC_NUTRITION_KEY, 'plans', user?.id, hospitalizationId],
    queryFn: async () => {
      if (!user) return []
      let q = supabase
        .from('clinic_meal_plans')
        .select('*, diet_table:clinic_diet_tables(number, name), hospitalization:clinic_hospitalizations(client:clients(first_name, last_name))')
        .order('start_date', { ascending: false })
      if (hospitalizationId) q = q.eq('hospitalization_id', hospitalizationId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ClinicMealPlan[]
    },
    enabled: !!user,
    staleTime: 30_000,
  })
}

export function useCreateMealPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { hospitalization_id: string; diet_table_id: string; start_date?: string; end_date?: string | null; special_instructions?: string | null; notes?: string | null }) => {
      const { error } = await supabase.from('clinic_meal_plans').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_NUTRITION_KEY] }),
  })
}

export function useUpdateMealPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ClinicMealPlan> & { id: string }) => {
      const { error } = await supabase.from('clinic_meal_plans').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_NUTRITION_KEY] }),
  })
}

export function useDeleteMealPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clinic_meal_plans').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_NUTRITION_KEY] }),
  })
}

// Meal Records
export function useClinicMealRecords(mealPlanId?: string, date?: string) {
  return useQuery({
    queryKey: [CLINIC_NUTRITION_KEY, 'records', mealPlanId, date],
    queryFn: async () => {
      let q = supabase.from('clinic_meal_records').select('*').order('meal_type')
      if (mealPlanId) q = q.eq('meal_plan_id', mealPlanId)
      if (date) q = q.eq('date', date)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ClinicMealRecord[]
    },
    enabled: !!(mealPlanId || date),
    staleTime: 30_000,
  })
}

export function useCreateMealRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { meal_plan_id: string; date: string; meal_type: MealType; menu_items?: string | null; served?: boolean; notes?: string | null }) => {
      const { error } = await supabase.from('clinic_meal_records').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_NUTRITION_KEY] }),
  })
}

export function useUpdateMealRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; served?: boolean; menu_items?: string | null; notes?: string | null }) => {
      const { error } = await supabase.from('clinic_meal_records').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_NUTRITION_KEY] }),
  })
}
