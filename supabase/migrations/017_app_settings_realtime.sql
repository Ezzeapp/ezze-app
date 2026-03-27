-- 017: Enable Realtime for app_settings
-- Bots subscribe to changes of key='tg_config' to instantly
-- batch-update menu button labels for all registered users when admin changes them.
ALTER TABLE app_settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE app_settings;
