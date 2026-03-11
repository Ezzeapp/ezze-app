/**
 * Edge Function: payme
 * Replaces pb_hooks/payme_webhook.pb.js
 *
 * POST /functions/v1/payme
 * JSONRPC 2.0 endpoint for Payme (paycom.uz)
 *
 * Methods:
 *   CheckPerformTransaction  — validate whether payment can be accepted
 *   CreateTransaction        — reserve transaction
 *   PerformTransaction       — confirm (funds charged)
 *   CancelTransaction        — cancel
 *   CheckTransaction         — get transaction status
 *   GetStatement             — list transactions for a period
 *
 * Auth: Basic Authorization: Basic base64("Paycom:" + PAYME_KEY)
 * PAYME_KEY is read from app_settings table (key = "payme_key").
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// ── Plan defaults ─────────────────────────────────────────────────────────────

const DEFAULT_PLAN_PRICES_TIYINS: Record<string, number> = {
  pro:        9900000,   // 99 000 UZS
  enterprise: 29900000,  // 299 000 UZS
}

const PLAN_PERIOD_MONTHS: Record<string, number> = {
  pro:        1,
  enterprise: 1,
}

// ── Payme error codes ─────────────────────────────────────────────────────────

const ERR = {
  INVALID_JSON:        -32700,
  METHOD_NOT_FOUND:    -32601,
  INVALID_PARAMS:      -32600,
  INTERNAL:            -32400,
  INSUFFICIENT_PRIV:   -32504,
  ORDER_NOT_FOUND:     -31099,
  TX_NOT_FOUND:        -31003,
  TX_INVALID_STATE:    -31008,
  CANT_PERFORM:        -31008,
  CANT_CANCEL:         -31006,
}

// ── Transaction states ────────────────────────────────────────────────────────

const TX_STATE_CREATED         =  1
const TX_STATE_COMPLETED       =  2
const TX_STATE_CANCELLED       = -1
const TX_STATE_CANCELLED_AFTER = -2

// ── Response helpers ──────────────────────────────────────────────────────────

function jsonResp(id: unknown, result: unknown): Response {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', id, result }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

function jsonErr(id: unknown, code: number, message: string): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: { code, message: { ru: message, en: message, uz: message } },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

function nowMs(): number {
  return Date.now()
}

function addMonths(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString().replace('T', ' ').substring(0, 19)
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function getPlanPriceTiyins(plan: string): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'plan_prices')
      .maybeSingle()
    if (data?.value) {
      const prices = JSON.parse(data.value)
      const uzs = prices[plan]
      return uzs ? uzs * 100 : 0
    }
  } catch (_) {}
  return DEFAULT_PLAN_PRICES_TIYINS[plan] ?? 0
}

async function getPaymeKey(): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'payme_key')
      .maybeSingle()
    return data?.value ?? ''
  } catch (_) {
    return ''
  }
}

async function findSubByTxId(txId: string) {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('provider_transaction_id', txId)
    .eq('provider', 'payme')
    .maybeSingle()
  return data
}

async function upgradePlan(userId: string, plan: string) {
  try {
    await supabaseAdmin.from('users').update({ plan }).eq('id', userId)
  } catch (e) {
    console.error('[payme] upgradePlan error:', e)
  }
}

// ── Method handlers ───────────────────────────────────────────────────────────

async function handleCheckPerform(id: unknown, params: Record<string, unknown>): Promise<Response> {
  const account = (params.account ?? {}) as Record<string, string>
  const userId  = account.user_id ?? ''
  const plan    = account.plan    ?? ''
  const amount  = Number(params.amount ?? 0)

  const { data: user } = await supabaseAdmin
    .from('users').select('id').eq('id', userId).maybeSingle()
  if (!user) {
    return jsonErr(id, ERR.ORDER_NOT_FOUND, 'User not found')
  }

  const expectedAmount = await getPlanPriceTiyins(plan)
  if (!expectedAmount) {
    return jsonErr(id, ERR.ORDER_NOT_FOUND, 'Unknown plan: ' + plan)
  }
  if (amount !== expectedAmount) {
    return jsonErr(id, ERR.INVALID_PARAMS,
      `Invalid amount. Expected ${expectedAmount}, got ${amount}`)
  }

  return jsonResp(id, { allow: 1 })
}

async function handleCreateTransaction(id: unknown, params: Record<string, unknown>): Promise<Response> {
  const account   = (params.account ?? {}) as Record<string, string>
  const userId    = account.user_id ?? ''
  const plan      = account.plan    ?? ''
  const amount    = Number(params.amount ?? 0)
  const paymeTime = Number(params.time   ?? nowMs())
  const txId      = String(params.id     ?? '')

  const { data: user } = await supabaseAdmin
    .from('users').select('id').eq('id', userId).maybeSingle()
  if (!user) {
    return jsonErr(id, ERR.ORDER_NOT_FOUND, 'User not found')
  }

  const expectedAmount = await getPlanPriceTiyins(plan)
  if (!expectedAmount || amount !== expectedAmount) {
    return jsonErr(id, ERR.INVALID_PARAMS, 'Invalid plan or amount')
  }

  // Idempotency: already created?
  const existing = await findSubByTxId(txId)
  if (existing) {
    const st = Number(existing.state)
    if (st === TX_STATE_CANCELLED || st === TX_STATE_CANCELLED_AFTER) {
      return jsonErr(id, ERR.TX_INVALID_STATE, 'Transaction cancelled')
    }
    return jsonResp(id, {
      create_time: existing.create_time_ms,
      transaction: existing.id,
      state:       st,
    })
  }

  const { data: newRec, error: insertErr } = await supabaseAdmin
    .from('subscriptions')
    .insert({
      user_id:                  userId,
      plan,
      amount_uzs:               Math.round(amount / 100),
      provider:                 'payme',
      status:                   'pending',
      provider_transaction_id:  txId,
      period_months:            PLAN_PERIOD_MONTHS[plan] ?? 1,
      create_time_ms:           paymeTime,
      state:                    TX_STATE_CREATED,
      raw_payload:              JSON.stringify(params),
    })
    .select()
    .single()

  if (insertErr || !newRec) {
    console.error('[payme] CreateTransaction insert error:', insertErr?.message)
    return jsonErr(id, ERR.INTERNAL, 'DB error')
  }

  return jsonResp(id, {
    create_time: paymeTime,
    transaction: newRec.id,
    state:       TX_STATE_CREATED,
  })
}

async function handlePerformTransaction(id: unknown, params: Record<string, unknown>): Promise<Response> {
  const txId        = String(params.id   ?? '')
  const performTime = Number(params.time ?? nowMs())

  const rec = await findSubByTxId(txId)
  if (!rec) {
    return jsonErr(id, ERR.TX_NOT_FOUND, 'Transaction not found')
  }

  const state = Number(rec.state)

  // Idempotency: already completed
  if (state === TX_STATE_COMPLETED) {
    return jsonResp(id, {
      perform_time: rec.perform_time_ms,
      transaction:  rec.id,
      state:        TX_STATE_COMPLETED,
    })
  }

  // Cannot perform a cancelled transaction
  if (state === TX_STATE_CANCELLED || state === TX_STATE_CANCELLED_AFTER) {
    return jsonErr(id, ERR.CANT_PERFORM, 'Transaction is cancelled')
  }

  const userId  = rec.user_id
  const plan    = rec.plan
  const months  = Number(rec.period_months) || 1
  const expires = addMonths(months)

  const { error: updateErr } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status:          'active',
      perform_time_ms: performTime,
      expires_at:      expires,
      state:           TX_STATE_COMPLETED,
    })
    .eq('id', rec.id)

  if (updateErr) {
    console.error('[payme] PerformTransaction update error:', updateErr.message)
    return jsonErr(id, ERR.INTERNAL, 'DB error')
  }

  await upgradePlan(userId, plan)

  return jsonResp(id, {
    perform_time: performTime,
    transaction:  rec.id,
    state:        TX_STATE_COMPLETED,
  })
}

async function handleCancelTransaction(id: unknown, params: Record<string, unknown>): Promise<Response> {
  const txId   = String(params.id     ?? '')
  const reason = Number(params.reason ?? 0)

  const rec = await findSubByTxId(txId)
  if (!rec) {
    return jsonErr(id, ERR.TX_NOT_FOUND, 'Transaction not found')
  }

  const state = Number(rec.state)
  const now   = nowMs()
  let newState: number

  if (state === TX_STATE_CREATED) {
    newState = TX_STATE_CANCELLED
  } else if (state === TX_STATE_COMPLETED) {
    newState = TX_STATE_CANCELLED_AFTER
    // Downgrade user plan back to free
    try {
      await supabaseAdmin.from('users').update({ plan: 'free' }).eq('id', rec.user_id)
    } catch (e) {
      console.error('[payme] CancelTransaction downgrade error:', e)
    }
  } else {
    // Already cancelled — idempotency
    return jsonResp(id, {
      cancel_time: rec.cancel_time_ms,
      transaction: rec.id,
      state,
    })
  }

  const { error: updateErr } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status:         'cancelled',
      cancel_time_ms: now,
      cancel_reason:  reason,
      state:          newState,
    })
    .eq('id', rec.id)

  if (updateErr) {
    return jsonErr(id, ERR.INTERNAL, 'DB error')
  }

  return jsonResp(id, {
    cancel_time: now,
    transaction: rec.id,
    state:       newState,
  })
}

async function handleCheckTransaction(id: unknown, params: Record<string, unknown>): Promise<Response> {
  const txId = String(params.id ?? '')
  const rec  = await findSubByTxId(txId)
  if (!rec) {
    return jsonErr(id, ERR.TX_NOT_FOUND, 'Transaction not found')
  }

  return jsonResp(id, {
    create_time:  rec.create_time_ms,
    perform_time: rec.perform_time_ms ?? 0,
    cancel_time:  rec.cancel_time_ms  ?? 0,
    transaction:  rec.id,
    state:        Number(rec.state),
    reason:       rec.cancel_reason   ?? null,
  })
}

async function handleGetStatement(id: unknown, params: Record<string, unknown>): Promise<Response> {
  const from = Number(params.from ?? 0)
  const to   = Number(params.to   ?? nowMs())

  const { data: records } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('provider', 'payme')
    .gte('create_time_ms', from)
    .lte('create_time_ms', to)
    .order('created_at', { ascending: false })
    .limit(1000)

  const transactions = (records ?? []).map((r) => ({
    id:           r.provider_transaction_id,
    time:         r.create_time_ms,
    amount:       r.amount_uzs * 100,
    account: {
      user_id: r.user_id,
      plan:    r.plan,
    },
    create_time:  r.create_time_ms,
    perform_time: r.perform_time_ms ?? 0,
    cancel_time:  r.cancel_time_ms  ?? 0,
    transaction:  r.id,
    state:        Number(r.state),
    reason:       r.cancel_reason   ?? null,
  }))

  return jsonResp(id, { transactions })
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 1. Verify Basic Auth
  const paymeKey = await getPaymeKey()
  if (!paymeKey) {
    return jsonErr(null, ERR.INSUFFICIENT_PRIV, 'Payme not configured')
  }

  const authHeader = req.headers.get('Authorization') || ''
  const expectedCredentials = btoa(`Paycom:${paymeKey}`)
  const expected = `Basic ${expectedCredentials}`
  if (authHeader !== expected) {
    return jsonErr(null, ERR.INSUFFICIENT_PRIV, 'Unauthorized')
  }

  // 2. Parse JSONRPC body
  let body: { id?: unknown; method?: string; params?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch (_) {
    return jsonErr(null, ERR.INVALID_JSON, 'Invalid JSON')
  }

  const id     = body.id     ?? null
  const method = body.method ?? ''
  const params = body.params ?? {}

  // 3. Dispatch
  switch (method) {
    case 'CheckPerformTransaction':  return handleCheckPerform(id, params)
    case 'CreateTransaction':        return handleCreateTransaction(id, params)
    case 'PerformTransaction':       return handlePerformTransaction(id, params)
    case 'CancelTransaction':        return handleCancelTransaction(id, params)
    case 'CheckTransaction':         return handleCheckTransaction(id, params)
    case 'GetStatement':             return handleGetStatement(id, params)
    default:
      return jsonErr(id, ERR.METHOD_NOT_FOUND, 'Method not found: ' + method)
  }
})
