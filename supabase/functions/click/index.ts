/**
 * Edge Function: click
 * Replaces pb_hooks/click_webhook.pb.js
 *
 * Handles Click.uz payment webhook — two steps via POST (form-encoded body):
 *   POST /functions/v1/click/prepare   — step 1: reserve transaction
 *   POST /functions/v1/click/complete  — step 2: confirm payment
 *
 * Routing is done via the `action` field in the form body:
 *   action=0 → prepare
 *   action=1 → complete
 *
 * MD5 signature (prepare, action=0):
 *   MD5(click_trans_id + service_id + secret_key + merchant_trans_id +
 *       amount + action + sign_time)
 *
 * MD5 signature (complete, action=1):
 *   MD5(click_trans_id + service_id + secret_key + merchant_trans_id +
 *       merchant_prepare_id + amount + action + sign_time)
 *
 * merchant_trans_id format: "userId:plan"
 *
 * Credentials read from app_settings:
 *   key = "click_merchant_key"  → secret key
 *   key = "click_service_id"    → service id (for reference only)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// ── Plan defaults ─────────────────────────────────────────────────────────────

const DEFAULT_PLAN_PRICES_UZS: Record<string, number> = {
  pro:        99000,
  enterprise: 299000,
}

const PLAN_PERIOD_MONTHS: Record<string, number> = {
  pro:        1,
  enterprise: 1,
}

// ── Click error codes ─────────────────────────────────────────────────────────

const CLICK_OK                  =  0
const CLICK_ERR_SIGN            = -1
const CLICK_ERR_INCORRECT_PARAM = -2
const CLICK_ERR_ACTION          = -3
const CLICK_ERR_ALREADY_PAID    = -4
const CLICK_ERR_NOT_FOUND       = -5
const CLICK_ERR_CANCELLED       = -9
const CLICK_ERR_INTERNAL        = -8

// ── Response helper ───────────────────────────────────────────────────────────

function clickResp(errCode: number, errNote: string, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ error: errCode, error_note: errNote, ...extra }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function getProductByUserId(userId: string): Promise<string> {
  if (!userId) return 'beauty'
  try {
    const { data } = await supabaseAdmin
      .from('users').select('product')
      .eq('id', userId)
      .maybeSingle()
    return data?.product ?? 'beauty'
  } catch (_) {
    return 'beauty'
  }
}

async function getClickKey(product: string): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from('app_settings').select('value')
      .eq('key', 'click_merchant_key')
      .eq('product', product)
      .maybeSingle()
    return data?.value ?? ''
  } catch (_) {
    return ''
  }
}

async function getPlanPriceUzs(plan: string, product: string): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from('app_settings').select('value')
      .eq('key', 'plan_prices')
      .eq('product', product)
      .maybeSingle()
    if (data?.value) {
      const prices = JSON.parse(data.value)
      return prices[plan] ?? 0
    }
  } catch (_) {}
  return DEFAULT_PLAN_PRICES_UZS[plan] ?? 0
}

async function findClickSub(clickTransId: string) {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('provider_transaction_id', `click:${clickTransId}`)
    .eq('provider', 'click')
    .maybeSingle()
  return data
}

/** Восстанавливает данные, деактивированные при истечении подписки */
async function restoreAfterRenewal(userId: string) {
  try {
    // Восстанавливаем услуги
    await supabaseAdmin
      .from('services')
      .update({ is_active: true, suspended_by_expiry: false })
      .eq('master_id', userId)
      .eq('suspended_by_expiry', true)

    // Восстанавливаем членов команды
    const { data: team } = await supabaseAdmin
      .from('teams').select('id').eq('owner_id', userId).maybeSingle()
    if (team) {
      await supabaseAdmin
        .from('team_members')
        .update({ status: 'active', suspended_by_expiry: false })
        .eq('team_id', team.id)
        .eq('suspended_by_expiry', true)
    }
    console.log('[click] restoreAfterRenewal done for userId:', userId)
  } catch (e) {
    console.error('[click] restoreAfterRenewal error:', e)
  }
}

function addMonths(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString().replace('T', ' ').substring(0, 19)
}

// ── MD5 via SubtleCrypto (MD5 not natively available; use Web Crypto workaround)
// Deno does not support MD5 in SubtleCrypto. We implement it manually.
// Reference: https://en.wikipedia.org/wiki/MD5

