-- ─────────────────────────────────────────────────────────────────
-- 085_rental_maintenance.sql
-- Техническое обслуживание объектов аренды.
-- Применимо в первую очередь к транспорту (плановое ТО, замена масла, шин)
-- и спецтехнике (моточасы, ресурс), но универсально для любого объекта,
-- требующего обслуживания (например, проверка лазерного нивелира).
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rental_maintenance (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product             TEXT NOT NULL DEFAULT 'rental',

  item_id             UUID NOT NULL REFERENCES rental_items(id) ON DELETE CASCADE,

  -- Категория работы
  type                TEXT NOT NULL DEFAULT 'scheduled'
                        CHECK (type IN ('scheduled','repair','inspection','cleaning','other')),
  title               TEXT NOT NULL,                     -- "Замена масла", "Балансировка", "Сезонное ТО"
  description         TEXT,

  -- Планирование
  planned_at          TIMESTAMPTZ,                       -- когда планируем
  completed_at        TIMESTAMPTZ,                       -- когда выполнено (NULL = ещё не сделано)

  -- Финансы
  cost                NUMERIC(12,2) NOT NULL DEFAULT 0,
  parts_cost          NUMERIC(12,2) NOT NULL DEFAULT 0,
  labor_cost          NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Метрики на момент ТО (для отслеживания ресурса)
  odometer_at_service NUMERIC(12,2),                     -- пробег км
  engine_hours_at_service NUMERIC(12,2),                 -- моточасы
  next_service_at     TIMESTAMPTZ,                       -- ориентир для следующего ТО (по дате)
  next_service_odometer NUMERIC(12,2),                   -- ориентир (по пробегу)

  -- Кто выполнил
  performed_by        UUID REFERENCES master_profiles(id) ON DELETE SET NULL,
  contractor          TEXT,                              -- если внешний сервис: "Bosch Service"

  -- Документы
  receipt_url         TEXT,                              -- чек / акт работ
  photos              TEXT[] NOT NULL DEFAULT '{}',

  -- Статус
  status              TEXT NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned','in_progress','completed','cancelled')),

  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rental_maintenance_item
  ON rental_maintenance(item_id);
CREATE INDEX IF NOT EXISTS idx_rental_maintenance_status
  ON rental_maintenance(product, status);
CREATE INDEX IF NOT EXISTS idx_rental_maintenance_planned
  ON rental_maintenance(planned_at) WHERE status = 'planned';

-- ── Автообновление updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_rental_maintenance_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_rental_maintenance_updated_at ON rental_maintenance;
CREATE TRIGGER trg_rental_maintenance_updated_at
  BEFORE UPDATE ON rental_maintenance
  FOR EACH ROW EXECUTE FUNCTION update_rental_maintenance_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE rental_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rental_maintenance_all" ON rental_maintenance
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
