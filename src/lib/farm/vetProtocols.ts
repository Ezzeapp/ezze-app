/**
 * Ветеринарные протоколы — рекомендуемый график вакцинаций и обработок
 * по виду и возрасту животного (в днях от рождения).
 * Упрощённая таблица для MVP — не медицинская рекомендация, только шаблон.
 */
import type { AnimalSpecies } from '@/types/farm'

export interface VetProtocolItem {
  day: number           // возраст в днях
  name: string          // название вакцины/обработки
  type: 'vaccination' | 'treatment' | 'exam'
  repeat_days?: number  // если повторяется — интервал
}

export const VET_PROTOCOLS: Record<AnimalSpecies, VetProtocolItem[]> = {
  cattle: [
    { day: 30,  name: 'Сибирская язва', type: 'vaccination', repeat_days: 365 },
    { day: 45,  name: 'Ящур',           type: 'vaccination', repeat_days: 180 },
    { day: 60,  name: 'Эмкар',          type: 'vaccination', repeat_days: 365 },
    { day: 90,  name: 'Лептоспироз',    type: 'vaccination', repeat_days: 365 },
    { day: 120, name: 'Дегельминтизация', type: 'treatment', repeat_days: 180 },
    { day: 180, name: 'Общий осмотр',   type: 'exam',        repeat_days: 180 },
  ],
  poultry: [
    { day: 1,   name: 'Болезнь Марека', type: 'vaccination' },
    { day: 7,   name: 'Ньюкасл',        type: 'vaccination', repeat_days: 90 },
    { day: 14,  name: 'Гамборо',        type: 'vaccination' },
    { day: 21,  name: 'Инфекционный бронхит', type: 'vaccination' },
    { day: 35,  name: 'Ньюкасл (ревакцинация)', type: 'vaccination' },
  ],
  sheep: [
    { day: 30,  name: 'Сибирская язва', type: 'vaccination', repeat_days: 365 },
    { day: 45,  name: 'Брадзот',        type: 'vaccination', repeat_days: 365 },
    { day: 60,  name: 'Дегельминтизация', type: 'treatment', repeat_days: 120 },
    { day: 120, name: 'Обработка от клещей', type: 'treatment', repeat_days: 30 },
  ],
  goat: [
    { day: 30,  name: 'Сибирская язва', type: 'vaccination', repeat_days: 365 },
    { day: 60,  name: 'Дегельминтизация', type: 'treatment', repeat_days: 120 },
    { day: 90,  name: 'Бруцеллёз (осмотр)', type: 'exam', repeat_days: 180 },
  ],
  pig: [
    { day: 7,   name: 'Железосодержащий препарат', type: 'treatment' },
    { day: 30,  name: 'Классическая чума свиней', type: 'vaccination', repeat_days: 365 },
    { day: 45,  name: 'Рожа',           type: 'vaccination', repeat_days: 180 },
    { day: 60,  name: 'Дегельминтизация', type: 'treatment', repeat_days: 120 },
  ],
  rabbit: [
    { day: 45,  name: 'Миксоматоз',     type: 'vaccination', repeat_days: 180 },
    { day: 60,  name: 'ВГБК',           type: 'vaccination', repeat_days: 365 },
    { day: 90,  name: 'Дегельминтизация', type: 'treatment', repeat_days: 90 },
  ],
  bee: [
    { day: 30,  name: 'Осмотр семьи',   type: 'exam', repeat_days: 14 },
    { day: 60,  name: 'Обработка от варроатоза', type: 'treatment', repeat_days: 60 },
  ],
  fish: [
    { day: 30,  name: 'Профилактика ихтиофтириоза', type: 'treatment', repeat_days: 60 },
  ],
  horse: [
    { day: 60,  name: 'Столбняк',       type: 'vaccination', repeat_days: 365 },
    { day: 90,  name: 'Грипп лошадей',  type: 'vaccination', repeat_days: 180 },
    { day: 120, name: 'Дегельминтизация', type: 'treatment', repeat_days: 90 },
  ],
  other: [],
}

export interface VetTask {
  animal_id: string
  animal_tag: string
  animal_name: string | null
  species: AnimalSpecies
  protocol: VetProtocolItem
  due_date: string     // YYYY-MM-DD
  overdue_days: number // >0 = просрочено, <0 = ещё впереди, 0 = сегодня
  last_done_date?: string | null
}
