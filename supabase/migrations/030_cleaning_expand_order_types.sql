-- ── 030: Расширение типов заказов химчистки ──────────────────────────────────
-- Добавляем новые типы: обувь, шторы, постельное

-- Снимаем старый CHECK constraint
ALTER TABLE cleaning_orders
  DROP CONSTRAINT IF EXISTS cleaning_orders_order_type_check;

-- Добавляем расширенный CHECK constraint
ALTER TABLE cleaning_orders
  ADD CONSTRAINT cleaning_orders_order_type_check
  CHECK (order_type IN ('clothing','carpet','furniture','shoes','curtains','bedding'));
