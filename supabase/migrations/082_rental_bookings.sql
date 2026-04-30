-- ─────────────────────────────────────────────────────────────────
-- 082_rental_bookings.sql
-- Брони объектов аренды (rental_bookings) для продукта "Аренда".
-- Ключевые отличия от cleaning/workshop orders:
--   * период аренды (start_at..end_at) вместо одной даты
--   * связь с rental_items (а не с услугой)
--   * двухуровневая оплата: депозит + основная сумма
--   * статус депозита отдельно от платёжного статуса
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rental_bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product             TEXT NOT NULL DEFAULT 'rental',

  -- Изоляция
  team_id             UUID REFERENCES teams(id) ON DELETE SET NULL,
  created_by          UUID REFERENCES master_profiles(id) ON DELETE SET NULL,

  -- Идентификация
  number              TEXT NOT NULL,                     -- АР-0001
  item_id             UUID NOT NULL REFERENCES rental_items(id) ON DELETE RESTRICT,
  client_id           UUID REFERENCES clients(id) ON DELETE SET NULL,
  accepted_by         UUID REFERENCES master_profiles(id) ON DELETE SET NULL,
  assigned_to         UUID REFERENCES master_profiles(id) ON DELETE SET NULL,

  -- Период аренды
  start_at            TIMESTAMPTZ NOT NULL,
  end_at              TIMESTAMPTZ NOT NULL,
  actual_returned_at  TIMESTAMPTZ,                       -- фактическое время возврата
  CHECK (end_at > start_at),

  -- Расчёт стоимости (snapshot тарифа на момент бронирования)
  pricing_unit        TEXT NOT NULL DEFAULT 'day'
                        CHECK (pricing_unit IN ('hour','day','week','month')),
  unit_price          NUMERIC(12,2) NOT NULL DEFAULT 0,  -- цена за единицу на момент брони
  units_count         NUMERIC(10,2) NOT NULL DEFAULT 0,  -- кол-во единиц (часов/дней/недель/месяцев)
  base_price          NUMERIC(12,2) NOT NULL DEFAULT 0,  -- = unit_price * units_count
  delivery_fee        NUMERIC(12,2) NOT NULL DEFAULT 0,  -- зарезервировано
  late_fee            NUMERIC(12,2) NOT NULL DEFAULT 0,  -- штраф за просрочку
  damages_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,  -- удержано за повреждения
  total_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,  -- итого к оплате клиентом

  -- Платежи
  prepaid_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status      TEXT NOT NULL DEFAULT 'unpaid'
                        CHECK (payment_status IN ('unpaid','partial','paid','refunded')),

  -- Депозит (отдельный учёт от основной оплаты)
  deposit_required    BOOLEAN NOT NULL DEFAULT FALSE,
  deposit_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,  -- размер залога
  deposit_status      TEXT NOT NULL DEFAULT 'pending'
                        CHECK (deposit_status IN ('pending','paid','returned','withheld','partial_returned')),
  deposit_returned    NUMERIC(12,2) NOT NULL DEFAULT 0,  -- фактически возвращено
  deposit_withheld    NUMERIC(12,2) NOT NULL DEFAULT 0,  -- удержано

  -- Жизненный цикл
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                          'pending',     -- бронь создана, ждёт подтверждения
                          'confirmed',   -- подтверждена, ждём момента выдачи
                          'active',      -- объект выдан клиенту
                          'returned',    -- возвращён, расчёт завершён
                          'cancelled',   -- отменена
                          'overdue'      -- просрочка возврата
                        )),

  -- Прочее
  notes               TEXT,
  cancel_reason       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product, number)
);

CREATE INDEX IF NOT EXISTS idx_rental_bookings_item_period
  ON rental_bookings(item_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_client
  ON rental_bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_status
  ON rental_bookings(product, status);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_team
  ON rental_bookings(team_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_created
  ON rental_bookings(created_at DESC);

-- ── Автообновление updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_rental_booking_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_rental_booking_updated_at ON rental_bookings;
CREATE TRIGGER trg_rental_booking_updated_at
  BEFORE UPDATE ON rental_bookings
  FOR EACH ROW EXECUTE FUNCTION update_rental_booking_updated_at();

-- ── Автоинкремент номера брони (АР-0001) ─────────────────────────
CREATE SEQUENCE IF NOT EXISTS rental_booking_seq;

CREATE OR REPLACE FUNCTION generate_rental_booking_number(p_product TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  seq BIGINT;
BEGIN
  seq := nextval('rental_booking_seq');
  RETURN 'АР-' || LPAD(seq::TEXT, 4, '0');
END;
$$;

-- ── История изменений статуса ────────────────────────────────────
CREATE TABLE IF NOT EXISTS rental_booking_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID NOT NULL REFERENCES rental_bookings(id) ON DELETE CASCADE,
  changed_by   UUID REFERENCES master_profiles(id) ON DELETE SET NULL,
  old_status   TEXT,
  new_status   TEXT NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rental_booking_history_booking
  ON rental_booking_history(booking_id);

-- ── RPC: проверка доступности объекта на период ──────────────────
-- Возвращает количество конфликтующих броней (>0 = занято).
-- Учитывает inventory_qty: если у объекта 5 одинаковых единиц,
-- одновременно могут быть 5 неперекрывающихся-по-объекту броней.
CREATE OR REPLACE FUNCTION rental_check_availability(
  p_item_id UUID,
  p_start TIMESTAMPTZ,
  p_end   TIMESTAMPTZ,
  p_exclude_booking_id UUID DEFAULT NULL
) RETURNS TABLE(conflicts_count INT, inventory_qty INT, is_available BOOLEAN)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_qty INT;
  v_conflicts INT;
BEGIN
  SELECT ri.inventory_qty INTO v_qty
    FROM rental_items ri WHERE ri.id = p_item_id;

  IF v_qty IS NULL THEN
    RETURN QUERY SELECT 0, 0, FALSE;
    RETURN;
  END IF;

  SELECT COUNT(*)::INT INTO v_conflicts
    FROM rental_bookings rb
    WHERE rb.item_id = p_item_id
      AND rb.status NOT IN ('cancelled','returned')
      AND (p_exclude_booking_id IS NULL OR rb.id <> p_exclude_booking_id)
      AND rb.start_at < p_end
      AND rb.end_at   > p_start;

  RETURN QUERY SELECT v_conflicts, v_qty, (v_conflicts < v_qty);
END;
$$;

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE rental_bookings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_booking_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rental_bookings_all" ON rental_bookings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "rental_booking_history_all" ON rental_booking_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Публичный track по номеру брони (как в workshop)
CREATE POLICY "rental_bookings_public_track" ON rental_bookings
  FOR SELECT TO anon USING (true);
