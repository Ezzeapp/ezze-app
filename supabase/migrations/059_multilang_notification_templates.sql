-- 059_multilang_notification_templates.sql
-- Seed / upgrade notification templates to multilang schema.
--
-- Schema:
--   [
--     { "status"|"event": "xxx", "enabled": true,
--       "texts": { "ru": "...", "en": "...", "uz": "..." } },
--     ...
--   ]
--
-- Backward-compat: edge functions also read `text` as ru if present.
--
-- Products covered: cleaning, workshop, beauty, clinic, barber
-- (any product that reuses cleaning_orders / workshop_orders / appointments tables
--  can extend later by copying rows per product).

-- ── Helper: upsert template set ────────────────────────────────────────────────
-- Inserts if missing. If existing row still uses old single-text schema
-- (no "texts" key anywhere) — replaces with multilang defaults.
-- If existing row already has "texts" — leaves alone (user-customized).
CREATE OR REPLACE FUNCTION _upsert_templates(p_product text, p_key text, p_value jsonb)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_existing text;
  v_is_legacy boolean;
BEGIN
  SELECT value INTO v_existing
  FROM app_settings
  WHERE product = p_product AND key = p_key;

  IF NOT FOUND THEN
    INSERT INTO app_settings(product, key, value)
    VALUES (p_product, p_key, p_value::text);
    RETURN;
  END IF;

  -- Legacy if: empty / NULL / no "texts" key anywhere
  v_is_legacy :=
    v_existing IS NULL
    OR v_existing = ''
    OR v_existing = '[]'
    OR position('"texts"' in v_existing) = 0;

  IF v_is_legacy THEN
    UPDATE app_settings
       SET value = p_value::text,
           updated_at = now()
     WHERE product = p_product AND key = p_key;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- CLEANING TEMPLATES
-- ══════════════════════════════════════════════════════════════════════════════
SELECT _upsert_templates('cleaning', 'cleaning_notification_templates', $json$
[
  {
    "status": "received",
    "enabled": true,
    "texts": {
      "ru": "✅ <b>Заказ принят</b>\n\n🔖 Номер: <b>{number}</b>\n📅 Готовность: {ready_date}\n💰 Сумма: {total}\n\n📦 Отслеживание: {track_url}\n\nСпасибо, {client_name}!",
      "en": "✅ <b>Order accepted</b>\n\n🔖 Number: <b>{number}</b>\n📅 Ready by: {ready_date}\n💰 Total: {total}\n\n📦 Tracking: {track_url}\n\nThank you, {client_name}!",
      "uz": "✅ <b>Buyurtma qabul qilindi</b>\n\n🔖 Raqam: <b>{number}</b>\n📅 Tayyor bo‘ladi: {ready_date}\n💰 Summa: {total}\n\n📦 Kuzatish: {track_url}\n\nRahmat, {client_name}!"
    }
  },
  {
    "status": "in_progress",
    "enabled": true,
    "texts": {
      "ru": "🧺 <b>Заказ {number}</b>\n\nВаши вещи приняты в работу.\n📅 Готовность: {ready_date}\n\n📦 {track_url}",
      "en": "🧺 <b>Order {number}</b>\n\nYour items are being processed.\n📅 Ready by: {ready_date}\n\n📦 {track_url}",
      "uz": "🧺 <b>Buyurtma {number}</b>\n\nBuyumlaringiz ishga qabul qilindi.\n📅 Tayyor bo‘ladi: {ready_date}\n\n📦 {track_url}"
    }
  },
  {
    "status": "ready",
    "enabled": true,
    "texts": {
      "ru": "✨ <b>Заказ {number} готов!</b>\n\nЗдравствуйте, {client_name}!\nВаш заказ готов к выдаче.\n\n💰 Сумма: {total}\n💸 К оплате: {remaining}\n\n📦 {track_url}",
      "en": "✨ <b>Order {number} is ready!</b>\n\nHello, {client_name}!\nYour order is ready for pickup.\n\n💰 Total: {total}\n💸 Due: {remaining}\n\n📦 {track_url}",
      "uz": "✨ <b>Buyurtma {number} tayyor!</b>\n\nAssalomu alaykum, {client_name}!\nBuyurtmangiz olib ketishga tayyor.\n\n💰 Summa: {total}\n💸 To‘lash kerak: {remaining}\n\n📦 {track_url}"
    }
  },
  {
    "status": "issued",
    "enabled": true,
    "texts": {
      "ru": "📤 <b>Заказ {number} выдан</b>\n\nСпасибо, что выбрали нас!\n💸 Остаток: {remaining}",
      "en": "📤 <b>Order {number} issued</b>\n\nThank you for choosing us!\n💸 Balance: {remaining}",
      "uz": "📤 <b>Buyurtma {number} berildi</b>\n\nBizni tanlaganingiz uchun rahmat!\n💸 Qoldiq: {remaining}"
    }
  },
  {
    "status": "paid",
    "enabled": true,
    "texts": {
      "ru": "💳 <b>Оплата получена</b>\n\nЗаказ {number} полностью оплачен. Спасибо!",
      "en": "💳 <b>Payment received</b>\n\nOrder {number} is fully paid. Thank you!",
      "uz": "💳 <b>To‘lov qabul qilindi</b>\n\nBuyurtma {number} to‘liq to‘landi. Rahmat!"
    }
  },
  {
    "status": "cancelled",
    "enabled": true,
    "texts": {
      "ru": "❌ <b>Заказ {number} отменён</b>\n\nЕсли это ошибка — свяжитесь с мастером.",
      "en": "❌ <b>Order {number} cancelled</b>\n\nIf this is a mistake, please contact the master.",
      "uz": "❌ <b>Buyurtma {number} bekor qilindi</b>\n\nAgar bu xato bo‘lsa, ustaga murojaat qiling."
    }
  }
]
$json$::jsonb);

