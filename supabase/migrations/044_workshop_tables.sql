-- ─────────────────────────────────────────────────────────────────
-- 044_workshop_tables.sql
-- Таблицы для продукта "Мастерская / Ремонт" (workshop)
-- Универсальная схема: электроника, быттехника, часы, обувь, мебель, велосипеды и т.д.
-- ─────────────────────────────────────────────────────────────────

-- 1. Справочник типов устройств / объектов ремонта
--    Настраивается мастером под свою нишу (смартфон, ноутбук, часы, пылесос...)
CREATE TABLE IF NOT EXISTS workshop_item_types (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product             TEXT NOT NULL DEFAULT 'workshop',
  name                TEXT NOT NULL,
  category            TEXT,                              -- Электроника / Бытовая техника / Часы и т.д.
  default_diagnostic_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  default_days        INT NOT NULL DEFAULT 3,
  default_warranty_days INT NOT NULL DEFAULT 30,
  icon                TEXT,                              -- Lucide icon name
  sort_order          INT NOT NULL DEFAULT 0,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product, name)
);

-- 2. Устройства клиента (история: что уже приносили в ремонт)
CREATE TABLE IF NOT EXISTS workshop_devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product         TEXT NOT NULL DEFAULT 'workshop',
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  item_type_id    UUID REFERENCES workshop_item_types(id) ON DELETE SET NULL,
  item_type_name  TEXT NOT NULL,                        -- snapshot
  brand           TEXT,
  model           TEXT,
  serial_number   TEXT,
  imei            TEXT,
  purchase_date   DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workshop_devices_client ON workshop_devices(client_id);

-- 3. Заказы на ремонт (квитанции)
CREATE TABLE IF NOT EXISTS workshop_orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product              TEXT NOT NULL DEFAULT 'workshop',
  number               TEXT NOT NULL,                    -- РМ-0001
  client_id            UUID REFERENCES clients(id) ON DELETE SET NULL,
  device_id            UUID REFERENCES workshop_devices(id) ON DELETE SET NULL,
  accepted_by          UUID REFERENCES master_profiles(id) ON DELETE SET NULL,   -- кто принял
  assigned_to          UUID REFERENCES master_profiles(id) ON DELETE SET NULL,   -- мастер-ремонтник
  -- Информация об устройстве (snapshot на момент приёма)
  item_type_id         UUID REFERENCES workshop_item_types(id) ON DELETE SET NULL,
  item_type_name       TEXT NOT NULL DEFAULT '',
  brand                TEXT,
  model                TEXT,
  serial_number        TEXT,
  imei                 TEXT,
  -- Приёмка
  defect_description   TEXT,                             -- со слов клиента
  visible_defects      TEXT,                             -- внешний вид, царапины, сколы
  completeness         TEXT,                             -- что в комплекте (зарядка, чехол...)
  -- Диагностика
  diagnostic_notes     TEXT,                             -- что нашли мастера
  diagnostic_price     NUMERIC(10,2) NOT NULL DEFAULT 0, -- цена диагностики (если отказ)
  estimated_cost       NUMERIC(10,2),                    -- оценка ремонта
  client_approved      BOOLEAN NOT NULL DEFAULT FALSE,   -- клиент согласовал стоимость
  client_approved_at   TIMESTAMPTZ,
  -- Статус и финансы
  status               TEXT NOT NULL DEFAULT 'received'
                         CHECK (status IN (
                           'received',       -- принят
                           'diagnosing',     -- на диагностике
                           'waiting_approval', -- ждём согласие клиента
                           'waiting_parts',  -- ждём запчасти
                           'in_progress',    -- в ремонте
                           'ready',          -- готов к выдаче
                           'issued',         -- выдан
                           'paid',           -- оплачен
                           'refused',        -- клиент отказался
                           'cancelled'       -- отменён
                         )),
  payment_status       TEXT NOT NULL DEFAULT 'unpaid'
                         CHECK (payment_status IN ('unpaid','partial','paid')),
  prepaid_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  works_amount         NUMERIC(10,2) NOT NULL DEFAULT 0, -- сумма работ
  parts_amount         NUMERIC(10,2) NOT NULL DEFAULT 0, -- сумма запчастей
  total_amount         NUMERIC(10,2) NOT NULL DEFAULT 0, -- итого к оплате
  paid_amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Сроки и гарантия
  ready_date           DATE,                             -- обещанная дата готовности
  issued_at            TIMESTAMPTZ,                      -- когда выдан
  warranty_days        INT NOT NULL DEFAULT 0,           -- гарантия в днях от даты выдачи
  -- Прочее
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product, number)
);
CREATE INDEX IF NOT EXISTS idx_workshop_orders_product_status ON workshop_orders(product, status);
CREATE INDEX IF NOT EXISTS idx_workshop_orders_client ON workshop_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_workshop_orders_created ON workshop_orders(created_at DESC);

