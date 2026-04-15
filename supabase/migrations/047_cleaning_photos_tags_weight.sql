-- ─────────────────────────────────────────────────────────────────
-- 047_cleaning_photos_tags_weight.sql
-- Фото дефектов при приёмке, теги заказа, вес вещей (прачечная)
-- ─────────────────────────────────────────────────────────────────

-- Фото дефектов на изделие (до 5 фото)
ALTER TABLE cleaning_order_items
  ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT '{}';

-- Вес в кг (для прачечной: стирка по весу)
ALTER TABLE cleaning_order_items
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC;

-- Теги на заказ (Срочно, VIP, Повторная, ...)
ALTER TABLE cleaning_orders
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- Публичный bucket для фото дефектов при приёмке
INSERT INTO storage.buckets (id, name, public)
VALUES ('cleaning-photos', 'cleaning-photos', TRUE)
ON CONFLICT DO NOTHING;
