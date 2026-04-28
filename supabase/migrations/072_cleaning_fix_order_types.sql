-- ─────────────────────────────────────────────────────────────────
-- 072: Финальный фикс order_type в global_services для cleaning
--
-- В миграции 070 у части новых категорий order_type не записался
-- корректно (Авто/Текстиль для дома/Детское бельё попали в clothing).
-- Эта миграция нормализует order_type для ВСЕХ известных категорий.
-- ─────────────────────────────────────────────────────────────────

UPDATE global_services SET order_type = CASE category
  -- одежда и текстиль на теле
  WHEN 'Одежда'            THEN 'clothing'
  WHEN 'Пальто и куртки'   THEN 'clothing'
  WHEN 'Кожа и замша'      THEN 'clothing'
  WHEN 'Костюмы'           THEN 'clothing'
  WHEN 'Детская одежда'    THEN 'clothing'
  WHEN 'Аксессуары'        THEN 'clothing'
  WHEN 'Меховые изделия'   THEN 'clothing'
  WHEN 'Спецодежда'        THEN 'clothing'
  WHEN 'Свадебное'         THEN 'clothing'
  WHEN 'Прачечная'         THEN 'clothing'
  -- ковры
  WHEN 'Ковры'             THEN 'carpet'
  -- мебель + матрасы + авто-обивка
  WHEN 'Мягкая мебель'     THEN 'furniture'
  WHEN 'Матрасы'           THEN 'furniture'
  WHEN 'Авто'              THEN 'furniture'
  -- обувь
  WHEN 'Обувь'             THEN 'shoes'
  -- шторы
  WHEN 'Шторы'             THEN 'curtains'
  -- постельное и домашний текстиль
  WHEN 'Постельное'        THEN 'bedding'
  WHEN 'Одеяла'            THEN 'bedding'
  WHEN 'Детское бельё'     THEN 'bedding'
  WHEN 'Текстиль для дома' THEN 'bedding'
  -- доп. услуги
  WHEN 'Спецуслуги'        THEN 'extras'
  ELSE order_type
END
WHERE product = 'cleaning';
