-- ─────────────────────────────────────────────────────────────────
-- 037_farm_sales.sql
-- Продажи продукта Farm: заказ + строки (животное / продукция / урожай / прочее)
-- ─────────────────────────────────────────────────────────────────

-- 1. Продажа (заголовок заказа)
CREATE TABLE IF NOT EXISTS farm_sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  master_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  buyer_name      TEXT,
  buyer_contact   TEXT,
  channel         TEXT NOT NULL DEFAULT 'direct' CHECK (channel IN ('retail','wholesale','market','direct','other')),
  total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_status  TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_farm_sales_master ON farm_sales(master_id);
CREATE INDEX idx_farm_sales_farm   ON farm_sales(farm_id);
CREATE INDEX idx_farm_sales_date   ON farm_sales(date);

-- 2. Строка продажи (что именно продано)
CREATE TABLE IF NOT EXISTS farm_sale_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id         UUID NOT NULL REFERENCES farm_sales(id) ON DELETE CASCADE,
  farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  master_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type       TEXT NOT NULL CHECK (item_type IN ('animal','production','crop','other')),
  animal_id       UUID REFERENCES animals(id) ON DELETE SET NULL,
  production_id   UUID REFERENCES production(id) ON DELETE SET NULL,
  crop_id         UUID REFERENCES crops(id) ON DELETE SET NULL,
  group_id        UUID REFERENCES animal_groups(id) ON DELETE SET NULL,
  description     TEXT,
  quantity        NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit            TEXT,
  price_per_unit  NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_farm_sale_items_sale       ON farm_sale_items(sale_id);
CREATE INDEX idx_farm_sale_items_farm       ON farm_sale_items(farm_id);
CREATE INDEX idx_farm_sale_items_animal     ON farm_sale_items(animal_id);
CREATE INDEX idx_farm_sale_items_production ON farm_sale_items(production_id);
CREATE INDEX idx_farm_sale_items_crop       ON farm_sale_items(crop_id);
CREATE INDEX idx_farm_sale_items_group      ON farm_sale_items(group_id);

-- ── Триггер updated_at ───────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_farm_sales_updated ON farm_sales;
CREATE TRIGGER trg_farm_sales_updated
  BEFORE UPDATE ON farm_sales
  FOR EACH ROW EXECUTE FUNCTION update_farm_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE farm_sales      ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "farm_farm_sales_all"      ON farm_sales      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "farm_farm_sale_items_all" ON farm_sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
