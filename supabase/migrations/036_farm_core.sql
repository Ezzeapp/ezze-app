-- ─────────────────────────────────────────────────────────────────
-- 036_farm_core.sql
-- Таблицы продукта "Farm" (фермерское хозяйство)
-- 14 таблиц: фермы, животные, группы, события, поля, культуры,
-- корма, расход кормов, продукция, расходы, техника, ТО,
-- пастбища, инкубатор
-- ─────────────────────────────────────────────────────────────────

-- 1. Ферма (площадка)
CREATE TABLE IF NOT EXISTS farms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  location    TEXT,
  area_ha     NUMERIC(10,2),
  currency    TEXT NOT NULL DEFAULT 'UZS',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_farms_user ON farms(user_id);

-- 2. Группа животных (стадо / загон / партия)
CREATE TABLE IF NOT EXISTS animal_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id     UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  master_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  species     TEXT NOT NULL CHECK (species IN ('cattle','poultry','sheep','goat','pig','rabbit','bee','fish','horse','other')),
  purpose     TEXT CHECK (purpose IN ('dairy','meat','eggs','wool','breeding','mixed')),
  location    TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_animal_groups_master ON animal_groups(master_id);
CREATE INDEX idx_animal_groups_farm    ON animal_groups(farm_id);

-- 3. Животное
CREATE TABLE IF NOT EXISTS animals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id           UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  master_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id          UUID REFERENCES animal_groups(id) ON DELETE SET NULL,
  tag               TEXT NOT NULL,
  name              TEXT,
  species           TEXT NOT NULL CHECK (species IN ('cattle','poultry','sheep','goat','pig','rabbit','bee','fish','horse','other')),
  breed             TEXT,
  sex               TEXT NOT NULL DEFAULT 'unknown' CHECK (sex IN ('male','female','unknown')),
  status            TEXT NOT NULL DEFAULT 'growing' CHECK (status IN ('growing','dairy','meat','breeding','sold','slaughtered','dead')),
  purpose           TEXT CHECK (purpose IN ('dairy','meat','eggs','wool','breeding','mixed')),
  birth_date        DATE,
  acquisition_date  DATE,
  acquisition_cost  NUMERIC(14,2),
  mother_id         UUID REFERENCES animals(id) ON DELETE SET NULL,
  father_id         UUID REFERENCES animals(id) ON DELETE SET NULL,
  current_weight_kg NUMERIC(10,2),
  species_attrs     JSONB NOT NULL DEFAULT '{}',
  photo_url         TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_animals_master   ON animals(master_id);
CREATE INDEX idx_animals_farm     ON animals(farm_id);
CREATE INDEX idx_animals_group    ON animals(group_id);
CREATE INDEX idx_animals_species  ON animals(species);
CREATE INDEX idx_animals_status   ON animals(status);
CREATE INDEX idx_animals_tag      ON animals(farm_id, tag);
CREATE INDEX idx_animals_mother   ON animals(mother_id);
CREATE INDEX idx_animals_father   ON animals(father_id);

