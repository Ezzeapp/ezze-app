-- 015: Add bot_message_ids column to tg_clients
-- Stores Telegram message IDs of messages sent by the bot to this client.
-- Used to clear the chat when the client is deleted (delete all bot messages).
ALTER TABLE tg_clients
  ADD COLUMN IF NOT EXISTS bot_message_ids integer[] DEFAULT '{}';
