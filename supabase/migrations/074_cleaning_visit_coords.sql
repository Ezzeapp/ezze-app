-- ─────────────────────────────────────────────────────────────────
-- 074: Координаты адреса забора/доставки в cleaning_orders
--
-- Для отображения заказов на карте (Leaflet + OSM) нужны lat/lon.
-- Геокодирование происходит на клиенте через Nominatim после сохранения
-- адреса. Кеш — прямо в строке заказа, чтобы не геокодировать повторно.
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE cleaning_orders
  ADD COLUMN IF NOT EXISTS visit_lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS visit_lon NUMERIC(9,6);

-- Индекс для быстрых выборок «есть координаты» при рендере карты
CREATE INDEX IF NOT EXISTS idx_cleaning_orders_visit_coords
  ON cleaning_orders (visit_lat, visit_lon)
  WHERE visit_lat IS NOT NULL AND visit_lon IS NOT NULL;
