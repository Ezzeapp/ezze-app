-- ── 031: Add product column to global catalogs ────────────────────────────────
ALTER TABLE global_services ADD COLUMN IF NOT EXISTS product TEXT;
ALTER TABLE global_products ADD COLUMN IF NOT EXISTS product TEXT;
CREATE INDEX IF NOT EXISTS idx_global_services_product ON global_services(product);
CREATE INDEX IF NOT EXISTS idx_global_products_product ON global_products(product);
