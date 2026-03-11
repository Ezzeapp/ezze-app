/**
 * Payme.uz (paycom.uz) helper
 *
 * Строит URL для редиректа на страницу оплаты.
 * Payme Checkout URL:
 *   https://checkout.paycom.uz/{base64(params)}
 *
 * Params string (semicolon-separated):
 *   m=MERCHANT_ID;ac.user_id=USER_ID;ac.plan=PLAN;a=AMOUNT_TIYINS;l=LANG
 */

const PAYME_BASE_URL = 'https://checkout.paycom.uz'

/** Цены планов в тийинах (UZS × 100) */
export const PLAN_PRICES_TIYINS: Record<string, number> = {
  pro:        9_900_000,   // 99 000 UZS
  enterprise: 29_900_000,  // 299 000 UZS
}

/** Цены планов в UZS (для отображения) */
export const PLAN_PRICES_UZS: Record<string, number> = {
  pro:        99_000,
  enterprise: 299_000,
}

/**
 * Строит URL для оплаты через Payme.
 * @param merchantId  — Payme Merchant ID (из app_settings.payme_merchant_id)
 * @param userId      — ID пользователя в нашей БД
 * @param plan        — 'pro' | 'enterprise'
 * @param lang        — 'ru' | 'uz' | 'en' (язык страницы оплаты)
 */
export function buildPaymeUrl(
  merchantId: string,
  userId: string,
  plan: string,
  lang = 'ru',
): string {
  const amount = PLAN_PRICES_TIYINS[plan]
  if (!amount) throw new Error(`Unknown plan: ${plan}`)

  const params = [
    `m=${merchantId}`,
    `ac.user_id=${userId}`,
    `ac.plan=${plan}`,
    `a=${amount}`,
    `l=${lang}`,
  ].join(';')

  const encoded = btoa(params)
  return `${PAYME_BASE_URL}/${encoded}`
}
