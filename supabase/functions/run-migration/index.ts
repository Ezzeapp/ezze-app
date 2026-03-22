/**
 * One-time migration runner — 005_team_members_join_policy
 * DELETE this function after use!
 */

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  if (url.searchParams.get('secret') !== 'ezze-migrate-2026') {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
  }

  const supabaseUrl  = Deno.env.get('SUPABASE_URL') ?? 'NOT_SET'
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'NOT_SET'
  const anonKey      = Deno.env.get('SUPABASE_ANON_KEY') ?? 'NOT_SET'
  const jwtSecret    = Deno.env.get('SUPABASE_JWT_SECRET') ?? 'NOT_SET'

  const debug: Record<string, unknown> = {
    supabaseUrl,
    serviceKeyLen: serviceKey.length,
    serviceKeyStart: serviceKey.slice(0, 30),
    anonKeyLen: anonKey.length,
    jwtSecretSet: jwtSecret !== 'NOT_SET',
  }

  const sql1 = `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='team_members' AND policyname='team_members_self_insert') THEN CREATE POLICY "team_members_self_insert" ON public.team_members FOR INSERT WITH CHECK (user_id = auth.uid()); END IF; END $$`
  const sql2 = `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='team_members' AND policyname='team_members_self_update') THEN CREATE POLICY "team_members_self_update" ON public.team_members FOR UPDATE USING (user_id = auth.uid()); END IF; END $$`

  const log: Record<string, unknown> = {}

  // Try multiple path variants for pg-meta
  const paths = [
    `${supabaseUrl}/pg-meta/v1/query`,
    `${supabaseUrl}/api/pg-meta/v1/query`,
    `http://meta:8080/v1/query`,
    `http://supabase-meta:8080/v1/query`,
  ]

  for (const [name, query] of [['insert_policy', sql1], ['update_policy', sql2]] as const) {
    let done = false
    for (const path of paths) {
      if (done) break
      try {
        const res = await fetch(path, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ query }),
          signal: AbortSignal.timeout(5000),
        })
        const body = await res.text()
        if (res.ok) {
          log[name] = { path, status: res.status, body }
          done = true
        } else if (res.status !== 404) {
          log[name] = { path, status: res.status, body }
        }
      } catch (e) {
        // unreachable, try next
      }
    }
    if (!done && !log[name]) {
      log[name] = { error: 'all endpoints failed' }
    }
  }

  return new Response(JSON.stringify({ debug, log }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  })
})
