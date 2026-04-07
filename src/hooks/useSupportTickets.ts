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

export interface SupportTicketWithMaster extends SupportTicket {
  master_name: string | null
  master_profession: string | null
  master_email: string | null
}

// ── Мастер видит только свои тикеты ──────────────────────────────────────────

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

export function useDeleteSupportTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('support_tickets')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUPPORT_KEY] })
    },
  })
}

// ── Администратор видит все тикеты + данные мастера ───────────────────────────

export function useAdminSupportTickets(statusFilter?: TicketStatus | 'all') {
  return useQuery({
    queryKey: [SUPPORT_KEY, 'admin', statusFilter],
    queryFn: async () => {
      let q = supabase
        .from('support_tickets')
        .select(`
          *,
          master:users!support_tickets_master_id_fkey(
            id,
            email,
            master_profiles(display_name, profession)
          )
        `)
        .order('created_at', { ascending: false })

      if (statusFilter && statusFilter !== 'all') {
        q = q.eq('status', statusFilter)
      }

      const { data, error } = await q
      if (error) throw error

      return (data ?? []).map((row: any) => ({
        ...row,
        master_name:       row.master?.master_profiles?.[0]?.display_name ?? null,
        master_profession: row.master?.master_profiles?.[0]?.profession ?? null,
        master_email:      row.master?.email ?? null,
      })) as SupportTicketWithMaster[]
    },
  })
}

export function useAdminUpdateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      id: string
      status?: TicketStatus
      admin_reply?: string | null
    }) => {
      const { id, ...rest } = payload
      const { error } = await supabase
        .from('support_tickets')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUPPORT_KEY] })
    },
  })
}

export function useAdminDeleteTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('support_tickets')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUPPORT_KEY] })
    },
  })
}
