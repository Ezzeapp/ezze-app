-- ─────────────────────────────────────────────────────────────────────────────
-- 015_fix_tg_clients_rls.sql
-- Закрываем чрезмерно широкую политику anon SELECT USING (true) на tg_clients.
-- Вместо прямого чтения таблицы используем SECURITY DEFINER функцию,
-- которая возвращает данные только для конкретного tg_chat_id.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Удаляем открытую политику (anon мог прочитать ВСЮ таблицу)
DROP POLICY IF EXISTS "anon_select_tg_clients" ON public.tg_clients;

-- 2. Создаём безопасную RPC-функцию (SECURITY DEFINER — обходит RLS внутри,
--    но возвращает только строку с переданным tg_chat_id)
CREATE OR REPLACE FUNCTION public.get_tg_client_safe(p_tg_chat_id TEXT)
RETURNS TABLE(
  phone    TEXT,
  name     TEXT,
  tg_name  TEXT,
  lang     TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT phone, name, tg_name, lang
  FROM public.tg_clients
  WHERE tg_chat_id = p_tg_chat_id
  LIMIT 1;
$$;

-- 3. Разрешаем anon и authenticated вызывать функцию
GRANT EXECUTE ON FUNCTION public.get_tg_client_safe(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_tg_client_safe(TEXT) TO authenticated;
