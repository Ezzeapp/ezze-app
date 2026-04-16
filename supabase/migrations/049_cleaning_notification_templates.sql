-- 049: Default notification templates for cleaning product

INSERT INTO app_settings (product, key, value)
VALUES ('cleaning', 'cleaning_notification_templates', '[
  {"status":"ready","enabled":true,"text":"✅ Заказ {number} готов!\n\nЗдравствуйте, {client_name}!\nВаш заказ готов к выдаче.\n\nСрок: {ready_date}\nСумма: {total}\nК оплате: {remaining}\n\n📦 Отслеживание: {track_url}"},
  {"status":"issued","enabled":true,"text":"📦 Заказ {number} выдан\n\nСпасибо, {client_name}!\nВаш заказ выдан.\n\nИтого: {total}\nОплачено: {remaining}"},
  {"status":"paid","enabled":true,"text":"💳 Оплата подтверждена\n\nЗаказ {number} полностью оплачен.\nСумма: {total}\n\nСпасибо за доверие! 🙏"}
]')
ON CONFLICT (product, key) DO NOTHING;
