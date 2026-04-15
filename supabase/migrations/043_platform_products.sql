-- 043_platform_products.sql
-- Таблица продуктов платформы: управляется из суперадмина,
-- отображается на экране выбора направления при регистрации.

CREATE TABLE IF NOT EXISTS platform_products (
  key        TEXT PRIMARY KEY,
  -- Названия по языкам
  name_ru    TEXT NOT NULL,
  name_en    TEXT,
  name_uz    TEXT,
  name_kz    TEXT,
  name_ky    TEXT,
  name_tg    TEXT,
  name_uk    TEXT,
  name_by    TEXT,
  name_kaa   TEXT,
  -- Описания по языкам
  desc_ru    TEXT,
  desc_en    TEXT,
  desc_uz    TEXT,
  desc_kz    TEXT,
  desc_ky    TEXT,
  desc_tg    TEXT,
  desc_uk    TEXT,
  desc_by    TEXT,
  desc_kaa   TEXT,
  -- Управление отображением
  active     BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- RLS
ALTER TABLE platform_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_products_public_read"
  ON platform_products FOR SELECT USING (true);

CREATE POLICY "platform_products_admin_all"
  ON platform_products FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

-- Seed: 12 продуктов с переводами на ru, en, uz, kz, ky, tg
INSERT INTO platform_products
  (key, sort_order, active,
   name_ru, name_en, name_uz, name_kz, name_ky, name_tg,
   desc_ru, desc_en, desc_uz, desc_kz, desc_ky, desc_tg)
VALUES
  ('beauty', 0, true,
   'Красота', 'Beauty', 'Go''zallik', 'Сұлулық', 'Сулуулук', 'Зебоӣ',
   'Салоны, парикмахеры, косметологи',
   'Salons, barbers, cosmetologists',
   'Salonlar, sartaroshlar, kosmetologlar',
   'Салондар, шаштаразлар, косметологтар',
   'Салондор, чач усталары, косметологдор',
   'Салонҳо, сартарошон, косметологҳо'),

  ('clinic', 1, true,
   'Медицина', 'Medicine', 'Tibbiyot', 'Медицина', 'Медицина', 'Тиббиёт',
   'Клиники, врачи, стоматология',
   'Clinics, doctors, dentistry',
   'Klinikalar, shifokorlar, stomatologiya',
   'Клиникалар, дәрігерлер, стоматология',
   'Клиникалар, дарыгерлер, стоматология',
   'Клиникаҳо, духтурон, стоматология'),

  ('workshop', 2, true,
   'Мастерская', 'Workshop', 'Ustaxona', 'Шеберхана', 'Чеберкана', 'Устохона',
   'Ремонт, сервис, умельцы',
   'Repair, service, craftsmen',
   'Ta''mirlash, xizmat, hunarmandlar',
   'Жөндеу, сервис, шеберлер',
   'Оңдоо, сервис, усталар',
   'Таъмир, хизмат, ҳунармандон'),

  ('edu', 3, true,
   'Образование', 'Education', 'Ta''lim', 'Білім', 'Билим', 'Маориф',
   'Репетиторы, курсы, тренинги',
   'Tutors, courses, trainings',
   'Repetitorlar, kurslar, treninglar',
   'Репетиторлар, курстар, тренингтер',
   'Репетиторлор, курстар, тренингдер',
   'Репетиторҳо, курсҳо, тренингҳо'),

  ('hotel', 4, true,
   'Размещение', 'Accommodation', 'Yotoqxona', 'Тұрғын үй', 'Жай', 'Истироҳатгоҳ',
   'Отели, хостелы, аренда',
   'Hotels, hostels, rentals',
   'Mehmonxonalar, xostellar, ijara',
   'Қонақүйлер, хостелдер, жалға алу',
   'Мейманканалар, хостелдер, ижара',
   'Меҳмонхонаҳо, хостелҳо, ижора'),

  ('food', 5, true,
   'Еда', 'Food', 'Taom', 'Тамақ', 'Тамак', 'Ғизо',
   'Рестораны, доставка, кейтеринг',
   'Restaurants, delivery, catering',
   'Restoranlar, yetkazib berish, katering',
   'Мейрамханалар, жеткізу, кейтеринг',
   'Мейрамканалар, жеткирүү, кейтеринг',
   'Тарабхонаҳо, расонидан, кейтеринг'),

  ('event', 6, true,
   'Мероприятия', 'Events', 'Tadbirlar', 'Іс-шаралар', 'Иш-чаралар', 'Тадбирҳо',
   'Ивенты, фотографы, аниматоры',
   'Events, photographers, entertainers',
   'Tadbirlar, fotochilar, animatorlar',
   'Іс-шаралар, фотографтар, аниматорлар',
   'Тойлор, сүрөтчүлөр, аниматорлор',
   'Тадбирҳо, аксбардорон, аниматорҳо'),

  ('farm', 7, true,
   'Агро', 'Agriculture', 'Qishloq xo''jaligi', 'Ауыл шаруашылығы', 'Айыл чарба', 'Кишоварзӣ',
   'Фермеры, поставщики, агрономы',
   'Farmers, suppliers, agronomists',
   'Fermerlar, ta''minotchilar, agronomlar',
   'Фермерлер, жеткізушілер, агрономдар',
   'Фермерлер, жеткирүүчүлөр, агрономдор',
   'Фермерҳо, таъминотчиён, агрономҳо'),

  ('transport', 8, true,
   'Транспорт', 'Transport', 'Transport', 'Көлік', 'Транспорт', 'Нақлиёт',
   'Такси, логистика, перевозки',
   'Taxi, logistics, transportation',
   'Taksi, logistika, tashish',
   'Такси, логистика, тасымал',
   'Такси, логистика, ташуу',
   'Такси, логистика, интиқол'),

  ('build', 9, true,
   'Строительство', 'Construction', 'Qurilish', 'Құрылыс', 'Курулуш', 'Сохтмон',
   'Стройка, проектирование, ремонт',
   'Construction, design, renovation',
   'Qurilish, loyihalash, ta''mirlash',
   'Құрылыс, жобалау, жөндеу',
   'Курулуш, долбоорлоо, оңдоо',
   'Сохтмон, лоиҳасозӣ, таъмир'),

  ('trade', 10, true,
   'Торговля', 'Trade', 'Savdo', 'Сауда', 'Соода', 'Тиҷорат',
   'Магазины, интернет-торговля',
   'Shops, e-commerce',
   'Do''konlar, internet savdo',
   'Дүкендер, интернет-сауда',
   'Дүкөндөр, интернет соода',
   'Мағозаҳо, тиҷорати интернетӣ'),

  ('cleaning', 11, true,
   'Химчистка', 'Dry Cleaning', 'Kimyoviy tozalash', 'Химчистка', 'Химчистка', 'Химчисткӣ',
   'Химчистки, прачечные, чистка ковров',
   'Dry cleaners, laundries, carpet cleaning',
   'Kimyoviy tozalash, kir yuvish, gilam tozalash',
   'Химчисткалар, кір жуу, кілем тазалау',
   'Химчисткалар, кир жуу, килем тазалоо',
   'Химчисткаҳо, рахтшӯихонаҳо, тозакунии қолин')

ON CONFLICT (key) DO NOTHING;
