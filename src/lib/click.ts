/**
 * Click.uz helpers
 *
 * buildClickUrl  — строит legacy URL напрямую (fallback, без сервера)
 * createClickInvoice — создаёт invoice через Click Merchant API (server-side),
 *                      возвращает payment_url с invoice_id.
 *
 * ВАЖНО: amountUzs должна точно совпадать с plan_prices в Supabase,
 *         иначе Click Edge Function отклонит платёж при проверке подписи.
 */

import { supabase } from '@/lib/supabase'

const CLICK_BASE_URL = 'https://my.click.uz/services/pay'

/**
 * Legacy: строит URL для оплаты через Click.uz без создания invoice.
 * Используется как fallback если Merchant API недоступен.
 */
export function buildClickUrl(
  serviceId: string,
  merchantId: string,
  userId: string,
  plan: string,
  amountUzs: number,
): string {
  const merchantTransId = `${userId}:${plan}`
  const params = new URLSearchParams({
    service_id:        serviceId,
    merchant_id:       merchantId,
    amount:            String(amountUzs),
    transaction_param: merchantTransId,
  })
  return `${CLICK_BASE_URL}?${params.toString()}`
}

/**
 * Создаёт invoice через Click Merchant API (server-side Edge Function).
 * Возвращает payment_url + invoice_id.
 *
 * Если click_user_id не настроен или API недоступен — автоматически
 * возвращает legacy URL (graceful fallback).
 *
 * @param userId     — ID пользователя (UUID)
 * @param plan       — 'pro' | 'enterprise'
 * @param amountUzs  — Сумма в UZS (из usePlanPrices())
 * @param phone      — Телефон пользователя (необязательно, для SMS от Click)
 */
export async function createClickInvoice(
  userId: string,
  plan: string,
  amountUzs: number,
  phone?: string,
): Promise<{ payment_url: string; invoice_id: number | null }> {
  const { data, error } = await supabase.functions.invoke('click-invoice', {
    body: { user_id: userId, plan, amount_uzs: amountUzs, phone },
  })

  if (error || !data?.payment_url) {
    throw new Error(error?.message ?? 'click-invoice: no payment_url returned')
  }

  return {
    payment_url: data.payment_url as string,
    invoice_id:  data.invoice_id as number | null,
  }
}