-- ══════════════════════════════════════════════════════════════════════════════
-- WORKSHOP TEMPLATES
-- ══════════════════════════════════════════════════════════════════════════════
SELECT _upsert_templates('workshop', 'workshop_notification_templates', $json$
[
  {
    "status": "received",
    "enabled": true,
    "texts": {
      "ru": "✅ <b>Заявка принята</b>\n\n🔖 Номер: <b>{number}</b>\n🔧 Устройство: {device}\n\n📦 Отслеживание: {track_url}\n\nСпасибо, {client_name}!",
      "en": "✅ <b>Request received</b>\n\n🔖 Number: <b>{number}</b>\n🔧 Device: {device}\n\n📦 Tracking: {track_url}\n\nThank you, {client_name}!",
      "uz": "✅ <b>Ariza qabul qilindi</b>\n\n🔖 Raqam: <b>{number}</b>\n🔧 Qurilma: {device}\n\n📦 Kuzatish: {track_url}\n\nRahmat, {client_name}!"
    }
  },
  {
    "status": "diagnosing",
    "enabled": true,
    "texts": {
      "ru": "🔍 <b>Диагностика</b>\n\nЗаявка {number} — проводим диагностику устройства {device}.\nМы свяжемся сразу после завершения.",
      "en": "🔍 <b>Diagnostics</b>\n\nRequest {number} — we are diagnosing {device}.\nWe will contact you right after.",
      "uz": "🔍 <b>Diagnostika</b>\n\nAriza {number} — {device} diagnostika qilinmoqda.\nTugagandan so‘ng biz bog‘lanamiz."
    }
  },
  {
    "status": "waiting_approval",
    "enabled": true,
    "texts": {
      "ru": "💬 <b>Согласование сметы</b>\n\nЗаявка {number}, {device}\n💰 Предварительная стоимость: {estimated}\n\nПросим подтвердить: {approve_url}",
      "en": "💬 <b>Estimate approval</b>\n\nRequest {number}, {device}\n💰 Estimated cost: {estimated}\n\nPlease approve: {approve_url}",
      "uz": "💬 <b>Smetani tasdiqlash</b>\n\nAriza {number}, {device}\n💰 Taxminiy narx: {estimated}\n\nIltimos, tasdiqlang: {approve_url}"
    }
  },
  {
    "status": "waiting_parts",
    "enabled": true,
    "texts": {
      "ru": "📦 <b>Ожидаем запчасти</b>\n\nЗаявка {number}, {device}.\nКак только запчасти придут — продолжим ремонт.",
      "en": "📦 <b>Waiting for parts</b>\n\nRequest {number}, {device}.\nWe will continue as soon as parts arrive.",
      "uz": "📦 <b>Ehtiyot qismlarni kutmoqdamiz</b>\n\nAriza {number}, {device}.\nQismlar kelishi bilan ta’mirni davom ettiramiz."
    }
  },
  {
    "status": "in_progress",
    "enabled": true,
    "texts": {
      "ru": "🔧 <b>В работе</b>\n\nЗаявка {number}, {device} — приступили к ремонту.\n📅 Готовность: {ready_date}",
      "en": "🔧 <b>In progress</b>\n\nRequest {number}, {device} — repair started.\n📅 Ready by: {ready_date}",
      "uz": "🔧 <b>Ishda</b>\n\nAriza {number}, {device} — ta’mir boshlandi.\n📅 Tayyor bo‘ladi: {ready_date}"
    }
  },
  {
    "status": "ready",
    "enabled": true,
    "texts": {
      "ru": "✨ <b>Устройство готово!</b>\n\nЗаявка {number}, {device}\n💰 Сумма: {total}\n💸 К оплате: {remaining}\n\n📦 {track_url}",
      "en": "✨ <b>Device is ready!</b>\n\nRequest {number}, {device}\n💰 Total: {total}\n💸 Due: {remaining}\n\n📦 {track_url}",
      "uz": "✨ <b>Qurilma tayyor!</b>\n\nAriza {number}, {device}\n💰 Summa: {total}\n💸 To‘lash kerak: {remaining}\n\n📦 {track_url}"
    }
  },
  {
    "status": "issued",
    "enabled": true,
    "texts": {
      "ru": "📤 <b>Устройство выдано</b>\n\nЗаявка {number}. Спасибо, что выбрали нас!",
      "en": "📤 <b>Device issued</b>\n\nRequest {number}. Thank you for choosing us!",
      "uz": "📤 <b>Qurilma berildi</b>\n\nAriza {number}. Bizni tanlaganingiz uchun rahmat!"
    }
  },
  {
    "status": "paid",
    "enabled": true,
    "texts": {
      "ru": "💳 <b>Оплата получена</b>\n\nЗаявка {number} полностью оплачена. Спасибо!",
      "en": "💳 <b>Payment received</b>\n\nRequest {number} is fully paid. Thank you!",
      "uz": "💳 <b>To‘lov qabul qilindi</b>\n\nAriza {number} to‘liq to‘landi. Rahmat!"
    }
  },
  {
    "status": "refused",
    "enabled": true,
    "texts": {
      "ru": "🚫 <b>Отказ от ремонта</b>\n\nЗаявка {number}. Пожалуйста, заберите устройство в мастерской.",
      "en": "🚫 <b>Repair declined</b>\n\nRequest {number}. Please pick up the device from the workshop.",
      "uz": "🚫 <b>Ta’mirdan voz kechildi</b>\n\nAriza {number}. Iltimos, qurilmani ustaxonadan olib keting."
    }
  },
  {
    "status": "cancelled",
    "enabled": true,
    "texts": {
      "ru": "❌ <b>Заявка отменена</b>\n\nЗаявка {number} отменена. Если это ошибка — свяжитесь с мастером.",
      "en": "❌ <b>Request cancelled</b>\n\nRequest {number} cancelled. If this is a mistake, please contact the master.",
      "uz": "❌ <b>Ariza bekor qilindi</b>\n\nAriza {number} bekor qilindi. Agar bu xato bo‘lsa, ustaga murojaat qiling."
    }
  }
]
$json$::jsonb);

