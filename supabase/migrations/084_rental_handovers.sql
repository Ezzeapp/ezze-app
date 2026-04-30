-- ─────────────────────────────────────────────────────────────────
-- 084_rental_handovers.sql
-- Приёмка/возврат объекта аренды (handovers).
-- Один акт на каждое событие: pickup (выдача клиенту) и return (приём от клиента).
-- Содержит фото "до"/"после", описание повреждений и расчёт удержаний из депозита.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rental_handovers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product               TEXT NOT NULL DEFAULT 'rental',

  booking_id            UUID NOT NULL REFERENCES rental_bookings(id) ON DELETE CASCADE,

  -- Тип события
  type                  TEXT NOT NULL
                          CHECK (type IN ('pickup','return')),

  -- Снимки состояния
  photos                TEXT[] NOT NULL DEFAULT '{}',    -- общие фото объекта
  damage_photos         TEXT[] NOT NULL DEFAULT '{}',    -- фото повреждений (если есть)

  -- Snapshot текущих specs объекта на момент приёмки/возврата:
  -- { odometer_km, engine_hours, fuel_level, accessories_returned[], etc. }
  specs_snapshot        JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Описание состояния и повреждений
  condition_notes       TEXT,                            -- общее состояние
  damages_description   TEXT,                            -- описание повреждений (для return)
  missing_items         TEXT,                            -- отсутствующие комплектующие

  -- Финансы (только для type=return)
  late_minutes          INT NOT NULL DEFAULT 0,          -- просрочка возврата в минутах
  late_fee              NUMERIC(12,2) NOT NULL DEFAULT 0,
  damages_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  cleaning_fee          NUMERIC(12,2) NOT NULL DEFAULT 0,
  fuel_charge           NUMERIC(12,2) NOT NULL DEFAULT 0, -- за неполный бак
  other_charges         NUMERIC(12,2) NOT NULL DEFAULT 0,
  charges_total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  charges_breakdown     JSONB NOT NULL DEFAULT '{}'::jsonb, -- детализация для договора

  -- Депозит на момент возврата (только для type=return)
  deposit_returned      NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_withheld      NUMERIC(12,2) NOT NULL DEFAULT 0,
  withhold_reason       TEXT,

  -- Подписи участников
  signed_by_master      UUID REFERENCES master_profiles(id) ON DELETE SET NULL,
  signed_by_client      BOOLEAN NOT NULL DEFAULT FALSE,
  client_signature_url  TEXT,
  signed_at             TIMESTAMPTZ,

  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rental_handovers_booking
  ON rental_handovers(booking_id);
CREATE INDEX IF NOT EXISTS idx_rental_handovers_type
  ON rental_handovers(booking_id, type);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE rental_handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rental_handovers_all" ON rental_handovers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
