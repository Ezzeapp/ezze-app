import type { LucideIcon } from 'lucide-react'
import { useProfile } from './useProfile'
import { getProfessionIcon } from '@/lib/professionIcon'

/**
 * Возвращает Lucide-иконку, соответствующую профессии текущего мастера.
 * Используется для динамической замены иконки ножниц во всём приложении.
 */
export function useProfileIcon(): LucideIcon {
  const { data: profile } = useProfile()
  return getProfessionIcon(profile?.profession)
}
