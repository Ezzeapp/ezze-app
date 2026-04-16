-- 050: Cleaning loyalty / discount tiers

CREATE TABLE IF NOT EXISTS cleaning_loyalty (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product             TEXT NOT NULL DEFAULT 'cleaning',
  total_orders        INT NOT NULL DEFAULT 0,
  total_spent         NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  tier                TEXT NOT NULL DEFAULT 'bronze',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, product)
);

CREATE INDEX IF NOT EXISTS idx_cleaning_loyalty_client ON cleaning_loyalty(client_id);

ALTER TABLE cleaning_loyalty ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cleaning_loyalty_read" ON cleaning_loyalty FOR SELECT USING (true);
CREATE POLICY "cleaning_loyalty_write" ON cleaning_loyalty FOR ALL USING (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS set_updated_at ON cleaning_loyalty;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON cleaning_loyalty
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Recalculate loyalty tier for a client
CREATE OR REPLACE FUNCTION recalc_cleaning_loyalty(p_client_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT;
  v_spent NUMERIC(12,2);
  v_tier  TEXT;
  v_disc  NUMERIC(5,2);
BEGIN
  SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
  INTO v_count, v_spent
  FROM cleaning_orders
  WHERE client_id = p_client_id
    AND status IN ('paid', 'issued', 'ready');

  IF v_count >= 30 THEN
    v_tier := 'platinum'; v_disc := 10;
  ELSIF v_count >= 15 THEN
    v_tier := 'gold'; v_disc := 5;
  ELSIF v_count >= 5 THEN
    v_tier := 'silver'; v_disc := 3;
  ELSE
    v_tier := 'bronze'; v_disc := 0;
  END IF;

  INSERT INTO cleaning_loyalty (client_id, product, total_orders, total_spent, current_discount_pct, tier)
  VALUES (p_client_id, 'cleaning', v_count, v_spent, v_disc, v_tier)
  ON CONFLICT (client_id, product) DO UPDATE SET
    total_orders = v_count,
    total_spent = v_spent,
    current_discount_pct = v_disc,
    tier = v_tier;
END;
$$;