-- 4. Событие животного (взвешивание, вакцинация, лечение, осмотр, случка, роды и т.д.)
CREATE TABLE IF NOT EXISTS animal_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id     UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  master_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  animal_id   UUID REFERENCES animals(id) ON DELETE CASCADE,
  group_id    UUID REFERENCES animal_groups(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL CHECK (event_type IN ('weighing','vaccination','treatment','exam','mating','pregnancy','birth','transfer','note')),
  event_date  TIMESTAMPTZ NOT NULL DEFAULT now(),
  weight_kg   NUMERIC(10,2),
  data        JSONB NOT NULL DEFAULT '{}',
  cost        NUMERIC(14,2),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_animal_events_master  ON animal_events(master_id);
CREATE INDEX idx_animal_events_farm    ON animal_events(farm_id);
CREATE INDEX idx_animal_events_animal  ON animal_events(animal_id);
CREATE INDEX idx_animal_events_group   ON animal_events(group_id);
CREATE INDEX idx_animal_events_type    ON animal_events(event_type);
CREATE INDEX idx_animal_events_date    ON animal_events(event_date);

-- 5. Поле (пассив, земельный участок)
CREATE TABLE IF NOT EXISTS fields (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id       UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  master_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  area_ha       NUMERIC(10,2) NOT NULL,
  soil_type     TEXT,
  status        TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','sown','growing','harvested')),
  current_crop  TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fields_master ON fields(master_id);
CREATE INDEX idx_fields_farm   ON fields(farm_id);

-- 6. Посев / урожай (культура на поле)
CREATE TABLE IF NOT EXISTS crops (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id               UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  master_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field_id              UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  use                   TEXT NOT NULL DEFAULT 'feed' CHECK (use IN ('feed','sale','mixed')),
  sown_date             DATE,
  expected_harvest_date DATE,
  harvested_date        DATE,
  yield_kg              NUMERIC(12,2),
  total_cost            NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crops_master ON crops(master_id);
CREATE INDEX idx_crops_farm   ON crops(farm_id);
CREATE INDEX idx_crops_field  ON crops(field_id);

-- 7. Склад кормов (позиция)
CREATE TABLE IF NOT EXISTS feed_stock (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id               UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  master_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  unit                  TEXT NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg','t','l','bale')),
  quantity              NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_per_unit         NUMERIC(14,2) NOT NULL DEFAULT 0,
  source                TEXT NOT NULL DEFAULT 'purchased' CHECK (source IN ('own','purchased')),
  crop_id               UUID REFERENCES crops(id) ON DELETE SET NULL,
  low_stock_threshold   NUMERIC(12,2),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feed_stock_master ON feed_stock(master_id);
CREATE INDEX idx_feed_stock_farm   ON feed_stock(farm_id);
CREATE INDEX idx_feed_stock_crop   ON feed_stock(crop_id);

-- 8. Расход корма
CREATE TABLE IF NOT EXISTS feed_consumption (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id     UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  master_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feed_id     UUID NOT NULL REFERENCES feed_stock(id) ON DELETE CASCADE,
  group_id    UUID REFERENCES animal_groups(id) ON DELETE SET NULL,
  animal_id   UUID REFERENCES animals(id) ON DELETE SET NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity    NUMERIC(12,2) NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feed_consumption_master ON feed_consumption(master_id);
CREATE INDEX idx_feed_consumption_farm   ON feed_consumption(farm_id);
CREATE INDEX idx_feed_consumption_feed   ON feed_consumption(feed_id);
CREATE INDEX idx_feed_consumption_group  ON feed_consumption(group_id);
CREATE INDEX idx_feed_consumption_animal ON feed_consumption(animal_id);
CREATE INDEX idx_feed_consumption_date   ON feed_consumption(date);

-- 9. Продукция (молоко, яйца, мясо, шерсть, мёд, потомство)
CREATE TABLE IF NOT EXISTS production (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id     UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  master_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('milk','eggs','meat','wool','honey','offspring')),
  animal_id   UUID REFERENCES animals(id) ON DELETE SET NULL,
  group_id    UUID REFERENCES animal_groups(id) ON DELETE SET NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity    NUMERIC(12,2) NOT NULL,
  quality     TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_production_master ON production(master_id);
CREATE INDEX idx_production_farm   ON production(farm_id);
CREATE INDEX idx_production_type   ON production(type);
CREATE INDEX idx_production_animal ON production(animal_id);
CREATE INDEX idx_production_group  ON production(group_id);
CREATE INDEX idx_production_date   ON production(date);

-- 10. Техника (сначала создаётся, т.к. farm_expenses ссылается)
CREATE TABLE IF NOT EXISTS farm_equipment (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id               UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  master_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  category              TEXT,
  purchase_date         DATE,
  purchase_cost         NUMERIC(14,2),
  useful_life_months    INT,
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','repair','decommissioned')),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_farm_equipment_master ON farm_equipment(master_id);
CREATE INDEX idx_farm_equipment_farm   ON farm_equipment(farm_id);

-- 11. Расходы фермы (с опциональной аллокацией на животное/группу/поле/технику)
CREATE TABLE IF NOT EXISTS farm_expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id       UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  master_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category      TEXT NOT NULL CHECK (category IN ('feed','veterinary','salary','utilities','fuel','rent','repair','equipment','seeds','fertilizer','transport','other')),
  amount        NUMERIC(14,2) NOT NULL,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  description   TEXT,
  animal_id     UUID REFERENCES animals(id) ON DELETE SET NULL,
  group_id      UUID REFERENCES animal_groups(id) ON DELETE SET NULL,
  field_id      UUID REFERENCES fields(id) ON DELETE SET NULL,
  equipment_id  UUID REFERENCES farm_equipment(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_farm_expenses_master   ON farm_expenses(master_id);
CREATE INDEX idx_farm_expenses_farm     ON farm_expenses(farm_id);
CREATE INDEX idx_farm_expenses_category ON farm_expenses(category);
CREATE INDEX idx_farm_expenses_date     ON farm_expenses(date);

-- 12. Техническое обслуживание / ремонт
CREATE TABLE IF NOT EXISTS equipment_maintenance (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id       UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  master_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  equipment_id  UUID NOT NULL REFERENCES farm_equipment(id) ON DELETE CASCADE,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  type          TEXT NOT NULL CHECK (type IN ('service','repair','fuel','insurance')),
  cost          NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_equipment_maintenance_master    ON equipment_maintenance(master_id);
CREATE INDEX idx_equipment_maintenance_farm      ON equipment_maintenance(farm_id);
CREATE INDEX idx_equipment_maintenance_equipment ON equipment_maintenance(equipment_id);
CREATE INDEX idx_equipment_maintenance_date      ON equipment_maintenance(date);

-- 13. Пастбище
CREATE TABLE IF NOT EXISTS pastures (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id           UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  master_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  area_ha           NUMERIC(10,2) NOT NULL,
  capacity_heads    INT,
  current_group_id  UUID REFERENCES animal_groups(id) ON DELETE SET NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pastures_master ON pastures(master_id);
CREATE INDEX idx_pastures_farm   ON pastures(farm_id);

-- 14. Инкубатор (партия закладки яиц)
CREATE TABLE IF NOT EXISTS incubations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id               UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  master_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  species               TEXT NOT NULL CHECK (species IN ('cattle','poultry','sheep','goat','pig','rabbit','bee','fish','horse','other')),
  eggs_loaded           INT NOT NULL,
  start_date            DATE NOT NULL,
  expected_hatch_date   DATE NOT NULL,
  actual_hatch_date     DATE,
  eggs_hatched          INT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_incubations_master ON incubations(master_id);
CREATE INDEX idx_incubations_farm   ON incubations(farm_id);

-- ── Автообновление updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_farm_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_farms_updated ON farms;
CREATE TRIGGER trg_farms_updated
  BEFORE UPDATE ON farms
  FOR EACH ROW EXECUTE FUNCTION update_farm_updated_at();

DROP TRIGGER IF EXISTS trg_animals_updated ON animals;
CREATE TRIGGER trg_animals_updated
  BEFORE UPDATE ON animals
  FOR EACH ROW EXECUTE FUNCTION update_farm_updated_at();

DROP TRIGGER IF EXISTS trg_feed_stock_updated ON feed_stock;
CREATE TRIGGER trg_feed_stock_updated
  BEFORE UPDATE ON feed_stock
  FOR EACH ROW EXECUTE FUNCTION update_farm_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE farms                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE animals                ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fields                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE crops                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_stock             ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_consumption       ENABLE ROW LEVEL SECURITY;
ALTER TABLE production             ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_equipment         ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_maintenance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastures               ENABLE ROW LEVEL SECURITY;
ALTER TABLE incubations            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "farm_farms_all"                 ON farms                 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "farm_animal_groups_all"         ON animal_groups         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "farm_animals_all"               ON animals               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "farm_animal_events_all"         ON animal_events         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "farm_fields_all"                ON fields                FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "farm_crops_all"                 ON crops                 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "farm_feed_stock_all"            ON feed_stock            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "farm_feed_consumption_all"      ON feed_consumption      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "farm_production_all"            ON production            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "farm_farm_equipment_all"        ON farm_equipment        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "farm_farm_expenses_all"         ON farm_expenses         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "farm_equipment_maintenance_all" ON equipment_maintenance FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "farm_pastures_all"              ON pastures              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "farm_incubations_all"           ON incubations           FOR ALL TO authenticated USING (true) WITH CHECK (true);
