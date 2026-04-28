-- ─────────────────────────────────────────────────────────────────
-- 063_team_workspace.sql
-- Team Workspace Foundation:
--   * users.team_only_for — флаг "сотрудник существует только в команде"
--   * team_members.tg_chat_id — TG-чат сотрудника для уведомлений
--   * team_id + created_by на data-таблицах — для scope-фильтрации команды
--   * subscriptions.seats — для per-seat биллинга
--   * RLS-helper функции: current_team_id(), current_role()
--   * Backfill: для существующих teams проставить team_id на записи владельца
-- ─────────────────────────────────────────────────────────────────

-- ============================================================
-- 1. USERS: team_only_for (сотрудник работает только в команде владельца)
-- ============================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS team_only_for UUID REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_team_only_for ON public.users(team_only_for);

COMMENT ON COLUMN public.users.team_only_for IS
  'Если заполнено — пользователь существует только как сотрудник этой команды (нет своего кабинета, своей подписки)';


-- ============================================================
-- 2. TEAM_MEMBERS: tg_chat_id для уведомлений сотрудника + commission
-- ============================================================
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS tg_chat_id TEXT;

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS suspended_by_expiry BOOLEAN DEFAULT false;

-- role values: 'owner' | 'admin' | 'operator' | 'worker' | 'member' (legacy)
COMMENT ON COLUMN public.team_members.role IS
  'Роль в команде: owner | admin | operator | worker | member (legacy)';


-- ============================================================
-- 3. SUBSCRIPTIONS: seats для per-seat биллинга
-- ============================================================
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS seats INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.subscriptions.seats IS
  'Количество сотрудников (мест) в команде, оплаченных в этой подписке. 0 = без команды';


-- ============================================================
-- 4. ADD team_id + created_by НА DATA-ТАБЛИЦЫ
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'clients',
    'service_categories',
    'services',
    'schedules',
    'schedule_breaks',
    'appointments',
    'appointment_services',
    'inventory_items',
    'promo_codes',
    'cleaning_orders',
    'cleaning_order_items'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Skip table if it doesn't exist (graceful for partial product installs)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      RAISE NOTICE 'Skipping % — table does not exist', tbl;
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL',
      tbl
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_team_id ON public.%I(team_id)',
      tbl, tbl
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL',
      tbl
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_created_by ON public.%I(created_by)',
      tbl, tbl
    );
  END LOOP;
END $$;


-- ============================================================
-- 5. RLS HELPER FUNCTIONS
-- ============================================================

-- current_team_id(): возвращает team_id текущего пользователя
-- Логика поиска (в порядке приоритета):
--   1. users.team_only_for (сотрудник)
--   2. teams.owner_id (владелец)
--   3. team_members (активный участник)
CREATE OR REPLACE FUNCTION public.current_team_id()
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  tid UUID;
BEGIN
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. team_only_for (сотрудник)
  SELECT team_only_for INTO tid FROM public.users WHERE id = uid;
  IF tid IS NOT NULL THEN
    RETURN tid;
  END IF;

  -- 2. Владелец
  SELECT id INTO tid FROM public.teams WHERE owner_id = uid LIMIT 1;
  IF tid IS NOT NULL THEN
    RETURN tid;
  END IF;

  -- 3. Активный участник
  SELECT team_id INTO tid FROM public.team_members
   WHERE user_id = uid AND status = 'active'
   LIMIT 1;

  RETURN tid;
END $$;

GRANT EXECUTE ON FUNCTION public.current_team_id() TO authenticated, anon, service_role;


-- current_role(): возвращает роль текущего пользователя в его команде
-- Возвращает: 'owner' | 'admin' | 'operator' | 'worker' | 'member' | NULL
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid  UUID := auth.uid();
  team UUID := public.current_team_id();
  r    TEXT;
BEGIN
  IF uid IS NULL OR team IS NULL THEN
    RETURN NULL;
  END IF;

  -- Владелец
  IF EXISTS (SELECT 1 FROM public.teams WHERE id = team AND owner_id = uid) THEN
    RETURN 'owner';
  END IF;

  -- Участник
  SELECT role INTO r FROM public.team_members
   WHERE team_id = team AND user_id = uid AND status = 'active'
   LIMIT 1;

  RETURN COALESCE(r, NULL);
