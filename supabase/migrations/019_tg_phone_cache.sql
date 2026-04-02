-- Временный кеш телефонов для передачи из бота в Mini App
-- Когда requestContact() отправляет контакт боту, а не в callback Mini App

CREATE TABLE IF NOT EXISTS tg_phone_cache (
  tg_chat_id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tg_phone_cache ENABLE ROW LEVEL SECURITY;

-- Anon может читать (Mini App до авторизации)
CREATE POLICY "anon_select_phone_cache" ON tg_phone_cache
  FOR SELECT TO anon USING (true);

-- Anon может удалять свою запись после чтения
CREATE POLICY "anon_delete_phone_cache" ON tg_phone_cache
  FOR DELETE TO anon USING (true);

-- Авто-очистка старых записей (>5 минут) при каждом INSERT
CREATE OR REPLACE FUNCTION cleanup_old_phone_cache() RETURNS trigger AS $$
BEGIN
  DELETE FROM tg_phone_cache WHERE created_at < now() - interval '5 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cleanup_phone_cache
  AFTER INSERT ON tg_phone_cache
  FOR EACH STATEMENT EXECUTE FUNCTION cleanup_old_phone_cache();
