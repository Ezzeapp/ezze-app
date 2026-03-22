/**
 * One-time migration runner — 005_team_members_join_policy
 * DELETE this function after use!
 *
 * Call: GET /functions/v1/run-migration?secret=ezze-migrate-2026
 */
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  if (url.searchParams.get('secret') !== 'ezze-migrate-2026') {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
  }

  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: 'SUPABASE_DB_URL not set' }), { status: 500 })
  }

  const sql = postgres(dbUrl, { ssl: 'require', max: 1 })
  const log: string[] = []

  try {
    // Policy 1: self insert
    await sql`
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
    log.push('team_members_self_insert: OK')
  } catch (e) {
    log.push(`team_members_self_insert: ERROR — ${String(e)}`)
  }

  try {
    // Policy 2: self update
    await sql`
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
    log.push('team_members_self_update: OK')
  } catch (e) {
    log.push(`team_members_self_update: ERROR — ${String(e)}`)
  }

  await sql.end()

  return new Response(JSON.stringify({ log }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  })
})
