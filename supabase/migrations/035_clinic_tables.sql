-- ─────────────────────────────────────────────────────────────────
-- 032_clinic_tables.sql
-- Таблицы для продукта "Медицина" (clinic)
-- ─────────────────────────────────────────────────────────────────

-- 1. Медкарта пациента (1:1 с clients)
CREATE TABLE IF NOT EXISTS clinic_patient_cards (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  master_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gender                  TEXT CHECK (gender IN ('male', 'female')),
  blood_type              TEXT CHECK (blood_type IN ('I+','I-','II+','II-','III+','III-','IV+','IV-')),
  allergies               TEXT,
  contraindications        TEXT,
  chronic_diseases         TEXT,
  insurance_number         TEXT,
  emergency_contact_name   TEXT,
  emergency_contact_phone  TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinic_patient_cards_master ON clinic_patient_cards(master_id);
CREATE INDEX idx_clinic_patient_cards_client ON clinic_patient_cards(client_id);

-- 2. Запись приёма врача (1:1 с appointments)
CREATE TABLE IF NOT EXISTS clinic_visits (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id   UUID NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  master_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  complaints       TEXT,
  examination      TEXT,
  diagnosis        TEXT,
  diagnosis_code   TEXT,
  treatment        TEXT,
  prescriptions    JSONB NOT NULL DEFAULT '[]',
  recommendations  TEXT,
  next_visit_date  DATE,
  attachments      JSONB NOT NULL DEFAULT '[]',
  template_id      UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinic_visits_master ON clinic_visits(master_id);
CREATE INDEX idx_clinic_visits_appointment ON clinic_visits(appointment_id);

-- 3. Зубная формула (1:1 с clients)
CREATE TABLE IF NOT EXISTS clinic_dental_charts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  master_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teeth       JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinic_dental_charts_master ON clinic_dental_charts(master_id);
CREATE INDEX idx_clinic_dental_charts_client ON clinic_dental_charts(client_id);

-- 4. Шаблоны приёмов
CREATE TABLE IF NOT EXISTS clinic_visit_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  specialty       TEXT,
  complaints      TEXT,
  examination     TEXT,
  diagnosis       TEXT,
  treatment       TEXT,
  prescriptions   JSONB NOT NULL DEFAULT '[]',
  recommendations TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinic_visit_templates_master ON clinic_visit_templates(master_id);

-- ── Автообновление updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_clinic_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_clinic_patient_cards_updated ON clinic_patient_cards;
CREATE TRIGGER trg_clinic_patient_cards_updated
  BEFORE UPDATE ON clinic_patient_cards
  FOR EACH ROW EXECUTE FUNCTION update_clinic_updated_at();

DROP TRIGGER IF EXISTS trg_clinic_visits_updated ON clinic_visits;
CREATE TRIGGER trg_clinic_visits_updated
  BEFORE UPDATE ON clinic_visits
  FOR EACH ROW EXECUTE FUNCTION update_clinic_updated_at();

DROP TRIGGER IF EXISTS trg_clinic_dental_charts_updated ON clinic_dental_charts;
CREATE TRIGGER trg_clinic_dental_charts_updated
  BEFORE UPDATE ON clinic_dental_charts
  FOR EACH ROW EXECUTE FUNCTION update_clinic_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE clinic_patient_cards   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_visits          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_dental_charts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_visit_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_patient_cards_all" ON clinic_patient_cards
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "clinic_visits_all" ON clinic_visits
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "clinic_dental_charts_all" ON clinic_dental_charts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "clinic_visit_templates_all" ON clinic_visit_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
