/**
 * products.ts — единый список продуктов экосистемы Ezze.
 * Используется в UI (ProductSelectionStep) и в боте (PRODUCT_MAP).
 */

export interface ProductInfo {
  key: string
  emoji: string
  name: string
  desc: string
  url: string
}

export const PRODUCT_LIST: ProductInfo[] = [
  { key: 'beauty',    emoji: '💄', name: 'Красота',        desc: 'Салоны, парикмахеры, косметологи',   url: 'https://beauty.ezze.site' },
  { key: 'clinic',    emoji: '🏥', name: 'Медицина',       desc: 'Клиники, врачи, стоматология',        url: 'https://clinic.ezze.site' },
  { key: 'workshop',  emoji: '🔧', name: 'Мастерская',     desc: 'Ремонт, сервис, умельцы',             url: 'https://workshop.ezze.site' },
  { key: 'edu',       emoji: '📚', name: 'Образование',    desc: 'Репетиторы, курсы, тренинги',         url: 'https://edu.ezze.site' },
  { key: 'hotel',     emoji: '🏨', name: 'Размещение',     desc: 'Отели, хостелы, апартаменты',         url: 'https://hotel.ezze.site' },
  { key: 'food',      emoji: '🍕', name: 'Еда',            desc: 'Рестораны, доставка, кейтеринг',      url: 'https://food.ezze.site' },
  { key: 'event',     emoji: '🎉', name: 'Мероприятия',    desc: 'Ивенты, фотографы, аниматоры',        url: 'https://event.ezze.site' },
  { key: 'farm',      emoji: '🌾', name: 'Агро',           desc: 'Фермеры, поставщики, агрономы',       url: 'https://farm.ezze.site' },
  { key: 'transport', emoji: '🚗', name: 'Транспорт',      desc: 'Такси, логистика, перевозки',         url: 'https://transport.ezze.site' },
  { key: 'build',     emoji: '🏗️', name: 'Строительство',  desc: 'Стройка, проектирование, ремонт',     url: 'https://build.ezze.site' },
  { key: 'trade',     emoji: '🛒', name: 'Торговля',       desc: 'Магазины, интернет-торговля',         url: 'https://trade.ezze.site' },
  { key: 'cleaning',  emoji: '👕', name: 'Химчистка',      desc: 'Химчистки, прачечные, чистка ковров', url: 'https://cleaning.ezze.site' },
  { key: 'rental',    emoji: '🚙', name: 'Аренда',         desc: 'Прокат транспорта, инструмента, оборудования', url: 'https://rental.ezze.site' },
]

/** key → URL: 'clinic' → 'https://clinic.ezze.site' */
export const PRODUCT_URL_MAP: Record<string, string> =
  Object.fromEntries(PRODUCT_LIST.map(p => [p.key, p.url]))
