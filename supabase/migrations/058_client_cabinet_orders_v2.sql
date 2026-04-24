-- ─────────────────────────────────────────────────────────────────
-- 058_client_cabinet_orders_v2.sql
-- Улучшения унифицированной выдачи заказов клиента:
--   • Матчинг cleaning/workshop по c.phone_normalized (надёжнее, чем c.phone)
--   • Добавлены поля product, master_phone, end_time для клиентского бота
--   • Для cleaning/workshop поле date теперь = ready_date (строка),
--     чтобы бот мог сортировать/отображать единым способом
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_client_cabinet_orders(p_tg_chat_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone_norm TEXT;
  v_result JSONB;
BEGIN
  -- Берём нормализованный телефон клиента из tg_clients
  SELECT phone_normalized INTO v_phone_norm
  FROM public.tg_clients
  WHERE tg_chat_id = p_tg_chat_id
  LIMIT 1;

  WITH
  -- 1) Beauty / clinic / barber / любой slot-booking
  appts AS (
    SELECT
      'appointment'::TEXT                                           AS kind,
      a.id::TEXT                                                     AS id,
      a.status                                                       AS status,
      a.date                                                         AS date,
      a.start_time                                                   AS time_text,
      a.end_time                                                     AS end_time,
      a.price                                                        AS total,
      a.notes                                                        AS notes,
      a.cancel_token                                                 AS cancel_token,
      NULL::TEXT                                                     AS number,
      a.master_id                                                    AS master_id,
      mp.booking_slug                                                AS booking_slug,
      mp.profession                                                  AS master_name,
      mp.avatar                                                      AS master_avatar,
      mp.phone                                                       AS master_phone,
      COALESCE(
        (SELECT string_agg(asr.service_name, ', ')
           FROM public.appointment_services asr WHERE asr.appointment_id = a.id),
        svc.name,
        ''
      )                                                              AS title,
      NULL::TEXT                                                     AS approval_token,
      NULL::TEXT                                                     AS public_token,
      NULL::DATE                                                     AS ready_date,
      NULL::TEXT                                                     AS product,
      a.created_at                                                   AS created_at
    FROM public.appointments a
    LEFT JOIN public.master_profiles mp ON mp.user_id = a.master_id
    LEFT JOIN public.services       svc ON svc.id     = a.service_id
    WHERE a.telegram_id = p_tg_chat_id
  ),
  -- 2) Химчистка — матчинг по нормализованному телефону
  cleaning AS (
    SELECT
      'cleaning'::TEXT                                               AS kind,
      co.id::TEXT                                                    AS id,
      co.status                                                      AS status,
      to_char(co.ready_date, 'YYYY-MM-DD')                           AS date,
      NULL::TEXT                                                     AS time_text,
      NULL::TEXT                                                     AS end_time,
      co.total_amount                                                AS total,
      co.notes                                                       AS notes,
      NULL::TEXT                                                     AS cancel_token,
      co.number                                                      AS number,
      NULL::UUID                                                     AS master_id,
      mp.booking_slug                                                AS booking_slug,
      mp.profession                                                  AS master_name,
      mp.avatar                                                      AS master_avatar,
      mp.phone                                                       AS master_phone,
      COALESCE(
        (SELECT string_agg(coi.item_type_name, ', ')
           FROM public.cleaning_order_items coi WHERE coi.order_id = co.id),
        ''
      )                                                              AS title,
      NULL::TEXT                                                     AS approval_token,
      NULL::TEXT                                                     AS public_token,
      co.ready_date                                                  AS ready_date,
      'cleaning'::TEXT                                               AS product,
      co.created_at                                                  AS created_at
    FROM public.cleaning_orders co
    JOIN public.clients         c ON c.id = co.client_id
    LEFT JOIN public.master_profiles mp ON mp.id = co.accepted_by
    WHERE v_phone_norm IS NOT NULL
      AND v_phone_norm <> ''
      AND c.phone_normalized = v_phone_norm
  ),
  -- 3) Сервис-центр (workshop) — матчинг по нормализованному телефону
  workshop AS (
    SELECT
      'workshop'::TEXT                                               AS kind,
      wo.id::TEXT                                                    AS id,
      wo.status                                                      AS status,
      to_char(wo.ready_date, 'YYYY-MM-DD')                           AS date,
      NULL::TEXT                                                     AS time_text,
      NULL::TEXT                                                     AS end_time,
      wo.total_amount                                                AS total,
      wo.notes                                                       AS notes,
      NULL::TEXT                                                     AS cancel_token,
      wo.number                                                      AS number,
      NULL::UUID                                                     AS master_id,
      mp.booking_slug                                                AS booking_slug,
      mp.profession                                                  AS master_name,
      mp.avatar                                                      AS master_avatar,
      mp.phone                                                       AS master_phone,
      TRIM(BOTH ' ' FROM CONCAT_WS(' ',
        wo.item_type_name,
        NULLIF(wo.brand, ''),
        NULLIF(wo.model, '')
      ))                                                             AS title,
      wo.approval_token                                              AS approval_token,
      wo.public_token                                                AS public_token,
      wo.ready_date                                                  AS ready_date,
      'workshop'::TEXT                                               AS product,
      wo.created_at                                                  AS created_at
    FROM public.workshop_orders wo
    JOIN public.clients          c ON c.id = wo.client_id
    LEFT JOIN public.master_profiles mp ON mp.id = wo.accepted_by
    WHERE v_phone_norm IS NOT NULL
      AND v_phone_norm <> ''
      AND c.phone_normalized = v_phone_norm
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
GRANT EXECUTE ON FUNCTION public.get_client_cabinet_orders(TEXT) TO service_role;
