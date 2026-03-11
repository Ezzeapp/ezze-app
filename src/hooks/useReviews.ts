import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Review, BaseRecord } from '@/types'

export const REVIEWS_KEY = 'reviews'

// Хук для мастера — все отзывы о нём
// reviews use text master_id (not UUID FK) — filter by user id string
export function useReviews() {
  const { user } = useAuth()

  return useQuery({
    queryKey: [REVIEWS_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('master_id', user!.id)
        .order('id', { ascending: false })
      if (error) throw error
      return (data ?? []) as Review[]
    },
    enabled: !!user,
  })
}

// Публичные отзывы по userId мастера (для страницы бронирования)
export function usePublicReviews(masterId: string | undefined) {
  return useQuery({
    queryKey: [REVIEWS_KEY, 'public', masterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('master_id', masterId!)
        .eq('is_visible', true)
        .order('id', { ascending: false })
      if (error) throw error
      return (data ?? []) as Review[]
    },
    enabled: !!masterId,
  })
}

// Создать отзыв (со стороны клиента, без авторизации)
export function useCreateReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Omit<Review, keyof BaseRecord>) => {
      const { data: review, error } = await supabase
        .from('reviews')
        .insert(data)
        .select()
        .single()
      if (error) throw error
      return review as Review
    },
    onSuccess: (review) => {
      queryClient.invalidateQueries({ queryKey: [REVIEWS_KEY] })
      queryClient.invalidateQueries({ queryKey: [REVIEWS_KEY, 'public', review.master_id] })
    },
  })
}

// Переключить видимость отзыва (мастер)
export function useToggleReviewVisibility() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, is_visible }: { id: string; is_visible: boolean }) => {
      const { data, error } = await supabase
        .from('reviews')
        .update({ is_visible })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Review
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [REVIEWS_KEY] }),
  })
}

// Удалить отзыв (мастер)
export function useDeleteReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reviews').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [REVIEWS_KEY] }),
  })
}
