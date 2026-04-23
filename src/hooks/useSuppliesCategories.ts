import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'

export interface SupplyCategory {
  value: string
  label: string
  enabled: boolean
}

export const DEFAULT_SUPPLY_CATEGORIES: SupplyCategory[] = [
  { value: 'chemical',  label: 'Химия',        enabled: true },
  { value: 'packaging', label: 'Упаковка',     enabled: true },
  { value: 'equipment', label: 'Оборудование', enabled: true },
  { value: 'other',     label: 'Прочее',       enabled: true },
]

const QKEY = ['app_settings', 'supplies_categories', PRODUCT]

export function useSuppliesCategories() {
  return useQuery({
    queryKey: QKEY,
    queryFn: async (): Promise<SupplyCategory[]> => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'supplies_categories')
        .eq('product', PRODUCT)
        .maybeSingle()
      if (!data?.value) return DEFAULT_SUPPLY_CATEGORIES
      try {
        const parsed = JSON.parse(data.value)
        if (Array.isArray(parsed) && parsed.every(x => x && typeof x.value === 'string' && typeof x.label === 'string')) {
          return parsed.map(x => ({ value: x.value, label: x.label, enabled: x.enabled !== false }))
        }
        return DEFAULT_SUPPLY_CATEGORIES
      } catch {
        return DEFAULT_SUPPLY_CATEGORIES
      }
    },
    staleTime: 5 * 60_000,
  })
}

export function useUpdateSuppliesCategories() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (categories: SupplyCategory[]) => {
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { key: 'supplies_categories', product: PRODUCT, value: JSON.stringify(categories) },
          { onConflict: 'product,key' },
        )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QKEY }),
  })
}
