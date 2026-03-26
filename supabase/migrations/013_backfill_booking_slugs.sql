-- Повторный backfill booking_slug для мастеров, у которых его нет
-- (на случай если 012 не затронул записи, созданные после деплоя)

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
