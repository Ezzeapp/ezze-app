-- ─────────────────────────────────────────────────────────────────
-- 064_default_plan_pricing.sql
-- Дефолтная конфигурация тарифов для cleaning:
--   * 3 уровня (Free / Pro / Business — "Business" хранится под ключом "enterprise")
--   * Цены: 0 / 50 000 / 120 000 (база Business)
--   * Per-seat биллинг: Business включает 3 сотрудника, +30 000 за каждого
--                       сверх 3, максимум 15 сотрудников
--   * Лимиты: Free — 30 заказов, 50 клиентов, 20 услуг
--
-- ВАЖНО: используется ON CONFLICT DO NOTHING — НЕ перезаписывает существующие
-- настройки. Если ты уже настраивал тарифы через админку — значения сохранятся.
-- Чтобы сбросить к дефолтам, используй кнопку "Сбросить к дефолтам" в
-- конструкторе тарифов (admin.ezze.site → Тарифы).
-- ─────────────────────────────────────────────────────────────────

-- ============================================================
-- 1. PLAN_NAMES (cleaning) — отображаемые названия тарифов
-- ============================================================
INSERT INTO public.app_settings (product, key, value) VALUES
  ('cleaning', 'plan_names',
   '{"free":"Free","pro":"Pro","enterprise":"Business"}')
ON CONFLICT (product, key) DO NOTHING;


-- ============================================================
-- 2. PLAN_PRICES (cleaning) — базовые цены/мес в UZS
-- ============================================================
INSERT INTO public.app_settings (product, key, value) VALUES
  ('cleaning', 'plan_prices',
   '{"pro":50000,"enterprise":120000}')
ON CONFLICT (product, key) DO NOTHING;


-- ============================================================
-- 3. PLAN_LIMITS (cleaning) — лимиты функционала
-- Структура совместима с DEFAULT_PLAN_LIMITS из useAppSettings.ts
-- (массив строк {key, enabled, free, pro, enterprise})
-- ============================================================
INSERT INTO public.app_settings (product, key, value) VALUES
  ('cleaning', 'plan_limits', '[
    {"key":"appts_month","enabled":true,"free":30,"pro":null,"enterprise":null},
    {"key":"clients","enabled":true,"free":50,"pro":null,"enterprise":null},
    {"key":"services","enabled":true,"free":20,"pro":null,"enterprise":null}
  ]')
ON CONFLICT (product, key) DO NOTHING;


-- ============================================================
-- 4. PLAN_SEAT_PRICING (cleaning) — per-seat биллинг для команды
-- Структура per-plan: { seats_included, additional_seat_price, max_seats }
-- ============================================================
INSERT INTO public.app_settings (product, key, value) VALUES
  ('cleaning', 'plan_seat_pricing', '{
    "free":      {"seats_included":1,"additional_seat_price":0,    "max_seats":1},
    "pro":       {"seats_included":1,"additional_seat_price":0,    "max_seats":1},
    "enterprise":{"seats_included":3,"additional_seat_price":30000,"max_seats":15}
  }')
ON CONFLICT (product, key) DO NOTHING;


-- ============================================================
-- 5. PLAN_FEATURES (cleaning) — список фич, отображаемых в UI
-- ============================================================
INSERT INTO public.app_settings (product, key, value) VALUES
  ('cleaning', 'plan_features', '{
    "free": [
      "До 30 заказов в месяц",
      "До 50 клиентов",
      "Базовая аналитика"
    ],
    "pro": [
      "Безлимитные заказы и клиенты",
      "Онлайн-оплаты (Click, Payme, Uzum)",
      "Telegram-уведомления",
      "Лендинг с QR и промокодами",
      "Расширенная аналитика"
    ],
    "enterprise": [
      "Все возможности Pro",
      "Команда: до 3 сотрудников включено",
      "+30 000 за каждого дополнительного сотрудника (макс. 15)",
      "Роли: Владелец / Админ / Оператор / Чистильщик-курьер",
      "Общая база клиентов и заказов",
      "Аналитика по сотрудникам и комиссиям"
    ]
  }')
ON CONFLICT (product, key) DO NOTHING;


-- ============================================================
-- 6. PLAN_ACTIVE (cleaning) — какие тарифы показываются в Billing
-- ============================================================
INSERT INTO public.app_settings (product, key, value) VALUES
  ('cleaning', 'plan_active',
   '{"free":true,"pro":true,"enterprise":true}')
ON CONFLICT (product, key) DO NOTHING;
