-- Добавляем колонку lang в tg_clients
-- Хранит язык, выбранный клиентом при регистрации в боте (ru/uz/en/tg/kz/ky)

ALTER TABLE public.tg_clients ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'ru';
