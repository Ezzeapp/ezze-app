-- ─────────────────────────────────────────────────────────────────
-- 045_master_commission.sql
-- Процент от работ мастера (для расчёта зарплаты)
-- ─────────────────────────────────────────────────────────────────

-- Процент от суммы работ, который получает мастер (0-100)
ALTER TABLE master_profiles
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN master_profiles.commission_rate IS
  'Процент от суммы работ в заказе, который получает мастер. 0-100.';
