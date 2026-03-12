-- ============================================================
-- 002_extras.sql — Birthday notifications cron + Team commission
-- ============================================================

-- Birthday notifications: run daily at 09:00 UTC
SELECT cron.schedule(
  'birthday-notifications',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url    := 'http://supabase-kong:8000/functions/v1/birthday-notifications',
    body   := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    )
  )
  $$
) ON CONFLICT (jobname) DO NOTHING;

-- Team member commission percentage (0-100, default 100 = full share)
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS commission_pct INT DEFAULT 100
  CHECK (commission_pct >= 0 AND commission_pct <= 100);

-- Allow anonymous users to read public master user info (for booking page)
-- Without this policy, the user join in master_profiles returns null for anon,
-- causing services/schedules to not load (userId = null)
CREATE POLICY users_public_master_read ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.master_profiles mp
      WHERE mp.user_id = users.id AND mp.is_public = true
    )
  );
