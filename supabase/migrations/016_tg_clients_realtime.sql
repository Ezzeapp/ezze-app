-- 016: Enable Realtime for tg_clients with full DELETE event data
-- REPLICA IDENTITY FULL is required so that DELETE events include the old row
-- (tg_chat_id), allowing the bot to identify which client was deleted.
ALTER TABLE tg_clients REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE tg_clients;
