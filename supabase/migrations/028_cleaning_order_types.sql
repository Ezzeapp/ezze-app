-- ── 028: Типы заказов для химчистки (одежда / ковры / мебель) ────────────────

-- 1. Тип заказа в cleaning_orders
ALTER TABLE cleaning_orders
  ADD COLUMN IF NOT EXISTS order_type    text NOT NULL DEFAULT 'clothing'
                                         CHECK (order_type IN ('clothing','carpet','furniture')),
  ADD COLUMN IF NOT EXISTS pickup_date   date,          -- ковры: дата забора
  ADD COLUMN IF NOT EXISTS delivery_date date,          -- ковры: дата возврата
  ADD COLUMN IF NOT EXISTS visit_address text,          -- мебель: адрес выезда
  ADD COLUMN IF NOT EXISTS visit_date    timestamptz;   -- мебель: дата/время выезда

-- 2. Размеры изделия в cleaning_order_items (для ковров)
ALTER TABLE cleaning_order_items
  ADD COLUMN IF NOT EXISTS width_m  numeric(6,2),   -- ширина, м
  ADD COLUMN IF NOT EXISTS length_m numeric(6,2),   -- длина, м
  ADD COLUMN IF NOT EXISTS area_m2  numeric(8,2);   -- площадь = width × length

-- 3. Дополнительные типы изделий: ковры и мягкая мебель
INSERT INTO cleaning_item_types
  (product, name, default_price, default_days, sort_order)
VALUES
  -- Ковры (цена за кв.м)
  ('cleaning', 'Ковёр тканый (кв.м)',        45000, 5, 20),
  ('cleaning', 'Ковёр шерстяной (кв.м)',      65000, 6, 21),
  ('cleaning', 'Ковёр шёлковый (кв.м)',      100000, 7, 22),
  ('cleaning', 'Ковёр синтетический (кв.м)',  35000, 4, 23),
  -- Мягкая мебель
  ('cleaning', 'Диван 2-местный',            250000, 3, 30),
  ('cleaning', 'Диван 3-местный',            350000, 3, 31),
  ('cleaning', 'Угловой диван',              450000, 4, 32),
  ('cleaning', 'Кресло',                     150000, 2, 33),
  ('cleaning', 'Матрас односпальный',        180000, 3, 34),
  ('cleaning', 'Матрас двуспальный',         250000, 3, 35),
  ('cleaning', 'Пуфик',                       80000, 2, 36)
ON CONFLICT DO NOTHING;
