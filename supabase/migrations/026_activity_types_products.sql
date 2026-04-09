-- Migration 026: Add products[] filter to activity_types
-- Each activity_type can belong to one or more products.
-- Empty array = available to ALL products (универсальные категории).

ALTER TABLE public.activity_types
  ADD COLUMN IF NOT EXISTS products TEXT[] NOT NULL DEFAULT '{}';

-- ── Назначаем продукты по категориям ─────────────────────────────────────────

UPDATE public.activity_types SET products = '{beauty}'
WHERE name IN (
  'Красота и уход',
  'Мода и стиль'
);

UPDATE public.activity_types SET products = '{beauty,clinic}'
WHERE name IN (
  'Здоровье и тело',
  'Спорт и активный отдых',
  'Фитнес и спорт'
);

UPDATE public.activity_types SET products = '{clinic}'
WHERE name IN (
  'Медицина'
);

UPDATE public.activity_types SET products = '{clinic,edu}'
WHERE name IN (
  'Детские услуги',
  'Психология и коучинг'
);

UPDATE public.activity_types SET products = '{edu}'
WHERE name IN (
  'Репетиторство и обучение',
  'Переводы и языки'
);

UPDATE public.activity_types SET products = '{edu,event}'
WHERE name IN (
  'Музыка и звук',
  'Медиа и контент'
);

UPDATE public.activity_types SET products = '{event}'
WHERE name IN (
  'Ивенты и праздники'
);

UPDATE public.activity_types SET products = '{event,beauty}'
WHERE name IN (
  'Фото и видео'
);

UPDATE public.activity_types SET products = '{food}'
WHERE name IN (
  'Кулинария и кейтеринг'
);

UPDATE public.activity_types SET products = '{farm}'
WHERE name IN (
  'Сельское хозяйство'
);

UPDATE public.activity_types SET products = '{farm,clinic}'
WHERE name IN (
  'Уход за животными'
);

UPDATE public.activity_types SET products = '{transport}'
WHERE name IN (
  'Авто и транспорт'
);

UPDATE public.activity_types SET products = '{workshop,build}'
WHERE name IN (
  'Строительство и ремонт'
);

UPDATE public.activity_types SET products = '{workshop,edu,event}'
WHERE name IN (
  'Творчество и ремёсла'
);

UPDATE public.activity_types SET products = '{workshop,beauty,clinic}'
WHERE name IN (
  'Услуги на дому'
);

UPDATE public.activity_types SET products = '{workshop,edu,event,build}'
WHERE name IN (
  'Дизайн'
);

UPDATE public.activity_types SET products = '{build,hotel,trade}'
WHERE name IN (
  'Недвижимость'
);

UPDATE public.activity_types SET products = '{build,transport}'
WHERE name IN (
  'Охрана и безопасность'
);

UPDATE public.activity_types SET products = '{trade}'
WHERE name IN (
  'Финансы и право'
);

-- products = '{}' (пустой) = показывать для ВСЕХ продуктов:
-- IT и digital, Бизнес и консалтинг, Маркетинг и реклама, Другое

-- ── Индекс для быстрой фильтрации ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_types_products
  ON public.activity_types USING GIN (products);
