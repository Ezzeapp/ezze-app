-- ─────────────────────────────────────────────────────────────────
-- 055_get_platform_clients_rpc.sql
-- Суперадмин: сводный список клиентов платформы.
-- Объединяет tg_clients (TG-регистрация) и clients (карточки у мастеров) по phone.
-- Клиенты без телефона выводятся отдельными строками (key = 'client:<uuid>').
-- SECURITY DEFINER + admin-гейт через public.is_admin().
-- ─────────────────────────────────────────────────────────────────

-- Expression-индексы на нормализованный phone (digits only)
CREATE INDEX IF NOT EXISTS idx_clients_phone_digits
  ON public.clients (regexp_replace(COALESCE(phone, ''), '\D', '', 'g'));

CREATE INDEX IF NOT EXISTS idx_tg_clients_phone_digits
  ON public.tg_clients (regexp_replace(COALESCE(phone, ''), '\D', '', 'g'));


CREATE OR REPLACE FUNCTION public.get_platform_clients(
  p_search TEXT DEFAULT NULL,
  p_filter TEXT DEFAULT 'all',
  p_limit  INT  DEFAULT 30,
  p_offset INT  DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search_digits TEXT;
  v_search_text   TEXT;
  v_total         INT;
  v_rows          JSONB;
BEGIN
  -- Admin-гейт
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Нормализация поискового запроса
  v_search_text   := NULLIF(TRIM(COALESCE(p_search, '')), '');
  v_search_digits := regexp_replace(COALESCE(v_search_text, ''), '\D', '', 'g');
  IF v_search_digits = '' THEN v_search_digits := NULL; END IF;

  WITH
  -- 1) TG-регистрации с нормализованным phone
  tg_norm AS (
    SELECT
      tg_chat_id,
      phone,
      regexp_replace(COALESCE(phone, ''), '\D', '', 'g') AS phone_n,
      name,
      tg_name,
      tg_username,
      lang,
      created_at AS tg_registered_at
    FROM public.tg_clients
  ),
  -- 2) Карточки клиентов мастеров с нормализованным phone
  cli_norm AS (
    SELECT
      c.id,
      c.master_id,
      c.first_name,
      c.last_name,
      c.phone,
      regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g') AS phone_n,
      c.total_visits,
      c.last_visit,
      c.created_at AS first_seen_at,
      mp.display_name AS master_display_name,
      mp.profession   AS master_profession,
      mp.product      AS master_product,
      mp.booking_slug AS master_slug
    FROM public.clients c
    LEFT JOIN public.master_profiles mp ON mp.user_id = c.master_id
  ),
  cli_with_phone AS (SELECT * FROM cli_norm WHERE phone_n <> ''),
  cli_no_phone   AS (SELECT * FROM cli_norm WHERE phone_n = ''),

  -- 3) Все уникальные phone_n (из TG и из карточек)
  phones AS (
    SELECT phone_n FROM tg_norm      WHERE phone_n <> ''
    UNION
    SELECT phone_n FROM cli_with_phone
  ),

  -- 4) Объединение по телефону: одна строка на человека
  merged_by_phone AS (
    SELECT
      p.phone_n AS key,
      COALESCE(tg.phone, cli_first.phone) AS phone,
      COALESCE(
        tg.name,
        NULLIF(TRIM(CONCAT_WS(' ', cli_first.first_name, cli_first.last_name)), '')
      )                                    AS name,
      tg.tg_chat_id,
      tg.tg_username,
      tg.tg_registered_at,
      tg.lang,
      (tg.tg_chat_id IS NOT NULL)          AS is_tg_registered,
      COALESCE(agg.masters_count, 0)       AS masters_count,
      COALESCE(agg.masters, '[]'::jsonb)   AS masters,
      GREATEST(
        tg.tg_registered_at,
        agg.last_master_at
      )                                    AS activity_at
    FROM phones p
    LEFT JOIN LATERAL (
      SELECT tg_chat_id, phone, name, tg_username, tg_registered_at, lang
      FROM tg_norm t
      WHERE t.phone_n = p.phone_n
      LIMIT 1
    ) tg ON TRUE
    LEFT JOIN LATERAL (
      SELECT c.phone, c.first_name, c.last_name
      FROM cli_with_phone c
      WHERE c.phone_n = p.phone_n
      ORDER BY c.first_seen_at ASC
      LIMIT 1
    ) cli_first ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        jsonb_agg(jsonb_build_object(
          'master_id',     c.master_id,
          'display_name',  c.master_display_name,
          'profession',    c.master_profession,
          'product',       c.master_product,
          'booking_slug',  c.master_slug,
          'client_id',     c.id,
          'first_seen_at', c.first_seen_at,
          'total_visits',  c.total_visits,
          'last_visit',    c.last_visit
        ) ORDER BY c.first_seen_at DESC)                                          AS masters,
        COUNT(*)                                                                   AS masters_count,
        MAX(GREATEST(
          c.first_seen_at,
          COALESCE(c.last_visit::timestamptz, c.first_seen_at)
        ))                                                                         AS last_master_at
      FROM cli_with_phone c
      WHERE c.phone_n = p.phone_n
    ) agg ON TRUE
  ),

  -- 5) Клиенты без телефона — отдельными строками (key = 'client:<uuid>')
  merged_no_phone AS (
    SELECT
      'client:' || c.id::text              AS key,
      NULL::TEXT                            AS phone,
      NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), '')
                                            AS name,
      NULL::TEXT                            AS tg_chat_id,
      NULL::TEXT                            AS tg_username,
      NULL::TIMESTAMPTZ                     AS tg_registered_at,
      NULL::TEXT                            AS lang,
      FALSE                                 AS is_tg_registered,
      1                                     AS masters_count,
      jsonb_build_array(jsonb_build_object(
        'master_id',     c.master_id,
        'display_name',  c.master_display_name,
        'profession',    c.master_profession,
        'product',       c.master_product,
        'booking_slug',  c.master_slug,
        'client_id',     c.id,
        'first_seen_at', c.first_seen_at,
        'total_visits',  c.total_visits,
        'last_visit',    c.last_visit
      ))                                    AS masters,
      GREATEST(
        c.first_seen_at,
        COALESCE(c.last_visit::timestamptz, c.first_seen_at)
      )                                     AS activity_at
    FROM cli_no_phone c
  ),

  all_rows AS (
    SELECT * FROM merged_by_phone
    UNION ALL
    SELECT * FROM merged_no_phone
  ),

  -- 6) Фильтры
  filtered AS (
    SELECT *
    FROM all_rows
    WHERE
      CASE p_filter
        WHEN 'new'      THEN is_tg_registered AND masters_count = 0
        WHEN 'one'      THEN masters_count = 1
        WHEN 'multi'    THEN masters_count >= 2
        WHEN 'no_tg'    THEN NOT is_tg_registered
        WHEN 'no_phone' THEN phone IS NULL
        ELSE TRUE
      END
      AND (
        v_search_text IS NULL
        OR (v_search_digits IS NOT NULL AND key LIKE '%' || v_search_digits || '%')
        OR (name ILIKE '%' || v_search_text || '%')
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(masters) m
          WHERE (m->>'display_name') ILIKE '%' || v_search_text || '%'
             OR (m->>'profession')   ILIKE '%' || v_search_text || '%'
        )
      )
  )

  -- 7) Total + постранично
  SELECT COUNT(*) INTO v_total FROM filtered;

  WITH paged AS (
    SELECT *
    FROM all_rows
    WHERE
      CASE p_filter
        WHEN 'new'      THEN is_tg_registered AND masters_count = 0
        WHEN 'one'      THEN masters_count = 1
        WHEN 'multi'    THEN masters_count >= 2
        WHEN 'no_tg'    THEN NOT is_tg_registered
        WHEN 'no_phone' THEN phone IS NULL
        ELSE TRUE
      END
      AND (
        v_search_text IS NULL
        OR (v_search_digits IS NOT NULL AND key LIKE '%' || v_search_digits || '%')
        OR (name ILIKE '%' || v_search_text || '%')
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(masters) m
          WHERE (m->>'display_name') ILIKE '%' || v_search_text || '%'
             OR (m->>'profession')   ILIKE '%' || v_search_text || '%'
        )
      )
    ORDER BY activity_at DESC NULLS LAST
    LIMIT GREATEST(p_limit, 1) OFFSET GREATEST(p_offset, 0)
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(paged) ORDER BY (to_jsonb(paged)->>'activity_at') DESC NULLS LAST), '[]'::jsonb)
    INTO v_rows
    FROM paged;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_clients(TEXT, TEXT, INT, INT) TO authenticated;