-- ══════════════════════════════════════════════════════════════════════════════
-- BEAUTY TEMPLATES (event-based: created/updated/cancelled/reminder)
-- Applied also for clinic/barber — any product using appointments table
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  p text;
BEGIN
  FOREACH p IN ARRAY ARRAY['beauty','clinic','barber','dental','hotel'] LOOP
    PERFORM _upsert_templates(p, 'appointment_notification_templates', $json$
[
  {
    "event": "created",
    "enabled": true,
    "texts": {
      "ru": "✅ <b>Запись создана</b>\n\n📅 {date} · {time}\n👤 {master_name}\n💼 {service}\n💰 {price}",
      "en": "✅ <b>Appointment created</b>\n\n📅 {date} · {time}\n👤 {master_name}\n💼 {service}\n💰 {price}",
      "uz": "✅ <b>Yozuv yaratildi</b>\n\n📅 {date} · {time}\n👤 {master_name}\n💼 {service}\n💰 {price}"
    }
  },
  {
    "event": "updated",
    "enabled": true,
    "texts": {
      "ru": "ℹ️ <b>Запись обновлена</b>\n\n📅 {date} · {time}\n👤 {master_name}\n💼 {service}",
      "en": "ℹ️ <b>Appointment updated</b>\n\n📅 {date} · {time}\n👤 {master_name}\n💼 {service}",
      "uz": "ℹ️ <b>Yozuv yangilandi</b>\n\n📅 {date} · {time}\n👤 {master_name}\n💼 {service}"
    }
  },
  {
    "event": "cancelled",
    "enabled": true,
    "texts": {
      "ru": "❌ <b>Запись отменена</b>\n\n📅 {date} · {time}\n👤 {master_name}",
      "en": "❌ <b>Appointment cancelled</b>\n\n📅 {date} · {time}\n👤 {master_name}",
      "uz": "❌ <b>Yozuv bekor qilindi</b>\n\n📅 {date} · {time}\n👤 {master_name}"
    }
  },
  {
    "event": "reminder",
    "enabled": true,
    "texts": {
      "ru": "⏰ <b>Напоминание</b>\n\nЗавтра в {time} у вас запись к {master_name}.\n💼 {service}",
      "en": "⏰ <b>Reminder</b>\n\nYou have an appointment tomorrow at {time} with {master_name}.\n💼 {service}",
      "uz": "⏰ <b>Eslatma</b>\n\nErtaga soat {time} da {master_name} bilan yozuvingiz bor.\n💼 {service}"
    }
  }
]
$json$::jsonb);
  END LOOP;
END $$;

-- Cleanup helper
DROP FUNCTION _upsert_templates(text, text, jsonb);
