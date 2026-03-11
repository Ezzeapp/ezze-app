/**
 * Click.uz helper
 *
 * Строит URL для редиректа на страницу оплаты Click.
 * Click Checkout URL:
 *   https://my.click.uz/services/pay?service_id=SID&merchant_id=MID&amount=AMOUNT&transaction_param=USER:PLAN
 */

const CLICK_BASE_URL = 'https://my.click.uz/services/pay'

/** Цены планов в UZS */
export const CLICK_PLAN_PRICES_UZS: Record<string, number> = {
  pro:        99_000,
  enterprise: 299_000,
}

/**
 * Строит URL для оплаты через Click.uz.
 * @param serviceId   — Click Service ID (из app_settings.click_service_id)
 * @param merchantId  — Click Merchant ID (из app_settings.click_merchant_id)
 * @param userId      — ID пользователя в нашей БД
 * @param plan        — 'pro' | 'enterprise'
 */
export function buildClickUrl(
  serviceId: string,
  merchantId: string,
  userId: string,
  plan: string,
): string {
  const amount = CLICK_PLAN_PRICES_UZS[plan]
  if (!amount) throw new Error(`Unknown plan: ${plan}`)

  // merchant_trans_id — наш идентификатор заказа
  const merchantTransId = `${userId}:${plan}`

  const params = new URLSearchParams({
    service_id:        serviceId,
    merchant_id:       merchantId,
    amount:            String(amount),
    transaction_param: merchantTransId,
  })

  return `${CLICK_BASE_URL}?${params.toString()}`
}