function md5(input: string): string {
  // MD5 implementation in pure TypeScript
  function safeAdd(x: number, y: number): number {
    const lsw = (x & 0xffff) + (y & 0xffff)
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16)
    return (msw << 16) | (lsw & 0xffff)
  }
  function bitRotateLeft(num: number, cnt: number): number {
    return (num << cnt) | (num >>> (32 - cnt))
  }
  function md5cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b)
  }
  function md5ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return md5cmn((b & c) | (~b & d), a, b, x, s, t)
  }
  function md5gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return md5cmn((b & d) | (c & ~d), a, b, x, s, t)
  }
  function md5hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return md5cmn(b ^ c ^ d, a, b, x, s, t)
  }
  function md5ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return md5cmn(c ^ (b | ~d), a, b, x, s, t)
  }

  const encoder = new TextEncoder()
  const msgBytes = encoder.encode(input)
  const msgLen   = msgBytes.length
  const bitLen   = msgLen * 8

  // Pad message
  const padded = new Uint8Array(((msgLen + 8) >>> 6 << 6) + 64)
  padded.set(msgBytes)
  padded[msgLen] = 0x80
  // Append length as 64-bit LE
  const dv = new DataView(padded.buffer)
  dv.setUint32(padded.length - 8, bitLen, true)
  dv.setUint32(padded.length - 4, 0, true)

  const words: number[] = []
  for (let i = 0; i < padded.length; i += 4) {
    words.push(dv.getUint32(i, true))
  }

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  for (let i = 0; i < words.length; i += 16) {
    const M = words.slice(i, i + 16)
    let a = a0, b = b0, c = c0, d = d0

    a = md5ff(a, b, c, d, M[0],   7, -680876936)
    d = md5ff(d, a, b, c, M[1],  12, -389564586)
    c = md5ff(c, d, a, b, M[2],  17,  606105819)
    b = md5ff(b, c, d, a, M[3],  22, -1044525330)
    a = md5ff(a, b, c, d, M[4],   7, -176418897)
    d = md5ff(d, a, b, c, M[5],  12,  1200080426)
    c = md5ff(c, d, a, b, M[6],  17, -1473231341)
    b = md5ff(b, c, d, a, M[7],  22, -45705983)
    a = md5ff(a, b, c, d, M[8],   7,  1770035416)
    d = md5ff(d, a, b, c, M[9],  12, -1958414417)
    c = md5ff(c, d, a, b, M[10], 17, -42063)
    b = md5ff(b, c, d, a, M[11], 22, -1990404162)
    a = md5ff(a, b, c, d, M[12],  7,  1804603682)
    d = md5ff(d, a, b, c, M[13], 12, -40341101)
    c = md5ff(c, d, a, b, M[14], 17, -1502002290)
    b = md5ff(b, c, d, a, M[15], 22,  1236535329)

    a = md5gg(a, b, c, d, M[1],   5, -165796510)
    d = md5gg(d, a, b, c, M[6],   9, -1069501632)
    c = md5gg(c, d, a, b, M[11], 14,  643717713)
    b = md5gg(b, c, d, a, M[0],  20, -373897302)
    a = md5gg(a, b, c, d, M[5],   5, -701558691)
    d = md5gg(d, a, b, c, M[10],  9,  38016083)
    c = md5gg(c, d, a, b, M[15], 14, -660478335)
    b = md5gg(b, c, d, a, M[4],  20, -405537848)
    a = md5gg(a, b, c, d, M[9],   5,  568446438)
    d = md5gg(d, a, b, c, M[14],  9, -1019803690)
    c = md5gg(c, d, a, b, M[3],  14, -187363961)
    b = md5gg(b, c, d, a, M[8],  20,  1163531501)
    a = md5gg(a, b, c, d, M[13],  5, -1444681467)
    d = md5gg(d, a, b, c, M[2],   9, -51403784)
    c = md5gg(c, d, a, b, M[7],  14,  1735328473)
    b = md5gg(b, c, d, a, M[12], 20, -1926607734)

    a = md5hh(a, b, c, d, M[5],   4, -378558)
    d = md5hh(d, a, b, c, M[8],  11, -2022574463)
    c = md5hh(c, d, a, b, M[11], 16,  1839030562)
    b = md5hh(b, c, d, a, M[14], 23, -35309556)
    a = md5hh(a, b, c, d, M[1],   4, -1530992060)
    d = md5hh(d, a, b, c, M[4],  11,  1272893353)
    c = md5hh(c, d, a, b, M[7],  16, -155497632)
    b = md5hh(b, c, d, a, M[10], 23, -1094730640)
    a = md5hh(a, b, c, d, M[13],  4,  681279174)
    d = md5hh(d, a, b, c, M[0],  11, -358537222)
    c = md5hh(c, d, a, b, M[3],  16, -722521979)
    b = md5hh(b, c, d, a, M[6],  23,  76029189)
    a = md5hh(a, b, c, d, M[9],   4, -640364487)
    d = md5hh(d, a, b, c, M[12], 11, -421815835)
    c = md5hh(c, d, a, b, M[15], 16,  530742520)
    b = md5hh(b, c, d, a, M[2],  23, -995338651)

    a = md5ii(a, b, c, d, M[0],   6, -198630844)
    d = md5ii(d, a, b, c, M[7],  10,  1126891415)
    c = md5ii(c, d, a, b, M[14], 15, -1416354905)
    b = md5ii(b, c, d, a, M[5],  21, -57434055)
    a = md5ii(a, b, c, d, M[12],  6,  1700485571)
    d = md5ii(d, a, b, c, M[3],  10, -1894986606)
    c = md5ii(c, d, a, b, M[10], 15, -1051523)
    b = md5ii(b, c, d, a, M[1],  21, -2054922799)
    a = md5ii(a, b, c, d, M[8],   6,  1873313359)
    d = md5ii(d, a, b, c, M[15], 10, -30611744)
    c = md5ii(c, d, a, b, M[6],  15, -1560198380)
    b = md5ii(b, c, d, a, M[13], 21,  1309151649)
    a = md5ii(a, b, c, d, M[4],   6, -145523070)
    d = md5ii(d, a, b, c, M[11], 10, -1120210379)
    c = md5ii(c, d, a, b, M[2],  15,  718787259)
    b = md5ii(b, c, d, a, M[9],  21, -343485551)

    a0 = safeAdd(a0, a)
    b0 = safeAdd(b0, b)
    c0 = safeAdd(c0, c)
    d0 = safeAdd(d0, d)
  }

  function le32ToHex(n: number): string {
    // Output in little-endian byte order as hex
    return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  return le32ToHex(a0) + le32ToHex(b0) + le32ToHex(c0) + le32ToHex(d0)
}

