-- ── 040: Cleaning — category field + order types config + more global services ──

-- 1. Add category column to cleaning_item_types
ALTER TABLE cleaning_item_types ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'clothing';

-- 2. Backfill category from keyword detection
UPDATE cleaning_item_types SET category = CASE
  WHEN lower(name) ~ 'ковёр|ковр|палас|ковролин' THEN 'carpet'
  WHEN lower(name) ~ 'диван|кресло|матрас|пуф|угловой' THEN 'furniture'
  WHEN lower(name) ~ 'сапог|ботин|кроссов|туфл|сандал|обувь|угг|кед|мокасин' THEN 'shoes'
  WHEN lower(name) ~ 'штор|тюл|занавес|ламбрек|жалюзи|гардин|портьер' THEN 'curtains'
  WHEN lower(name) ~ 'одеял|подушк|постел|простын|наволочк|пеленк|наматрасник|плед|покрывал' THEN 'bedding'
  ELSE 'clothing'
END;

-- 3. Remove hardcoded CHECK constraint on order_type (allows custom types)
ALTER TABLE cleaning_orders DROP CONSTRAINT IF EXISTS cleaning_orders_order_type_check;

-- 4. Insert default order types config
INSERT INTO app_settings (product, key, value)
VALUES ('cleaning', 'cleaning_order_types_config',
'[{"slug":"clothing","label":"\u041e\u0434\u0435\u0436\u0434\u0430","icon":"Shirt","sort_order":0,"active":true,"description":"\u041e\u0434\u0435\u0436\u0434\u0430, \u043f\u0430\u043b\u044c\u0442\u043e, \u043a\u0443\u0440\u0442\u043a\u0438, \u043a\u043e\u0441\u0442\u044e\u043c\u044b"},{"slug":"carpet","label":"\u041a\u043e\u0432\u0451\u0440","icon":"LayoutGrid","sort_order":1,"active":true,"description":"\u041a\u043e\u0432\u0440\u044b, \u0434\u043e\u0440\u043e\u0436\u043a\u0438 (\u0446\u0435\u043d\u0430 \u0437\u0430 \u043a\u0432.\u043c)"},{"slug":"furniture","label":"\u041c\u0435\u0431\u0435\u043b\u044c","icon":"Sofa","sort_order":2,"active":true,"description":"\u0414\u0438\u0432\u0430\u043d\u044b, \u043a\u0440\u0435\u0441\u043b\u0430, \u043c\u0430\u0442\u0440\u0430\u0441\u044b"},{"slug":"shoes","label":"\u041e\u0431\u0443\u0432\u044c","icon":"Footprints","sort_order":3,"active":false,"description":"\u041e\u0431\u0443\u0432\u044c, \u0441\u0430\u043f\u043e\u0433\u0438, \u0431\u043e\u0442\u0438\u043d\u043a\u0438"},{"slug":"curtains","label":"\u0428\u0442\u043e\u0440\u044b","icon":"Wind","sort_order":4,"active":false,"description":"\u0428\u0442\u043e\u0440\u044b, \u0442\u044e\u043b\u044c, \u0437\u0430\u043d\u0430\u0432\u0435\u0441\u043a\u0438"},{"slug":"bedding","label":"\u041f\u043e\u0441\u0442\u0435\u043b\u044c\u043d\u043e\u0435","icon":"BedDouble","sort_order":5,"active":false,"description":"\u041e\u0434\u0435\u044f\u043b\u0430, \u043f\u043e\u0434\u0443\u0448\u043a\u0438, \u043f\u043e\u0441\u0442\u0435\u043b\u044c\u043d\u043e\u0435"}]'
)
ON CONFLICT (product, key) DO NOTHING;

