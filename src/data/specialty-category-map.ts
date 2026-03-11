/**
 * Маппинг вида деятельности (activityTypeName) к категориям услуг и товаров.
 * Используется при онбординге для автоматического импорта релевантных позиций.
 */

export interface SpecialtyCategoryMap {
  /** Ключевые слова (нижний регистр) в названии вида деятельности */
  keywords: string[]
  /** Категории услуг из глобального справочника для импорта */
  serviceCategories: string[]
  /** Категории товаров из глобального справочника для импорта */
  productCategories: string[]
}

export const SPECIALTY_CATEGORY_MAP: SpecialtyCategoryMap[] = [
  {
    keywords: ['парикмахер', 'стрижк', 'барбер', 'волос', 'колорист', 'hair'],
    serviceCategories: ['Волосы', 'Барбер'],
    productCategories: ['Уход за волосами', 'Краски и химия', 'Расходники', 'Инструменты'],
  },
  {
    keywords: ['маникюр', 'педикюр', 'ноготь', 'ногт', 'nail'],
    serviceCategories: ['Ногти'],
    productCategories: ['Ногтевой сервис', 'Косметика', 'Расходники', 'Инструменты'],
  },
  {
    keywords: ['бровист', 'лешмейк', 'ресниц', 'brow', 'lash'],
    serviceCategories: ['Брови и ресницы'],
    productCategories: ['Краски и химия', 'Косметика', 'Расходники', 'Инструменты'],
  },
  {
    keywords: ['визажист', 'макияж', 'makeup', 'make-up'],
    serviceCategories: ['Лицо'],
    productCategories: ['Косметика', 'Расходники'],
  },
  {
    keywords: ['косметолог', 'эстетист', 'уход за лиц', 'косметик'],
    serviceCategories: ['Лицо', 'Тело'],
    productCategories: ['Косметика', 'Расходники'],
  },
  {
    keywords: ['массаж', 'massage'],
    serviceCategories: ['Тело', 'Здоровье'],
    productCategories: ['Массаж и тело', 'Расходники'],
  },
  {
    keywords: ['депил', 'шугар', 'воск', 'эпиляц', 'wax'],
    serviceCategories: ['Тело'],
    productCategories: ['Депиляция', 'Расходники'],
  },
  {
    keywords: ['татуир', 'татуаж', 'перманент', 'pmu', 'tattoo'],
    serviceCategories: ['Лицо', 'Тело'],
    productCategories: ['Расходники'],
  },
  {
    keywords: ['груминг', 'зоо', 'pet', 'groo'],
    serviceCategories: ['Зоогруминг'],
    productCategories: ['Расходники'],
  },
  {
    keywords: ['нутрицио', 'диетолог', 'тренер', 'фитнес', 'йог', 'fitness'],
    serviceCategories: ['Здоровье'],
    productCategories: ['Расходники'],
  },
]

/** Дефолтные категории если специальность не распознана */
export const DEFAULT_SERVICE_CATEGORIES: string[] = []
export const DEFAULT_PRODUCT_CATEGORIES: string[] = ['Расходники']

/**
 * Получить категории услуг и товаров для автоимпорта по названию активности/специальности
 */
export function getCategoriesForSpecialty(
  activityTypeName: string,
  specialtyName: string,
): { serviceCategories: string[]; productCategories: string[] } {
  const searchStr = `${activityTypeName} ${specialtyName}`.toLowerCase()

  const serviceCats = new Set<string>()
  const productCats = new Set<string>()

  for (const mapping of SPECIALTY_CATEGORY_MAP) {
    if (mapping.keywords.some((kw) => searchStr.includes(kw))) {
      mapping.serviceCategories.forEach((c) => serviceCats.add(c))
      mapping.productCategories.forEach((c) => productCats.add(c))
    }
  }

  // Если ничего не найдено — дефолт
  if (serviceCats.size === 0) DEFAULT_SERVICE_CATEGORIES.forEach((c) => serviceCats.add(c))
  if (productCats.size === 0) DEFAULT_PRODUCT_CATEGORIES.forEach((c) => productCats.add(c))

  return {
    serviceCategories: Array.from(serviceCats),
    productCategories: Array.from(productCats),
  }
}
