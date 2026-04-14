-- ─────────────────────────────────────────────────────────────────
-- 039_clinic_inpatient_surgery_nutrition.sql
-- Стационар, Операционная, Питание
-- ─────────────────────────────────────────────────────────────────

-- ══════════════ СТАЦИОНАР ══════════════

-- 1. Отделения
CREATE TABLE IF NOT EXISTS clinic_wards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  ward_type   TEXT NOT NULL DEFAULT 'therapeutic'
              CHECK (ward_type IN ('therapeutic','surgical','intensive','pediatric','maternity','other')),
  floor       INT,
  capacity    INT NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_wards_master ON clinic_wards(master_id);

-- 2. Палаты
CREATE TABLE IF NOT EXISTS clinic_rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id     UUID NOT NULL REFERENCES clinic_wards(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  capacity    INT NOT NULL DEFAULT 1,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_rooms_ward ON clinic_rooms(ward_id);

-- 3. Койки
CREATE TABLE IF NOT EXISTS clinic_beds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES clinic_rooms(id) ON DELETE CASCADE,
  number      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'free'
              CHECK (status IN ('free','occupied','maintenance')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_beds_room   ON clinic_beds(room_id);
CREATE INDEX idx_clinic_beds_status ON clinic_beds(status);

-- 4. Госпитализации
CREATE TABLE IF NOT EXISTS clinic_hospitalizations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  visit_id          UUID REFERENCES clinic_visits(id) ON DELETE SET NULL,
  ward_id           UUID NOT NULL REFERENCES clinic_wards(id) ON DELETE RESTRICT,
  room_id           UUID NOT NULL REFERENCES clinic_rooms(id) ON DELETE RESTRICT,
  bed_id            UUID NOT NULL REFERENCES clinic_beds(id) ON DELETE RESTRICT,
  admission_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
  discharge_date    TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'admitted'
                    CHECK (status IN ('admitted','in_treatment','pre_discharge','discharged')),
  diagnosis         TEXT,
  diagnosis_code    TEXT,
  reason            TEXT,
  attending_doctor  TEXT,
  discharge_summary TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_hosp_master ON clinic_hospitalizations(master_id);
CREATE INDEX idx_clinic_hosp_client ON clinic_hospitalizations(client_id);
CREATE INDEX idx_clinic_hosp_visit  ON clinic_hospitalizations(visit_id);
CREATE INDEX idx_clinic_hosp_ward   ON clinic_hospitalizations(ward_id);
CREATE INDEX idx_clinic_hosp_bed    ON clinic_hospitalizations(bed_id);
CREATE INDEX idx_clinic_hosp_status ON clinic_hospitalizations(status);

-- 5. Дневник наблюдений
CREATE TABLE IF NOT EXISTS clinic_daily_observations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospitalization_id UUID NOT NULL REFERENCES clinic_hospitalizations(id) ON DELETE CASCADE,
  master_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  observation_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  temperature        NUMERIC,
  bp_systolic        INT,
  bp_diastolic       INT,
  pulse              INT,
  spo2               INT,
  respiratory_rate   INT,
  notes              TEXT,
  treatment_notes    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_obs_hosp ON clinic_daily_observations(hospitalization_id);
CREATE INDEX idx_clinic_obs_date ON clinic_daily_observations(observation_date);

-- ══════════════ ОПЕРАЦИОННАЯ ══════════════

-- 6. Операционные залы
CREATE TABLE IF NOT EXISTS clinic_operating_rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  equipment_notes TEXT,
  status          TEXT NOT NULL DEFAULT 'available'
                  CHECK (status IN ('available','in_use','maintenance')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_or_master ON clinic_operating_rooms(master_id);

-- 7. Операции
CREATE TABLE IF NOT EXISTS clinic_surgeries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id             UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  hospitalization_id    UUID NOT NULL REFERENCES clinic_hospitalizations(id) ON DELETE CASCADE,
  operating_room_id     UUID REFERENCES clinic_operating_rooms(id) ON DELETE SET NULL,
  scheduled_date        TIMESTAMPTZ NOT NULL,
  actual_start          TIMESTAMPTZ,
  actual_end            TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  procedure_name        TEXT NOT NULL,
  pre_op_diagnosis      TEXT,
  post_op_diagnosis     TEXT,
  anesthesia_type       TEXT CHECK (anesthesia_type IN ('general','regional','local','sedation')),
  anesthesia_duration_min INT,
  blood_loss_ml         INT,
  complications         TEXT,
  surgeon_name          TEXT,
  anesthesiologist_name TEXT,
  assistants            JSONB NOT NULL DEFAULT '[]',
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_surg_master ON clinic_surgeries(master_id);
CREATE INDEX idx_clinic_surg_client ON clinic_surgeries(client_id);
CREATE INDEX idx_clinic_surg_hosp   ON clinic_surgeries(hospitalization_id);
CREATE INDEX idx_clinic_surg_or     ON clinic_surgeries(operating_room_id);
CREATE INDEX idx_clinic_surg_status ON clinic_surgeries(status);
CREATE INDEX idx_clinic_surg_date   ON clinic_surgeries(scheduled_date);

-- ══════════════ ПИТАНИЕ ══════════════

-- 8. Диетстолы
CREATE TABLE IF NOT EXISTS clinic_diet_tables (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  number           TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  allowed_foods    TEXT,
  restricted_foods TEXT,
  calories_target  INT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_diet_master ON clinic_diet_tables(master_id);

-- 9. Назначение диеты
CREATE TABLE IF NOT EXISTS clinic_meal_plans (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospitalization_id   UUID NOT NULL REFERENCES clinic_hospitalizations(id) ON DELETE CASCADE,
  diet_table_id        UUID NOT NULL REFERENCES clinic_diet_tables(id) ON DELETE RESTRICT,
  start_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date             DATE,
  special_instructions TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_meal_plans_hosp ON clinic_meal_plans(hospitalization_id);
CREATE INDEX idx_clinic_meal_plans_diet ON clinic_meal_plans(diet_table_id);

-- 10. Записи приёмов пищи
CREATE TABLE IF NOT EXISTS clinic_meal_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id  UUID NOT NULL REFERENCES clinic_meal_plans(id) ON DELETE CASCADE,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type     TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  menu_items    TEXT,
  served        BOOLEAN NOT NULL DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_meal_rec_plan ON clinic_meal_records(meal_plan_id);
CREATE INDEX idx_clinic_meal_rec_date ON clinic_meal_records(date);

-- ── updated_at triggers (reuse update_clinic_updated_at from 035) ──
DROP TRIGGER IF EXISTS trg_clinic_wards_updated ON clinic_wards;
CREATE TRIGGER trg_clinic_wards_updated BEFORE UPDATE ON clinic_wards FOR EACH ROW EXECUTE FUNCTION update_clinic_updated_at();

DROP TRIGGER IF EXISTS trg_clinic_rooms_updated ON clinic_rooms;
CREATE TRIGGER trg_clinic_rooms_updated BEFORE UPDATE ON clinic_rooms FOR EACH ROW EXECUTE FUNCTION update_clinic_updated_at();

DROP TRIGGER IF EXISTS trg_clinic_beds_updated ON clinic_beds;
CREATE TRIGGER trg_clinic_beds_updated BEFORE UPDATE ON clinic_beds FOR EACH ROW EXECUTE FUNCTION update_clinic_updated_at();

DROP TRIGGER IF EXISTS trg_clinic_hosp_updated ON clinic_hospitalizations;
CREATE TRIGGER trg_clinic_hosp_updated BEFORE UPDATE ON clinic_hospitalizations FOR EACH ROW EXECUTE FUNCTION update_clinic_updated_at();

DROP TRIGGER IF EXISTS trg_clinic_or_updated ON clinic_operating_rooms;
CREATE TRIGGER trg_clinic_or_updated BEFORE UPDATE ON clinic_operating_rooms FOR EACH ROW EXECUTE FUNCTION update_clinic_updated_at();

DROP TRIGGER IF EXISTS trg_clinic_surg_updated ON clinic_surgeries;
CREATE TRIGGER trg_clinic_surg_updated BEFORE UPDATE ON clinic_surgeries FOR EACH ROW EXECUTE FUNCTION update_clinic_updated_at();

DROP TRIGGER IF EXISTS trg_clinic_diet_updated ON clinic_diet_tables;
CREATE TRIGGER trg_clinic_diet_updated BEFORE UPDATE ON clinic_diet_tables FOR EACH ROW EXECUTE FUNCTION update_clinic_updated_at();

DROP TRIGGER IF EXISTS trg_clinic_meal_plans_updated ON clinic_meal_plans;
CREATE TRIGGER trg_clinic_meal_plans_updated BEFORE UPDATE ON clinic_meal_plans FOR EACH ROW EXECUTE FUNCTION update_clinic_updated_at();

-- ── RLS ──
ALTER TABLE clinic_wards              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_rooms              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_beds               ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_hospitalizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_daily_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_operating_rooms    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_surgeries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_diet_tables        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_meal_plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_meal_records       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_wards_all"              ON clinic_wards              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clinic_rooms_all"              ON clinic_rooms              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clinic_beds_all"               ON clinic_beds               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clinic_hospitalizations_all"   ON clinic_hospitalizations   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clinic_daily_observations_all" ON clinic_daily_observations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clinic_operating_rooms_all"    ON clinic_operating_rooms    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clinic_surgeries_all"          ON clinic_surgeries          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clinic_diet_tables_all"        ON clinic_diet_tables        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clinic_meal_plans_all"         ON clinic_meal_plans         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clinic_meal_records_all"       ON clinic_meal_records       FOR ALL TO authenticated USING (true) WITH CHECK (true);