-- 4. Работы в заказе (услуги мастера)
CREATE TABLE IF NOT EXISTS workshop_order_works (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES workshop_orders(id) ON DELETE CASCADE,
  service_id   UUID REFERENCES services(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,                           -- snapshot названия
  price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  quantity     NUMERIC(10,2) NOT NULL DEFAULT 1,
  performed_by UUID REFERENCES master_profiles(id) ON DELETE SET NULL,
  done         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workshop_order_works_order ON workshop_order_works(order_id);

-- 5. Запчасти в заказе (списание со склада)
CREATE TABLE IF NOT EXISTS workshop_order_parts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID NOT NULL REFERENCES workshop_orders(id) ON DELETE CASCADE,
  inventory_item_id  UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  name               TEXT NOT NULL,                     -- snapshot
  sku                TEXT,
  quantity           NUMERIC(10,2) NOT NULL DEFAULT 1,
  cost_price         NUMERIC(10,2) NOT NULL DEFAULT 0,  -- себестоимость (для прибыли)
  sell_price         NUMERIC(10,2) NOT NULL DEFAULT 0,  -- цена продажи клиенту
  warranty_days      INT NOT NULL DEFAULT 0,            -- гарантия на запчасть
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workshop_order_parts_order ON workshop_order_parts(order_id);

-- 6. История изменений статусов и действий
CREATE TABLE IF NOT EXISTS workshop_order_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES workshop_orders(id) ON DELETE CASCADE,
  changed_by  UUID REFERENCES master_profiles(id) ON DELETE SET NULL,
  old_status  TEXT,
  new_status  TEXT NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workshop_order_history_order ON workshop_order_history(order_id);

-- ── Автообновление updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_workshop_order_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_workshop_order_updated_at ON workshop_orders;
CREATE TRIGGER trg_workshop_order_updated_at
  BEFORE UPDATE ON workshop_orders
  FOR EACH ROW EXECUTE FUNCTION update_workshop_order_updated_at();

-- ── Автоинкремент номера квитанции (РМ-0001) ─────────────────────
CREATE SEQUENCE IF NOT EXISTS workshop_order_seq;

CREATE OR REPLACE FUNCTION generate_workshop_order_number(p_product TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  seq BIGINT;
BEGIN
  seq := nextval('workshop_order_seq');
  RETURN 'РМ-' || LPAD(seq::TEXT, 4, '0');
END;
$$;

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE workshop_item_types     ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_devices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_order_works    ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_order_parts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_order_history  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workshop_item_types_all"    ON workshop_item_types    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "workshop_devices_all"       ON workshop_devices       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "workshop_orders_all"        ON workshop_orders        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "workshop_order_works_all"   ON workshop_order_works   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "workshop_order_parts_all"   ON workshop_order_parts   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "workshop_order_history_all" ON workshop_order_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Публичное чтение статуса заказа по номеру (для /track/:number) ──
-- Позволяет клиенту отслеживать заказ без авторизации
CREATE POLICY "workshop_orders_public_track" ON workshop_orders
  FOR SELECT TO anon USING (true);

-- ── Дефолтные типы устройств (универсальный стартовый набор) ─────
INSERT INTO workshop_item_types (product, name, category, default_diagnostic_price, default_days, default_warranty_days, icon, sort_order) VALUES
  ('workshop', 'Смартфон',         'Электроника',       50000,  2,  90, 'Smartphone',       1),
  ('workshop', 'Планшет',          'Электроника',       50000,  3,  90, 'Tablet',           2),
  ('workshop', 'Ноутбук',          'Электроника',       80000,  5,  90, 'Laptop',           3),
  ('workshop', 'Компьютер',        'Электроника',       80000,  3,  90, 'Monitor',          4),
  ('workshop', 'Телевизор',        'Электроника',      100000,  5, 180, 'Tv',               5),
  ('workshop', 'Наушники',         'Электроника',       30000,  2,  30, 'Headphones',       6),
  ('workshop', 'Часы',             'Часы',              50000,  7,  90, 'Watch',            7),
  ('workshop', 'Стиральная машина','Бытовая техника',  100000,  3, 180, 'WashingMachine',   8),
  ('workshop', 'Холодильник',      'Бытовая техника',  120000,  3, 180, 'Refrigerator',     9),
  ('workshop', 'Микроволновка',    'Бытовая техника',   50000,  2,  90, 'Microwave',       10),
  ('workshop', 'Пылесос',          'Бытовая техника',   40000,  2,  90, 'Wind',            11),
  ('workshop', 'Кондиционер',      'Бытовая техника',  100000,  5, 180, 'AirVent',         12),
  ('workshop', 'Обувь',            'Обувь и одежда',    20000,  3,  30, 'Footprints',      13),
  ('workshop', 'Велосипед',        'Транспорт',         40000,  3,  60, 'Bike',            14),
  ('workshop', 'Мебель',           'Мебель',            50000,  5,  60, 'Sofa',            15),
  ('workshop', 'Другое',           'Прочее',            30000,  3,  30, 'Package',         99)
ON CONFLICT (product, name) DO NOTHING;
