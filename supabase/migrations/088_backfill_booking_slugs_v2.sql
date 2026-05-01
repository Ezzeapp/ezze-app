-- Migration 088: backfill missing booking_slug в master_profiles
--
-- Из-за бага в useUpsertProfile (INSERT не генерил booking_slug) часть строк
-- master_profiles могли быть созданы с NULL/пустым booking_slug. Без slug
-- публичная страница /p/<slug> отдаёт 404, и в settings ссылка ломается.
--
-- Заполняем для всех таких строк уникальный slug формата:
--   {sanitized display_name | 'master'}{первые 6 hex от id}
-- (использование части id гарантирует уникальность без коллизий с UNIQUE(booking_slug))

UPDATE public.master_profiles
SET booking_slug =
  COALESCE(
    NULLIF(LOWER(REGEXP_REPLACE(display_name, '[^a-zA-Z0-9]', '', 'g')), ''),
    'master'
  ) || SUBSTRING(REPLACE(id::text, '-', ''), 1, 6)
WHERE booking_slug IS NULL OR booking_slug = '';
