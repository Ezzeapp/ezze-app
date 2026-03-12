-- ============================================================
-- 003_client_booking_fix.sql
-- 1. Fix check_plan_limits: use master_id from row (not auth.uid())
--    Previously, online bookings (anon users) always hit free plan limits
--    because auth.uid() was NULL, ignoring the master's actual plan.
-- 2. Auto-create client record after online appointment booking
--    Previously, clients were only created if the anon user could INSERT
--    into the clients table (blocked by RLS).
-- ============================================================

-- ── 1. Fix check_plan_limits ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_plan_limits()
RETURNS TRIGGER AS $$
DECLARE
  v_master_id   UUID;
  user_plan     TEXT;
  current_count INT;
  limits        JSONB;
  table_limit   INT;
  limit_key     TEXT;
BEGIN
  -- Use master_id from the row being inserted (works for anon / service role)
  IF TG_TABLE_NAME IN ('clients', 'services', 'appointments') THEN
    v_master_id := NEW.master_id;
  ELSE
    v_master_id := auth.uid();
  END IF;

  -- Get user plan by master_id
  SELECT plan INTO user_plan FROM public.users WHERE id = v_master_id;
  IF user_plan IN ('pro', 'enterprise') THEN RETURN NEW; END IF;

  -- Get limits from app_settings
  SELECT value::jsonb INTO limits FROM public.app_settings WHERE key = 'plan_limits';
  IF limits IS NULL THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'clients' THEN
    limit_key := 'clients';
    SELECT COUNT(*) INTO current_count FROM public.clients WHERE master_id = v_master_id;
  ELSIF TG_TABLE_NAME = 'services' THEN
    limit_key := 'services';
    SELECT COUNT(*) INTO current_count FROM public.services WHERE master_id = v_master_id;
  ELSIF TG_TABLE_NAME = 'appointments' THEN
    limit_key := 'appts_month';
    SELECT COUNT(*) INTO current_count FROM public.appointments
    WHERE master_id = v_master_id
      AND date >= to_char(date_trunc('month', NOW()), 'YYYY-MM-DD')
      AND date < to_char(date_trunc('month', NOW()) + INTERVAL '1 month', 'YYYY-MM-DD');
  END IF;

  table_limit := (limits -> 'free' ->> limit_key)::INT;
  IF table_limit IS NOT NULL AND current_count >= table_limit THEN
    RAISE EXCEPTION 'plan_limit_reached:%', limit_key;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 2. Auto-create client from online booking ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_create_client_from_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_first_name TEXT;
  v_last_name  TEXT;
  v_client_id  UUID;
  v_full_name  TEXT;
BEGIN
  -- Only for online bookings with a phone number
  IF COALESCE(NEW.booked_via, '') <> 'online'
     OR COALESCE(NEW.client_phone, '') = '' THEN
    RETURN NEW;
  END IF;

  -- Parse name into first / last
  v_full_name  := trim(COALESCE(NEW.client_name, ''));
  v_first_name := trim(split_part(v_full_name, ' ', 1));
  IF position(' ' IN v_full_name) > 0 THEN
    v_last_name := trim(substring(v_full_name FROM position(' ' IN v_full_name) + 1));
  ELSE
    v_last_name := '';
  END IF;

  -- Find existing client for this master by phone
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE master_id = NEW.master_id
    AND phone     = NEW.client_phone
  LIMIT 1;

  IF v_client_id IS NULL THEN
    -- Create new client (SECURITY DEFINER bypasses RLS;
    -- check_clients_limit trigger enforces plan limits correctly
    -- because check_plan_limits now uses NEW.master_id)
    BEGIN
      INSERT INTO public.clients
        (master_id, first_name, last_name, phone, email, source)
      VALUES (
        NEW.master_id,
        v_first_name,
        v_last_name,
        NEW.client_phone,
        COALESCE(NEW.client_email, ''),
        'online_booking'
      )
      RETURNING id INTO v_client_id;
    EXCEPTION
      WHEN OTHERS THEN
        -- Plan limit reached or any other error — skip silently
        RETURN NEW;
    END;
  ELSE
    -- Update email if client doesn't have one and booking provides one
    UPDATE public.clients
    SET email = NEW.client_email
    WHERE id                   = v_client_id
      AND COALESCE(email, '')  = ''
      AND COALESCE(NEW.client_email, '') <> '';
  END IF;

  -- Link appointment → client (if not already linked)
  IF v_client_id IS NOT NULL AND NEW.client_id IS NULL THEN
    UPDATE public.appointments
    SET client_id = v_client_id
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_create_client_on_booking ON public.appointments;
CREATE TRIGGER auto_create_client_on_booking
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_client_from_booking();
