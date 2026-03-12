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
