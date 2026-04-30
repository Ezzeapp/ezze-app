import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import type { RentalBooking } from '@/types/rental'

export const RENTAL_BOOKINGS_KEY = 'rental_bookings'

export function useRentalBookings() {
  return useQuery({
    queryKey: [RENTAL_BOOKINGS_KEY, PRODUCT],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rental_bookings')
        .select('*')
        .eq('product', PRODUCT)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as RentalBooking[]
    },
    staleTime: 15_000,
  })
}

export function useRentalBooking(id: string | undefined) {
  return useQuery({
    queryKey: [RENTAL_BOOKINGS_KEY, 'one', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('rental_bookings')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data as RentalBooking | null
    },
    enabled: !!id,
    staleTime: 5_000,
  })
}

export interface UpsertBookingPayload extends Partial<RentalBooking> {
  item_id: string
  start_at: string
  end_at: string
}

export function useUpsertRentalBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UpsertBookingPayload) => {
      const isNew = !payload.id
      let number = payload.number
      if (isNew && !number) {
        const { data, error } = await supabase.rpc('generate_rental_booking_number', { p_product: PRODUCT })
        if (error) throw error
        number = data as string
      }
      const { data, error } = await supabase
        .from('rental_bookings')
        .upsert({ ...payload, product: PRODUCT, number })
        .select()
        .single()
      if (error) throw error
      return data as RentalBooking
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [RENTAL_BOOKINGS_KEY] }),
  })
}

export function useDeleteRentalBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rental_bookings').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [RENTAL_BOOKINGS_KEY] }),
  })
}

export interface AvailabilityResult {
  conflicts_count: number
  inventory_qty: number
  is_available: boolean
}

export async function checkRentalAvailability(
  itemId: string,
  startAt: string,
  endAt: string,
  excludeBookingId?: string,
): Promise<AvailabilityResult> {
  const { data, error } = await supabase.rpc('rental_check_availability', {
    p_item_id: itemId,
    p_start: startAt,
    p_end: endAt,
    p_exclude_booking_id: excludeBookingId ?? null,
  })
  if (error) throw error
  // RPC возвращает таблицу с одной строкой
  const row = Array.isArray(data) ? data[0] : data
  return {
    conflicts_count: row?.conflicts_count ?? 0,
    inventory_qty: row?.inventory_qty ?? 0,
    is_available: row?.is_available ?? false,
  }
}

/**
 * Расчёт стоимости аренды по датам и тарифу объекта.
 * Берёт цену по выбранной единице тарификации; если её нет — fallback по убыванию длительности.
 */
export function calcRentalPrice(item: {
  pricing_unit: 'hour' | 'day' | 'week' | 'month'
  price_per_hour: number | null
  price_per_day: number | null
  price_per_week: number | null
  price_per_month: number | null
}, startAt: string, endAt: string) {
  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()
  if (!isFinite(start) || !isFinite(end) || end <= start) {
    return { unitPrice: 0, unitsCount: 0, basePrice: 0, unitUsed: item.pricing_unit }
  }
  const ms = end - start
  const hours  = ms / (1000 * 60 * 60)
  const days   = hours / 24
  const weeks  = days / 7
  const months = days / 30  // условно

  const candidates: Array<{ unit: 'hour'|'day'|'week'|'month'; count: number; price: number | null }> = [
    { unit: 'hour',  count: hours,  price: item.price_per_hour  },
    { unit: 'day',   count: days,   price: item.price_per_day   },
    { unit: 'week',  count: weeks,  price: item.price_per_week  },
    { unit: 'month', count: months, price: item.price_per_month },
  ]

  // Сначала пробуем основную единицу
  const primary = candidates.find(c => c.unit === item.pricing_unit && c.price && c.price > 0)
  let chosen = primary
  if (!chosen) {
    // Если нет — берём первую заполненную с подходящей длиной (предпочитаем round-up)
    chosen = candidates.find(c => c.price && c.price > 0)
  }
  if (!chosen || !chosen.price) {
    return { unitPrice: 0, unitsCount: 0, basePrice: 0, unitUsed: item.pricing_unit }
  }
  // Округляем единицы вверх (даже частичный час/день оплачивается полностью)
  const unitsCount = Math.max(1, Math.ceil(chosen.count * 100) / 100)
  const basePrice = Math.round(chosen.price * unitsCount)
  return { unitPrice: chosen.price, unitsCount, basePrice, unitUsed: chosen.unit }
}
