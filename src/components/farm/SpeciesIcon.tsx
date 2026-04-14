import { Beef, Bird, Fish, Bug, Rabbit, PawPrint } from 'lucide-react'
import type { AnimalSpecies } from '@/types/farm'

const MAP: Record<AnimalSpecies, React.ComponentType<{ className?: string }>> = {
  cattle:   Beef,
  poultry:  Bird,
  sheep:    Beef,
  goat:     Beef,
  pig:      Beef,
  rabbit:   Rabbit,
  bee:      Bug,
  fish:     Fish,
  horse:    PawPrint,
  other:    PawPrint,
}

export function SpeciesIcon({ species, className }: { species: AnimalSpecies; className?: string }) {
  const Icon = MAP[species] ?? PawPrint
  return <Icon className={className} />
}
