import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { SpeciesIcon } from './SpeciesIcon'
import { Loader2, ChevronRight } from 'lucide-react'
import type { Animal } from '@/types/farm'

interface Props {
  animalId: string
  sex: 'male' | 'female' | 'unknown'
  depth?: number
}

/**
 * Рекурсивное дерево потомков. Для самок запрашиваем mother_id=animalId,
 * для самцов — father_id=animalId, для unknown — оба.
 */
export function OffspringTree({ animalId, sex, depth = 0 }: Props) {
  const { t } = useTranslation()
  const nav = useNavigate()

  const { data: children, isLoading } = useQuery({
    queryKey: ['farm', 'offspring', animalId, sex],
    queryFn: async () => {
      const col = sex === 'male' ? 'father_id' : sex === 'female' ? 'mother_id' : null
      if (col) {
        const { data, error } = await supabase.from('animals').select('*').eq(col, animalId).order('birth_date', { ascending: false })
        if (error) throw error
        return (data ?? []) as Animal[]
      }
      const [m, f] = await Promise.all([
        supabase.from('animals').select('*').eq('mother_id', animalId),
        supabase.from('animals').select('*').eq('father_id', animalId),
      ])
      const merged = [...(m.data ?? []), ...(f.data ?? [])]
      const seen = new Set<string>()
      return merged.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true }) as Animal[]
    },
    staleTime: 60_000,
  })

  if (isLoading && depth === 0) return <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  if (!children || children.length === 0) {
    if (depth === 0) return <p className="text-sm text-muted-foreground text-center py-6">{t('farm.offspring.empty')}</p>
    return null
  }

  return (
    <ul className={depth === 0 ? 'space-y-1' : 'ml-5 border-l border-border pl-3 space-y-1'}>
      {children.map(c => (
        <li key={c.id}>
          <button
            onClick={() => nav(`/farm/animals/${c.id}`)}
            className="w-full flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted transition-colors text-left"
          >
            <SpeciesIcon species={c.species} className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium text-sm">{c.tag}</span>
            {c.name && <span className="text-xs text-muted-foreground truncate">{c.name}</span>}
            {c.sex !== 'unknown' && <span className="text-xs text-muted-foreground ml-auto shrink-0">{t(`farm.sex.${c.sex}`)}</span>}
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          </button>
          {depth < 3 && <OffspringTree animalId={c.id} sex={c.sex} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  )
}
