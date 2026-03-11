import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { PromoCode } from '@/types'

export const PROMO_CODES_KEY = 'promo_codes'

// Все промокоды мастера
export function usePromoCodes() {
  const { user } = useAuth()

  return useQuery({
    queryKey: [PROMO_CODES_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('master_id', user!.id)
        .order('id', { ascending: false })
      if (error) throw error
      return (data ?? []) as PromoCode[]
    },
    enabled: !!user,
  })
}

// Создать промокод
export function useCreatePromoCode() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (data: Partial<PromoCode>) => {
      const { data: promo, error } = await supabase
        .from('promo_codes')
        .insert({
          ...data,
          master_id: user!.id,
          use_count: 0,
        })
        .select()
        .single()
      if (error) throw error
      return promo as PromoCode
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PROMO_CODES_KEY] }),
  })
}

// Обновить промокод
export function useUpdatePromoCode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PromoCode> }) => {
      const { data: promo, error } = await supabase
        .from('promo_codes')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return promo as PromoCode
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PROMO_CODES_KEY] }),
  })
}

// Удалить промокод
export function useDeletePromoCode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('promo_codes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PROMO_CODES_KEY] }),
  })
}

// Публичная проверка промокода при бронировании (без авторизации)
export async function validatePromoCode(
  masterId: string,
  code: string,
  totalPrice: number
): Promise<{ valid: boolean; promo?: PromoCode; discountAmount?: number; error?: string }> {
  try {
    const { data: records } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('master_id', masterId)
      .eq('code', code.toUpperCase())
      .eq('is_active', true)

    if (!records || records.length === 0) {
      return { valid: false, error: 'Промокод не найден или неактивен' }
    }

    const promo = records[0] as PromoCode
    const today = new Date().toISOString().slice(0, 10)

    if (promo.valid_from && today < promo.valid_from) {
      return { valid: false, error: 'Промокод ещё не действует' }
    }
    if (promo.valid_until && today > promo.valid_until) {
      return { valid: false, error: 'Срок действия промокода истёк' }
    }
    if (promo.max_uses && promo.max_uses > 0 && (promo.use_count ?? 0) >= promo.max_uses) {
      return { valid: false, error: 'Промокод исчерпан' }
    }

    let discountAmount = 0
    if (promo.discount_type === 'percent') {
      discountAmount = Math.round((totalPrice * promo.discount_value) / 100)
    } else {
      discountAmount = Math.min(promo.discount_value, totalPrice)
    }

    return { valid: true, promo, discountAmount }
  } catch {
    return { valid: false, error: 'Ошибка проверки промокода' }
  }
}
