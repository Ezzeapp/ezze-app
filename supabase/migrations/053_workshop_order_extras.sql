-- ─────────────────────────────────────────────────────────────────
-- 053_workshop_order_extras.sql
-- Доп. поля на форме приёмки:
--   · device_unlock_code  — пароль/графический ключ устройства
--   · completeness_items  — чеклист комплектности (JSONB массив строк)
--   · priority            — срочность (normal | urgent | express)
--   · client_consent_at   — отметка согласия клиента с условиями
-- Плюс RPC peek_next_workshop_order_number — показать следующий номер
-- без расхода sequence.
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE workshop_orders
  ADD COLUMN IF NOT EXISTS device_unlock_code TEXT,
  ADD COLUMN IF NOT EXISTS completeness_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS client_consent_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'workshop_orders_priority_check'
  ) THEN
    ALTER TABLE workshop_orders
      ADD CONSTRAINT workshop_orders_priority_check
      CHECK (priority IN ('normal','urgent','express'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workshop_orders_priority
  ON workshop_orders(priority) WHERE priority <> 'normal';

-- Подглядеть следующий номер без вызова nextval()
CREATE OR REPLACE FUNCTION peek_next_workshop_order_number(p_product TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  seq BIGINT;
BEGIN
  SELECT last_value + (CASE WHEN is_called THEN 1 ELSE 0 END)
  INTO seq
  FROM workshop_order_seq;
  RETURN 'РМ-' || LPAD(seq::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION peek_next_workshop_order_number(TEXT) TO authenticated;
