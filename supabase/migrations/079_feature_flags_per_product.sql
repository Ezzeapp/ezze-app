-- ─────────────────────────────────────────────────────────────────
-- 079_feature_flags_per_product.sql
-- feature_flags per-product: одна запись = (product, key)
--
-- Раньше feature_flags был глобальный: один флаг key='teams' enabled=true
-- управлял командой во ВСЕХ продуктах одновременно. После переноса
-- управления флагами в superadmin per-product (страница /dashboard/[product]
-- → вкладка Функции) — нужна изоляция: cleaning может включить teams, beauty
-- — выключить, и они не пересекаются.
--
-- Дополнительно: подтягиваем недостающие колонки key/min_plan/overrides/
-- blocked_users (исторически добавлены вручную в DB вне миграций — делаем
-- идемпотентным).
-- ─────────────────────────────────────────────────────────────────

-- 1. Добиваем "новые" колонки если их вдруг не было (idempotent)
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS key           TEXT;
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS min_plan      TEXT;
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS overrides     UUID[] DEFAULT '{}'::UUID[];
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS blocked_users UUID[] DEFAULT '{}'::UUID[];

-- Backfill key из legacy flag_name
UPDATE public.feature_flags
   SET key = flag_name
 WHERE key IS NULL AND flag_name IS NOT NULL;

-- 2. Добавляем product (без DEFAULT — фронт всегда передаёт явно через
-- useUpsertFeatureFlag → product: PRODUCT)
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS product TEXT;

-- Backfill: существующие записи попадают в beauty (исторически они и были
-- глобальные == beauty-эра). После деплоя superadmin может скопировать
-- настройки в другие продукты вручную.
UPDATE public.feature_flags SET product = 'beauty' WHERE product IS NULL;

ALTER TABLE public.feature_flags ALTER COLUMN product SET NOT NULL;

-- 3. UNIQUE: (product, key) вместо legacy (key)
-- Сначала чистим возможные дубли (если key встречается несколько раз —
-- оставляем самый новый по created_at).
DELETE FROM public.feature_flags ff
 WHERE ff.id NOT IN (
   SELECT DISTINCT ON (product, key) id
     FROM public.feature_flags
    WHERE key IS NOT NULL
    ORDER BY product, key, created_at DESC NULLS LAST
 )
   AND key IS NOT NULL;

-- Снимаем legacy UNIQUE если был на key
ALTER TABLE public.feature_flags DROP CONSTRAINT IF EXISTS feature_flags_key_key;
DROP INDEX IF EXISTS public.feature_flags_key_unique;

-- Ставим новый UNIQUE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'feature_flags_product_key_unique'
       AND conrelid = 'public.feature_flags'::regclass
  ) THEN
    ALTER TABLE public.feature_flags
      ADD CONSTRAINT feature_flags_product_key_unique UNIQUE (product, key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_feature_flags_product_key
  ON public.feature_flags(product, key);
