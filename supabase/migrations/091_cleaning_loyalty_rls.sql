-- 088_cleaning_loyalty_rls.sql
-- Закрываем дыру в cleaning_loyalty (миграция 050).
--
-- Раньше политика SELECT была `USING (true)` — любой авторизованный (и при
-- ANON_KEY с отсутствием явного auth → даже неавторизованный) видел tier и
-- сумму всех клиентов всех мастеров. Это data leak: суммы трат клиентов
-- утекают между мастерами одной БД.
--
-- recalc_cleaning_loyalty() работает с SECURITY DEFINER, так что новые
-- политики ему не мешают (он вызывается со service-привилегиями).

DROP POLICY IF EXISTS "cleaning_loyalty_read" ON cleaning_loyalty;
DROP POLICY IF EXISTS "cleaning_loyalty_write" ON cleaning_loyalty;

-- Read: запись доступна если её клиент принадлежит мастеру (одиночный
-- мастер) или команде, в которой состоит пользователь.
CREATE POLICY "cleaning_loyalty_select_own" ON cleaning_loyalty
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients
      WHERE master_id = auth.uid()
         OR team_id IN (
           SELECT team_id FROM team_members WHERE user_id = auth.uid()
         )
    )
  );

-- Write: симметрично — мастер/команда может править свои записи. Реальные
-- мутации идут через recalc_cleaning_loyalty() (SECURITY DEFINER), эта
-- политика покрывает разве что ручной admin-trigger из superadmin.
CREATE POLICY "cleaning_loyalty_write_own" ON cleaning_loyalty
  FOR ALL USING (
    client_id IN (
      SELECT id FROM clients
      WHERE master_id = auth.uid()
         OR team_id IN (
           SELECT team_id FROM team_members WHERE user_id = auth.uid()
         )
    )
  );
