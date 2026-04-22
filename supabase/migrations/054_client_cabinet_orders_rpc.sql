-- ─────────────────────────────────────────────────────────────────
-- 054_client_cabinet_orders_rpc.sql
-- Унифицированная выдача заказов в личный кабинет клиента.
-- Источники: appointments (slot-booking) ∪ cleaning_orders ∪ workshop_orders
-- Связь с Telegram-клиентом:
--   • appointments.telegram_id  = tg_chat_id (прямая)
--   • cleaning_orders/workshop_orders.client_id → clients, связь по phone из tg_clients
-- SECURITY DEFINER обходит RLS, но фильтрует только по конкретному tg_chat_id.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_client_cabinet_orders(p_tg_chat_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_result JSONB;
BEGIN
  -- Берём телефон клиента из tg_clients (сохраняется ботом при регистрации)
  SELECT phone INTO v_phone
  FROM public.tg_clients
  WHERE tg_chat_id = p_tg_chat_id
  LIMIT 1;

  WITH
  -- 1) Beauty / clinic / barber / any slot-booking
  appts AS (
    SELECT
      'appointment'::TEXT                                           AS kind,
      a.id::TEXT                                                     AS id,
      a.status                                                       AS status,
      a.date                                                         AS date,
      a.start_time                                                   AS time_text,
      a.price                                                        AS total,
      a.notes                                                        AS notes,
      a.cancel_token                                                 AS cancel_token,
      NULL::TEXT                                                     AS number,
      a.master_id                                                    AS master_id,
      mp.booking_slug                                                AS booking_slug,
      mp.profession                                                  AS master_name,
      mp.avatar                                                      AS master_avatar,
      COALESCE(svc.name, '')                                         AS title,
      NULL::TEXT                                                     AS approval_token,
      NULL::TEXT                                                     AS public_token,
      NULL::DATE                                                     AS ready_date,
      a.created_at                                                   AS created_at
    FROM public.appointments a
    LEFT JOIN public.master_profiles mp ON mp.user_id = a.master_id
    LEFT JOIN public.services       svc ON svc.id     = a.service_id
    WHERE a.telegram_id = p_tg_chat_id
  ),
  -- 2) Химчистка — через clients.phone (у разных мастеров может быть свой client_id)
  cleaning AS (
    SELECT
      'cleaning'::TEXT                                               AS kind,
      co.id::TEXT                                                    AS id,
      co.status                                                      AS status,
      NULL::TEXT                                                     AS date,
      NULL::TEXT                                                     AS time_text,
      co.total_amount                                                AS total,
      co.notes                                                       AS notes,
      NULL::TEXT                                                     AS cancel_token,
      co.number                                                      AS number,
      NULL::UUID                                                     AS master_id,
      mp.booking_slug                                                AS booking_slug,
      mp.profession                                                  AS master_name,
      mp.avatar                                                      AS master_avatar,
      COALESCE(
        (SELECT string_agg(coi.item_type_name, ', ')
           FROM public.cleaning_order_items coi WHERE coi.order_id = co.id),
        ''
      )                                                              AS title,
      NULL::TEXT                                                     AS approval_token,
      NULL::TEXT                                                     AS public_token,
      co.ready_date                                                  AS ready_date,
      co.created_at                                                  AS created_at
    FROM public.cleaning_orders co
    JOIN public.clients         c ON c.id = co.client_id
    LEFT JOIN public.master_profiles mp ON mp.id = co.accepted_by
    WHERE v_phone IS NOT NULL AND c.phone = v_phone
  ),
  -- 3) Сервис-центр
  workshop AS (
    SELECT
      'workshop'::TEXT                                               AS kind,
      wo.id::TEXT                                                    AS id,
      wo.status                                                      AS status,
      NULL::TEXT                                                     AS date,
      NULL::TEXT                                                     AS time_text,
      wo.total_amount                                                AS total,
      wo.notes                                                       AS notes,
      NULL::TEXT                                                     AS cancel_token,
      wo.number                                                      AS number,
      NULL::UUID                                                     AS master_id,
      mp.booking_slug                                                AS booking_slug,
      mp.profession                                                  AS master_name,
      mp.avatar                                                      AS master_avatar,
      TRIM(BOTH ' ' FROM CONCAT_WS(' ',
        wo.item_type_name,
        NULLIF(wo.brand, ''),
        NULLIF(wo.model, '')
      ))                                                             AS title,
      wo.approval_token                                              AS approval_token,
      wo.public_token                                                AS public_token,
      wo.ready_date                                                  AS ready_date,
      wo.created_at                                                  AS created_at
    FROM public.workshop_orders wo
    JOIN public.clients          c ON c.id = wo.client_id
    LEFT JOIN public.master_profiles mp ON mp.id = wo.accepted_by
    WHERE v_phone IS NOT NULL AND c.phone = v_phone
  ),
  merged AS (
    SELECT * FROM appts
    UNION ALL SELECT * FROM cleaning
    UNION ALL SELECT * FROM workshop
  )
  SELECT COALESCE(jsonb_agg(row_to_json(m)::jsonb ORDER BY m.created_at DESC), '[]'::jsonb)
    INTO v_result
    FROM merged m;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_cabinet_orders(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_client_cabinet_orders(TEXT) TO authenticated;
