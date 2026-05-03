-- 089_cleaning_supplies_team_scope.sql
-- Закрываем дыру: cleaning_supplies / cleaning_supply_log из миграции 051
-- имели RLS `USING(true)` без team_id колонки. Это значит что мастер
-- химчистки A видел и мог править расходники химчистки B на той же БД:
-- наименования, цены закупки, поставщиков, остатки. Полный data leak.

-- ── 1. Колонки team_id, created_by ─────────────────────────────────────────
ALTER TABLE public.cleaning_supplies
  ADD COLUMN IF NOT EXISTS team_id    UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- supply_log уже имеет created_by; добавляем team_id для симметрии.
ALTER TABLE public.cleaning_supply_log
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cleaning_supplies_team    ON public.cleaning_supplies(team_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_supply_log_team  ON public.cleaning_supply_log(team_id);

-- ── 2. Best-effort backfill team_id для существующих записей ─────────────
-- Записи без created_by оставляем legacy (team_id NULL). Записи с
-- created_by → берём team_id из team_members (если автор в команде).
-- Если автор в нескольких — берём первую (best-effort, redo вручную).
UPDATE public.cleaning_supply_log AS sl
SET    team_id = tm.team_id
FROM   public.team_members tm
WHERE  sl.team_id IS NULL
  AND  sl.created_by = tm.user_id;

-- ── 3. RLS policies — team-scoped как cleaning_orders в 065 ──────────────
DROP POLICY IF EXISTS "cleaning_supplies_read"      ON public.cleaning_supplies;
DROP POLICY IF EXISTS "cleaning_supplies_write"     ON public.cleaning_supplies;
DROP POLICY IF EXISTS "cleaning_supply_log_read"    ON public.cleaning_supply_log;
DROP POLICY IF EXISTS "cleaning_supply_log_write"   ON public.cleaning_supply_log;

CREATE POLICY "cleaning_supplies_select" ON public.cleaning_supplies
  FOR SELECT TO authenticated
  USING (
    team_id IS NULL  -- legacy одиночки
    OR team_id = public.current_team_id()
  );

CREATE POLICY "cleaning_supplies_insert" ON public.cleaning_supplies
  FOR INSERT TO authenticated
  WITH CHECK (
    team_id IS NULL
    OR team_id = public.current_team_id()
  );

CREATE POLICY "cleaning_supplies_update" ON public.cleaning_supplies
  FOR UPDATE TO authenticated
  USING (
    team_id IS NULL
    OR team_id = public.current_team_id()
  );

CREATE POLICY "cleaning_supplies_delete" ON public.cleaning_supplies
  FOR DELETE TO authenticated
  USING (
    team_id IS NULL
    OR (team_id = public.current_team_id() AND public.current_role() IN ('owner', 'admin'))
  );

-- supply_log: чтение/запись через team_id записи или связанного supply.
CREATE POLICY "cleaning_supply_log_select" ON public.cleaning_supply_log
  FOR SELECT TO authenticated
  USING (
    team_id IS NULL
    OR team_id = public.current_team_id()
    OR EXISTS (
      SELECT 1 FROM public.cleaning_supplies cs
       WHERE cs.id = cleaning_supply_log.supply_id
         AND (cs.team_id IS NULL OR cs.team_id = public.current_team_id())
    )
  );

CREATE POLICY "cleaning_supply_log_insert" ON public.cleaning_supply_log
  FOR INSERT TO authenticated
  WITH CHECK (
    team_id IS NULL
    OR team_id = public.current_team_id()
  );
