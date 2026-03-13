import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export const SUPPORT_KEY = 'support_tickets'

export type TicketType = 'bug' | 'feature' | 'question' | 'other'
export type TicketStatus = 'new' | 'in_progress' | 'resolved' | 'closed'

export interface SupportTicket {
  id: string
  master_id: string
  type: TicketType
  title: string
  message: string
  status: TicketStatus
  admin_reply?: string | null
  created_at: string
  updated_at: string
}

export function useSupportTickets() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [SUPPORT_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as SupportTicket[]
    },
    enabled: !!user?.id,
  })
}

export function useCreateSupportTicket() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { type: TicketType; title: string; message: string }) => {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({ ...payload, master_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data as SupportTicket
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUPPORT_KEY] })
    },
  })
}
