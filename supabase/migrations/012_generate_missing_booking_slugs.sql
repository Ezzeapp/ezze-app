-- Генерируем booking_slug для мастеров, у которых его нет
-- Для имён только на кириллице / с эмодзи (ASCII-часть пустая) — используем префикс 'master'
-- Для имён с ASCII-символами — берём их + случайный суффикс

UPDATE public.master_profiles
SET booking_slug =
  CASE
    WHEN trim(lower(regexp_replace(
           coalesce(display_name, profession, ''),
           '[^a-z0-9]+', '', 'gi'
         ))) = ''
    THEN 'master' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)
    ELSE left(
           lower(regexp_replace(
             coalesce(display_name, profession, ''),
             '[^a-z0-9]+', '', 'gi'
           )), 20
         ) || substring(replace(gen_random_uuid()::text, '-', ''), 1, 6)
  END
WHERE booking_slug IS NULL;
