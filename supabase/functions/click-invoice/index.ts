/**
 * Edge Function: click-invoice
 *
 * Creates a Click.uz invoice via Merchant API (server-side).
 * Returns payment_url + invoice_id to the client.
 *
 * Auth header format:
 *   Auth: {merchant_user_id}:{digest}:{timestamp}
 *   digest = SHA1(timestamp + secret_key)
 *
 * Endpoint:
 *   POST https://api.click.uz/v2/merchant/invoice/create
 *   Body: { service_id, amount, phone_number?, merchant_trans_id }
 *
 * Credentials read from app_settings:
 *   click_service_id    — Click Service ID
 *   click_merchant_id   — Click Merchant ID (for redirect URL)
 *   click_user_id       — Click Merchant User ID (for Merchant API auth)
 *   click_merchant_key  — Click Secret Key (for SHA1 digest)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const CLICK_MERCHANT_API = 'https://api.click.uz/v2/merchant/invoice/create'
const CLICK_PAY_BASE     = 'https://my.click.uz/services/pay'

// ── SHA1 (pure TypeScript / WebCrypto) ────────────────────────────────────────

async function sha1(input: string): Promise<string> {
  const data    = new TextEncoder().encode(input)
  const hashBuf = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── Read credentials from app_settings ────────────────────────────────────────

async function getCredentials() {
  const { data: rows } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .in('key', ['click_service_id', 'click_merchant_id', 'click_user_id', 'click_merchant_key'])

  const map: Record<string, string> = {}
  ;(rows ?? []).forEach((r: any) => { map[r.key] = r.value })

  return {
    serviceId:   map.click_service_id   ?? '',
    merchantId:  map.click_merchant_id  ?? '',
    userId:      map.click_user_id      ?? '',
    secretKey:   map.click_merchant_key ?? '',
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  let body: { user_id: string; plan: string; amount_uzs: number; phone?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const { user_id, plan, amount_uzs, phone } = body

  if (!user_id || !plan || !amount_uzs) {
    return new Response(JSON.stringify({ error: 'Missing required fields: user_id, plan, amount_uzs' }), { status: 400 })
  }

  // ── Get credentials ──────────────────────────────────────────────────────────

  const creds = await getCredentials()

  if (!creds.serviceId || !creds.merchantId) {
    return new Response(JSON.stringify({ error: 'Click credentials not configured' }), { status: 500 })
  }

  // ── Fallback: if click_user_id not set, return legacy URL ────────────────────

  if (!creds.userId || !creds.secretKey) {
    const params = new URLSearchParams({
      service_id:        creds.serviceId,
      merchant_id:       creds.merchantId,
      amount:            String(amount_uzs),
      transaction_param: `${user_id}:${plan}`,
    })
    return new Response(
      JSON.stringify({
        payment_url: `${CLICK_PAY_BASE}?${params.toString()}`,
        invoice_id:  null,
        method:      'legacy',
      }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  }

  // ── Build Merchant API auth header ───────────────────────────────────────────

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const digest    = await sha1(timestamp + creds.secretKey)
  const authHeader = `${creds.userId}:${digest}:${timestamp}`

  // ── Call Click Merchant API ───────────────────────────────────────────────────

  const merchantTransId = `${user_id}:${plan}`

  const invoiceBody: Record<string, string | number> = {
    service_id:        Number(creds.serviceId),
    amount:            amount_uzs,
    merchant_trans_id: merchantTransId,
  }
  if (phone) invoiceBody.phone_number = phone

  let invoiceId: number | null = null

  try {
    const clickRes = await fetch(CLICK_MERCHANT_API, {
      method:  'POST',
      headers: {
        'Accept':       'application/json',
        'Content-Type': 'application/json',
        'Auth':         authHeader,
      },
      body: JSON.stringify(invoiceBody),
    })

    const clickData: { error_code: number; error_note?: string; invoice_id?: number } = await clickRes.json()

    if (clickData.error_code !== 0 || !clickData.invoice_id) {
      // Click Merchant API returned an error — fallback to legacy URL
      console.error('[click-invoice] API error:', clickData)
      const params = new URLSearchParams({
        service_id:        creds.serviceId,
        merchant_id:       creds.merchantId,
        amount:            String(amount_uzs),
        transaction_param: merchantTransId,
      })
      return new Response(
        JSON.stringify({
          payment_url: `${CLICK_PAY_BASE}?${params.toString()}`,
          invoice_id:  null,
          method:      'legacy_fallback',
          api_error:   clickData.error_note ?? 'unknown',
        }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    invoiceId = clickData.invoice_id
  } catch (err) {
    console.error('[click-invoice] fetch error:', err)
    // Network error — fallback to legacy
    const params = new URLSearchParams({
      service_id:        creds.serviceId,
      merchant_id:       creds.merchantId,
      amount:            String(amount_uzs),
      transaction_param: merchantTransId,
    })
    return new Response(
      JSON.stringify({
        payment_url: `${CLICK_PAY_BASE}?${params.toString()}`,
        invoice_id:  null,
        method:      'legacy_fallback',
        api_error:   'network_error',
      }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  }

  // ── Build payment URL with invoice_id ────────────────────────────────────────

  const params = new URLSearchParams({
    service_id:        creds.serviceId,
    merchant_id:       creds.merchantId,
    amount:            String(amount_uzs),
    transaction_param: merchantTransId,
    invoice_id:        String(invoiceId),
  })

  const paymentUrl = `${CLICK_PAY_BASE}?${params.toString()}`

  return new Response(
    JSON.stringify({
      payment_url: paymentUrl,
      invoice_id:  invoiceId,
      method:      'merchant_api',
    }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  )
})
