-- ─────────────────────────────────────────────────────────────────
-- 046_workshop_photos.sql
-- Фото устройства при приёмке (до 10 фото на заказ)
-- ─────────────────────────────────────────────────────────────────

-- Массив путей к фото в bucket 'workshop-photos'
ALTER TABLE workshop_orders
  ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN workshop_orders.photos IS
  'Пути к фото в bucket workshop-photos (например, {user_id}/{order_id}/{nanoid}.webp)';

-- Публичный bucket (ссылки доступны без auth — клиент видит в квитанции)
INSERT INTO storage.buckets (id, name, public)
VALUES ('workshop-photos', 'workshop-photos', TRUE)
ON CONFLICT DO NOTHING;
