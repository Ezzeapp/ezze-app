/**
 * farm.ts — типы продукта "Farm" (фермерское хозяйство).
 * Единый контракт для хуков, страниц, компонентов и БД (миграция 036_farm_core.sql).
 */

// ── Перечисления ─────────────────────────────────────────────────
export type AnimalSpecies =
  | 'cattle'    // КРС
  | 'poultry'   // птица (куры/утки/гуси/индейки)
  | 'sheep'     // МРС: овцы
  | 'goat'      // МРС: козы
  | 'pig'       // свиньи
  | 'rabbit'    // кролики
  | 'bee'       // пчёлы
  | 'fish'      // рыба
  | 'horse'     // лошади
  | 'other'

export type AnimalSex = 'male' | 'female' | 'unknown'

export type AnimalStatus =
  | 'growing'   // растёт
  | 'dairy'     // дойное
  | 'meat'      // мясное (на откорме)
  | 'breeding'  // племенное
  | 'sold'      // продано
  | 'slaughtered' // забито
  | 'dead'      // пало

export type AnimalPurpose = 'dairy' | 'meat' | 'eggs' | 'wool' | 'breeding' | 'mixed'

export type AnimalEventType =
  | 'weighing'      // взвешивание
  | 'vaccination'   // вакцинация
  | 'treatment'     // лечение
  | 'exam'          // осмотр ветеринара
  | 'mating'        // случка
  | 'pregnancy'     // подтверждение беременности
  | 'birth'         // роды (отёл/опорос/окрол)
  | 'transfer'      // перевод в группу
  | 'note'          // произвольная заметка

export type FieldStatus = 'idle' | 'sown' | 'growing' | 'harvested'

export type CropUse = 'feed' | 'sale' | 'mixed'

export type FeedUnit = 'kg' | 't' | 'l' | 'bale' // кг, тонна, литр, тюк

export type ProductionType =
  | 'milk'     // молоко (литры)
  | 'eggs'     // яйца (шт)
  | 'meat'     // мясо после забоя (кг)
  | 'wool'     // шерсть (кг)
  | 'honey'    // мёд (кг)
  | 'offspring' // потомство (голов)

export type FarmExpenseCategory =
  | 'feed'        // корма
  | 'veterinary'  // ветеринария
  | 'salary'      // зарплата
  | 'utilities'   // коммунальные (свет/вода/газ)
  | 'fuel'        // ГСМ
  | 'rent'        // аренда земли/помещений
  | 'repair'      // ремонт
  | 'equipment'   // покупка техники/инвентаря
  | 'seeds'       // семена
  | 'fertilizer'  // удобрения
  | 'transport'   // транспорт
  | 'other'

// ── Сущности ─────────────────────────────────────────────────────

export interface Farm {
  id: string
  user_id: string
  name: string
  location: string | null
  area_ha: number | null          // общая площадь в гектарах
  currency: string                // 'UZS' по умолчанию
  created_at: string
  updated_at: string
}

export interface AnimalGroup {
  id: string
  farm_id: string
  master_id: string
  name: string                    // "Дойное стадо №1", "Бройлеры март-26"
  species: AnimalSpecies
  purpose: AnimalPurpose | null
  location: string | null         // коровник №2 / загон А
  notes: string | null
  created_at: string
}

