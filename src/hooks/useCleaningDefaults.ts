import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'

export interface CleaningDefaults {
  delivery_fee: number       // дефолт для цены доставки
  default_express_pct: number // дефолт срочной надбавки %
}

const DEFAULTS: CleaningDefaults = {
  delivery_fee: 350,
  default_express_pct: 50,
}

const KEY = 'cleaning_defaults'

export function useCleaningDefaults() {
  return useQuery({
    queryKey: ['app_settings', KEY, PRODUCT],
    queryFn: async (): Promise<CleaningDefaults> => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('product', PRODUCT)
        .eq('key', KEY)
        .maybeSingle()
      if (!data?.value) return DEFAULTS
      try {
        const parsed = JSON.parse(data.value) as Partial<CleaningDefaults>
        return { ...DEFAULTS, ...parsed }
      } catch {
        return DEFAULTS
      }
    },
    staleTime: 60_000,
  })
}

export function useUpdateCleaningDefaults() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (defaults: Partial<CleaningDefaults>) => {
      const merged = { ...DEFAULTS, ...defaults }
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { product: PRODUCT, key: KEY, value: JSON.stringify(merged) },
          { onConflict: 'product,key' }
        )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app_settings', KEY] }),
  })
}
