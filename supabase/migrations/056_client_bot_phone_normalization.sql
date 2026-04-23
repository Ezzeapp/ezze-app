-- 056: Нормализованные телефонные колонки для связи клиент ↔ бот
--
-- Контекст: клиентский Telegram-бот переходит с Mini App на чат-кнопки.
-- Связь "клиент в боте ↔ запись на сайте мастера" идёт через номер телефона.
-- Телефон приходит в разных форматах: "+998 90 123-45-67", "998901234567",
-- "+998901234567" и т.п. Нужен гарантированно одинаковый ключ для поиска.
--
-- Решение: GENERATED STORED колонки с автоматической нормализацией
-- (удаление всех не-цифр). Postgres сам пересчитывает при INSERT/UPDATE,
-- код пишет `phone`/`client_phone` как есть, поиск идёт по `*_normalized`.

-- ── tg_clients.phone_normalized ──────────────────────────────────────────────

ALTER TABLE public.tg_clients
  ADD COLUMN IF NOT EXISTS phone_normalized TEXT
  GENERATED ALWAYS AS (regexp_replace(COALESCE(phone, ''), '\D', '', 'g')) STORED;

CREATE INDEX IF NOT EXISTS idx_tg_clients_phone_norm
  ON public.tg_clients(phone_normalized)
  WHERE phone_normalized <> '';

-- ── appointments.client_phone_normalized ─────────────────────────────────────

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS client_phone_normalized TEXT
  GENERATED ALWAYS AS (regexp_replace(COALESCE(client_phone, ''), '\D', '', 'g')) STORED;

CREATE INDEX IF NOT EXISTS idx_appointments_phone_norm
  ON public.appointments(client_phone_normalized)
  WHERE client_phone_normalized <> '';
