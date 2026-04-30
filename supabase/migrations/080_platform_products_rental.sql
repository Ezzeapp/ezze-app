-- 080_platform_products_rental.sql
-- Добавление 13-го продукта "Аренда" (rental) в platform_products.
-- Также корректируем описание "hotel": убираем слово "аренда",
-- чтобы избежать пересечения с новым продуктом (hotel = только размещение).

INSERT INTO platform_products
  (key, sort_order, active,
   name_ru, name_en, name_uz, name_kz, name_ky, name_tg,
   desc_ru, desc_en, desc_uz, desc_kz, desc_ky, desc_tg)
VALUES
  ('rental', 12, true,
   'Аренда', 'Rental', 'Ijara', 'Жалға беру', 'Ижара', 'Иҷора',
   'Прокат транспорта, инструмента, оборудования',
   'Vehicle, tool, and equipment rental',
   'Transport, asbob va jihozlarni ijaraga berish',
   'Көлік, құрал, жабдық жалға беру',
   'Транспорт, шайман, жабдуу ижарасы',
   'Иҷораи нақлиёт, асбоб, таҷҳизот')
ON CONFLICT (key) DO NOTHING;

-- Уточнение hotel: убираем "аренду" из описаний, чтобы не путать с rental
UPDATE platform_products SET
  desc_ru = 'Отели, хостелы, апартаменты',
  desc_en = 'Hotels, hostels, apartments',
  desc_uz = 'Mehmonxonalar, xostellar, apartamentlar',
  desc_kz = 'Қонақүйлер, хостелдер, пәтерлер',
  desc_ky = 'Мейманканалар, хостелдер, батирлер',
  desc_tg = 'Меҳмонхонаҳо, хостелҳо, апартаментҳо'
WHERE key = 'hotel';
