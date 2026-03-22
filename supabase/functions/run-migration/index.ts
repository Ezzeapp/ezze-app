/**
 * One-time migration runner — 005_team_members_join_policy
 * DELETE this function after use!
 *
 * Call: GET /functions/v1/run-migration?secret=ezze-migrate-2026
 */

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  if (url.searchParams.get('secret') !== 'ezze-migrate-2026') {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const sql1 = `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='team_members' AND policyname='team_members_self_insert') THEN CREATE POLICY "team_members_self_insert" ON public.team_members FOR INSERT WITH CHECK (user_id = auth.uid()); END IF; END $$`
  const sql2 = `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='team_members' AND policyname='team_members_self_update') THEN CREATE POLICY "team_members_self_update" ON public.team_members FOR UPDATE USING (user_id = auth.uid()); END IF; END $$`

  const log: Record<string, unknown> = {}
  const debug: Record<string, unknown> = {}

  // Try internal Docker network endpoints first, then public
  const endpoints = [
    'http://meta:8080',
    'http://supabase-meta:8080',
    'http://localhost:5555',
  ]

  let workingEndpoint = ''
  for (const ep of endpoints) {
    try {
      const r = await fetch(`${ep}/v1/version`, {
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
        signal: AbortSignal.timeout(2000),
      })
      if (r.ok || r.status === 401) {
        workingEndpoint = ep
        debug['endpoint_probe'] = `${ep} → ${r.status}`
        break
      }
    } catch (_) {
      debug[`probe_${ep}`] = 'unreachable'
    }
  }

  if (!workingEndpoint) {
    // Fall back to public URL
    workingEndpoint = Deno.env.get('SUPABASE_URL')! + '/pg-meta'
    debug['using_fallback'] = workingEndpoint
  }

  for (const [name, query] of [['insert_policy', sql1], ['update_policy', sql2]] as const) {
    try {
      const res = await fetch(`${workingEndpoint}/v1/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ query }),
      })
      log[name] = { status: res.status, body: await res.text() }
    } catch (e) {
      log[name] = { error: String(e) }
    }
  }

  return new Response(JSON.stringify({ log, debug }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  })
})
