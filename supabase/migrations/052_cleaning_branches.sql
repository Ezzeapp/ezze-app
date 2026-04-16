-- 052: Cleaning multi-branch support

CREATE TABLE IF NOT EXISTS cleaning_branches (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product    TEXT NOT NULL DEFAULT 'cleaning',
  name       TEXT NOT NULL,
  address    TEXT,
  phone      TEXT,
  is_main    BOOLEAN DEFAULT false,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cleaning_branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cleaning_branches_read" ON cleaning_branches FOR SELECT USING (true);
CREATE POLICY "cleaning_branches_write" ON cleaning_branches FOR ALL USING (auth.uid() IS NOT NULL);

-- Link orders to branches
ALTER TABLE cleaning_orders ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES cleaning_branches(id);
CREATE INDEX IF NOT EXISTS idx_cleaning_orders_branch ON cleaning_orders(branch_id);
