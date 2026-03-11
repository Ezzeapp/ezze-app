/**
 * Edge Function: tg-widget-login
 * Replaces pb_hooks/tg_widget_login.pb.js
 *
 * POST /functions/v1/tg-widget-login
 * Body: { id, first_name, last_name?, username?, auth_date, hash }
 *
 * Login via official Telegram Login Widget (website, not Mini App).
 * Widget sends Telegram user data; we find the account by tg_chat_id.
 *
 * Signature verification for Login Widget is different from Mini App:
 *   data_check_string = sorted "key=value" pairs (excluding hash) joined by \n
 *   secret_key        = SHA-256(bot_token)   ← NOT HMAC("WebAppData", bot_token)
 *   expected_hash     = HMAC-SHA256(secret_key, data_check_string)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// ── Telegram Login Widget signature verification ──────────────────────────────

async function verifyWidgetHash(
  data: Record<string, string>,
  botToken: string
): Promise<boolean> {
  const receivedHash = data['hash']
  if (!receivedHash) return false

  // Build data-check-string: sorted key=value pairs excluding hash
  const entries: string[] = []
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'hash') entries.push(`${key}=${value}`)
  }
  entries.sort()
  const dataCheckString = entries.join('\n')

  const encoder = new TextEncoder()

  // secret_key = SHA-256(bot_token) — raw bytes
  const secretKeyBytes = await crypto.subtle.digest('SHA-256', encoder.encode(botToken))

  // expected_hash = HMAC-SHA256(secret_key, data_check_string)
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    secretKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBytes = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(dataCheckString))

  const signatureHex = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return signatureHex === receivedHash
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 1. Parse body
  let body: Record<string, string>
  try {
    body = await req.json()
  } catch (_) {
    return new Response(JSON.stringify({ message: 'invalid_data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const tgId = String(body?.id || '')
  const authDate = parseInt(String(body?.auth_date || '0'), 10)

  if (!tgId || !authDate) {
    return new Response(JSON.stringify({ message: 'invalid_data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 2. Check freshness — max 24 hours
  const now = Math.floor(Date.now() / 1000)
  if (now - authDate > 86400) {
    return new Response(JSON.stringify({ message: 'auth_data_expired' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 3. Verify signature
  const botToken = Deno.env.get('TG_BOT_TOKEN') || ''
  if (botToken) {
    // Convert all values to strings for hash verification
    const dataForVerify: Record<string, string> = {}
    for (const [k, v] of Object.entries(body)) {
      dataForVerify[k] = String(v)
    }
    const valid = await verifyWidgetHash(dataForVerify, botToken)
    if (!valid) {
      return new Response(JSON.stringify({ message: 'invalid_hash' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  // 4. Find master — Step A: by tg_chat_id in master_profiles
  let userId = ''

  const { data: profileRow } = await supabaseAdmin
    .from('master_profiles')
    .select('user_id')
    .eq('tg_chat_id', tgId)
    .maybeSingle()

  if (profileRow?.user_id) {
    userId = profileRow.user_id
  }

  // Step B: fallback — find user by email tg_{id}@ezze.site
  if (!userId) {
    const tgEmail = `tg_${tgId}@ezze.site`
    const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers()
    const matchedUser = authUsers?.find((u) => u.email === tgEmail)

    if (matchedUser) {
      userId = matchedUser.id

      // Sync tg_chat_id so Step A works next time
      const { data: profToFix } = await supabaseAdmin
        .from('master_profiles')
        .select('id, tg_chat_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (profToFix && !profToFix.tg_chat_id) {
        await supabaseAdmin
          .from('master_profiles')
          .update({ tg_chat_id: tgId })
          .eq('id', profToFix.id)
      }
    }
  }

  if (!userId) {
    return new Response(JSON.stringify({ message: 'not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 5. Create session (7-day token)
  const { data: sessionData, error: sessionError } =
    await supabaseAdmin.auth.admin.createSession({ userId })

  if (sessionError || !sessionData?.session) {
    return new Response(
      JSON.stringify({ message: 'auth_failed: ' + (sessionError?.message ?? 'no session') }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      token_type: 'bearer',
      expires_in: sessionData.session.expires_in,
      user: sessionData.session.user,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
