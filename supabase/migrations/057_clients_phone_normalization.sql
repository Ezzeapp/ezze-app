-- 057: Нормализованная колонка phone в clients
--
-- Нужна, чтобы клиент в TG-боте мог находить свои бонусы/связанные записи
-- у любого мастера через нормализованный телефон (см. миграцию 056 для
-- tg_clients и appointments).

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS phone_normalized TEXT
  GENERATED ALWAYS AS (regexp_replace(COALESCE(phone, ''), '\D', '', 'g')) STORED;

CREATE INDEX IF NOT EXISTS idx_clients_phone_norm
  ON public.clients(phone_normalized)
  WHERE phone_normalized <> '';
