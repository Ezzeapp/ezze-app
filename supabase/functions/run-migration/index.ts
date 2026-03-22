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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const sql1 = `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'team_members'
          AND policyname = 'team_members_self_insert'
      ) THEN
        CREATE POLICY "team_members_self_insert" ON public.team_members
          FOR INSERT WITH CHECK (user_id = auth.uid());
      END IF;
    END $$
  `

  const sql2 = `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'team_members'
          AND policyname = 'team_members_self_update'
      ) THEN
        CREATE POLICY "team_members_self_update" ON public.team_members
          FOR UPDATE USING (user_id = auth.uid());
      END IF;
    END $$
  `

  const log: Record<string, unknown> = {}

  for (const [name, query] of [['insert_policy', sql1], ['update_policy', sql2]]) {
    try {
      const res = await fetch(`${supabaseUrl}/pg-meta/v1/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'x-pg-meta-pass': serviceKey,
        },
        body: JSON.stringify({ query }),
      })
      const body = await res.text()
      log[name] = { status: res.status, body }
    } catch (e) {
      log[name] = { error: String(e) }
    }
  }

  return new Response(JSON.stringify(log, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  })
})
