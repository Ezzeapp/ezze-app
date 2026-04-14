import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useClinicICD10Search(query: string) {
  return useQuery({
    queryKey: ['clinic_icd10', query],
    queryFn: async () => {
      if (!query || query.length < 2) return []
      const { data, error } = await supabase
        .from('clinic_icd10_codes')
        .select('code, name_ru')
        .or(`code.ilike.${query}%,name_ru.ilike.%${query}%`)
        .limit(20)
      if (error) throw error
      return data as { code: string; name_ru: string }[]
    },
    enabled: query.length >= 2,
    staleTime: 300_000,
  })
}
