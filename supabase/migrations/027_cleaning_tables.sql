-- ─────────────────────────────────────────────────────────────────
-- 027_cleaning_tables.sql
-- Таблицы для продукта "Химчистка" (cleaning)
-- ─────────────────────────────────────────────────────────────────

-- 1. Справочник типов изделий
CREATE TABLE IF NOT EXISTS cleaning_item_types (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product      TEXT NOT NULL DEFAULT 'cleaning',
  name         TEXT NOT NULL,
  default_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  default_days  INT NOT NULL DEFAULT 3,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product, name)
);

-- 2. Квитанции (заказы)
CREATE TABLE IF NOT EXISTS cleaning_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product         TEXT NOT NULL DEFAULT 'cleaning',
  number          TEXT NOT NULL,                         -- КВ-0001
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  accepted_by     UUID REFERENCES master_profiles(id) ON DELETE SET NULL,
  assigned_to     UUID REFERENCES master_profiles(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'received'
                    CHECK (status IN ('received','in_progress','ready','issued','paid','cancelled')),
  payment_status  TEXT NOT NULL DEFAULT 'unpaid'
                    CHECK (payment_status IN ('unpaid','partial','paid')),
  prepaid_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  ready_date      DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product, number)
);

-- 3. Изделия внутри квитанции
CREATE TABLE IF NOT EXISTS cleaning_order_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES cleaning_orders(id) ON DELETE CASCADE,
  item_type_id     UUID REFERENCES cleaning_item_types(id) ON DELETE SET NULL,
  item_type_name   TEXT NOT NULL,                        -- snapshot названия
  color            TEXT,
  brand            TEXT,
  defects          TEXT,
  price            NUMERIC(10,2) NOT NULL DEFAULT 0,
  ready_date       DATE,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','ready','issued')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. История изменений статуса квитанции
CREATE TABLE IF NOT EXISTS cleaning_order_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES cleaning_orders(id) ON DELETE CASCADE,
  changed_by  UUID REFERENCES master_profiles(id) ON DELETE SET NULL,
  old_status  TEXT,
  new_status  TEXT NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Автообновление updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_cleaning_order_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_cleaning_order_updated_at ON cleaning_orders;
CREATE TRIGGER trg_cleaning_order_updated_at
  BEFORE UPDATE ON cleaning_orders
  FOR EACH ROW EXECUTE FUNCTION update_cleaning_order_updated_at();

-- ── Автоинкремент номера квитанции ──────────────────────────────
CREATE SEQUENCE IF NOT EXISTS cleaning_order_seq;

CREATE OR REPLACE FUNCTION generate_cleaning_order_number(p_product TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  seq BIGINT;
BEGIN
  seq := nextval('cleaning_order_seq');
  RETURN 'КВ-' || LPAD(seq::TEXT, 4, '0');
END;
$$;

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE cleaning_item_types    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_order_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_order_history ENABLE ROW LEVEL SECURITY;

-- Политики: authenticated пользователи читают/пишут свой product
CREATE POLICY "cleaning_item_types_all" ON cleaning_item_types
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "cleaning_orders_all" ON cleaning_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "cleaning_order_items_all" ON cleaning_order_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "cleaning_order_history_all" ON cleaning_order_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Дефолтные типы изделий ───────────────────────────────────────
INSERT INTO cleaning_item_types (product, name, default_price, default_days, sort_order) VALUES
  ('cleaning', 'Пальто',           150000, 5, 1),
  ('cleaning', 'Куртка',           120000, 4, 2),
  ('cleaning', 'Костюм',           130000, 4, 3),
  ('cleaning', 'Платье',            80000, 3, 4),
  ('cleaning', 'Рубашка',           30000, 2, 5),
  ('cleaning', 'Брюки',             50000, 3, 6),
  ('cleaning', 'Пуховик',          180000, 5, 7),
  ('cleaning', 'Ковёр (1 кв.м)',    50000, 7, 8),
  ('cleaning', 'Одеяло',            80000, 4, 9),
  ('cleaning', 'Подушка',           40000, 3, 10),
  ('cleaning', 'Шторы (1 пара)',    100000, 5, 11),
  ('cleaning', 'Обувь (пара)',       60000, 3, 12)
ON CONFLICT (product, name) DO NOTHING;
