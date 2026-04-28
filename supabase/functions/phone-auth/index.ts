/**
 * Edge Function: phone-auth
 *
 * POST /functions/v1/phone-auth
 *
 * Actions:
 *   send_code  — Find user by phone, generate code, send via our TG bot
 *   verify_code — Check code from phone_codes table, return session tokens
 *
 * Env: TG_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Normalize phone: strip spaces/dashes, ensure leading +
function normalizePhone(raw: string): string {
  let phone = raw.replace(/[\s\-()]/g, '')
  if (!phone.startsWith('+')) phone = '+' + phone
  return phone
}

// Generate random 6-digit code
function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// ── Send message via our Telegram bot ────────────────────────────────────────

async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  })
  return resp.ok
}

// ── Create Supabase session (magic link pattern from tg-auth) ────────────────

async function createSession(userId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''

  const { data: { user: authUser }, error: getUserErr } =
    await supabaseAdmin.auth.admin.getUserById(userId)

  if (getUserErr || !authUser?.email) {
    throw new Error('user_fetch_failed: ' + (getUserErr?.message ?? 'no email'))
  }

  // Generate magic link
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
    throw new Error('link_generation_failed: ' + await linkResp.text())
  }

  const { hashed_token } = await linkResp.json()
  if (!hashed_token) throw new Error('no_hashed_token')

  // Exchange token for session
  const verifyResp = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey || serviceKey,
    },
    body: JSON.stringify({ type: 'magiclink', token_hash: hashed_token }),
  })

  if (!verifyResp.ok) {
    throw new Error('verify_failed: ' + await verifyResp.text())
  }

  const session = await verifyResp.json()
  if (!session.access_token) throw new Error('no_access_token')

  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: 'bearer',
    expires_in: session.expires_in,
    user: session.user,
  }
}

// ── Find user by phone ───────────────────────────────────────────────────────
// Looks in master_profiles first (owners/masters), then falls back to
// team_members (sotrudники, у которых tg_chat_id хранится в team_members).

async function findUserByPhone(phone: string): Promise<{ user_id: string; tg_chat_id: string } | null> {
  // 1. master_profiles — обычные мастера (владельцы)
  const { data } = await supabaseAdmin
    .from('master_profiles')
    .select('user_id, tg_chat_id')
    .eq('phone', phone)
    .maybeSingle()

  if (data?.user_id && data?.tg_chat_id) return data

  // 2. master_profiles без leading +
  const phoneNoPlus = phone.startsWith('+') ? phone.slice(1) : phone
  const { data: data2 } = await supabaseAdmin
    .from('master_profiles')
    .select('user_id, tg_chat_id')
    .eq('phone', phoneNoPlus)
    .maybeSingle()

  if (data2?.user_id && data2?.tg_chat_id) return data2

  // 3. team_only_for сотрудники: ищем через auth.users.phone → team_members.tg_chat_id
  // (team_only_for users не имеют master_profiles)
  // get_auth_user_id_by_phone returns scalar UUID or null
  const { data: userId } = await supabaseAdmin
    .rpc('get_auth_user_id_by_phone', { p_phone: phone })

  if (!userId) return null

  // Look up tg_chat_id from team_members
  const { data: member } = await supabaseAdmin
    .from('team_members')
    .select('tg_chat_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (member?.tg_chat_id) {
    return { user_id: userId, tg_chat_id: member.tg_chat_id }
  }

  return null
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ message: 'Method not allowed' }, 405)
  }

  const botToken = Deno.env.get('TG_BOT_TOKEN')
  if (!botToken) {
    return json({ message: 'TG_BOT_TOKEN not configured' }, 500)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ message: 'Invalid JSON body' }, 400)
  }

  const action = String(body.action || '')

  // ── ACTION: send_code ────────────────────────────────────────────────────

  if (action === 'send_code') {
    const rawPhone = String(body.phone || '')
    if (!rawPhone || rawPhone.replace(/\D/g, '').length < 7) {
      return json({ message: 'Valid phone number required' }, 400)
    }

    const phone = normalizePhone(rawPhone)

    // Find user by phone — must be registered
    const profile = await findUserByPhone(phone)
    if (!profile) {
      return json({ message: 'not_found' }, 404)
    }

    // Generate code and save to phone_codes table
    const code = generateCode()
    const { error: insertErr } = await supabaseAdmin
      .from('phone_codes')
      .insert({
        phone,
        code,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })

    if (insertErr) {
      console.error('[phone-auth] insert code error:', insertErr)
      return json({ message: 'Failed to generate code' }, 500)
    }

    // Send code via our Telegram bot
    const sent = await sendTelegramMessage(
      botToken,
      profile.tg_chat_id,
      `🔐 <b>Код для входа:</b> <code>${code}</code>\n\nДействителен 5 минут. Никому не сообщайте этот код.`
    )

    if (!sent) {
      console.error('[phone-auth] failed to send TG message to', profile.tg_chat_id)
      await supabaseAdmin.from('phone_codes').delete().eq('phone', phone).eq('code', code)
      return json({ message: 'telegram_send_failed' }, 500)
    }

    console.log('[phone-auth] code sent to tg_chat_id:', profile.tg_chat_id)
    return json({ ok: true, phone })
  }

  // ── ACTION: verify_code ──────────────────────────────────────────────────

  if (action === 'verify_code') {
    const rawPhone = String(body.phone || '')
    const code = String(body.code || '')

    if (!rawPhone || !code) {
      return json({ message: 'phone and code required' }, 400)
    }

    const phone = normalizePhone(rawPhone)

    // Find valid code in phone_codes table
    const { data: codeRow } = await supabaseAdmin
      .from('phone_codes')
      .select('id')
      .eq('phone', phone)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!codeRow) {
      // Also try without +
      const phoneNoPlus = phone.startsWith('+') ? phone.slice(1) : phone
      const { data: codeRow2 } = await supabaseAdmin
        .from('phone_codes')
        .select('id')
        .eq('phone', phoneNoPlus)
        .eq('code', code)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!codeRow2) {
        return json({ message: 'invalid_code' }, 401)
      }

      // Mark as used
      await supabaseAdmin.from('phone_codes').update({ used: true }).eq('id', codeRow2.id)
    } else {
      // Mark as used
      await supabaseAdmin.from('phone_codes').update({ used: true }).eq('id', codeRow.id)
    }

    // Find user and create session
    const profile = await findUserByPhone(phone)
    if (!profile) {
      return json({ message: 'not_found' }, 404)
    }

    try {
      const session = await createSession(profile.user_id)
      return json(session)
    } catch (e) {
      return json({ message: (e as Error).message }, 500)
    }
  }

  return json({ message: 'Unknown action. Use send_code or verify_code' }, 400)
})
