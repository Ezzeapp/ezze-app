-- ─────────────────────────────────────────────────────────────────
-- 073: Синхронизация category в cleaning_item_types с global_services
--
-- У мастеров, которые импортировали справочник ДО фикса 072,
-- в cleaning_item_types.category могло сохраниться неправильное
-- значение (например, всё попало в clothing вместо furniture/bedding/...).
--
-- Эта миграция выравнивает category по эталону global_services.order_type,
-- сопоставляя по имени услуги. Кастомные позиции мастера (которых нет в
-- глобальном справочнике) не затрагиваются.
-- ─────────────────────────────────────────────────────────────────

UPDATE cleaning_item_types AS c
   SET category = g.order_type
  FROM global_services AS g
 WHERE c.product = 'cleaning'
   AND g.product = 'cleaning'
   AND c.name = g.name
   AND g.order_type IS NOT NULL
   AND COALESCE(c.category, '') <> g.order_type;