// ── Signature verification ────────────────────────────────────────────────────

interface ClickParams {
  click_trans_id:       string
  service_id:           string
  merchant_trans_id:    string
  merchant_prepare_id?: string
  amount:               string | number
  action:               number
  sign_time:            string
  sign_string:          string
}

function verifyClickSign(params: ClickParams, secretKey: string): boolean {
  const preparePart = params.action === 1
    ? (params.merchant_prepare_id ?? '')
    : ''

  const str = [
    params.click_trans_id,
    params.service_id,
    secretKey,
    params.merchant_trans_id,
    preparePart,
    params.amount,
    params.action,
    params.sign_time,
  ].join('')

  return md5(str) === params.sign_string
}

// ── Parse form-encoded body ───────────────────────────────────────────────────

async function parseFormBody(req: Request): Promise<Record<string, string>> {
  const text = await req.text()
  const result: Record<string, string> = {}
  for (const pair of text.split('&')) {
    const idx = pair.indexOf('=')
    if (idx === -1) continue
    try {
      result[decodeURIComponent(pair.slice(0, idx).replace(/\+/g, ' '))] =
        decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, ' '))
    } catch (_) {}
  }
  return result
}

// ── PREPARE handler (action=0) ────────────────────────────────────────────────

async function handlePrepare(params: Record<string, string>): Promise<Response> {
  const clickTransId    = params['click_trans_id']    ?? ''
  const serviceId       = params['service_id']        ?? ''
  const merchantTransId = params['merchant_trans_id'] ?? ''
  const amount          = parseFloat(params['amount'] ?? '0')
  const action          = parseInt(params['action']   ?? '0', 10)
  const signTime        = params['sign_time']         ?? ''
  const signString      = params['sign_string']       ?? ''

  if (action !== 0) {
    return clickResp(CLICK_ERR_ACTION, 'Incorrect action for prepare')
  }

  // ── Click URL validation probe ────────────────────────────────────────────
  // Click sends a POST probe with click_trans_id=0 (or empty) to verify the
  // Prepare URL before saving it. We must respond with error:0 immediately,
  // without signature verification (test probes have no valid signature).
  if (!clickTransId || clickTransId === '0') {
    console.log('[click] prepare probe detected (click_trans_id=0), returning OK')
    return clickResp(CLICK_OK, 'OK', {
      click_trans_id:      clickTransId || '0',
      merchant_trans_id:   merchantTransId || '0',
      merchant_prepare_id: 0,
    })
  }

  // merchant_trans_id = "userId:plan"
  const parts  = merchantTransId.split(':')
  const userId = parts[0] ?? ''
  const plan   = parts[1] ?? ''

  const product   = await getProductByUserId(userId)
  const secretKey = await getClickKey(product)
  if (!secretKey) {
    return clickResp(CLICK_ERR_INTERNAL, 'Click not configured')
  }

  const signOk = verifyClickSign({
    click_trans_id:    clickTransId,
    service_id:        serviceId,
    merchant_trans_id: merchantTransId,
    amount,
    action,
    sign_time:         signTime,
    sign_string:       signString,
  }, secretKey)

  if (!signOk) {
    return clickResp(CLICK_ERR_SIGN, 'Invalid sign')
  }

  const { data: user } = await supabaseAdmin
    .from('users').select('id').eq('id', userId).maybeSingle()
  if (!user) {
    return clickResp(CLICK_ERR_NOT_FOUND, 'User not found')
  }

  const expectedAmount = await getPlanPriceUzs(plan, product)
  if (!expectedAmount) {
    return clickResp(CLICK_ERR_NOT_FOUND, 'Unknown plan')
  }
  if (Math.round(amount) !== expectedAmount) {
    return clickResp(CLICK_ERR_INCORRECT_PARAM, `Invalid amount. Expected ${expectedAmount}`)
  }

  // Idempotency
  const existing = await findClickSub(clickTransId)
  if (existing) {
    if (existing.status === 'cancelled') {
      return clickResp(CLICK_ERR_CANCELLED, 'Transaction cancelled')
    }
    if (existing.status === 'active') {
      return clickResp(CLICK_ERR_ALREADY_PAID, 'Already paid')
    }
    return clickResp(CLICK_OK, 'OK', {
      click_trans_id:      clickTransId,
      merchant_trans_id:   merchantTransId,
      merchant_prepare_id: existing.id,
    })
  }

  const { data: newRec, error: insertErr } = await supabaseAdmin
    .from('subscriptions')
    .insert({
      user_id:                  userId,
      plan,
      amount_uzs:               expectedAmount,
      provider:                 'click',
      status:                   'pending',
      provider_transaction_id:  `click:${clickTransId}`,
      period_months:            PLAN_PERIOD_MONTHS[plan] ?? 1,
      create_time_ms:           Date.now(),
      raw_payload:              JSON.stringify({ action: 0, params }),
    })
    .select()
    .single()

  if (insertErr || !newRec) {
    console.error('[click] prepare insert error:', insertErr?.message)
    return clickResp(CLICK_ERR_INTERNAL, 'DB error')
  }

  return clickResp(CLICK_OK, 'OK', {
    click_trans_id:      clickTransId,
    merchant_trans_id:   merchantTransId,
    merchant_prepare_id: newRec.id,
  })
}

