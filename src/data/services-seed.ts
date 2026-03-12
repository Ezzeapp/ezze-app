/** Seed-данные для глобального справочника услуг */
export interface SeedService {
  category: string
  name: string
  duration_min?: number
  price?: number
}

export const SERVICES_SEED: SeedService[] = [
  // ── Волосы ───────────────────────────────────────────────────────────────
  { category: 'Волосы', name: 'Стрижка мужская', duration_min: 30 },
  { category: 'Волосы', name: 'Стрижка женская', duration_min: 60 },
  { category: 'Волосы', name: 'Стрижка детская', duration_min: 20 },
  { category: 'Волосы', name: 'Окрашивание волос', duration_min: 120 },
  { category: 'Волосы', name: 'Мелирование / балаяж', duration_min: 150 },
  { category: 'Волосы', name: 'Тонирование волос', duration_min: 60 },
  { category: 'Волосы', name: 'Ламинирование волос', duration_min: 90 },
  { category: 'Волосы', name: 'Кератиновое выпрямление', duration_min: 180 },
  { category: 'Волосы', name: 'Укладка / blow dry', duration_min: 45 },
  { category: 'Волосы', name: 'Плетение кос', duration_min: 60 },
  { category: 'Волосы', name: 'Наращивание волос', duration_min: 180 },
  { category: 'Волосы', name: 'Восстановительная маска для волос', duration_min: 30 },

  // ── Ногти ────────────────────────────────────────────────────────────────
  { category: 'Ногти', name: 'Маникюр классический', duration_min: 45 },
  { category: 'Ногти', name: 'Маникюр аппаратный', duration_min: 60 },
  { category: 'Ногти', name: 'Гель-лак маникюр', duration_min: 75 },
  { category: 'Ногти', name: 'Педикюр классический', duration_min: 60 },
  { category: 'Ногти', name: 'Педикюр аппаратный', duration_min: 75 },
  { category: 'Ногти', name: 'Гель-лак педикюр', duration_min: 90 },
  { category: 'Ногти', name: 'Наращивание ногтей (гель)', duration_min: 120 },
  { category: 'Ногти', name: 'Дизайн ногтей / нейл-арт', duration_min: 30 },
  { category: 'Ногти', name: 'Снятие гель-лака', duration_min: 20 },
  { category: 'Ногти', name: 'Укрепление ногтей', duration_min: 30 },

  // ── Брови и ресницы ──────────────────────────────────────────────────────
  { category: 'Брови и ресницы', name: 'Оформление бровей', duration_min: 30 },
  { category: 'Брови и ресницы', name: 'Окрашивание бровей', duration_min: 20 },
  { category: 'Брови и ресницы', name: 'Ламинирование бровей', duration_min: 45 },
  { category: 'Брови и ресницы', name: 'Микроблейдинг бровей', duration_min: 90 },
  { category: 'Брови и ресницы', name: 'Наращивание ресниц (классика)', duration_min: 90 },
  { category: 'Брови и ресницы', name: 'Наращивание ресниц (объём)', duration_min: 120 },
  { category: 'Брови и ресницы', name: 'Ламинирование ресниц', duration_min: 60 },
  { category: 'Брови и ресницы', name: 'Окрашивание ресниц', duration_min: 20 },

  // ── Лицо ─────────────────────────────────────────────────────────────────
  { category: 'Лицо', name: 'Чистка лица (механическая)', duration_min: 60 },
  { category: 'Лицо', name: 'Чистка лица (ультразвуковая)', duration_min: 45 },
  { category: 'Лицо', name: 'Пилинг лица', duration_min: 45 },
  { category: 'Лицо', name: 'Увлажняющая маска', duration_min: 30 },
  { category: 'Лицо', name: 'Перманентный макияж (брови)', duration_min: 120 },
  { category: 'Лицо', name: 'Перманентный макияж (губы)', duration_min: 120 },
  { category: 'Лицо', name: 'Перманентный макияж (стрелки)', duration_min: 90 },
  { category: 'Лицо', name: 'Дневной макияж', duration_min: 45 },
  { category: 'Лицо', name: 'Вечерний макияж', duration_min: 60 },
  { category: 'Лицо', name: 'Свадебный макияж', duration_min: 90 },
  { category: 'Лицо', name: 'Мезотерапия лица', duration_min: 60 },
  { category: 'Лицо', name: 'RF-лифтинг', duration_min: 45 },

  // ── Тело ─────────────────────────────────────────────────────────────────
  { category: 'Тело', name: 'Массаж классический', duration_min: 60 },
  { category: 'Тело', name: 'Массаж спины', duration_min: 30 },
  { category: 'Тело', name: 'Антицеллюлитный массаж', duration_min: 60 },
  { category: 'Тело', name: 'Лимфодренажный массаж', duration_min: 60 },
  { category: 'Тело', name: 'Spa-программа для тела', duration_min: 90 },
  { category: 'Тело', name: 'Обёртывание', duration_min: 60 },
  { category: 'Тело', name: 'Шугаринг (ноги полностью)', duration_min: 60 },
  { category: 'Тело', name: 'Шугаринг (зона бикини)', duration_min: 30 },
  { category: 'Тело', name: 'Шугаринг (руки)', duration_min: 30 },
  { category: 'Тело', name: 'Лазерная эпиляция', duration_min: 45 },
  { category: 'Тело', name: 'Татуировка (консультация)', duration_min: 30 },

  // ── Барбер ───────────────────────────────────────────────────────────────
  { category: 'Барбер', name: 'Стрижка машинкой', duration_min: 25 },
  { category: 'Барбер', name: 'Стрижка + борода', duration_min: 45 },
  { category: 'Барбер', name: 'Оформление бороды', duration_min: 20 },
  { category: 'Барбер', name: 'Бритьё опасной бритвой', duration_min: 30 },
  { category: 'Барбер', name: 'Камуфляж седины', duration_min: 30 },

  // ── Здоровье ─────────────────────────────────────────────────────────────
  { category: 'Здоровье', name: 'Консультация нутрициолога', duration_min: 60 },
  { category: 'Здоровье', name: 'Составление плана питания', duration_min: 45 },
  { category: 'Здоровье', name: 'Персональная тренировка', duration_min: 60 },
  { category: 'Здоровье', name: 'Йога (индивидуально)', duration_min: 60 },
  { category: 'Здоровье', name: 'Остеопатия', duration_min: 60 },
  { category: 'Здоровье', name: 'Рефлексотерапия', duration_min: 45 },

  // ── Уход за животными ────────────────────────────────────────────────────
  { category: 'Зоогруминг', name: 'Груминг кошки', duration_min: 60 },
  { category: 'Зоогруминг', name: 'Груминг собаки (малая)', duration_min: 60 },
  { category: 'Зоогруминг', name: 'Груминг собаки (крупная)', duration_min: 90 },
  { category: 'Зоогруминг', name: 'Стрижка когтей', duration_min: 15 },
  { category: 'Зоогруминг', name: 'Купание и сушка', duration_min: 45 },

  // ── Психология и коучинг ─────────────────────────────────────────────────
  { category: 'Психология', name: 'Психологическая консультация', duration_min: 60 },
  { category: 'Психология', name: 'Психотерапевтическая сессия', duration_min: 50 },
  { category: 'Психология', name: 'Коучинг-сессия', duration_min: 60 },
  { category: 'Психология', name: 'Семейная терапия', duration_min: 90 },
  { category: 'Психология', name: 'Детская психология', duration_min: 60 },
  { category: 'Психология', name: 'Арт-терапия', duration_min: 60 },
  { category: 'Психология', name: 'НЛП-сессия', duration_min: 60 },

  // ── Фитнес и спорт ───────────────────────────────────────────────────────
  { category: 'Фитнес', name: 'Персональная тренировка (тренажёрный зал)', duration_min: 60 },
  { category: 'Фитнес', name: 'Функциональная тренировка', duration_min: 60 },
  { category: 'Фитнес', name: 'Стретчинг / гибкость', duration_min: 45 },
  { category: 'Фитнес', name: 'Пилатес (индивидуально)', duration_min: 55 },
  { category: 'Фитнес', name: 'Йога (индивидуально)', duration_min: 60 },
  { category: 'Фитнес', name: 'Онлайн-тренировка', duration_min: 45 },
  { category: 'Фитнес', name: 'Программа тренировок (составление)', duration_min: 60 },
  { category: 'Фитнес', name: 'Танцы (индивидуальный урок)', duration_min: 60 },

  // ── Обучение / Репетиторство ─────────────────────────────────────────────
  { category: 'Обучение', name: 'Урок английского языка', duration_min: 60 },
  { category: 'Обучение', name: 'Урок русского языка', duration_min: 60 },
  { category: 'Обучение', name: 'Урок математики', duration_min: 60 },
  { category: 'Обучение', name: 'Подготовка к экзамену', duration_min: 90 },
  { category: 'Обучение', name: 'Урок музыки / игра на гитаре', duration_min: 45 },
  { category: 'Обучение', name: 'Урок рисования', duration_min: 60 },
  { category: 'Обучение', name: 'Онлайн-урок', duration_min: 60 },

  // ── Фотография и видео ───────────────────────────────────────────────────
  { category: 'Фото / Видео', name: 'Портретная фотосессия', duration_min: 60 },
  { category: 'Фото / Видео', name: 'Семейная фотосессия', duration_min: 90 },
  { category: 'Фото / Видео', name: 'Детская фотосессия', duration_min: 60 },
  { category: 'Фото / Видео', name: 'Love story / Pre-wedding', duration_min: 120 },
  { category: 'Фото / Видео', name: 'Видеосъёмка события', duration_min: 240 },
  { category: 'Фото / Видео', name: 'Обработка фотографий (ретушь)', duration_min: 60 },
  { category: 'Фото / Видео', name: 'Фото для документов', duration_min: 15 },

  // ── Инъекционная косметология ────────────────────────────────────────────
  { category: 'Эстетическая медицина', name: 'Ботулинотерапия (ботокс)', duration_min: 30 },
  { category: 'Эстетическая медицина', name: 'Контурная пластика (филлеры)', duration_min: 45 },
  { category: 'Эстетическая медицина', name: 'Биоревитализация', duration_min: 45 },
  { category: 'Эстетическая медицина', name: 'Мезотерапия тела', duration_min: 60 },
  { category: 'Эстетическая медицина', name: 'PRP-терапия (плазмолифтинг)', duration_min: 60 },
  { category: 'Эстетическая медицина', name: 'Нитевой лифтинг', duration_min: 90 },

  // ── Детские услуги ───────────────────────────────────────────────────────
  { category: 'Детские услуги', name: 'Детский праздник (аниматор)', duration_min: 120 },
  { category: 'Детские услуги', name: 'Детский массаж', duration_min: 30 },
  { category: 'Детские услуги', name: 'Детская стрижка', duration_min: 20 },
  { category: 'Детские услуги', name: 'Логопед (занятие)', duration_min: 45 },
  { category: 'Детские услуги', name: 'Нянечка (почасово)', duration_min: 60 },

  // ── Услуги на дому ───────────────────────────────────────────────────────
  { category: 'Выезд на дом', name: 'Маникюр на дому', duration_min: 90 },
  { category: 'Выезд на дом', name: 'Стрижка на дому', duration_min: 60 },
  { category: 'Выезд на дом', name: 'Массаж на дому', duration_min: 90 },
  { category: 'Выезд на дом', name: 'Макияж на дому', duration_min: 90 },
  { category: 'Выезд на дом', name: 'Стрижка животного на дому', duration_min: 90 },
]

export const SERVICES_SEED_JSON_EXAMPLE =
  '[{"category":"Волосы","name":"Стрижка","duration_min":30,"price":500}]'
export const SERVICES_SEED_CSV_EXAMPLE = 'Волосы,Стрижка,30,500'
