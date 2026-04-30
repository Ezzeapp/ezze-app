-- ─────────────────────────────────────────────────────────────────
-- 078_teams_product_backfill.sql
-- Backfill teams.product для команд, созданных ДО фикса 7a0128e.
--
-- Проблема: до фикса колонка teams.product имела DEFAULT 'beauty', а
-- INSERT в useCreateTeam не передавал product → все старые команды получили
-- product='beauty' независимо от того, в каком продукте мастер их создавал.
-- После фикса cleaning/workshop/clinic мастера не видят свои команды
-- в кабинете (фронт фильтрует teams по product=PRODUCT).
--
-- Стратегия восстановления (от сильного сигнала к слабому):
--   1. cleaning_orders.team_id → 'cleaning'
--   2. master_profiles владельца — если у него профиль ровно в одном
--      не-beauty продукте → берём его product
--   3. Иначе оставляем текущий product (мастер вручную пересоздаст команду
--      в нужном продукте — данные не разрушаем)
-- ─────────────────────────────────────────────────────────────────

-- Шаг 1: Команды с привязанными cleaning_orders → точно cleaning.
UPDATE public.teams t
   SET product = 'cleaning'
 WHERE t.product = 'beauty'
   AND EXISTS (
     SELECT 1 FROM public.cleaning_orders co WHERE co.team_id = t.id
   );

-- Шаг 2: Владелец имеет ровно один master_profile, и он не beauty
-- → используем его product как product команды.
WITH owner_profiles AS (
  SELECT user_id,
         COUNT(*)              AS profile_cnt,
         MIN(product)           AS only_product
    FROM public.master_profiles
   GROUP BY user_id
)
UPDATE public.teams t
   SET product = op.only_product
  FROM owner_profiles op
 WHERE t.owner_id      = op.user_id
   AND t.product       = 'beauty'
   AND op.profile_cnt  = 1
   AND op.only_product IS NOT NULL
   AND op.only_product != 'beauty';

-- Шаг 3: Владелец имеет несколько master_profiles, но ни одного beauty.
-- Берём самый старый (вероятно, исходный продукт).
WITH owner_profiles AS (
  SELECT DISTINCT ON (user_id)
         user_id,
         product
    FROM public.master_profiles
   WHERE product != 'beauty'
   ORDER BY user_id, created_at ASC NULLS LAST, id ASC
), owners_without_beauty AS (
  SELECT user_id
    FROM public.master_profiles
   GROUP BY user_id
  HAVING SUM(CASE WHEN product = 'beauty' THEN 1 ELSE 0 END) = 0
     AND COUNT(DISTINCT product) > 1
)
UPDATE public.teams t
   SET product = op.product
  FROM owner_profiles op
   JOIN owners_without_beauty owb ON owb.user_id = op.user_id
 WHERE t.owner_id = op.user_id
   AND t.product  = 'beauty';

-- Уберём DEFAULT 'beauty' с teams.product — фронт всегда передаёт product
-- явно через useCreateTeam. Дефолт только маскировал баг.
ALTER TABLE public.teams ALTER COLUMN product DROP DEFAULT;
