-- Добавляем колонку tg_name в tg_clients
-- tg_name: имя из профиля Telegram (first_name + last_name из message.from)
-- Отличается от name — имени, которое клиент ввёл самостоятельно при регистрации.

ALTER TABLE public.tg_clients ADD COLUMN IF NOT EXISTS tg_name TEXT;
