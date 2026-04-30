-- ─────────────────────────────────────────────────────────────────
-- 083_rental_contracts.sql
-- Договоры аренды: паспортные данные клиента, PDF, подпись.
-- Один договор на одну бронь (1:1). Если бронь продлевается — создаётся новый.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rental_contracts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product               TEXT NOT NULL DEFAULT 'rental',

  booking_id            UUID NOT NULL REFERENCES rental_bookings(id) ON DELETE CASCADE,
  contract_number       TEXT NOT NULL,                   -- ДОГ-АР-0001 (отдельная нумерация для договоров)

  -- Snapshot паспортных/идентификационных данных клиента на момент подписания.
  -- jsonb: { last_name, first_name, middle_name, passport_number, passport_issued_by,
  --          passport_issued_at, birthday, address, drivers_license_number,
  --          drivers_license_issued_at, drivers_license_categories }
  client_identity       JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Сканы документов клиента (paspport_url, license_url, и т.п.)
  client_documents      TEXT[] NOT NULL DEFAULT '{}',

  -- Условия договора (jsonb): тарифы, депозит, штрафы за просрочку, условия возврата.
  -- Это snapshot, который не должен меняться при последующих правках rental_items.
  terms                 JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Сгенерированный PDF договора
  contract_pdf_url      TEXT,

  -- Подписи
  signed_by_client      BOOLEAN NOT NULL DEFAULT FALSE,
  client_signature_url  TEXT,                            -- если подписали электронно (canvas/photo)
  signed_at             TIMESTAMPTZ,
  signed_by_master      UUID REFERENCES master_profiles(id) ON DELETE SET NULL,

  -- Статус
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','signed','cancelled')),

  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product, contract_number)
);

CREATE INDEX IF NOT EXISTS idx_rental_contracts_booking
  ON rental_contracts(booking_id);
CREATE INDEX IF NOT EXISTS idx_rental_contracts_status
  ON rental_contracts(product, status);

-- ── Автообновление updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_rental_contract_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_rental_contract_updated_at ON rental_contracts;
CREATE TRIGGER trg_rental_contract_updated_at
  BEFORE UPDATE ON rental_contracts
  FOR EACH ROW EXECUTE FUNCTION update_rental_contract_updated_at();

-- ── Sequence для номера договора ─────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS rental_contract_seq;

CREATE OR REPLACE FUNCTION generate_rental_contract_number(p_product TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  seq BIGINT;
BEGIN
  seq := nextval('rental_contract_seq');
  RETURN 'ДОГ-АР-' || LPAD(seq::TEXT, 4, '0');
END;
$$;

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE rental_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rental_contracts_all" ON rental_contracts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
