-- ─────────────────────────────────────────────────────────────────
-- 049_workshop_approval_token.sql
-- Токен для публичной страницы согласования сметы клиентом.
-- Мастер после диагностики отправляет клиенту ссылку /approve/{token},
-- клиент жмёт «Утвердить» или «Отказаться» — обновляется client_approved + status.
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE workshop_orders
  ADD COLUMN IF NOT EXISTS approval_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workshop_orders_approval_token
  ON workshop_orders(approval_token)
  WHERE approval_token IS NOT NULL;

-- Публичный SELECT по токену (без авторизации) — для /approve/:token страницы.
-- Политика уже допускает anon SELECT (public_track), здесь ничего добавлять не нужно.
-- Ограничение: anon может SELECT workshop_orders в принципе (legacy, будет ужесточено в #8).

COMMENT ON COLUMN workshop_orders.approval_token IS
  'Одноразовый токен для публичной страницы согласования сметы клиентом. Сбрасывается после approve/reject.';
