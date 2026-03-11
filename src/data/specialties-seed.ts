/** Данные для начального наполнения справочника специальностей */
export interface SeedSpecialty {
  activity_type_name: string
  name: string
}

export const SPECIALTIES_SEED: SeedSpecialty[] = [
  // ── Красота и уход ────────────────────────────────────────────────────
  { activity_type_name: 'Красота и уход', name: 'Парикмахер' },
  { activity_type_name: 'Красота и уход', name: 'Барбер' },
  { activity_type_name: 'Красота и уход', name: 'Стилист-колорист' },
  { activity_type_name: 'Красота и уход', name: 'Мастер наращивания волос' },
  { activity_type_name: 'Красота и уход', name: 'Мастер маникюра' },
  { activity_type_name: 'Красота и уход', name: 'Мастер педикюра' },
  { activity_type_name: 'Красота и уход', name: 'Мастер гель-лака' },
  { activity_type_name: 'Красота и уход', name: 'Нейл-арт мастер' },
  { activity_type_name: 'Красота и уход', name: 'Бровист' },
  { activity_type_name: 'Красота и уход', name: 'Лэшмейкер' },
  { activity_type_name: 'Красота и уход', name: 'Мастер эпиляции / шугаринга' },
  { activity_type_name: 'Красота и уход', name: 'Косметолог' },
  { activity_type_name: 'Красота и уход', name: 'Визажист / Макияж' },
  { activity_type_name: 'Красота и уход', name: 'Свадебный стилист' },
  { activity_type_name: 'Красота и уход', name: 'Перманентный макияж (ПМ)' },
  { activity_type_name: 'Красота и уход', name: 'Тату-мастер' },
  { activity_type_name: 'Красота и уход', name: 'Пирсер' },
  { activity_type_name: 'Красота и уход', name: 'Солярий / загар' },
  { activity_type_name: 'Красота и уход', name: 'Мастер по уходу за бородой' },

  // ── Здоровье и тело ───────────────────────────────────────────────────
  { activity_type_name: 'Здоровье и тело', name: 'Массажист' },
  { activity_type_name: 'Здоровье и тело', name: 'Массажист (спортивный)' },
  { activity_type_name: 'Здоровье и тело', name: 'Массажист (лечебный)' },
  { activity_type_name: 'Здоровье и тело', name: 'Массажист (детский)' },
  { activity_type_name: 'Здоровье и тело', name: 'Рефлексотерапевт' },
  { activity_type_name: 'Здоровье и тело', name: 'Остеопат' },
  { activity_type_name: 'Здоровье и тело', name: 'Кинезиолог' },
  { activity_type_name: 'Здоровье и тело', name: 'Диетолог-нутрициолог' },
  { activity_type_name: 'Здоровье и тело', name: 'Нутрициолог' },
  { activity_type_name: 'Здоровье и тело', name: 'Мануальный терапевт' },

  // ── Фитнес и спорт ────────────────────────────────────────────────────
  { activity_type_name: 'Фитнес и спорт', name: 'Персональный тренер (фитнес)' },
  { activity_type_name: 'Фитнес и спорт', name: 'Инструктор по йоге' },
  { activity_type_name: 'Фитнес и спорт', name: 'Инструктор пилатеса' },
  { activity_type_name: 'Фитнес и спорт', name: 'Тренер по плаванию' },
  { activity_type_name: 'Фитнес и спорт', name: 'Тренер по боксу' },
  { activity_type_name: 'Фитнес и спорт', name: 'Тренер по единоборствам' },
  { activity_type_name: 'Фитнес и спорт', name: 'Тренер по танцам' },
  { activity_type_name: 'Фитнес и спорт', name: 'Тренер по растяжке (стретчинг)' },
  { activity_type_name: 'Фитнес и спорт', name: 'Инструктор по аэробике / зумбе' },
  { activity_type_name: 'Фитнес и спорт', name: 'Тренер по бегу' },
  { activity_type_name: 'Фитнес и спорт', name: 'Онлайн-тренер' },

  // ── Психология и коучинг ──────────────────────────────────────────────
  { activity_type_name: 'Психология и коучинг', name: 'Психолог' },
  { activity_type_name: 'Психология и коучинг', name: 'Психотерапевт' },
  { activity_type_name: 'Психология и коучинг', name: 'Коуч (личностный)' },
  { activity_type_name: 'Психология и коучинг', name: 'Карьерный коуч' },
  { activity_type_name: 'Психология и коучинг', name: 'Бизнес-коуч' },
  { activity_type_name: 'Психология и коучинг', name: 'Семейный психолог' },
  { activity_type_name: 'Психология и коучинг', name: 'Детский психолог' },
  { activity_type_name: 'Психология и коучинг', name: 'Арт-терапевт' },

  // ── Репетиторство и обучение ──────────────────────────────────────────
  { activity_type_name: 'Репетиторство и обучение', name: 'Репетитор (математика)' },
  { activity_type_name: 'Репетиторство и обучение', name: 'Репетитор (русский язык)' },
  { activity_type_name: 'Репетиторство и обучение', name: 'Репетитор (английский)' },
  { activity_type_name: 'Репетиторство и обучение', name: 'Репетитор (китайский)' },
  { activity_type_name: 'Репетиторство и обучение', name: 'Репетитор по физике' },
  { activity_type_name: 'Репетиторство и обучение', name: 'Репетитор по химии' },
  { activity_type_name: 'Репетиторство и обучение', name: 'Репетитор (подготовка к ЕГЭ/ОГЭ)' },
  { activity_type_name: 'Репетиторство и обучение', name: 'Логопед' },
  { activity_type_name: 'Репетиторство и обучение', name: 'Дефектолог' },
  { activity_type_name: 'Репетиторство и обучение', name: 'Учитель музыки' },
  { activity_type_name: 'Репетиторство и обучение', name: 'Инструктор по вокалу' },
  { activity_type_name: 'Репетиторство и обучение', name: 'Преподаватель рисования' },

  // ── IT и digital ──────────────────────────────────────────────────────
  { activity_type_name: 'IT и digital', name: 'Веб-разработчик (фриланс)' },
  { activity_type_name: 'IT и digital', name: 'Мобильный разработчик' },
  { activity_type_name: 'IT и digital', name: 'UI/UX дизайнер' },
  { activity_type_name: 'IT и digital', name: 'Графический дизайнер' },
  { activity_type_name: 'IT и digital', name: 'Моушн-дизайнер' },
  { activity_type_name: 'IT и digital', name: 'SEO-специалист' },
  { activity_type_name: 'IT и digital', name: 'Таргетолог' },
  { activity_type_name: 'IT и digital', name: 'SMM-специалист' },
  { activity_type_name: 'IT и digital', name: 'Контент-маркетолог' },
  { activity_type_name: 'IT и digital', name: 'Копирайтер' },
  { activity_type_name: 'IT и digital', name: 'Видеограф / монтажёр' },
  { activity_type_name: 'IT и digital', name: 'Фотограф' },
  { activity_type_name: 'IT и digital', name: 'Продуктовый аналитик' },

  // ── Творчество и ремёсла ──────────────────────────────────────────────
  { activity_type_name: 'Творчество и ремёсла', name: 'Флорист' },
  { activity_type_name: 'Творчество и ремёсла', name: 'Декоратор интерьера' },
  { activity_type_name: 'Творчество и ремёсла', name: 'Ювелир' },
  { activity_type_name: 'Творчество и ремёсла', name: 'Кожевник' },
  { activity_type_name: 'Творчество и ремёсла', name: 'Гончар (керамика)' },
  { activity_type_name: 'Творчество и ремёсла', name: 'Скрапбукинг / hand-made' },
  { activity_type_name: 'Творчество и ремёсла', name: 'Вышивальщица' },
  { activity_type_name: 'Творчество и ремёсла', name: 'Портной / Швея' },
  { activity_type_name: 'Творчество и ремёсла', name: 'Вязальщица' },
  { activity_type_name: 'Творчество и ремёсла', name: 'Мастер по свечам / мылу' },
  { activity_type_name: 'Творчество и ремёсла', name: 'Кондитер (домашний)' },
  { activity_type_name: 'Творчество и ремёсла', name: 'Мастер тортов / десертов' },
  { activity_type_name: 'Творчество и ремёсла', name: 'Каллиграф' },

  // ── Услуги на дому ────────────────────────────────────────────────────
  { activity_type_name: 'Услуги на дому', name: 'Клинер / Уборщик' },
  { activity_type_name: 'Услуги на дому', name: 'Химчистка мебели' },
  { activity_type_name: 'Услуги на дому', name: 'Сантехник' },
  { activity_type_name: 'Услуги на дому', name: 'Электрик' },
  { activity_type_name: 'Услуги на дому', name: 'Мастер по ремонту техники' },
  { activity_type_name: 'Услуги на дому', name: 'Мастер по ремонту телефонов' },
  { activity_type_name: 'Услуги на дому', name: 'Грузчик / Переезд' },
  { activity_type_name: 'Услуги на дому', name: 'Сборщик мебели' },

  // ── Уход за животными ─────────────────────────────────────────────────
  { activity_type_name: 'Уход за животными', name: 'Зоогрумер' },
  { activity_type_name: 'Уход за животными', name: 'Кинолог / Дрессировщик' },
  { activity_type_name: 'Уход за животными', name: 'Ветеринарный фельдшер (выезд)' },
  { activity_type_name: 'Уход за животными', name: 'Передержка животных' },
  { activity_type_name: 'Уход за животными', name: 'Выгульщик собак' },

  // ── Финансы и право ───────────────────────────────────────────────────
  { activity_type_name: 'Финансы и право', name: 'Бухгалтер (фриланс)' },
  { activity_type_name: 'Финансы и право', name: 'Налоговый консультант' },
  { activity_type_name: 'Финансы и право', name: 'Финансовый советник' },
  { activity_type_name: 'Финансы и право', name: 'Юрист (консультации)' },

  // ── Другое ────────────────────────────────────────────────────────────
  { activity_type_name: 'Другое', name: 'Переводчик' },
  { activity_type_name: 'Другое', name: 'Организатор мероприятий' },
  { activity_type_name: 'Другое', name: 'Свадебный координатор' },
  { activity_type_name: 'Другое', name: 'Ведущий мероприятий' },
  { activity_type_name: 'Другое', name: 'DJ' },
  { activity_type_name: 'Другое', name: 'Фотограф (свадебный)' },
  { activity_type_name: 'Другое', name: 'Аниматор / Клоун' },
]

export const SEED_JSON_EXAMPLE = `[
  { "activity_type_name": "Красота и уход", "name": "Парикмахер" },
  { "activity_type_name": "Фитнес и спорт", "name": "Инструктор по йоге" }
]`

export const SEED_CSV_EXAMPLE = `Красота и уход,Парикмахер
Фитнес и спорт,Инструктор по йоге`
