/**
 * Edge Function: team-employee-register
 *
 * Registers a new EMPLOYEE (team_only_for user) via Telegram bot invitation.
 * Called by tg_master_bot.js when an employee taps invite link and shares contact.
 *
 * POST /functions/v1/team-employee-register
 * Body: {
 *   invite_code:  string,          // from /start=join_<code>
 *   phone:        string,          // from message.contact.phone_number
 *   tg_chat_id:   string,          // employee's TG chat
 *   first_name:   string,
 *   last_name?:   string,
 *   tg_username?: string,
 * }
 *
 * Returns: {
 *   ok: true,
 *   user_id: string,
 *   team_id: string,
 *   team_name: string,
 *   role: string,
 *   product: string,
 *   access_token: string,
 *   refresh_token: string,
 * }
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

// Normalize phone: strip everything except digits, ensure leading +
function normalizePhone(raw: string): string {
  let phone = String(raw || '').replace(/[\s\-()]/g, '')
  if (!phone.startsWith('+')) phone = '+' + phone.replace(/\D/g, '')
  return phone
}

// Generate session tokens via magic-link pattern (same as tg-auth)
async function createSessionTokens(userId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''

  const { data: { user }, error } =
    await supabaseAdmin.auth.admin.getUserById(userId)
  if (error || !user?.email) {
    throw new Error('user_fetch_failed: ' + (error?.message ?? 'no email'))
  }

  // Generate magic link
  const linkResp = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ type: 'magiclink', email: user.email }),
  })
  if (!linkResp.ok) {
    throw new Error('link_generation_failed: ' + (await linkResp.text()))
  }
  const { hashed_token } = await linkResp.json()
  if (!hashed_token) throw new Error('no_hashed_token')

  // Verify token to get session
  const verifyResp = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey || serviceKey,
    },
    body: JSON.stringify({ type: 'magiclink', token_hash: hashed_token }),
  })
  if (!verifyResp.ok) {
    throw new Error('verify_failed: ' + (await verifyResp.text()))
  }
  const session = await verifyResp.json()
  if (!session.access_token) throw new Error('no_access_token')

  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ message: 'Method not allowed' }, 405)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ message: 'Invalid JSON body' }, 400)
  }

  const inviteCode = String(body.invite_code || '').trim()
  const rawPhone = String(body.phone || '')
  const tgChatId = String(body.tg_chat_id || '')
  const firstName = String(body.first_name || '').trim()
  const lastName = String(body.last_name || '').trim()
  const tgUsername = String(body.tg_username || '').trim()

  if (!inviteCode || !rawPhone || !tgChatId) {
    return json({ message: 'invite_code, phone, tg_chat_id required' }, 400)
  }

  const phone = normalizePhone(rawPhone)

  // 1. Validate invite
  const { data: invite, error: inviteErr } = await supabaseAdmin
    .from('team_invites')
    .select('id, team_id, code, expires_at, max_uses, use_count, is_active, label, teams(id, name, owner_id, product)')
    .eq('code', inviteCode)
    .maybeSingle()

  if (inviteErr || !invite) {
    return json({ message: 'invite_not_found' }, 404)
  }
  if (!invite.is_active) {
    return json({ message: 'invite_inactive' }, 400)
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return json({ message: 'invite_expired' }, 400)
  }
  if (invite.max_uses && invite.use_count >= invite.max_uses) {
    return json({ message: 'invite_used_up' }, 400)
  }

  const team: any = invite.teams
  if (!team?.id) {
    return json({ message: 'team_not_found' }, 404)
  }

  // 2. Check team_members seat limit (read app_settings.plan_seat_pricing)
  const product = team.product || 'beauty'

  // Owner's plan
  const { data: ownerData } = await supabaseAdmin
    .from('users')
    .select('plan')
    .eq('id', team.owner_id)
    .maybeSingle()
  const ownerPlan = ownerData?.plan || 'free'

  // Active member count
  const { count: activeMembers } = await supabaseAdmin
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', team.id)
    .eq('status', 'active')
  const memberCount = activeMembers || 0

  // plan_seat_pricing config
  const { data: psp } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('product', product)
    .eq('key', 'plan_seat_pricing')
    .maybeSingle()

  let maxSeats = 0
  try {
    const cfg = psp?.value ? JSON.parse(psp.value) : {}
    maxSeats = cfg?.[ownerPlan]?.max_seats ?? 0
  } catch { /* ignore */ }

  if (maxSeats > 0 && memberCount >= maxSeats) {
    return json({ message: 'seat_limit_reached', max_seats: maxSeats }, 403)
  }

  // 3. Check phone uniqueness — phone must not already be registered
  // get_auth_user_id_by_phone returns UUID or null
  const { data: existingByPhone } = await supabaseAdmin
    .rpc('get_auth_user_id_by_phone', { p_phone: phone })

  // Fallback: also check master_profiles.phone
  const { data: existingMaster } = await supabaseAdmin
    .from('master_profiles')
    .select('user_id')
    .eq('phone', phone)
    .maybeSingle()

  if (existingByPhone || existingMaster) {
    return json({ message: 'phone_already_registered' }, 409)
  }

  // 4. Check tg_chat_id uniqueness — already a different user?
  const { data: existingByTg } = await supabaseAdmin
    .from('team_members')
    .select('user_id, team_id')
    .eq('tg_chat_id', tgChatId)
    .eq('status', 'active')
    .maybeSingle()

  if (existingByTg) {
    return json({
      message: 'tg_chat_already_linked',
      team_id: existingByTg.team_id,
    }, 409)
  }

  // 5. Create auth user
  // Email pattern: tg_{chatId}@team.ezze.site (separate namespace from owner masters)
  const email = `team_${tgChatId}@team.ezze.site`
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'Сотрудник'

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    phone: phone.startsWith('+') ? phone : '+' + phone,
    phone_confirm: true,
    email_confirm: true,
    user_metadata: {
      name: fullName,
      tg_chat_id: tgChatId,
      tg_username: tgUsername || null,
      team_only_for: team.id,
      role: invite.label || 'operator',
      product,
    },
  })

  if (createErr || !created?.user) {
    console.error('[team-employee-register] createUser error:', createErr)
    return json({ message: 'user_create_failed: ' + (createErr?.message ?? 'unknown') }, 500)
  }

  const userId = created.user.id

  // 6. Set team_only_for + product on public.users
  // Trigger handle_new_user has already inserted public.users record from auth signup
  const { error: updateUserErr } = await supabaseAdmin
    .from('users')
    .update({
      team_only_for: team.id,
      onboarded: true,
    })
    .eq('id', userId)

  if (updateUserErr) {
    console.error('[team-employee-register] update users error:', updateUserErr)
  }

  // 7. Create team_members record
  const role = (invite.label || 'operator').toLowerCase()
  const validRoles = ['admin', 'operator', 'worker', 'member']
  const finalRole = validRoles.includes(role) ? role : 'operator'

  const { error: tmErr } = await supabaseAdmin
    .from('team_members')
    .insert({
      team_id: team.id,
      user_id: userId,
      role: finalRole,
      status: 'active',
      tg_chat_id: tgChatId,
    })

  if (tmErr) {
    console.error('[team-employee-register] team_members insert error:', tmErr)
    // Cleanup: delete the user we just created
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {})
    return json({ message: 'team_member_create_failed: ' + tmErr.message }, 500)
  }

  // 8. Increment invite use_count
  await supabaseAdmin
    .from('team_invites')
    .update({ use_count: (invite.use_count || 0) + 1 })
    .eq('id', invite.id)

  // 9. Update subscription seats count for the owner (per-seat billing)
  const { error: seatErr } = await supabaseAdmin.rpc('refresh_subscription_seats', {
    p_owner_id: team.owner_id,
  })
  if (seatErr) {
    console.error('[team-employee-register] refresh_subscription_seats error:', seatErr)
    // Non-fatal: subscription stays out-of-date until next refresh
  }

  // 10. Generate session tokens for auto-login
  let session: { access_token: string; refresh_token: string } | null = null
  try {
    session = await createSessionTokens(userId)
  } catch (e) {
    console.error('[team-employee-register] session creation failed:', e)
    // Not fatal — employee can still log in via phone+code (Day 5.5)
  }

  return json({
    ok: true,
    user_id: userId,
    team_id: team.id,
    team_name: team.name,
    role: finalRole,
    product,
    access_token: session?.access_token || null,
    refresh_token: session?.refresh_token || null,
  })
})
