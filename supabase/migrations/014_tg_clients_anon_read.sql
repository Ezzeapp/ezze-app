-- Разрешаем anon читать tg_clients
-- Нужно для клиентского кабинета (Telegram Mini App):
-- клиенты НЕ аутентифицированы в Supabase, используют anon-ключ,
-- но должны видеть своё зарегистрированное имя и телефон.

CREATE POLICY "anon_select_tg_clients"
  ON public.tg_clients FOR SELECT
  TO anon
  USING (true);
