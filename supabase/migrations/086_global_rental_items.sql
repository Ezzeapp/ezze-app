-- ─────────────────────────────────────────────────────────────────
-- 086_global_rental_items.sql
-- Глобальный справочник позиций для аренды.
-- Используется при онбординге арендодателя для импорта стартового каталога
-- (по аналогии с global_services / global_products / cleaning_item_types).
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS global_rental_items (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product                     TEXT NOT NULL DEFAULT 'rental',

  name                        TEXT NOT NULL,
  category                    TEXT NOT NULL,             -- transport / tool / event / sport / household / other
  subcategory                 TEXT,                      -- свободный текст

  -- Дефолты для тарификации
  default_pricing_unit        TEXT NOT NULL DEFAULT 'day'
                                CHECK (default_pricing_unit IN ('hour','day','week','month')),
  default_price_per_day       NUMERIC(12,2) NOT NULL DEFAULT 0,
  default_price_per_hour      NUMERIC(12,2),
  default_min_rental_minutes  INT NOT NULL DEFAULT 0,

  -- Дефолтный депозит
  default_deposit_required    BOOLEAN NOT NULL DEFAULT FALSE,
  default_deposit_percent     INT NOT NULL DEFAULT 0,    -- % от стоимости аренды (если нужен залог)

  icon                        TEXT,                      -- Lucide icon name
  sort_order                  INT NOT NULL DEFAULT 0,
  active                      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (product, name)
);

CREATE INDEX IF NOT EXISTS idx_global_rental_items_category
  ON global_rental_items(product, category);
CREATE INDEX IF NOT EXISTS idx_global_rental_items_active
  ON global_rental_items(active) WHERE active = TRUE;

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE global_rental_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "global_rental_items_public_read" ON global_rental_items
  FOR SELECT USING (true);

CREATE POLICY "global_rental_items_admin_write" ON global_rental_items
  FOR ALL USING (public.is_admin());

-- ── Сидинг типовых позиций ───────────────────────────────────────
-- Цены в сумах (UZS). default_price_per_day — ориентир для арендодателя.

INSERT INTO global_rental_items
  (product, category, name, subcategory, default_pricing_unit, default_price_per_day, default_price_per_hour, default_deposit_required, default_deposit_percent, icon, sort_order)
