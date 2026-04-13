import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'

export interface ReceiptConfig {
  company_name: string
  company_address: string
  company_phone: string
  footer_text: string
  show_item_details: boolean  // цвет, бренд, дефекты
  copy_count: 1 | 2           // 1 = один экземпляр, 2 = клиент + организация
}

export const DEFAULT_RECEIPT_CONFIG: ReceiptConfig = {
  company_name: '',
  company_address: '',
  company_phone: '',
  footer_text: 'Спасибо за обращение!',
  show_item_details: true,
  copy_count: 2,
}

const QKEY = ['app_settings', 'receipt_config', PRODUCT]

export function useReceiptConfig() {
  return useQuery({
    queryKey: QKEY,
    queryFn: async (): Promise<ReceiptConfig> => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'receipt_config')
        .eq('product', PRODUCT)
        .maybeSingle()
      if (!data?.value) return DEFAULT_RECEIPT_CONFIG
      try { return { ...DEFAULT_RECEIPT_CONFIG, ...JSON.parse(data.value) } }
      catch { return DEFAULT_RECEIPT_CONFIG }
    },
    staleTime: 5 * 60_000,
  })
}

export function useUpdateReceiptConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config: ReceiptConfig) => {
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { key: 'receipt_config', product: PRODUCT, value: JSON.stringify(config) },
          { onConflict: 'product,key' }
        )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QKEY }),
  })
}
