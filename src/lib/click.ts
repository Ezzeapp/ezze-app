/**
 * Click.uz helper
 *
 * Строит URL для редиректа на страницу оплаты Click.
 * Click Checkout URL:
 *   https://my.click.uz/services/pay?service_id=SID&merchant_id=MID&amount=AMOUNT&transaction_param=USER:PLAN
 *
 * ВАЖНО: amountUzs должна точно совпадать с plan_prices в Supabase,
 *         иначе Click Edge Function отклонит платёж при проверке подписи.
 */

const CLICK_BASE_URL = 'https://my.click.uz/services/pay'

/**
 * Строит URL для оплаты через Click.uz.
 * @param serviceId   — Click Service ID (из app_settings.click_service_id)
 * @param merchantId  — Click Merchant ID (из app_settings.click_merchant_id)
 * @param userId      — ID пользователя в нашей БД
 * @param plan        — 'pro' | 'enterprise'
 * @param amountUzs   — Сумма в UZS (берётся из usePlanPrices() — должна совпадать с Supabase)
 */
export function buildClickUrl(
  serviceId: string,
  merchantId: string,
  userId: string,
  plan: string,
  amountUzs: number,
): string {
  // merchant_trans_id — наш идентификатор заказа
  const merchantTransId = `${userId}:${plan}`

  const params = new URLSearchParams({
    service_id:        serviceId,
    merchant_id:       merchantId,
    amount:            String(amountUzs),
    transaction_param: merchantTransId,
  })

  return `${CLICK_BASE_URL}?${params.toString()}`
}