-- 5. More global services for cleaning
INSERT INTO global_services (name, category, product) VALUES
('Чистка сарафана', 'Одежда', 'cleaning'),
('Чистка толстовки / худи', 'Одежда', 'cleaning'),
('Чистка кардигана', 'Одежда', 'cleaning'),
('Чистка майки', 'Одежда', 'cleaning'),
('Чистка комбинезона', 'Одежда', 'cleaning'),
('Глажка платья', 'Одежда', 'cleaning'),
('Глажка джинсов', 'Одежда', 'cleaning'),
('Глажка куртки', 'Одежда', 'cleaning'),
('Чистка мужского костюма (2 предмета)', 'Костюмы', 'cleaning'),
('Чистка женского костюма (2 предмета)', 'Костюмы', 'cleaning'),
('Чистка делового костюма', 'Костюмы', 'cleaning'),
('Чистка смокинга', 'Костюмы', 'cleaning'),
('Чистка мундира / форменной одежды', 'Костюмы', 'cleaning'),
('Чистка детской куртки', 'Детская одежда', 'cleaning'),
('Чистка детского комбинезона', 'Детская одежда', 'cleaning'),
('Чистка детского платья', 'Детская одежда', 'cleaning'),
('Чистка школьной формы', 'Детская одежда', 'cleaning'),
('Чистка детских брюк', 'Детская одежда', 'cleaning'),
('Чистка шарфа / платка', 'Аксессуары', 'cleaning'),
('Чистка галстука', 'Аксессуары', 'cleaning'),
('Чистка перчаток кожаных', 'Аксессуары', 'cleaning'),
('Чистка шапки', 'Аксессуары', 'cleaning'),
('Чистка сумки тканевой', 'Аксессуары', 'cleaning'),
('Чистка рюкзака', 'Аксессуары', 'cleaning'),
('Чистка пояса / ремня', 'Аксессуары', 'cleaning'),
('Чистка турецкого ковра (м²)', 'Ковры', 'cleaning'),
('Чистка иранского ковра (м²)', 'Ковры', 'cleaning'),
('Чистка бельгийского ковра (м²)', 'Ковры', 'cleaning'),
('Чистка паласа (м²)', 'Ковры', 'cleaning'),
('Дезинфекция ковра (м²)', 'Ковры', 'cleaning'),
('Чистка ковровой дорожки (м²)', 'Ковры', 'cleaning'),
('Реставрация ковра', 'Ковры', 'cleaning'),
('Химчистка дивана угловой', 'Мягкая мебель', 'cleaning'),
('Химчистка пуфа', 'Мягкая мебель', 'cleaning'),
('Химчистка банкетки', 'Мягкая мебель', 'cleaning'),
('Химчистка стула мягкого', 'Мягкая мебель', 'cleaning'),
('Химчистка матраса детского', 'Мягкая мебель', 'cleaning'),
('Химчистка матраса односпального', 'Мягкая мебель', 'cleaning'),
('Дезинфекция мягкой мебели', 'Мягкая мебель', 'cleaning'),
('Чистка кроссовок детских (пара)', 'Обувь', 'cleaning'),
('Чистка ботинок зимних (пара)', 'Обувь', 'cleaning'),
('Чистка мокасин (пара)', 'Обувь', 'cleaning'),
('Чистка шлёпанцев (пара)', 'Обувь', 'cleaning'),
('Чистка спортивной обуви (пара)', 'Обувь', 'cleaning'),
('Реставрация обуви', 'Обувь', 'cleaning'),
('Чистка портьер (м²)', 'Шторы', 'cleaning'),
('Чистка гардин (м²)', 'Шторы', 'cleaning'),
('Чистка римских штор (м²)', 'Шторы', 'cleaning'),
('Чистка рулонных штор (м²)', 'Шторы', 'cleaning'),
('Глажка гардин после стирки', 'Шторы', 'cleaning'),
('Чистка шерстяного одеяла', 'Постельное', 'cleaning'),
('Чистка бамбукового одеяла', 'Постельное', 'cleaning'),
('Чистка пледа', 'Постельное', 'cleaning'),
('Чистка покрывала', 'Постельное', 'cleaning'),
('Стирка пододеяльника', 'Постельное', 'cleaning'),
('Стирка наволочки (2 шт.)', 'Постельное', 'cleaning'),
('Стирка простыни', 'Постельное', 'cleaning'),
('Срочная химчистка (24 ч)', 'Спецуслуги', 'cleaning'),
('Пятновыводка (1 пятно)', 'Спецуслуги', 'cleaning'),
('Дезодорация изделия', 'Спецуслуги', 'cleaning'),
('Консервация одежды на хранение', 'Спецуслуги', 'cleaning'),
('Упаковка в чехол после чистки', 'Спецуслуги', 'cleaning'),
('Доставка и забор вещей', 'Спецуслуги', 'cleaning'),
('Выезд к клиенту (химчистка ковра)', 'Спецуслуги', 'cleaning')
ON CONFLICT (name, category, product) DO NOTHING;
