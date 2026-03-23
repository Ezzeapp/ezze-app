/**
 * Payme.uz (paycom.uz) helper
 *
 * Строит URL для редиректа на страницу оплаты.
 * Payme Checkout URL:
 *   https://checkout.paycom.uz/{base64(params)}
 *
 * Params string (semicolon-separated):
 *   m=MERCHANT_ID;ac.user_id=USER_ID;ac.plan=PLAN;a=AMOUNT_TIYINS;l=LANG
 *
 * ВАЖНО: amountUzs должна точно совпадать с plan_prices в Supabase,
 *         иначе Payme Edge Function отклонит платёж.
 */

const PAYME_BASE_URL = 'https://checkout.paycom.uz'

/**
 * Строит URL для оплаты через Payme.
 * @param merchantId  — Payme Merchant ID (из app_settings.payme_merchant_id)
 * @param userId      — ID пользователя в нашей БД
 * @param plan        — 'pro' | 'enterprise'
 * @param amountUzs   — Сумма в UZS (берётся из usePlanPrices() — должна совпадать с Supabase)
 * @param lang        — 'ru' | 'uz' | 'en' (язык страницы оплаты)
 */
export function buildPaymeUrl(
  merchantId: string,
  userId: string,
  plan: string,
  amountUzs: number,
  lang = 'ru',
): string {
  // Payme работает в тийинах (1 UZS = 100 тийинов)
  const amountTiyins = amountUzs * 100

  const params = [
    `m=${merchantId}`,
    `ac.user_id=${userId}`,
    `ac.plan=${plan}`,
    `a=${amountTiyins}`,
    `l=${lang}`,
  ].join(';')

  const encoded = btoa(params)
  return `${PAYME_BASE_URL}/${encoded}`
}
