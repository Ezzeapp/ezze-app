-- Таблица для клиентов, самостоятельно зарегистрированных через Telegram-бот платформы.
-- Клиент не привязан к конкретному мастеру. Виден только администратору платформы.

CREATE TABLE IF NOT EXISTS public.tg_clients (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tg_chat_id  TEXT        UNIQUE NOT NULL,
  name        TEXT,
  phone       TEXT,
  tg_username TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tg_clients_phone      ON public.tg_clients(phone);
CREATE INDEX IF NOT EXISTS idx_tg_clients_tg_chat_id ON public.tg_clients(tg_chat_id);

-- RLS: только service-role (бот) может писать; read — только для is_admin()
ALTER TABLE public.tg_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read tg_clients"
  ON public.tg_clients FOR SELECT
  USING (public.is_admin());