END $$;

GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated, anon, service_role;


-- has_team_permission(action): проверка прав текущего пользователя
-- Возвращает TRUE если роль пользователя имеет право выполнить action.
-- Действия:
--   manage_billing, manage_team, manage_settings — только owner
--   manage_employees, view_reports               — owner, admin
--   create_order, view_clients, accept_payment   — owner, admin, operator
--   change_assigned_status                       — все, кроме NULL
CREATE OR REPLACE FUNCTION public.has_team_permission(action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r TEXT := public.current_role();
BEGIN
  IF r IS NULL THEN
    RETURN FALSE;
  END IF;

  CASE action
    WHEN 'manage_billing', 'manage_team', 'manage_settings' THEN
      RETURN r = 'owner';
    WHEN 'manage_employees', 'view_reports' THEN
      RETURN r IN ('owner', 'admin');
    WHEN 'create_order', 'view_clients', 'accept_payment', 'view_all_orders' THEN
      RETURN r IN ('owner', 'admin', 'operator');
    WHEN 'change_assigned_status', 'view_assigned_orders' THEN
      RETURN r IN ('owner', 'admin', 'operator', 'worker', 'member');
    ELSE
      RETURN FALSE;
  END CASE;
END $$;

GRANT EXECUTE ON FUNCTION public.has_team_permission(TEXT) TO authenticated, anon, service_role;


-- ============================================================
-- 6. BACKFILL: для каждой существующей команды проставить team_id
-- на записях владельца (master_id = teams.owner_id).
-- Безопасно: обновляет только записи где team_id IS NULL.
-- ============================================================
DO $$
DECLARE
  team_rec RECORD;
  tbl TEXT;
  -- Таблицы с master_id колонкой → user_id владельца
  master_tables TEXT[] := ARRAY[
    'clients',
    'service_categories',
    'services',
    'schedules',
    'schedule_breaks',
    'appointments',
    'inventory_items',
    'promo_codes'
  ];
BEGIN
  FOR team_rec IN SELECT id, owner_id FROM public.teams LOOP
    -- Tables with master_id pointing to users
    FOREACH tbl IN ARRAY master_tables LOOP
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'master_id'
      ) THEN
        EXECUTE format(
          'UPDATE public.%I SET team_id = $1 WHERE team_id IS NULL AND master_id = $2',
          tbl
        ) USING team_rec.id, team_rec.owner_id;
      END IF;
    END LOOP;

    -- cleaning_orders: accepted_by → master_profiles.id, lookup user_id via master_profiles
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'cleaning_orders'
    ) THEN
      UPDATE public.cleaning_orders co
         SET team_id = team_rec.id
        FROM public.master_profiles mp
       WHERE co.team_id IS NULL
         AND co.accepted_by = mp.id
         AND mp.user_id = team_rec.owner_id;

      -- cleaning_order_items: linked through cleaning_orders.team_id
      UPDATE public.cleaning_order_items coi
         SET team_id = co.team_id
        FROM public.cleaning_orders co
       WHERE coi.team_id IS NULL
         AND coi.order_id = co.id
         AND co.team_id = team_rec.id;
    END IF;

    -- appointment_services: linked through appointments.team_id
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'appointment_services'
    ) THEN
      UPDATE public.appointment_services aps
         SET team_id = a.team_id
        FROM public.appointments a
       WHERE aps.team_id IS NULL
         AND aps.appointment_id = a.id
         AND a.team_id = team_rec.id;
    END IF;
  END LOOP;
END $$;


-- ============================================================
-- 7. SUBSCRIPTIONS: backfill seats based on existing team_members
-- Для активных подписок владельцев команд: seats = кол-во активных участников
-- ============================================================
DO $$
BEGIN
  UPDATE public.subscriptions s
     SET seats = COALESCE(cnt.cnt, 0)
    FROM (
      SELECT t.owner_id AS uid,
             COUNT(*) FILTER (WHERE tm.status = 'active') AS cnt
        FROM public.teams t
        LEFT JOIN public.team_members tm ON tm.team_id = t.id
       GROUP BY t.owner_id
    ) cnt
   WHERE s.user_id = cnt.uid
     AND s.status IN ('active', 'pending');
