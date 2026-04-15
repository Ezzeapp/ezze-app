-- ── 045: Cleaning — order_type in global_services + subcategory in cleaning_item_types ──

-- 1. Add order_type to global_services (filled only for cleaning)
ALTER TABLE global_services ADD COLUMN IF NOT EXISTS order_type TEXT;

-- Backfill order_type from existing category text (cleaning only)
UPDATE global_services SET order_type = CASE
  WHEN lower(category) ~ 'ковр|палас' THEN 'carpet'
  WHEN lower(category) ~ 'мягк.*мебел|диван|кресл|матрас|пуф|банкетк|стул мягк' THEN 'furniture'
  WHEN lower(category) ~ 'обувь|ботин|кроссов|туфл|кед|сапог|мокасин|шлёпан|шлепан' THEN 'shoes'
  WHEN lower(category) ~ 'штор|тюл|занавес|гардин|портьер|ламбрек' THEN 'curtains'
  WHEN lower(category) ~ 'постел|одеял|подушк|плед|покрывал|наволочк|простын|наматрасник' THEN 'bedding'
  ELSE 'clothing'
END WHERE product = 'cleaning';

-- 2. Add subcategory to cleaning_item_types
ALTER TABLE cleaning_item_types ADD COLUMN IF NOT EXISTS subcategory TEXT;
