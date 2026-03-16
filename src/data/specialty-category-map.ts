/**
 * Маппинг вида деятельности (activityTypeName) к категориям услуг и товаров.
 * Используется при онбординге для автоматического импорта релевантных позиций.
 *
 * Категории соответствуют именам в таблицах global_services / global_products на VPS.
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
  // ── Красота и внешность ───────────────────────────────────────────────────
  {
    keywords: ['парикмахер', 'стрижк', 'барбер', 'волос', 'колорист', 'hair'],
    serviceCategories: ['Волосы'],
    productCategories: ['Волосы', 'Барберинг', 'Расходники'],
  },
  {
    keywords: ['маникюр', 'педикюр', 'ноготь', 'ногт', 'nail'],
    serviceCategories: ['Ногти'],
    productCategories: ['Ногти', 'Расходники'],
  },
  {
    keywords: ['бровист', 'лешмейк', 'ресниц', 'brow', 'lash'],
    serviceCategories: ['Брови и ресницы', 'Перманентный макияж'],
    productCategories: ['Брови и ресницы', 'Расходники'],
  },
  {
    keywords: ['визажист', 'макияж', 'makeup', 'make-up'],
    serviceCategories: ['Макияж', 'Перманентный макияж'],
    productCategories: ['Макияж', 'Расходники'],
  },
  {
    keywords: ['косметолог', 'эстетист', 'уход за лиц', 'косметик'],
    serviceCategories: ['Косметология', 'Эстетическая медицина'],
    productCategories: ['Косметология', 'Расходники'],
  },
  {
    keywords: ['массаж', 'massage'],
    serviceCategories: ['Массаж'],
    productCategories: ['Массаж', 'Спа и тело', 'Расходники'],
  },
  {
    keywords: ['депил', 'шугар', 'воск', 'эпиляц', 'wax'],
    serviceCategories: ['Эпиляция и депиляция'],
    productCategories: ['Эпиляция', 'Расходники'],
  },
  {
    keywords: ['татуир', 'tattoo', 'tatt'],
    serviceCategories: ['Тату и пирсинг'],
    productCategories: ['Тату', 'Расходники'],
  },
  {
    keywords: ['татуаж', 'перманент', 'pmu'],
    serviceCategories: ['Перманентный макияж'],
    productCategories: ['Татуаж и перманент', 'Расходники'],
  },
  {
    keywords: ['груминг', 'зоо', 'pet', 'groo'],
    serviceCategories: ['Уход за животными'],
    productCategories: ['Ветеринария', 'Расходники'],
  },
  {
    keywords: ['ботокс', 'филлер', 'биоревит', 'мезотерап', 'инъекц', 'плазмолифт', 'нитев'],
    serviceCategories: ['Эстетическая медицина', 'Косметология'],
    productCategories: ['Косметология', 'Медицина и здоровье', 'Расходники'],
  },

  // ── Здоровье и фитнес ─────────────────────────────────────────────────────
  {
    keywords: ['нутрицио', 'диетолог'],
    serviceCategories: ['Медицинские услуги', 'Фитнес'],
    productCategories: [],
  },
  {
    keywords: ['тренер', 'фитнес', 'fitness'],
    serviceCategories: ['Фитнес', 'Фитнес и тренировки'],
    productCategories: [],
  },
  {
    keywords: ['пилатес', 'стретчинг', 'йог'],
    serviceCategories: ['Йога и пилатес', 'Фитнес и тренировки'],
    productCategories: [],
  },
  {
    keywords: ['танц'],
    serviceCategories: ['Танцы'],
    productCategories: [],
  },
  {
    keywords: ['остеопат', 'рефлексо', 'мануальн'],
    serviceCategories: ['Остеопатия и мануальная терапия', 'Медицинские услуги'],
    productCategories: ['Медицина и здоровье', 'Расходники'],
  },

  // ── Психология и коучинг ──────────────────────────────────────────────────
  {
    keywords: ['психолог', 'психотерап', 'арт-терап', 'therapist'],
    serviceCategories: ['Психология', 'Психология и психотерапия'],
    productCategories: [],
  },
  {
    keywords: ['нлп', 'коуч', 'coach'],
    serviceCategories: ['Коучинг', 'Психология'],
    productCategories: [],
  },

  // ── Образование и репетиторство ───────────────────────────────────────────
  {
    keywords: ['репетитор', 'учитель', 'преподават', 'тьютор', 'обучени', 'педагог', 'tutor', 'teacher'],
    serviceCategories: ['Обучение', 'Репетиторство'],
    productCategories: [],
  },

  // ── Фото и видео ──────────────────────────────────────────────────────────
  {
    keywords: ['фотограф', 'видеограф', 'фотосессия', 'ретушь', 'photo', 'video'],
    serviceCategories: ['Фото / Видео', 'Фотосъёмка', 'Видеосъёмка и монтаж'],
    productCategories: [],
  },

  // ── Детские услуги ────────────────────────────────────────────────────────
  {
    keywords: ['аниматор'],
    serviceCategories: ['Детские услуги'],
    productCategories: ['Детские услуги'],
  },
  {
    keywords: ['логопед'],
    serviceCategories: ['Логопедия и дефектология', 'Детские услуги'],
    productCategories: [],
  },
  {
    keywords: ['няня', 'нянечк'],
    serviceCategories: ['Детские услуги'],
    productCategories: ['Детские услуги'],
  },
]

/** Дефолтные категории если специальность не распознана */
export const DEFAULT_SERVICE_CATEGORIES: string[] = []
export const DEFAULT_PRODUCT_CATEGORIES: string[] = []

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