export interface Animal {
  id: string
  farm_id: string
  master_id: string
  group_id: string | null
  tag: string                     // бирка / идентификатор
  name: string | null             // клички (опционально)
  species: AnimalSpecies
  breed: string | null            // порода
  sex: AnimalSex
  status: AnimalStatus
  purpose: AnimalPurpose | null
  birth_date: string | null       // YYYY-MM-DD
  acquisition_date: string | null // дата поступления на ферму
  acquisition_cost: number | null // цена покупки (UZS)
  mother_id: string | null        // FK → animals
  father_id: string | null        // FK → animals
  current_weight_kg: number | null
  species_attrs: Record<string, any>  // специфика: среднесут.удой, яйценоскость, настриг и т.п.
  photo_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AnimalEvent {
  id: string
  farm_id: string
  master_id: string
  animal_id: string | null        // null если событие групповое
  group_id: string | null
  event_type: AnimalEventType
  event_date: string              // ISO datetime
  weight_kg: number | null        // для weighing
  data: Record<string, any>       // специфика события: vaccine_name / medicine / diagnosis / partner_id / offspring_count
  cost: number | null             // прямая стоимость события (лекарство, услуга ветеринара)
  notes: string | null
  created_at: string
}

export interface Field {
  id: string
  farm_id: string
  master_id: string
  name: string                    // "Поле №1 Южное"
  area_ha: number
  soil_type: string | null
  status: FieldStatus
  current_crop: string | null     // текущая культура
  notes: string | null
  created_at: string
}

export interface Crop {
  id: string
  farm_id: string
  master_id: string
  field_id: string
  name: string                    // кукуруза / люцерна / ячмень
  use: CropUse
  sown_date: string | null
  expected_harvest_date: string | null
  harvested_date: string | null
  yield_kg: number | null         // итоговый урожай
  total_cost: number              // сумма всех расходов на этот посев (seeds+fert+fuel+labor)
  notes: string | null
  created_at: string
}

export interface FeedStockItem {
  id: string
  farm_id: string
  master_id: string
  name: string                    // "Комбикорм ПК-1", "Сено люцерновое"
  unit: FeedUnit
  quantity: number                // текущий остаток
  cost_per_unit: number           // себестоимость единицы
  source: 'own' | 'purchased'     // своё (с поля) или закуплено
  crop_id: string | null          // если получено с урожая
  low_stock_threshold: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface FeedConsumption {
  id: string
  farm_id: string
  master_id: string
  feed_id: string
  group_id: string | null
  animal_id: string | null
  date: string                    // YYYY-MM-DD
  quantity: number                // сколько использовано (в unit корма)
  notes: string | null
  created_at: string
}

export interface ProductionRecord {
  id: string
  farm_id: string
  master_id: string
  type: ProductionType
  animal_id: string | null        // для дойки — конкретная корова
  group_id: string | null         // для яиц — стадо птицы
  date: string                    // YYYY-MM-DD
  quantity: number                // л / шт / кг
  quality: string | null          // жирность молока, категория яиц
  notes: string | null
  created_at: string
}

export interface FarmExpense {
  id: string
  farm_id: string
  master_id: string
  category: FarmExpenseCategory
  amount: number
  date: string                    // YYYY-MM-DD
  description: string | null
  // Аллокация: если расход относится к одному животному/группе/полю — указываем
  animal_id: string | null
  group_id: string | null
  field_id: string | null
  equipment_id: string | null
  created_at: string
}

export interface FarmEquipment {
  id: string
  farm_id: string
  master_id: string
  name: string                    // "Трактор МТЗ-82"
  category: string | null         // трактор / комбайн / доильный аппарат / инкубатор
  purchase_date: string | null
  purchase_cost: number | null
  useful_life_months: number | null // для амортизации
  status: 'active' | 'repair' | 'decommissioned'
  notes: string | null
  created_at: string
}

export interface EquipmentMaintenance {
  id: string
  farm_id: string
  master_id: string
  equipment_id: string
  date: string
  type: 'service' | 'repair' | 'fuel' | 'insurance'
  cost: number
  notes: string | null
  created_at: string
}

export interface Pasture {
  id: string
  farm_id: string
  master_id: string
  name: string
  area_ha: number
  capacity_heads: number | null   // рекомендуемая нагрузка
  current_group_id: string | null // какая группа сейчас пасётся
  notes: string | null
  created_at: string
}

export interface Incubation {
  id: string
  farm_id: string
  master_id: string
  species: AnimalSpecies          // poultry
  eggs_loaded: number
  start_date: string
  expected_hatch_date: string
  actual_hatch_date: string | null
  eggs_hatched: number | null
  notes: string | null
  created_at: string
}

// ── Derived / UI ─────────────────────────────────────────────────

export interface AnimalWithGroup extends Animal {
  group?: Pick<AnimalGroup, 'id' | 'name'> | null
}

export interface AnimalCostBreakdown {
  animal_id: string
  tag: string
  name: string | null
  acquisition_cost: number
  feed_cost: number
  veterinary_cost: number
  allocated_overhead: number      // пропорциональная доля общих расходов
  total_cost: number              // себестоимость накопленная
  revenue: number                 // доход от продукции/продажи
  margin: number                  // revenue - total_cost
}

export interface FarmDashboardStats {
  animals_total: number
  animals_by_species: Record<AnimalSpecies, number>
  fields_total_ha: number
  feed_stock_total_value: number
  production_last_30d: Record<ProductionType, number>
  expenses_last_30d: number
  revenue_last_30d: number
}

// ── Константы для UI ─────────────────────────────────────────────

export const ANIMAL_SPECIES_LIST: { value: AnimalSpecies; labelKey: string }[] = [
  { value: 'cattle',   labelKey: 'farm.species.cattle' },
  { value: 'poultry',  labelKey: 'farm.species.poultry' },
  { value: 'sheep',    labelKey: 'farm.species.sheep' },
  { value: 'goat',     labelKey: 'farm.species.goat' },
  { value: 'pig',      labelKey: 'farm.species.pig' },
  { value: 'rabbit',   labelKey: 'farm.species.rabbit' },
  { value: 'bee',      labelKey: 'farm.species.bee' },
  { value: 'fish',     labelKey: 'farm.species.fish' },
  { value: 'horse',    labelKey: 'farm.species.horse' },
  { value: 'other',    labelKey: 'farm.species.other' },
]
