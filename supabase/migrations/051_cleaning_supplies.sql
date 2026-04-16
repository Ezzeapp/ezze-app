-- 051: Cleaning supplies / inventory tracking

CREATE TABLE IF NOT EXISTS cleaning_supplies (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product        TEXT NOT NULL DEFAULT 'cleaning',
  name           TEXT NOT NULL,
  category       TEXT DEFAULT 'other',
  unit           TEXT DEFAULT 'шт',
  quantity       NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_quantity   NUMERIC(10,2) DEFAULT 0,
  price_per_unit NUMERIC(10,2) DEFAULT 0,
  supplier       TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cleaning_supplies_category ON cleaning_supplies(category);
CREATE INDEX IF NOT EXISTS idx_cleaning_supplies_product ON cleaning_supplies(product);

CREATE TABLE IF NOT EXISTS cleaning_supply_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supply_id   UUID NOT NULL REFERENCES cleaning_supplies(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL,  -- 'in', 'out', 'adjust'
  quantity    NUMERIC(10,2) NOT NULL,
  note        TEXT,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cleaning_supply_log_supply ON cleaning_supply_log(supply_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_supply_log_date ON cleaning_supply_log(created_at);

ALTER TABLE cleaning_supplies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cleaning_supplies_read" ON cleaning_supplies FOR SELECT USING (true);
CREATE POLICY "cleaning_supplies_write" ON cleaning_supplies FOR ALL USING (auth.uid() IS NOT NULL);

ALTER TABLE cleaning_supply_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cleaning_supply_log_read" ON cleaning_supply_log FOR SELECT USING (true);
CREATE POLICY "cleaning_supply_log_write" ON cleaning_supply_log FOR ALL USING (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS set_updated_at ON cleaning_supplies;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON cleaning_supplies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
