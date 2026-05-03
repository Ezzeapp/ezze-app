-- 092_cleaning_photos_storage_rls.sql
-- Storage RLS для bucket `cleaning-photos` из миграции 047.
--
-- 047 создаёт bucket с public=TRUE (URL-чтение работает напрямую через
-- /storage/v1/object/public/cleaning-photos/...), но НЕ объявляет ни одной
-- policy на storage.objects. По дефолту RLS на storage.objects = deny —
-- значит upload/delete либо не работает, либо проходит благодаря
-- какой-то старой permissive-политике из чужой миграции, что хуже.
--
-- Симметрично паттерну avatars/portfolio/services из 001_schema.sql:
--   • SELECT — публично (bucket помечен public, всё равно URL читаемый)
--   • INSERT — любой authenticated
--   • DELETE — только owner (первый сегмент пути совпадает с auth.uid)
--
-- В POSPage/Wizard/DnD путь генерится как `${PRODUCT}/{timestamp}_{rand}.{ext}`.
-- Это значит первый сегмент = 'cleaning' (не auth.uid), и owner-DELETE по
-- auth.uid() как для avatars здесь НЕ сработает: фото никто удалить не
-- сможет, кроме service_role. Для MVP это приемлемо (фото копится, чистка
-- сторонним cron-ом). Удаление через UI пока и не предусмотрено.

DO $$
BEGIN
  -- Чтение публичное (bucket уже public, но явная policy для consistency).
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='storage' AND tablename='objects'
       AND policyname='Public read cleaning-photos'
  ) THEN
    CREATE POLICY "Public read cleaning-photos" ON storage.objects
      FOR SELECT USING (bucket_id = 'cleaning-photos');
  END IF;

  -- Загрузка — любой authenticated. На уровне приложения путь скоупится
  -- по PRODUCT, но storage RLS не может проверять team_id без денормализации.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='storage' AND tablename='objects'
       AND policyname='Auth upload cleaning-photos'
  ) THEN
    CREATE POLICY "Auth upload cleaning-photos" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'cleaning-photos'
        AND auth.uid() IS NOT NULL
      );
  END IF;

  -- DELETE: только service_role. UI не предлагает удаление фото, чистка —
  -- через cron/admin. Без owner-policy чужой не уничтожит файлы.
  -- (Не создаём policy на DELETE → запрещено всем authenticated по умолчанию.)
END $$;
