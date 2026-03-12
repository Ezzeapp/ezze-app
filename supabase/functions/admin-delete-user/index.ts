/**
 * Edge Function: admin-delete-user
 * Replaces pb_hooks/admin_delete_user.pb.js
 *
 * POST /functions/v1/admin-delete-user
 * Body: { userId: string }
 *
 * Full cascade delete of a user and all their data.
 * Caller must be authenticated and have is_admin = true in public.users.
 *
 * Deletion order:
 *  1. email_log        WHERE appointment_id IN (appointments of master)
 *  2. appointment_services WHERE appointment_id IN (appointments of master)
 *  3. service_materials WHERE service_id IN (services of master)
 *  4. inventory_receipts WHERE inventory_item_id IN (inventory_items of master)
 *  5. appointments, clients, services, service_categories, inventory_items WHERE master_id = userId
 *  6. schedules, schedule_breaks, date_blocks, reviews, promo_codes,
 *     notification_settings WHERE master_id = userId
 *  7. master_profiles, subscriptions WHERE user_id = userId
 *  8. team_members WHERE user_id = userId
 *  9. copy_snapshots WHERE source_user_id = userId
 * 10. users WHERE id = userId  (public profile row)
 * 11. supabase.auth.admin.deleteUser(userId)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// ── Helper: delete rows from a table by a filter column = value ───────────────

async function deleteWhere(table: string, column: string, value: string) {
  await supabaseAdmin.from(table).delete().eq(column, value)
}

// ── Helper: delete rows where column IN (subquery ids) ───────────────────────

async function deleteWhereIn(table: string, column: string, ids: string[]) {
  if (!ids.length) return
  await supabaseAdmin.from(table).delete().in(column, ids)
}

// ── Collect IDs from a table ──────────────────────────────────────────────────

async function collectIds(table: string, column: string, value: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from(table)
    .select('id')
    .eq(column, value)
  return (data ?? []).map((r: { id: string }) => r.id)
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 1. Authenticate caller via Authorization header (Supabase JWT)
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')

  if (!jwt) {
    return new Response(JSON.stringify({ message: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Create a caller client using their JWT to verify identity
  const supabaseCaller = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  )

  const { data: { user: callerUser }, error: callerError } = await supabaseCaller.auth.getUser()
  if (callerError || !callerUser) {
    return new Response(JSON.stringify({ message: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Check is_admin flag in public.users
  const { data: callerProfile } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('id', callerUser.id)
    .maybeSingle()

  if (!callerProfile?.is_admin) {
    return new Response(JSON.stringify({ message: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 2. Parse body
  let userId = ''
  try {
    const body = await req.json()
    userId = String(body?.userId || body?.userid || '')
  } catch (_) {
    return new Response(JSON.stringify({ message: 'invalid body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!userId) {
    return new Response(JSON.stringify({ message: 'userId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Cannot delete self
  if (callerUser.id === userId) {
    return new Response(JSON.stringify({ message: 'cannot_delete_self' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Cannot delete admin accounts
  const { data: targetUser } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .single()
  if (targetUser?.is_admin) {
    return new Response(JSON.stringify({ message: 'cannot_delete_admin' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // ── Step 1: email_log via appointments ────────────────────────────────────
    const apptIds = await collectIds('appointments', 'master_id', userId)
    await deleteWhereIn('email_log', 'appointment_id', apptIds)

    // ── Step 2: appointment_services via appointments ─────────────────────────
    await deleteWhereIn('appointment_services', 'appointment_id', apptIds)

    // ── Step 3: service_materials via services ────────────────────────────────
    const serviceIds = await collectIds('services', 'master_id', userId)
    await deleteWhereIn('service_materials', 'service_id', serviceIds)

    // ── Step 4: inventory_receipts via inventory_items ────────────────────────
    const inventoryIds = await collectIds('inventory_items', 'master_id', userId)
    await deleteWhereIn('inventory_receipts', 'inventory_item_id', inventoryIds)

    // ── Step 5: Main collections by master_id ─────────────────────────────────
    await deleteWhere('appointments',       'master_id', userId)
    await deleteWhere('clients',            'master_id', userId)
    await deleteWhere('services',           'master_id', userId)
    await deleteWhere('service_categories', 'master_id', userId)
    await deleteWhere('inventory_items',    'master_id', userId)

    // ── Step 6: Schedule and misc collections by master_id ────────────────────
    await deleteWhere('schedules',              'master_id', userId)
    await deleteWhere('schedule_breaks',        'master_id', userId)
    await deleteWhere('date_blocks',            'master_id', userId)
    await deleteWhere('reviews',                'master_id', userId)
    await deleteWhere('promo_codes',            'master_id', userId)
    await deleteWhere('notification_settings',  'master_id', userId)

    // ── Step 7: Profile and subscription by user_id ───────────────────────────
    await deleteWhere('master_profiles', 'user_id', userId)
    await deleteWhere('subscriptions',   'user_id', userId)

    // ── Step 8: Team membership ───────────────────────────────────────────────
    await deleteWhere('team_members', 'user_id', userId)

    // ── Step 9: Copy snapshots ────────────────────────────────────────────────
    await deleteWhere('copy_snapshots', 'source_user_id', userId)

    // ── Step 10: Public users row ─────────────────────────────────────────────
    await supabaseAdmin.from('users').delete().eq('id', userId)

    // ── Step 11: Delete from auth.users ──────────────────────────────────────
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteAuthError) {
      // Log but don't fail — public data is already cleaned up
      console.error('[admin-delete-user] auth.admin.deleteUser error:', deleteAuthError.message)
    }

    return new Response(JSON.stringify({ message: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ message: 'delete failed: ' + String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
