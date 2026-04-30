-- ─────────────────────────────────────────────────────────────────
-- 081_rental_items.sql
-- Объекты аренды (rental_items) для продукта "Аренда" (rental).
-- Универсальная схема: транспорт, инструмент, event-оборудование,
-- спорт-инвентарь, костюмы, бытовая техника и т.д.
--
-- Принципы:
--   * Гибкая тарификация: цены за час/день/неделю/месяц (любые из 4 могут быть NULL)
--   * Опциональный депозит: фиксированный или % от стоимости аренды
--   * Складской учёт: один объект (BMW X5 №А123АА) или несколько одинаковых
--     единиц (5 одинаковых дрелей Bosch GSB 13 RE) через inventory_qty
--   * specs jsonb: для transport — пробег/год/мощность; для tool — мощность/комплектация
--   * Изоляция per-team через team_id (как в cleaning_orders/workshop_orders)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rental_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product             TEXT NOT NULL DEFAULT 'rental',

  -- Принадлежность (для изоляции в команде)
  team_id             UUID REFERENCES teams(id) ON DELETE SET NULL,
  created_by          UUID REFERENCES master_profiles(id) ON DELETE SET NULL,

  -- Описание объекта
  name                TEXT NOT NULL,
  category            TEXT,                              -- 'transport' / 'tool' / 'event' / 'sport' / 'other'
  subcategory         TEXT,                              -- свободный текст (легковой авто / бензопила / шатёр)
  description         TEXT,
  photos              TEXT[] NOT NULL DEFAULT '{}',      -- url'ы изображений в bucket
  brand               TEXT,
  model               TEXT,
  serial_number       TEXT,                              -- VIN / серийный
  registration_plate  TEXT,                              -- госномер (для транспорта)

  -- Складской учёт
  inventory_qty       INT NOT NULL DEFAULT 1
                        CHECK (inventory_qty >= 0),

  -- Тарификация (хотя бы одна из цен должна быть заполнена; контролируется UI)
  pricing_unit        TEXT NOT NULL DEFAULT 'day'
                        CHECK (pricing_unit IN ('hour','day','week','month')),
  price_per_hour      NUMERIC(12,2),
  price_per_day       NUMERIC(12,2),
  price_per_week      NUMERIC(12,2),
  price_per_month     NUMERIC(12,2),
  min_rental_minutes  INT NOT NULL DEFAULT 0,            -- минимальный срок аренды в минутах (0 = нет минимума)

  -- Депозит (залог)
  deposit_required    BOOLEAN NOT NULL DEFAULT FALSE,
  deposit_type        TEXT NOT NULL DEFAULT 'fixed'
                        CHECK (deposit_type IN ('fixed','percent_of_price')),
  deposit_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,  -- сумма (для fixed) или % (для percent_of_price)

  -- Адрес самовывоза + резервная фича доставки
  pickup_address      TEXT,
  pickup_hours        TEXT,                              -- свободный текст: "Пн-Пт 9:00-18:00"
  delivery_available  BOOLEAN NOT NULL DEFAULT FALSE,    -- зарезервировано для будущей доставки

  -- Статус объекта
  status              TEXT NOT NULL DEFAULT 'available'
                        CHECK (status IN ('available','rented','maintenance','retired')),

  -- Технические параметры (jsonb): odometer_km, engine_hours, year, power_hp,
  -- fuel_type, transmission, seats, weight_kg, accessories[] и т.д.
  specs               JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Прочее
  notes               TEXT,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order          INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rental_items_product_status
  ON rental_items(product, status);
CREATE INDEX IF NOT EXISTS idx_rental_items_team
  ON rental_items(team_id);
CREATE INDEX IF NOT EXISTS idx_rental_items_category
  ON rental_items(product, category);
CREATE INDEX IF NOT EXISTS idx_rental_items_active
  ON rental_items(product, active) WHERE active = TRUE;

-- ── Автообновление updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_rental_item_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_rental_item_updated_at ON rental_items;
CREATE TRIGGER trg_rental_item_updated_at
  BEFORE UPDATE ON rental_items
  FOR EACH ROW EXECUTE FUNCTION update_rental_item_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE rental_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rental_items_all" ON rental_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Публичное чтение для каталога-витрины (если будем делать /rental/:slug)
CREATE POLICY "rental_items_public_read" ON rental_items
  FOR SELECT TO anon USING (active = TRUE);
