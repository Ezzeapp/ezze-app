-- 060_client_cancel_rpcs.sql
-- RPCs for client-initiated cancellation from @ezzeclient_bot.
--
-- Rules:
--   cleaning_orders: cancel allowed on status='received' only
--   workshop_orders: cancel allowed on received / diagnosing / waiting_approval
--
-- Ownership is verified via clients.tg_chat_id matching p_tg_chat_id.
-- Returns jsonb: { ok: bool, reason?: text, status?: text }

-- ══════════════════════════════════════════════════════════════════════════════
-- cleaning_cancel_by_client
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION cleaning_cancel_by_client(
  p_order_id uuid,
  p_tg_chat_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_status text;
  v_client_tg text;
BEGIN
  SELECT co.status, c.tg_chat_id
    INTO v_status, v_client_tg
    FROM cleaning_orders co
    LEFT JOIN clients c ON c.id = co.client_id
   WHERE co.id = p_order_id;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_client_tg IS NULL OR v_client_tg <> p_tg_chat_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_owner');
  END IF;

  IF v_status <> 'received' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_status', 'status', v_status);
  END IF;

  UPDATE cleaning_orders SET status = 'cancelled', updated_at = now()
   WHERE id = p_order_id;

  INSERT INTO cleaning_order_history(order_id, old_status, new_status, note)
  VALUES (p_order_id, v_status, 'cancelled', 'Отменено клиентом через Telegram-бот');

  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION cleaning_cancel_by_client(uuid, text) TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- workshop_cancel_by_client
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION workshop_cancel_by_client(
  p_order_id uuid,
  p_tg_chat_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_status text;
  v_client_tg text;
  v_allowed  text[] := ARRAY['received','diagnosing','waiting_approval'];
BEGIN
  SELECT wo.status, c.tg_chat_id
    INTO v_status, v_client_tg
    FROM workshop_orders wo
    LEFT JOIN clients c ON c.id = wo.client_id
   WHERE wo.id = p_order_id;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_client_tg IS NULL OR v_client_tg <> p_tg_chat_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_owner');
  END IF;

  IF NOT (v_status = ANY (v_allowed)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_status', 'status', v_status);
  END IF;

  UPDATE workshop_orders SET status = 'cancelled', updated_at = now()
   WHERE id = p_order_id;

  INSERT INTO workshop_order_history(order_id, old_status, new_status, note)
  VALUES (p_order_id, v_status, 'cancelled', 'Отменено клиентом через Telegram-бот');

  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION workshop_cancel_by_client(uuid, text) TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- appointment_cancel_by_client — с проверкой времени (>= 1h до начала)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION appointment_cancel_by_client(
  p_appointment_id uuid,
  p_tg_chat_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_appt record;
  v_client_tg text;
  v_start timestamptz;
BEGIN
  SELECT a.*, c.tg_chat_id AS client_tg
    INTO v_appt
    FROM appointments a
    LEFT JOIN clients c ON c.id = a.client_id
   WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- Проверка владельца — либо telegram_id на записи, либо tg_chat_id у привязанного клиента
  IF COALESCE(v_appt.telegram_id, v_appt.client_tg, '') <> p_tg_chat_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_owner');
  END IF;

  IF COALESCE(v_appt.status, 'scheduled') IN ('cancelled','completed','no_show') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_status', 'status', v_appt.status);
  END IF;

  -- Время начала записи (text + text → timestamp)
  BEGIN
    v_start := (v_appt.date || ' ' || v_appt.start_time)::timestamp AT TIME ZONE 'UTC';
  EXCEPTION WHEN others THEN
    v_start := NULL;
  END;

  IF v_start IS NOT NULL AND v_start < now() + interval '1 hour' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_late');
  END IF;

  UPDATE appointments
     SET status = 'cancelled', updated_at = now()
   WHERE id = p_appointment_id;

  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION appointment_cancel_by_client(uuid, text) TO anon, authenticated, service_role;
