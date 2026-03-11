import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { DateBlock, BaseRecord } from '@/types'

export const DATE_BLOCKS_KEY = 'date_blocks'

// Блокировки дат текущего мастера
export function useDateBlocks() {
  const { user } = useAuth()

  return useQuery({
    queryKey: [DATE_BLOCKS_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('date_blocks')
        .select('*')
        .eq('master_id', user!.id)
        .order('date_from', { ascending: false })
      if (error) throw error
      return (data ?? []) as DateBlock[]
    },
    enabled: !!user,
  })
}

// Публичные блокировки для страницы бронирования
export function usePublicDateBlocks(masterId: string | undefined) {
  return useQuery({
    queryKey: [DATE_BLOCKS_KEY, 'public', masterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('date_blocks')
        .select('*')
        .eq('master_id', masterId!)
        .order('date_from')
      if (error) throw error
      return (data ?? []) as DateBlock[]
    },
    enabled: !!masterId,
  })
}

// Создать блокировку
export function useCreateDateBlock() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (data: Omit<DateBlock, keyof BaseRecord>) => {
      const { data: block, error } = await supabase
        .from('date_blocks')
        .insert({
          ...data,
          master_id: user!.id,
        })
        .select()
        .single()
      if (error) throw error
      return block as DateBlock
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [DATE_BLOCKS_KEY] }),
  })
}

// Удалить блокировку
export function useDeleteDateBlock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('date_blocks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [DATE_BLOCKS_KEY] }),
  })
}

// Проверить, заблокирована ли дата
export function isDateBlocked(date: string, blocks: DateBlock[]): boolean {
  return blocks.some((b) => date >= b.date_from && date <= b.date_to)
}
