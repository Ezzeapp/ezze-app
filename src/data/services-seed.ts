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
]

export const SERVICES_SEED_JSON_EXAMPLE =
  '[{"category":"Волосы","name":"Стрижка","duration_min":30,"price":500}]'
export const SERVICES_SEED_CSV_EXAMPLE = 'Волосы,Стрижка,30,500'