VALUES
  -- ── Транспорт ────────────────────────────────────────────────
  ('rental', 'transport', 'Легковой автомобиль (эконом)', 'Авто', 'day',  400000,  60000, true, 100, 'Car',         10),
  ('rental', 'transport', 'Легковой автомобиль (комфорт)', 'Авто','day',  600000,  80000, true, 100, 'Car',         11),
  ('rental', 'transport', 'Легковой автомобиль (премиум)', 'Авто','day', 1200000, 150000, true, 200, 'Car',         12),
  ('rental', 'transport', 'Внедорожник / SUV',            'Авто', 'day',  900000, 120000, true, 150, 'Car',         13),
  ('rental', 'transport', 'Минивэн (7-9 мест)',           'Авто', 'day',  800000, 100000, true, 150, 'Car',         14),
  ('rental', 'transport', 'Грузовой фургон',              'Грузовой','day', 700000, 90000, true, 100, 'Truck',      20),
  ('rental', 'transport', 'Пикап',                        'Грузовой','day', 800000,100000, true, 100, 'Truck',      21),
  ('rental', 'transport', 'Скутер / мопед',               'Мото',  'day',  150000,  25000, true, 50,  'Bike',       30),
  ('rental', 'transport', 'Мотоцикл',                     'Мото',  'day',  300000,  50000, true, 100, 'Bike',       31),
  ('rental', 'transport', 'Велосипед городской',          'Вело',  'hour',  20000,   8000, false, 0,  'Bike',       40),
  ('rental', 'transport', 'Электровелосипед',             'Вело',  'hour',  40000,  15000, true, 50,  'Bike',       41),
  ('rental', 'transport', 'Электросамокат',               'Вело',  'hour',  30000,  10000, true, 50,  'Bike',       42),
  ('rental', 'transport', 'Прицеп легковой',              'Прицеп','day',  100000,  20000, true, 50,  'Truck',      50),
  ('rental', 'transport', 'Лодка / катер',                'Вода',  'hour', 200000,  80000, true, 100, 'Sailboat',   60),
  ('rental', 'transport', 'Сап-доска (SUP)',              'Вода',  'hour',  30000,  12000, true, 50,  'Waves',      61),
  ('rental', 'transport', 'Каяк / байдарка',              'Вода',  'hour',  25000,  10000, true, 50,  'Waves',      62),
  ('rental', 'transport', 'Снегоход',                     'Зима',  'hour', 150000,  50000, true, 100, 'Snowflake',  70),
  ('rental', 'transport', 'Квадроцикл',                   'Внедор','hour', 120000,  40000, true, 100, 'Bike',       71),
  ('rental', 'transport', 'Багги',                        'Внедор','hour', 150000,  50000, true, 100, 'Car',        72),

  -- ── Спецтехника ──────────────────────────────────────────────
  ('rental', 'transport', 'Экскаватор',                   'Спец',  'day', 1500000, 200000, true, 100, 'HardHat',    80),
  ('rental', 'transport', 'Погрузчик',                    'Спец',  'day', 1200000, 180000, true, 100, 'HardHat',    81),
  ('rental', 'transport', 'Автокран',                     'Спец',  'hour', 250000,250000, true, 100, 'HardHat',    82),
  ('rental', 'transport', 'Манипулятор',                  'Спец',  'hour', 200000,200000, true, 100, 'HardHat',    83),

  -- ── Инструмент ───────────────────────────────────────────────
  ('rental', 'tool', 'Перфоратор',                        'Электро','day',  60000,  12000, true, 50,  'Wrench',    100),
  ('rental', 'tool', 'Дрель / шуруповёрт',                'Электро','day',  40000,   8000, true, 30,  'Wrench',    101),
  ('rental', 'tool', 'Болгарка (УШМ)',                    'Электро','day',  50000,  10000, true, 30,  'Wrench',    102),
  ('rental', 'tool', 'Лобзик электрический',              'Электро','day',  40000,   8000, true, 30,  'Wrench',    103),
  ('rental', 'tool', 'Циркулярная пила',                  'Электро','day',  60000,  12000, true, 50,  'Wrench',    104),
  ('rental', 'tool', 'Штроборез',                         'Электро','day', 100000,  20000, true, 50,  'Wrench',    105),
  ('rental', 'tool', 'Бензопила',                         'Бензо',  'day',  80000,  15000, true, 50,  'Wrench',    110),
  ('rental', 'tool', 'Триммер бензиновый',                'Бензо',  'day',  60000,  12000, true, 30,  'Wrench',    111),
  ('rental', 'tool', 'Генератор',                         'Бензо',  'day', 150000,  30000, true, 100, 'Wrench',    112),
  ('rental', 'tool', 'Бетономешалка',                     'Стройка','day',  80000,  15000, true, 50,  'HardHat',   120),
  ('rental', 'tool', 'Виброплита',                        'Стройка','day', 120000,  25000, true, 50,  'HardHat',   121),
  ('rental', 'tool', 'Отбойный молоток',                  'Стройка','day', 100000,  20000, true, 50,  'HardHat',   122),
  ('rental', 'tool', 'Сварочный аппарат',                 'Сварка', 'day', 100000,  20000, true, 50,  'Wrench',    130),
  ('rental', 'tool', 'Компрессор',                        'Сварка', 'day', 120000,  25000, true, 50,  'Wrench',    131),
  ('rental', 'tool', 'Леса строительные (секция)',        'Леса',   'day',  50000,   0,    true, 30,  'HardHat',   140),
  ('rental', 'tool', 'Вышка-тура',                        'Леса',   'day',  80000,   0,    true, 50,  'HardHat',   141),
  ('rental', 'tool', 'Лазерный нивелир',                  'Измер',  'day',  60000,  12000, true, 100, 'Wrench',    150),
  ('rental', 'tool', 'Тепловизор',                        'Измер',  'day', 150000,  30000, true, 200, 'Wrench',    151),

  -- ── Оборудование для мероприятий ─────────────────────────────
  ('rental', 'event', 'Звуковая система (комплект)',      'Звук',   'day', 500000,   0,    true, 50,  'PartyPopper', 200),
  ('rental', 'event', 'Световое оборудование (комплект)', 'Свет',   'day', 400000,   0,    true, 50,  'PartyPopper', 201),
  ('rental', 'event', 'Проектор',                         'Видео',  'day', 200000,  50000, true, 100, 'PartyPopper', 202),
  ('rental', 'event', 'Экран проекционный',               'Видео',  'day',  80000,   0,    false, 0,  'PartyPopper', 203),
  ('rental', 'event', 'Шатёр / тент',                     'Шатры',  'day', 300000,   0,    true, 30,  'PartyPopper', 210),
  ('rental', 'event', 'Стол банкетный',                   'Мебель', 'day',  20000,   0,    false, 0,  'PartyPopper', 220),
  ('rental', 'event', 'Стул',                             'Мебель', 'day',   5000,   0,    false, 0,  'PartyPopper', 221),
  ('rental', 'event', 'Скатерть',                         'Текст',  'day',   8000,   0,    false, 0,  'PartyPopper', 230),
  ('rental', 'event', 'Посуда (комплект на 10 персон)',   'Посуда', 'day',  50000,   0,    true, 50,  'PartyPopper', 240),
  ('rental', 'event', 'Свадебная арка',                   'Декор',  'day', 200000,   0,    true, 30,  'PartyPopper', 250),
  ('rental', 'event', 'Фотозона',                         'Декор',  'day', 150000,   0,    true, 30,  'PartyPopper', 251),

  -- ── Фото/видео/гейминг ───────────────────────────────────────
  ('rental', 'event', 'Камера фото (зеркальная)',         'Фото',   'day', 300000,  60000, true, 200, 'PartyPopper', 260),
  ('rental', 'event', 'Объектив',                         'Фото',   'day', 150000,  30000, true, 200, 'PartyPopper', 261),
  ('rental', 'event', 'Стабилизатор / gimbal',            'Видео',  'day', 200000,  40000, true, 100, 'PartyPopper', 262),
  ('rental', 'event', 'Дрон',                             'Видео',  'day', 400000,  80000, true, 200, 'PartyPopper', 263),
  ('rental', 'event', 'VR-очки',                          'Гейминг','hour', 50000,  20000, true, 100, 'PartyPopper', 270),
  ('rental', 'event', 'Игровая приставка',                'Гейминг','day', 100000,  30000, true, 100, 'PartyPopper', 271),

  -- ── Спорт и туризм ───────────────────────────────────────────
  ('rental', 'sport', 'Горные лыжи (комплект)',           'Зима',   'day', 100000,   0,    true, 50,  'Snowflake',  300),
  ('rental', 'sport', 'Сноуборд (комплект)',              'Зима',   'day', 100000,   0,    true, 50,  'Snowflake',  301),
  ('rental', 'sport', 'Палатка туристическая',            'Кемпинг','day',  50000,   0,    true, 30,  'Tent',       310),
  ('rental', 'sport', 'Спальный мешок',                   'Кемпинг','day',  20000,   0,    false, 0,  'Tent',       311),
  ('rental', 'sport', 'Рюкзак туристический',             'Кемпинг','day',  20000,   0,    false, 0,  'Tent',       312),
  ('rental', 'sport', 'Велосипед горный',                 'Вело',   'day',  80000,  15000, true, 50,  'Bike',       320),

  -- ── Бытовая техника ──────────────────────────────────────────
  ('rental', 'household', 'Моющий пылесос',               'Уборка', 'day', 100000,  20000, true, 50,  'WashingMachine', 400),
  ('rental', 'household', 'Парогенератор',                'Уборка', 'day',  80000,  15000, true, 30,  'WashingMachine', 401),
  ('rental', 'household', 'Ковровый экстрактор',          'Уборка', 'day', 150000,  30000, true, 50,  'WashingMachine', 402),
  ('rental', 'household', 'Детская коляска',              'Дети',   'day',  50000,   0,    true, 50,  'Package',    410),
  ('rental', 'household', 'Автокресло детское',           'Дети',   'day',  30000,   0,    true, 30,  'Package',    411),

  -- ── Одежда / реквизит ────────────────────────────────────────
  ('rental', 'other', 'Свадебное платье',                 'Одежда', 'day', 500000,   0,    true, 200, 'Package',    500),
  ('rental', 'other', 'Вечернее платье',                  'Одежда', 'day', 200000,   0,    true, 100, 'Package',    501),
  ('rental', 'other', 'Карнавальный костюм',              'Одежда', 'day', 100000,   0,    true, 50,  'Package',    502),
  ('rental', 'other', 'Смокинг / костюм мужской',         'Одежда', 'day', 250000,   0,    true, 100, 'Package',    503),
  ('rental', 'other', 'Реквизит для съёмок',              'Реквиз', 'day',  50000,   0,    true, 50,  'Package',    510)

ON CONFLICT (product, name) DO NOTHING;
