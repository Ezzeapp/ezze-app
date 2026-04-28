-- ─────────────────────────────────────────────────────────────────
-- 065_team_scoped_rls.sql
-- Заменяет permissive RLS (USING true) на team-scoped политики для cleaning.
-- Логика:
--   * authenticated пользователь видит cleaning_orders, где:
--       team_id = current_team_id() — он в этой команде (любая роль)
--     ИЛИ
--       team_id IS NULL — старые данные без скоупа (для одиночек)
--   * worker видит ТОЛЬКО заказы, назначенные на его master_profile_id
--   * service_role и owner-управление через app — без ограничений
-- ─────────────────────────────────────────────────────────────────

-- ============================================================
-- 1. CLEANING_ORDERS: заменяем USING(true) на team-scoped политику
-- ============================================================

DROP POLICY IF EXISTS "cleaning_orders_all" ON public.cleaning_orders;

-- SELECT: можно читать заказы своей команды (или legacy заказы без team_id)
-- Worker — только свои назначенные
CREATE POLICY "cleaning_orders_select" ON public.cleaning_orders
  FOR SELECT
  TO authenticated
  USING (
    -- В команде → видим заказы команды
    (
      team_id IS NOT NULL
      AND team_id = public.current_team_id()
      AND (
        -- Worker — только assigned на его master_profile
        public.current_role() != 'worker'
        OR assigned_to IN (
          SELECT id FROM public.master_profiles WHERE user_id = auth.uid()
        )
      )
    )
    -- Legacy: заказы без team_id видны всем (старая модель — любой видит всё)
    -- ⚠️ Это сохраняет существующее поведение для одиночек, но не идеально для prod.
    --     В будущем backfill всех cleaning_orders с team_id и убрать этот OR.
    OR team_id IS NULL
    -- Suspended/expired sotrudники — нет доступа
  );

-- INSERT: только authenticated с активным team_id или без team
CREATE POLICY "cleaning_orders_insert" ON public.cleaning_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- В команде: создаём заказ с team_id своей команды
    (team_id IS NOT NULL AND team_id = public.current_team_id() AND public.has_team_permission('create_order'))
    -- Без team: legacy одиночка
    OR (team_id IS NULL)
  );

-- UPDATE: можно обновлять заказы своей команды (с правом edit)
-- Worker может только менять статус своих назначенных
CREATE POLICY "cleaning_orders_update" ON public.cleaning_orders
  FOR UPDATE
  TO authenticated
  USING (
    (
      team_id IS NOT NULL
      AND team_id = public.current_team_id()
      AND (
        public.current_role() != 'worker'
        OR assigned_to IN (SELECT id FROM public.master_profiles WHERE user_id = auth.uid())
      )
    )
    OR team_id IS NULL
  );

-- DELETE: только owner/admin команды
CREATE POLICY "cleaning_orders_delete" ON public.cleaning_orders
  FOR DELETE
  TO authenticated
  USING (
    (
      team_id IS NOT NULL
      AND team_id = public.current_team_id()
      AND public.current_role() IN ('owner', 'admin')
    )
    OR team_id IS NULL
  );

-- ============================================================
-- 2. CLEANING_ORDER_ITEMS: те же правила через order
-- ============================================================

DROP POLICY IF EXISTS "cleaning_order_items_all" ON public.cleaning_order_items;

CREATE POLICY "cleaning_order_items_select" ON public.cleaning_order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cleaning_orders co
       WHERE co.id = cleaning_order_items.order_id
         AND (
           (co.team_id IS NOT NULL AND co.team_id = public.current_team_id())
           OR co.team_id IS NULL
         )
    )
  );

CREATE POLICY "cleaning_order_items_insert" ON public.cleaning_order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cleaning_orders co
       WHERE co.id = cleaning_order_items.order_id
         AND (
           (co.team_id IS NOT NULL AND co.team_id = public.current_team_id())
           OR co.team_id IS NULL
         )
    )
  );

CREATE POLICY "cleaning_order_items_update" ON public.cleaning_order_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cleaning_orders co
       WHERE co.id = cleaning_order_items.order_id
         AND (
           (co.team_id IS NOT NULL AND co.team_id = public.current_team_id())
           OR co.team_id IS NULL
         )
    )
  );

CREATE POLICY "cleaning_order_items_delete" ON public.cleaning_order_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cleaning_orders co
       WHERE co.id = cleaning_order_items.order_id
         AND (
           (co.team_id IS NOT NULL AND co.team_id = public.current_team_id())
           OR co.team_id IS NULL
         )
    )
  );

-- ============================================================
-- 3. CLEANING_ORDER_HISTORY: SELECT через order
-- ============================================================

DROP POLICY IF EXISTS "cleaning_order_history_all" ON public.cleaning_order_history;

CREATE POLICY "cleaning_order_history_select" ON public.cleaning_order_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cleaning_orders co
       WHERE co.id = cleaning_order_history.order_id
         AND (
           (co.team_id IS NOT NULL AND co.team_id = public.current_team_id())
           OR co.team_id IS NULL
         )
    )
  );

CREATE POLICY "cleaning_order_history_insert" ON public.cleaning_order_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cleaning_orders co
       WHERE co.id = cleaning_order_history.order_id
         AND (
           (co.team_id IS NOT NULL AND co.team_id = public.current_team_id())
           OR co.team_id IS NULL
         )
    )
  );
