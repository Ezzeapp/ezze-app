/**
 * Edge Function: tg-widget-login
 *
 * POST /functions/v1/tg-widget-login
 * Body: { id, first_name, last_name?, username?, photo_url?, auth_date, hash }
 *   ← данные от официального Telegram Login Widget (web-браузер)
 *
 * Отличие от tg-auth (TMA):
 *   TMA:    secret_key = HMAC-SHA256("WebAppData", bot_token)
 *   Widget: secret_key = SHA256(bot_token)  ← другой алгоритм!
 *
 * Logic:
 *  1. Verify hash (SHA256-based HMAC)
 *  2. Check auth_date freshness (max 24h)
 *  3. Find master by tg_chat_id
 *  4. Fallback: find by email tg_{id}@ezze.site
 *  5. Generate session → return tokens
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// ── Telegram Login Widget HMAC verification ───────────────────────────────────
// Widget uses SHA256(bot_token) as the secret key — different from TMA initData!

async function verifyWidgetAuth(
  data: Record<string, string>,
  botToken: string
): Promise<boolean> {
  const { hash, ...rest } = data
  if (!hash) return false

  // Build data_check_string: sorted key=value pairs (excluding hash), joined by \n
  const checkString = Object.keys(rest)
    .filter((k) => rest[k] !== undefined && rest[k] !== '')
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join('\n')

  const encoder = new TextEncoder()

  // secret_key = SHA256(bot_token)
  const secretKeyBytes = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(botToken)
  )

  // signature = HMAC-SHA256(secret_key, data_check_string)
  const key = await crypto.subtle.importKey(
    'raw',
    secretKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(checkString)
  )

  const expectedHash = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return hash === expectedHash
}

// ── Session helpers ───────────────────────────────────────────────────────────

async function createSessionForUser(userId: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
  user: unknown
} | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY') || serviceKey

  const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (error || !user?.email) return null

  const linkResp = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ type: 'magiclink', email: user.email }),
  })
  if (!linkResp.ok) return null

  const { hashed_token } = await linkResp.json()
  if (!hashed_token) return null

  const verifyResp = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey,
    },
    body: JSON.stringify({ type: 'magiclink', token_hash: hashed_token }),
  })
  if (!verifyResp.ok) return null

  const session = await verifyResp.json()
  if (!session.access_token) return null

  return {
    access_token:  session.access_token,
    refresh_token: session.refresh_token,
    expires_in:    session.expires_in,
    user:          session.user,
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ message: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const { id, auth_date, hash } = body
  if (!id || !auth_date || !hash) {
    return new Response(JSON.stringify({ message: 'id, auth_date and hash are required' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const botToken = Deno.env.get('TG_BOT_TOKEN') || ''

  // Verify hash
  if (botToken) {
    const valid = await verifyWidgetAuth(body, botToken)
    if (!valid) {
      return new Response(JSON.stringify({ message: 'invalid_signature' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
  }

  // Check freshness (max 24h)
  const now = Math.floor(Date.now() / 1000)
  if (now - parseInt(auth_date, 10) > 86400) {
    return new Response(JSON.stringify({ message: 'auth_data_expired' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const tgId = String(id)

  // Find master by tg_chat_id
  let userId = ''
  const { data: profileRow } = await supabaseAdmin
    .from('master_profiles')
    .select('user_id')
    .eq('tg_chat_id', tgId)
    .maybeSingle()

  if (profileRow?.user_id) {
    userId = profileRow.user_id
  }

  // Fallback: find by email tg_{id}@ezze.site
  if (!userId) {
    const tgEmail = `tg_${tgId}@ezze.site`
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
    const matched = users?.find((u) => u.email === tgEmail)
    if (matched) {
      userId = matched.id
      // Sync tg_chat_id for faster future lookups
      const { data: prof } = await supabaseAdmin
        .from('master_profiles')
        .select('id, tg_chat_id')
        .eq('user_id', userId)
        .maybeSingle()
      if (prof && !prof.tg_chat_id) {
        await supabaseAdmin
          .from('master_profiles')
          .update({ tg_chat_id: tgId })
          .eq('id', prof.id)
      }
    }
  }

  if (!userId) {
    return new Response(JSON.stringify({ message: 'not_found' }), {
      status: 404,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const session = await createSessionForUser(userId)
  if (!session) {
    return new Response(JSON.stringify({ message: 'session_creation_failed' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(session), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
