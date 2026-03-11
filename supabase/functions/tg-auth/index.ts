/**
 * Edge Function: tg-auth
 * Replaces pb_hooks/tg_auth.pb.js
 *
 * POST /functions/v1/tg-auth
 * Body: { initData: string }  ← Telegram WebApp.initData
 *
 * Logic:
 *  1. Parse and validate Telegram initData (HMAC-SHA256)
 *  2. Check auth_date freshness (max 24h)
 *  3. Extract tg user_id
 *  4. Search master_profiles by tg_chat_id
 *  5. Fallback: search auth.users by email tg_{id}@ezze.site
 *  6. If found: create session via admin API → return tokens
 *  7. If not found: send Telegram message, return 404
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// ── Telegram HMAC-SHA256 verification ────────────────────────────────────────

async function verifyTelegramInitData(initData: string, botToken: string): Promise<boolean> {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return false

  // Build data-check-string: sorted key=value pairs (excluding hash), joined by \n
  const entries: string[] = []
  for (const [key, value] of params.entries()) {
    if (key !== 'hash') entries.push(`${key}=${value}`)
  }
  entries.sort()
  const dataCheckString = entries.join('\n')

  // secret_key = HMAC-SHA256("WebAppData", bot_token)
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const secretKeyBytes = await crypto.subtle.sign('HMAC', keyMaterial, encoder.encode(botToken))

  // signature = HMAC-SHA256(secret_key, data_check_string)
  const secretKey = await crypto.subtle.importKey(
    'raw',
    secretKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBytes = await crypto.subtle.sign('HMAC', secretKey, encoder.encode(dataCheckString))

  const signatureHex = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return signatureHex === hash
}

// ── Send Telegram message ─────────────────────────────────────────────────────

async function sendTelegramMessage(botToken: string, chatId: string, text: string, replyMarkup: unknown) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    })
  } catch (_) {
    // Non-fatal — log but don't fail the request
  }
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
  let initData = ''
  try {
    const body = await req.json()
    initData = String(body?.initData || '')
  } catch (_) {
    return new Response(JSON.stringify({ message: 'initData required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!initData) {
    return new Response(JSON.stringify({ message: 'initData required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const botToken = Deno.env.get('TG_BOT_TOKEN') || ''
  const appUrl = Deno.env.get('APP_URL') || 'https://ezze.site'

  // 2. Verify HMAC signature
  if (botToken) {
    const valid = await verifyTelegramInitData(initData, botToken)
    if (!valid) {
      return new Response(JSON.stringify({ message: 'invalid initData signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  // 3. Parse initData params
  const params: Record<string, string> = {}
  for (const pair of initData.split('&')) {
    const idx = pair.indexOf('=')
    if (idx === -1) continue
    try {
      params[decodeURIComponent(pair.slice(0, idx))] =
        decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, ' '))
    } catch (_) {}
  }

  const authDate = parseInt(params['auth_date'] || '0', 10)
  const userStr = params['user'] || ''

  if (!userStr || !authDate) {
    return new Response(JSON.stringify({ message: 'invalid initData' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Check freshness — max 24 hours
  const now = Math.floor(Date.now() / 1000)
  if (now - authDate > 86400) {
    return new Response(JSON.stringify({ message: 'initData expired' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 4. Parse Telegram user
  let tgUser: { id?: number; username?: string; first_name?: string }
  try {
    tgUser = JSON.parse(userStr)
  } catch (_) {
    return new Response(JSON.stringify({ message: 'invalid user data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const tgId = String(tgUser?.id || '')
  if (!tgId || tgId === '0') {
    return new Response(JSON.stringify({ message: 'invalid tg user id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 5. Find master — Step A: by tg_chat_id in master_profiles
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

      // Sync tg_chat_id on master_profiles so Step A works next time
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

  // 6. Not found — send TG message and return 404
  if (!userId) {
    if (botToken) {
      await sendTelegramMessage(
        botToken,
        tgId,
        '❌ <b>Аккаунт не найден</b>\n\nВаш Telegram не привязан ни к одному аккаунту в системе Ezze.\n\nЧтобы начать — зарегистрируйтесь:',
        {
          inline_keyboard: [[
            { text: '📝 Зарегистрироваться', web_app: { url: `${appUrl}/register` } },
          ]],
        }
      )
    }
    return new Response(JSON.stringify({ message: 'not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 7. Create session via generateLink + verifyOtp
  // (admin.createSession is not available in self-hosted GoTrue < v2.170)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY') || ''

  // Step 7a: Get user email
  const { data: { user: authUser }, error: getUserErr } =
    await supabaseAdmin.auth.admin.getUserById(userId)

  if (getUserErr || !authUser?.email) {
    return new Response(
      JSON.stringify({ message: 'user_fetch_failed: ' + (getUserErr?.message ?? 'no email') }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Step 7b: Generate magic link
  const linkResp = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ type: 'magiclink', email: authUser.email }),
  })

  if (!linkResp.ok) {
    const errText = await linkResp.text()
    return new Response(
      JSON.stringify({ message: 'link_generation_failed: ' + errText }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const linkData = await linkResp.json()
  const hashedToken = linkData.hashed_token

  if (!hashedToken) {
    return new Response(
      JSON.stringify({ message: 'no_hashed_token in generateLink response' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Step 7c: Exchange token for session
  const verifyResp = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey || serviceKey,
    },
    body: JSON.stringify({ type: 'magiclink', token_hash: hashedToken }),
  })

  if (!verifyResp.ok) {
    const errText = await verifyResp.text()
    return new Response(
      JSON.stringify({ message: 'verify_failed: ' + errText }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const session = await verifyResp.json()

  if (!session.access_token) {
    return new Response(
      JSON.stringify({ message: 'no_access_token in verify response' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      access_token:  session.access_token,
      refresh_token: session.refresh_token,
      token_type:    'bearer',
      expires_in:    session.expires_in,
      user:          session.user,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
