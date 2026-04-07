-- Migration 024: Fix inventory receipts + auto-deduction on appointment done
-- 2026-04-08

-- ── 1. Add missing columns to inventory_receipts ─────────────────────────────
-- Code uses cost_price, supplier, note but they didn't exist in the schema
ALTER TABLE inventory_receipts
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supplier   TEXT,
  ADD COLUMN IF NOT EXISTS note       TEXT;

-- ── 2. Trigger: deduct inventory when appointment status → done ───────────────
-- Fires AFTER UPDATE on appointments, when status changes to 'done'.
-- Decrements inventory_items.quantity for each service_material of the appointment's services.

CREATE OR REPLACE FUNCTION deduct_inventory_on_done()
RETURNS TRIGGER AS $func$
DECLARE
  svc_id UUID;
  mat    RECORD;
BEGIN
  -- Only when transitioning TO 'done' (not on re-saves or creation)
  IF (OLD.status IS DISTINCT FROM 'done') AND NEW.status = 'done' THEN

    -- Deduct materials for each service in appointment_services
    FOR svc_id IN
      SELECT service_id FROM appointment_services
      WHERE appointment_id = NEW.id AND service_id IS NOT NULL
    LOOP
      FOR mat IN
        SELECT inventory_item_id, quantity
        FROM service_materials
        WHERE service_id = svc_id
      LOOP
        UPDATE inventory_items
        SET quantity   = GREATEST(0, quantity - mat.quantity),
            updated_at = NOW()
        WHERE id = mat.inventory_item_id;
      END LOOP;
    END LOOP;

    -- Fallback: if appointment_services is empty, use appointments.service_id
    IF NOT EXISTS (SELECT 1 FROM appointment_services WHERE appointment_id = NEW.id)
       AND NEW.service_id IS NOT NULL THEN
      FOR mat IN
        SELECT inventory_item_id, quantity
        FROM service_materials
        WHERE service_id = NEW.service_id
      LOOP
        UPDATE inventory_items
        SET quantity   = GREATEST(0, quantity - mat.quantity),
            updated_at = NOW()
        WHERE id = mat.inventory_item_id;
      END LOOP;
    END IF;

  END IF;

  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_deduct_inventory_done ON appointments;
CREATE TRIGGER trg_deduct_inventory_done
  AFTER UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION deduct_inventory_on_done();
