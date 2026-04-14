-- ─────────────────────────────────────────────────────────────────
-- 038_clinic_lab_pharmacy.sql
-- Laboratory + Pharmacy tables for clinic product
-- ─────────────────────────────────────────────────────────────────

-- ══════════════ LABORATORY ══════════════

-- 1. Справочник анализов
CREATE TABLE IF NOT EXISTS clinic_lab_tests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT,
  unit        TEXT,
  ref_min     NUMERIC,
  ref_max     NUMERIC,
  ref_text    TEXT,
  price       NUMERIC,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_lab_tests_master ON clinic_lab_tests(master_id);

-- 2. Направления на анализы
CREATE TABLE IF NOT EXISTS clinic_lab_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  visit_id      UUID REFERENCES clinic_visits(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'ordered'
                  CHECK (status IN ('ordered','in_progress','completed','cancelled')),
  notes         TEXT,
  ordered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_lab_orders_master ON clinic_lab_orders(master_id);
CREATE INDEX idx_clinic_lab_orders_client ON clinic_lab_orders(client_id);
CREATE INDEX idx_clinic_lab_orders_visit  ON clinic_lab_orders(visit_id);
CREATE INDEX idx_clinic_lab_orders_status ON clinic_lab_orders(status);

-- 3. Позиции направления
CREATE TABLE IF NOT EXISTS clinic_lab_order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES clinic_lab_orders(id) ON DELETE CASCADE,
  test_id       UUID REFERENCES clinic_lab_tests(id) ON DELETE SET NULL,
  test_name     TEXT NOT NULL,
  result_value  TEXT,
  result_unit   TEXT,
  ref_min       NUMERIC,
  ref_max       NUMERIC,
  ref_text      TEXT,
  flag          TEXT CHECK (flag IN ('normal','low','high','abnormal')),
  notes         TEXT,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_lab_order_items_order ON clinic_lab_order_items(order_id);
CREATE INDEX idx_clinic_lab_order_items_test  ON clinic_lab_order_items(test_id);

-- ══════════════ PHARMACY ══════════════

-- 4. Склад лекарств
CREATE TABLE IF NOT EXISTS clinic_pharmacy_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  generic_name          TEXT,
  category              TEXT,
  dosage_form           TEXT CHECK (dosage_form IN (
                          'tablet','capsule','injection','syrup',
                          'cream','drops','ointment','powder',
                          'solution','suppository','inhaler','other'
                        )),
  manufacturer          TEXT,
  sku                   TEXT,
  quantity              NUMERIC NOT NULL DEFAULT 0,
  min_quantity          NUMERIC NOT NULL DEFAULT 0,
  cost_price            NUMERIC,
  sell_price            NUMERIC,
  expiry_date           DATE,
  prescription_required BOOLEAN NOT NULL DEFAULT false,
  unit                  TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_pharmacy_items_master ON clinic_pharmacy_items(master_id);
CREATE INDEX idx_clinic_pharmacy_items_expiry ON clinic_pharmacy_items(expiry_date);

-- 5. Приход лекарств
CREATE TABLE IF NOT EXISTS clinic_pharmacy_receipts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES clinic_pharmacy_items(id) ON DELETE CASCADE,
  quantity      NUMERIC NOT NULL,
  cost_price    NUMERIC,
  supplier      TEXT,
  batch_number  TEXT,
  expiry_date   DATE,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_pharmacy_receipts_master ON clinic_pharmacy_receipts(master_id);
CREATE INDEX idx_clinic_pharmacy_receipts_item   ON clinic_pharmacy_receipts(item_id);

-- 6. Отпуск лекарств пациентам
CREATE TABLE IF NOT EXISTS clinic_dispensing (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  visit_id      UUID REFERENCES clinic_visits(id) ON DELETE SET NULL,
  item_id       UUID NOT NULL REFERENCES clinic_pharmacy_items(id) ON DELETE RESTRICT,
  quantity      NUMERIC NOT NULL,
  price         NUMERIC,
  notes         TEXT,
  dispensed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_dispensing_master ON clinic_dispensing(master_id);
CREATE INDEX idx_clinic_dispensing_client ON clinic_dispensing(client_id);
CREATE INDEX idx_clinic_dispensing_visit  ON clinic_dispensing(visit_id);
CREATE INDEX idx_clinic_dispensing_item   ON clinic_dispensing(item_id);

-- ── updated_at triggers (reuse update_clinic_updated_at from 035) ──
DROP TRIGGER IF EXISTS trg_clinic_lab_tests_updated ON clinic_lab_tests;
CREATE TRIGGER trg_clinic_lab_tests_updated
  BEFORE UPDATE ON clinic_lab_tests
  FOR EACH ROW EXECUTE FUNCTION update_clinic_updated_at();

DROP TRIGGER IF EXISTS trg_clinic_lab_orders_updated ON clinic_lab_orders;
CREATE TRIGGER trg_clinic_lab_orders_updated
  BEFORE UPDATE ON clinic_lab_orders
  FOR EACH ROW EXECUTE FUNCTION update_clinic_updated_at();

DROP TRIGGER IF EXISTS trg_clinic_pharmacy_items_updated ON clinic_pharmacy_items;
CREATE TRIGGER trg_clinic_pharmacy_items_updated
  BEFORE UPDATE ON clinic_pharmacy_items
  FOR EACH ROW EXECUTE FUNCTION update_clinic_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE clinic_lab_tests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_lab_orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_lab_order_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_pharmacy_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_pharmacy_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_dispensing        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_lab_tests_all" ON clinic_lab_tests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clinic_lab_orders_all" ON clinic_lab_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clinic_lab_order_items_all" ON clinic_lab_order_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clinic_pharmacy_items_all" ON clinic_pharmacy_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clinic_pharmacy_receipts_all" ON clinic_pharmacy_receipts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clinic_dispensing_all" ON clinic_dispensing
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