// ── COMPLETE handler (action=1) ───────────────────────────────────────────────

async function handleComplete(params: Record<string, string>): Promise<Response> {
  const clickTransId      = params['click_trans_id']      ?? ''
  const serviceId         = params['service_id']          ?? ''
  const merchantTransId   = params['merchant_trans_id']   ?? ''
  const merchantPrepareId = params['merchant_prepare_id'] ?? ''
  const amount            = parseFloat(params['amount']   ?? '0')
  const action            = parseInt(params['action']     ?? '0', 10)
  const error             = parseInt(params['error']      ?? '0', 10)
  const signTime          = params['sign_time']           ?? ''
  const signString        = params['sign_string']         ?? ''

  if (action !== 1) {
    return clickResp(CLICK_ERR_ACTION, 'Incorrect action for complete')
  }

  // ── Click URL validation probe ────────────────────────────────────────────
  // Click sends a POST probe with click_trans_id=0 to verify the Complete URL.
  // Must respond with error:0 immediately, before signature verification.
  if (!clickTransId || clickTransId === '0') {
    console.log('[click] complete probe detected (click_trans_id=0), returning OK')
    return clickResp(CLICK_OK, 'OK', {
      click_trans_id:      clickTransId || '0',
      merchant_trans_id:   merchantTransId || '0',
      merchant_confirm_id: 0,
    })
  }

  const userId2   = (merchantTransId.split(':')[0]) ?? ''
  const product   = await getProductByUserId(userId2)
  const secretKey = await getClickKey(product)
  if (!secretKey) {
    return clickResp(CLICK_ERR_INTERNAL, 'Click not configured')
  }

  const signOk = verifyClickSign({
    click_trans_id:      clickTransId,
    service_id:          serviceId,
    merchant_trans_id:   merchantTransId,
    merchant_prepare_id: merchantPrepareId,
    amount,
    action,
    sign_time:           signTime,
    sign_string:         signString,
  }, secretKey)

  if (!signOk) {
    return clickResp(CLICK_ERR_SIGN, 'Invalid sign')
  }

  // Find by click_trans_id first, then by merchant_prepare_id (Supabase row id)
  let rec = await findClickSub(clickTransId)
  if (!rec && merchantPrepareId) {
    const { data } = await supabaseAdmin
      .from('subscriptions').select('*').eq('id', merchantPrepareId).maybeSingle()
    rec = data
  }
  if (!rec) {
    return clickResp(CLICK_ERR_NOT_FOUND, 'Transaction not found')
  }

  // Click sends error < 0 when user cancels
  if (error < 0) {
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'cancelled', cancel_time_ms: Date.now(), cancel_reason: error })
      .eq('id', rec.id)
    return clickResp(CLICK_OK, 'Cancelled', {
      click_trans_id:      clickTransId,
      merchant_trans_id:   merchantTransId,
      merchant_confirm_id: rec.id,
    })
  }

  if (rec.status === 'active') {
    return clickResp(CLICK_ERR_ALREADY_PAID, 'Already paid', {
      click_trans_id:      clickTransId,
      merchant_trans_id:   merchantTransId,
      merchant_confirm_id: rec.id,
    })
  }

  if (rec.status === 'cancelled') {
    return clickResp(CLICK_ERR_CANCELLED, 'Cancelled')
  }

  const userId  = rec.user_id
  const plan    = rec.plan
  const months  = Number(rec.period_months) || 1
  const expires = addMonths(months)

  const { error: updateErr } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status:          'active',
      perform_time_ms: Date.now(),
      expires_at:      expires,
    })
    .eq('id', rec.id)

  if (updateErr) {
    console.error('[click] complete update error:', updateErr.message)
    return clickResp(CLICK_ERR_INTERNAL, 'DB error')
  }

  // Отменяем предыдущие активные подписки (апгрейд / продление)
  await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'expired', expires_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'active')
    .neq('id', rec.id)

  // Обновляем план пользователя с повторной попыткой при ошибке
  const doUpgradePlan = async () => {
    const { error: planErr } = await supabaseAdmin.from('users').update({ plan }).eq('id', userId)
    if (planErr) throw planErr
  }
  try {
    await doUpgradePlan()
  } catch (e) {
    console.error('[click] upgradePlan failed, retrying in 2s...', e)
    await new Promise(r => setTimeout(r, 2000))
    try {
      await doUpgradePlan()
      console.warn('[click] upgradePlan succeeded on retry for userId:', userId)
    } catch (e2) {
      // Платёж зафиксирован в subscriptions, но план не обновлён.
      // При следующем входе пользователя план можно восстановить по таблице subscriptions.
      console.error('[click] upgradePlan FAILED after retry. userId:', userId, 'plan:', plan, 'error:', e2)
    }
  }

  // Восстанавливаем данные, деактивированные при истечении предыдущей подписки
  await restoreAfterRenewal(userId)

  return clickResp(CLICK_OK, 'OK', {
    click_trans_id:      clickTransId,
    merchant_trans_id:   merchantTransId,
    merchant_confirm_id: rec.id,
  })
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Click validates URLs by sending GET/HEAD requests — respond with 200 OK
  if (req.method === 'GET' || req.method === 'HEAD') {
    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Parse form-encoded body
  let formParams: Record<string, string>
  try {
    formParams = await parseFormBody(req)
  } catch (_) {
    return clickResp(CLICK_ERR_INCORRECT_PARAM, 'Cannot parse body')
  }

  // Route by URL path (/prepare or /complete) OR by action field in body
  const url      = new URL(req.url)
  const pathname = url.pathname.toLowerCase()
  const byPath   = pathname.endsWith('/prepare') ? 0
                 : pathname.endsWith('/complete') ? 1
                 : null

  const action = byPath !== null
    ? byPath
    : parseInt(formParams['action'] ?? '-99', 10)

  console.log(`[click] path=${pathname} action=${action}`)

  if (action === 0) {
    return handlePrepare(formParams)
  } else if (action === 1) {
    return handleComplete(formParams)
  } else {
    return clickResp(CLICK_ERR_ACTION, 'Unknown action')
  }
})
