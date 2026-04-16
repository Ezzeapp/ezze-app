-- ─────────────────────────────────────────────────────────────────
-- 050_workshop_public_token.sql
-- public_token для безопасной публичной ссылки трекинга.
-- Старая ссылка /track/РМ-XXXX остаётся рабочей (backward-compat),
-- но без токена — финансовая информация скрыта.
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE workshop_orders
  ADD COLUMN IF NOT EXISTS public_token TEXT;

-- Backfill для существующих заказов
UPDATE workshop_orders
  SET public_token = REPLACE(gen_random_uuid()::TEXT, '-', '')
  WHERE public_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workshop_orders_public_token
  ON workshop_orders(public_token)
  WHERE public_token IS NOT NULL;

-- Триггер для новых вставок
CREATE OR REPLACE FUNCTION workshop_gen_public_token()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := REPLACE(gen_random_uuid()::TEXT, '-', '');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_workshop_gen_public_token ON workshop_orders;
CREATE TRIGGER trg_workshop_gen_public_token
  BEFORE INSERT ON workshop_orders
  FOR EACH ROW EXECUTE FUNCTION workshop_gen_public_token();

COMMENT ON COLUMN workshop_orders.public_token IS
  'Непредсказуемый токен для публичной ссылки /track. Выдаётся при создании заказа и не меняется.';
