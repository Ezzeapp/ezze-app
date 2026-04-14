-- 042_clinic_notifications.sql — Триггер уведомления о готовых анализах

-- Функция: при смене статуса lab order на 'completed' — HTTP POST в edge function
CREATE OR REPLACE FUNCTION notify_clinic_lab_completed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    PERFORM net.http_post(
      url := 'http://supabase-edge-functions:8000/telegram-notifications',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
      body := jsonb_build_object(
        'type', 'LAB_COMPLETED',
        'record', jsonb_build_object('id', NEW.id, 'client_id', NEW.client_id, 'master_id', NEW.master_id)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinic_lab_completed ON clinic_lab_orders;
CREATE TRIGGER trg_clinic_lab_completed
  AFTER UPDATE ON clinic_lab_orders
  FOR EACH ROW EXECUTE FUNCTION notify_clinic_lab_completed();
