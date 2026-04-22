/**
 * Edge Function: admin-delete-client
 *
 * POST /functions/v1/admin-delete-client
 * Body: { phone?: string, client_id?: string }
 *   — ровно одно из двух.
 *
 * Каскадное удаление клиента платформы:
 *   • phone: удаляет TG-регистрацию и все карточки clients с этим phone
 *            (у всех мастеров), плюс все связанные записи/квитанции.
 *   • client_id: удаляет одну phone-less карточку с её записями/квитанциями.
 *
 * Caller должен быть authenticated с users.is_admin = true.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function deleteWhereIn(table: string, column: string, ids: string[]) {
  if (!ids.length) return 0
  const { count } = await supabaseAdmin
    .from(table)
    .delete({ count: 'exact' })
    .in(column, ids)
  return count ?? 0
}

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
  let phone = ''
  let clientId = ''
  try {
    const body = await req.json()
    phone    = String(body?.phone    || '').trim()
    clientId = String(body?.client_id || '').trim()
  } catch (_) {
    return new Response(JSON.stringify({ message: 'invalid body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }
  if ((!phone && !clientId) || (phone && clientId)) {
    return new Response(JSON.stringify({ message: 'phone OR client_id required (exactly one)' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 3. Собираем список client_ids и опциональный tg_chat_id ──────
  const phoneDigits = phone.replace(/\D/g, '')
  let clientIds: string[] = []
  let tgChatId: string | null = null
  let tgLang: string | null = null

  if (clientId) {
    clientIds = [clientId]
  } else if (phoneDigits) {
    // TG-регистрация для fire-and-forget уведомления
    const { data: tgRows } = await supabaseAdmin
      .from('tg_clients')
      .select('tg_chat_id, lang, phone')
    const matchTg = (tgRows ?? []).find(
      (r: any) => String(r.phone ?? '').replace(/\D/g, '') === phoneDigits,
    ) as { tg_chat_id: string; lang: string | null } | undefined
    if (matchTg) {
      tgChatId = matchTg.tg_chat_id
      tgLang = matchTg.lang
    }

    // client_ids у всех мастеров
    const { data: cliRows } = await supabaseAdmin
      .from('clients')
      .select('id, phone')
    clientIds = (cliRows ?? [])
      .filter((c: any) => String(c.phone ?? '').replace(/\D/g, '') === phoneDigits)
      .map((c: any) => c.id)
  }

  const stats = {
    tg_clients: 0,
    clients: 0,
    appointments: 0,
    cleaning_orders: 0,
    workshop_orders: 0,
  }

  try {
    if (clientIds.length) {
      // Сначала — id-ы appointments / cleaning_orders / workshop_orders клиента
      const { data: apptRows } = await supabaseAdmin
        .from('appointments').select('id').in('client_id', clientIds)
      const apptIds = (apptRows ?? []).map((r: any) => r.id as string)

      const { data: cleaningRows } = await supabaseAdmin
        .from('cleaning_orders').select('id').in('client_id', clientIds)
      const cleaningIds = (cleaningRows ?? []).map((r: any) => r.id as string)

      const { data: workshopRows } = await supabaseAdmin
        .from('workshop_orders').select('id').in('client_id', clientIds)
      const workshopIds = (workshopRows ?? []).map((r: any) => r.id as string)

      // appointments → дочерние → сами
      await deleteWhereIn('email_log',           'appointment_id', apptIds)
      await deleteWhereIn('appointment_services','appointment_id', apptIds)
      stats.appointments = await deleteWhereIn('appointments', 'id', apptIds)

      // cleaning_orders
      await deleteWhereIn('cleaning_order_items',   'order_id', cleaningIds)
      await deleteWhereIn('cleaning_order_history', 'order_id', cleaningIds)
      stats.cleaning_orders = await deleteWhereIn('cleaning_orders', 'id', cleaningIds)

      // workshop_orders
      await deleteWhereIn('workshop_order_works',   'order_id', workshopIds)
      await deleteWhereIn('workshop_order_parts',   'order_id', workshopIds)
      await deleteWhereIn('workshop_order_history', 'order_id', workshopIds)
      // workshop_devices связан по client_id, не по order_id
      await deleteWhereIn('workshop_devices',       'client_id', clientIds)
      stats.workshop_orders = await deleteWhereIn('workshop_orders', 'id', workshopIds)

      // clients (карточки мастеров)
      stats.clients = await deleteWhereIn('clients', 'id', clientIds)
    }

    // tg_clients — только при удалении по phone
    if (phoneDigits && tgChatId) {
      const { count } = await supabaseAdmin
        .from('tg_clients')
        .delete({ count: 'exact' })
        .eq('tg_chat_id', tgChatId)
      stats.tg_clients = count ?? 0
    }

    // Fire-and-forget TG-уведомление (клиентский бот, т.к. tg_chat_id из tg_clients)
    if (tgChatId) {
      const botToken = Deno.env.get('TG_CLIENT_BOT_TOKEN') || Deno.env.get('TG_BOT_TOKEN') || ''
      if (botToken) {
        const text = tgLang === 'en'
          ? '❌ Your account has been removed from the platform by the administrator.'
          : '❌ Ваш аккаунт был удалён администратором платформы.'
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: tgChatId, text }),
            signal: AbortSignal.timeout(5000),
          })
        } catch (_) { /* non-blocking */ }
      }
    }

    return new Response(JSON.stringify({ message: 'ok', deleted: stats }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('admin-delete-client error:', err)
    return new Response(JSON.stringify({ message: 'error', detail: String(err?.message ?? err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
