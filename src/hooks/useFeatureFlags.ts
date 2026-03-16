import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { FEATURE_MAP, PLAN_ORDER, type FeaturePlan } from '@/config/features'

// ─── Типы записи ────────────────────────────────────────────────────────────

export interface FeatureFlag {
  id?: string
  key: string
  enabled: boolean                   // глобально вкл/выкл
  min_plan: FeaturePlan              // минимальный план для доступа
  overrides: string[]                // userId[] — персональные исключения (доступ вне плана)
  blocked_users: string[]            // userId[] — явно заблокированные пользователи
}

// ─── Загрузка всех флагов из БД ────────────────────────────────────────────

export function useFeatureFlags() {
  return useQuery<FeatureFlag[]>({
    queryKey: ['feature_flags'],
    queryFn: async () => {
      const { data } = await supabase
        .from('feature_flags')
        .select('*')
        .order('key')
      return (data ?? []) as FeatureFlag[]
    },
    staleTime: 10 * 60_000,
  })
}

// O(1) Map для быстрого поиска флагов (вместо O(n) find на каждый useFeature)
export function useFlagMap(): Map<string, FeatureFlag> {
  const { data: flags } = useFeatureFlags()
  return useMemo(
    () => new Map((flags ?? []).map(f => [f.key, f])),
    [flags]
  )
}

// ─── Проверка доступа к конкретной функции ─────────────────────────────────

export function useFeature(key: string): boolean {
  const { user } = useAuth()
  const flagMap = useFlagMap()

  const userPlan: FeaturePlan = (user?.plan as FeaturePlan) || 'free'
  const config = FEATURE_MAP[key]

  if (!config) return true
  if (user?.is_admin) return true

  const flag = flagMap.get(key)

  if (flag) {
    if (!flag.enabled) return false
    if (user && flag.blocked_users?.includes(user.id)) return false
    if (user && flag.overrides?.includes(user.id)) return true
    const requiredPlan = flag.min_plan || config.defaultPlan
    return hasRequiredPlan(userPlan, requiredPlan)
  }

  return hasRequiredPlan(userPlan, config.defaultPlan)
}

/** Проверяет, что userPlan >= requiredPlan */
function hasRequiredPlan(userPlan: FeaturePlan, requiredPlan: FeaturePlan): boolean {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(requiredPlan)
}

// ─── CRUD для admin UI ─────────────────────────────────────────────────────

export function useUpsertFeatureFlag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (flag: FeatureFlag) => {
      const { data, error } = await supabase
        .from('feature_flags')
        // flag_name — legacy NOT NULL column; pass key as fallback value
        .upsert({ ...flag, flag_name: flag.key }, { onConflict: 'key' })
        .select()
        .single()
      if (error) throw error
      return data as FeatureFlag
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feature_flags'] })
    },
  })
}
