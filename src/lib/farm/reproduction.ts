/**
 * Справочник репродуктивных циклов по виду (в днях).
 */
import type { AnimalSpecies } from '@/types/farm'

export interface ReproductionCycle {
  pregnancy_days: number    // длительность беременности
  estrus_cycle_days: number // период между охотами
  maturity_months: number   // возраст половой зрелости
}

export const REPRODUCTION: Record<AnimalSpecies, ReproductionCycle | null> = {
  cattle:   { pregnancy_days: 283, estrus_cycle_days: 21, maturity_months: 15 },
  sheep:    { pregnancy_days: 150, estrus_cycle_days: 17, maturity_months: 7 },
  goat:     { pregnancy_days: 150, estrus_cycle_days: 21, maturity_months: 7 },
  pig:      { pregnancy_days: 114, estrus_cycle_days: 21, maturity_months: 6 },
  rabbit:   { pregnancy_days: 31,  estrus_cycle_days: 16, maturity_months: 4 },
  horse:    { pregnancy_days: 336, estrus_cycle_days: 21, maturity_months: 18 },
  poultry:  null, // у птицы другая логика (инкубация)
  bee:      null,
  fish:     null,
  other:    null,
}

export type ReproStatus = 'empty' | 'mated' | 'pregnant' | 'due_soon' | 'overdue' | 'immature' | 'unsupported'

export interface ReproRow {
  animal_id: string
  tag: string
  name: string | null
  species: AnimalSpecies
  status: ReproStatus
  last_mating_date: string | null
  last_birth_date: string | null
  expected_birth_date: string | null
  days_pregnant: number | null
  days_until_birth: number | null
  age_months: number | null
}
