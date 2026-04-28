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
  terms_text: string          // условия приёмки (юр. оферта); пустая строка — не показывать
}

export const DEFAULT_TERMS_TEXT = [
  'Условия приёмки:',
  '1. Клиент подтверждает наличие отмеченных дефектов на изделии.',
  '2. Химчистка не несёт ответственности за скрытые дефекты, проявившиеся в процессе обработки (потеря цвета, деформация фурнитуры, расхождение швов, усадка ткани).',
  '3. Срок предъявления претензий к качеству — 24 часа с момента выдачи.',
  '4. Готовое изделие хранится бесплатно 30 дней. Далее взимается плата за хранение.',
  '5. При утере квитанции изделие выдаётся при предъявлении документа, удостоверяющего личность.',
  '6. Подписывая квитанцию, клиент соглашается с условиями приёмки.',
].join('\n')

export const DEFAULT_RECEIPT_CONFIG: ReceiptConfig = {
  company_name: '',
  company_address: '',
  company_phone: '',
  footer_text: 'Спасибо за обращение!',
  show_item_details: true,
  copy_count: 2,
  terms_text: DEFAULT_TERMS_TEXT,
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
