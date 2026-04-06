import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface BroadcastCampaign {
  id: string
  master_id: string
  name: string
  message: string
  promo_code_id: string | null
  filter_type: 'all' | 'tag' | 'level' | 'inactive' | 'birthday_month' | 'selected'
  filter_value: string | null
  status: 'draft' | 'sending' | 'sent' | 'failed'
  total_recipients: number
  sent_count: number
  failed_count: number
  created_at: string
  sent_at: string | null
}

export interface CreateBroadcastData {
  name: string
  message: string
  filter_type: BroadcastCampaign['filter_type']
  filter_value?: string
  promo_code_id?: string
}

export function useBroadcasts() {
  const { user } = useAuth()
  const masterId = user?.id

  return useQuery({
    queryKey: ['broadcast_campaigns', masterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('broadcast_campaigns')
        .select('*')
        .eq('master_id', masterId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as BroadcastCampaign[]
    },
    enabled: !!masterId,
  })
}

export function useCreateBroadcast() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateBroadcastData) => {
      const { data: result, error } = await supabase
        .from('broadcast_campaigns')
        .insert({ ...data, master_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return result as BroadcastCampaign
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['broadcast_campaigns'] }),
  })
}

export function useUpdateBroadcast() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateBroadcastData> & { status?: string } }) => {
      const { data: result, error } = await supabase
        .from('broadcast_campaigns')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return result as BroadcastCampaign
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['broadcast_campaigns'] }),
  })
}

export function useDeleteBroadcast() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('broadcast_campaigns').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['broadcast_campaigns'] }),
  })
}

export function useSendBroadcast() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await supabase.functions.invoke('send-broadcast', {
        body: { campaign_id: campaignId },
      })
      if (res.error) throw res.error
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['broadcast_campaigns'] }),
  })
}

/** Подсчёт примерного кол-ва получателей для превью в диалоге */
export function useBroadcastRecipientCount(
  masterId: string | undefined,
  filterType: string,
  filterValue: string,
) {
  return useQuery({
    queryKey: ['broadcast_recipient_count', masterId, filterType, filterValue],
    queryFn: async () => {
      if (!masterId) return 0
      if (filterType === 'birthday_month') return null
      if (filterType === 'selected') {
        try { return JSON.parse(filterValue || '[]').length } catch { return 0 }
      }

      let query = supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('master_id', masterId)
        .not('tg_chat_id', 'is', null)

      if (filterType === 'tag' && filterValue) {
        query = query.contains('tags', [filterValue])
      } else if (filterType === 'level' && filterValue) {
        const THRESHOLDS: Record<string, number> = { regular: 3, vip: 10, premium: 20 }
        query = query.gte('total_visits', THRESHOLDS[filterValue] ?? 3)
      } else if (filterType === 'inactive' && filterValue) {
        const days = parseInt(filterValue)
        if (!isNaN(days)) {
          const cutoff = new Date()
          cutoff.setDate(cutoff.getDate() - days)
          query = query.or(`last_visit.is.null,last_visit.lte.${cutoff.toISOString().slice(0, 10)}`)
        }
      }

      const { count, error } = await query
      if (error) return null
      return count
    },
    enabled: !!masterId,
  })
}
