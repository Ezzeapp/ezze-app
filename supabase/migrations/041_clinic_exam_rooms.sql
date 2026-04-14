-- 041_clinic_exam_rooms.sql — Кабинеты врачей
CREATE TABLE IF NOT EXISTS clinic_exam_rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  floor       INT,
  notes       TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_exam_rooms_master ON clinic_exam_rooms(master_id);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES clinic_exam_rooms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_room ON appointments(room_id);

ALTER TABLE clinic_exam_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinic_exam_rooms_all" ON clinic_exam_rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_clinic_exam_rooms_updated ON clinic_exam_rooms;
CREATE TRIGGER trg_clinic_exam_rooms_updated BEFORE UPDATE ON clinic_exam_rooms FOR EACH ROW EXECUTE FUNCTION update_clinic_updated_at();
