/**
 * Edge Function: admin-send-client-message
 *
 * POST /functions/v1/admin-send-client-message
 * Body: { tg_chat_id: string, text: string }
 *
 * Отправляет сообщение клиенту через единый TG-бот платформы.
 * Caller должен быть authenticated с users.is_admin = true.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 1. Auth ──────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) {
    return new Response(JSON.stringify({ message: 'forbidden' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    })
  }
  const supabaseCaller = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  )
  const { data: { user: caller }, error: callerErr } = await supabaseCaller.auth.getUser()
  if (callerErr || !caller) {
    return new Response(JSON.stringify({ message: 'forbidden' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    })
  }
  const { data: callerRow } = await supabaseAdmin
    .from('users').select('is_admin').eq('id', caller.id).maybeSingle()
  if (!callerRow?.is_admin) {
    return new Response(JSON.stringify({ message: 'forbidden' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 2. Body ──────────────────────────────────────────────────────
  let tgChatId = ''
  let text = ''
  try {
    const body = await req.json()
    tgChatId = String(body?.tg_chat_id || '').trim()
    text     = String(body?.text       || '').trim()
  } catch (_) {
    return new Response(JSON.stringify({ message: 'invalid body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!tgChatId) {
    return new Response(JSON.stringify({ message: 'tg_chat_id required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }
  if (text.length < 1 || text.length > 4000) {
    return new Response(JSON.stringify({ message: 'text length must be 1..4000' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 3. Send (клиентский бот — тот же, с которым клиент взаимодействует)
  const botToken = Deno.env.get('TG_CLIENT_BOT_TOKEN') || Deno.env.get('TG_BOT_TOKEN') || ''
  if (!botToken) {
    return new Response(JSON.stringify({ message: 'TG_CLIENT_BOT_TOKEN not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tgChatId, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(10000),
    })
    const tgJson = await resp.json().catch(() => ({}))
    if (!resp.ok || !tgJson?.ok) {
      return new Response(JSON.stringify({
        message: 'tg_error',
        detail: tgJson?.description ?? `HTTP ${resp.status}`,
      }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({
      message: 'ok',
      tg_message_id: tgJson?.result?.message_id ?? null,
    }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ message: 'error', detail: String(err?.message ?? err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