END $$;


-- ============================================================
-- 8. PRODUCT MARKER на teams (для multi-product экосистемы)
-- ============================================================
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT 'beauty';

CREATE INDEX IF NOT EXISTS idx_teams_product ON public.teams(product);

COMMENT ON COLUMN public.teams.product IS
  'Продукт, к которому относится команда: beauty | cleaning | clinic | workshop | farm | edu | ...';


-- ============================================================
-- 9. RPC: get_auth_user_id_by_phone(p_phone)
-- Возвращает auth.users.id по номеру телефона (для phone-based login)
-- Возвращает скалярный UUID или NULL — совместимо с supabase-js .rpc()
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_phone(p_phone TEXT)
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized TEXT;
  result UUID;
BEGIN
  IF p_phone IS NULL OR p_phone = '' THEN
    RETURN NULL;
  END IF;

  -- Normalize: strip everything except digits
  normalized := regexp_replace(p_phone, '\D', '', 'g');

  SELECT u.id INTO result
    FROM auth.users u
   WHERE u.phone = normalized
      OR u.phone = '+' || normalized
      OR regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g') = normalized
   LIMIT 1;

  RETURN result;
END $$;

GRANT EXECUTE ON FUNCTION public.get_auth_user_id_by_phone(TEXT)
  TO service_role, authenticated, anon;


-- ============================================================
-- 10. RPC: refresh_subscription_seats(p_owner_id)
-- Пересчитывает subscriptions.seats на основе кол-ва active team_members
-- Вызывается после инвайта/удаления сотрудника для пересчёта биллинга.
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_subscription_seats(p_owner_id UUID)
RETURNS INT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt INT;
BEGIN
  IF p_owner_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Count active members across all teams owned by this user
  SELECT COUNT(*)
    INTO cnt
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
   WHERE t.owner_id = p_owner_id
     AND tm.status = 'active';

  -- Update active/pending subscriptions for owner
  UPDATE public.subscriptions
     SET seats = cnt
   WHERE user_id = p_owner_id
     AND status IN ('active', 'pending');

  RETURN cnt;
END $$;

GRANT EXECUTE ON FUNCTION public.refresh_subscription_seats(UUID)
  TO service_role, authenticated;


-- ============================================================
-- 11. RPC: validate_team_invite(p_code)
-- Возвращает информацию о приглашении (для пред-показа в боте перед регистрацией)
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_team_invite(p_code TEXT)
RETURNS TABLE(
  invite_id   UUID,
  team_id     UUID,
  team_name   TEXT,
  team_slug   TEXT,
  product     TEXT,
  role        TEXT,
  is_valid    BOOLEAN,
  reason      TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
BEGIN
  SELECT i.id, i.team_id, i.expires_at, i.max_uses, i.use_count, i.is_active, i.label,
         t.name AS t_name, t.slug AS t_slug, t.product AS t_product
    INTO inv
    FROM public.team_invites i
    JOIN public.teams t ON t.id = i.team_id
   WHERE i.code = p_code
   LIMIT 1;

  IF inv IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, FALSE, 'not_found'::TEXT;
    RETURN;
  END IF;

  IF NOT inv.is_active THEN
    RETURN QUERY SELECT inv.id, inv.team_id, inv.t_name, inv.t_slug, inv.t_product, inv.label, FALSE, 'inactive'::TEXT;
    RETURN;
  END IF;

  IF inv.expires_at < NOW() THEN
    RETURN QUERY SELECT inv.id, inv.team_id, inv.t_name, inv.t_slug, inv.t_product, inv.label, FALSE, 'expired'::TEXT;
    RETURN;
  END IF;

  IF inv.max_uses IS NOT NULL AND inv.use_count >= inv.max_uses THEN
    RETURN QUERY SELECT inv.id, inv.team_id, inv.t_name, inv.t_slug, inv.t_product, inv.label, FALSE, 'used_up'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT inv.id, inv.team_id, inv.t_name, inv.t_slug, inv.t_product,
                      COALESCE(inv.label, 'operator'), TRUE, NULL::TEXT;
END $$;

GRANT EXECUTE ON FUNCTION public.validate_team_invite(TEXT)
  TO service_role, authenticated, anon;
