import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ClinicLabOrder, ClinicLabOrderItem, LabOrderStatus, LabResultFlag } from '@/types'

export const CLINIC_LAB_ORDERS_KEY = 'clinic_lab_orders'

export function useClinicLabOrders(filters?: { status?: LabOrderStatus; clientId?: string }) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [CLINIC_LAB_ORDERS_KEY, user?.id, filters],
    queryFn: async () => {
      if (!user) return []
      let q = supabase
        .from('clinic_lab_orders')
        .select('*, client:clients(first_name, last_name), items:clinic_lab_order_items(id)')
        .eq('master_id', user.id)
        .order('ordered_at', { ascending: false })
      if (filters?.status) q = q.eq('status', filters.status)
      if (filters?.clientId) q = q.eq('client_id', filters.clientId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ClinicLabOrder[]
    },
    enabled: !!user,
    staleTime: 30_000,
  })
}

export function useClinicLabOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: [CLINIC_LAB_ORDERS_KEY, 'detail', orderId],
    queryFn: async () => {
      if (!orderId) return null
      const { data, error } = await supabase
        .from('clinic_lab_orders')
        .select('*, client:clients(first_name, last_name), items:clinic_lab_order_items(*)')
        .eq('id', orderId)
        .single()
      if (error) throw error
      return data as ClinicLabOrder
    },
    enabled: !!orderId,
    staleTime: 30_000,
  })
}

export function useClinicLabOrdersByPatient(clientId: string | undefined) {
  return useQuery({
    queryKey: [CLINIC_LAB_ORDERS_KEY, 'by_patient', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data, error } = await supabase
        .from('clinic_lab_orders')
        .select('*, items:clinic_lab_order_items(*)')
        .eq('client_id', clientId)
        .order('ordered_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ClinicLabOrder[]
    },
    enabled: !!clientId,
    staleTime: 30_000,
  })
}

export function useCreateLabOrder() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: {
      client_id: string
      visit_id?: string | null
      notes?: string | null
      items: Array<{ test_id?: string | null; test_name: string; result_unit?: string | null; ref_min?: number | null; ref_max?: number | null; ref_text?: string | null }>
    }) => {
      const { data: order, error: orderErr } = await supabase
        .from('clinic_lab_orders')
        .insert({ master_id: user!.id, client_id: payload.client_id, visit_id: payload.visit_id, notes: payload.notes })
        .select()
        .single()
      if (orderErr) throw orderErr

      if (payload.items.length > 0) {
        const itemRows = payload.items.map(item => ({ order_id: order.id, ...item }))
        const { error: itemsErr } = await supabase.from('clinic_lab_order_items').insert(itemRows)
        if (itemsErr) throw itemsErr
      }
      return order as ClinicLabOrder
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_LAB_ORDERS_KEY] }),
  })
}

export function useUpdateLabOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LabOrderStatus }) => {
      const update: Record<string, unknown> = { status }
      if (status === 'completed') update.completed_at = new Date().toISOString()
      const { error } = await supabase.from('clinic_lab_orders').update(update).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_LAB_ORDERS_KEY] }),
  })
}

export function useUpdateLabOrderItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: Array<{ id: string; result_value?: string | null; flag?: LabResultFlag | null; notes?: string | null }>) => {
      for (const item of items) {
        const { id, ...rest } = item
        const update: Record<string, unknown> = { ...rest }
        if (rest.result_value !== undefined) {
          update.completed_at = new Date().toISOString()
        }
        const { error } = await supabase.from('clinic_lab_order_items').update(update).eq('id', id)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_LAB_ORDERS_KEY] }),
  })
}

export function useClinicLabStats() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [CLINIC_LAB_ORDERS_KEY, 'stats', user?.id],
    queryFn: async () => {
      if (!user) return { ordered: 0, inProgress: 0, completed: 0 }
      const { data, error } = await supabase
        .from('clinic_lab_orders')
        .select('status')
        .eq('master_id', user.id)
      if (error) throw error
      const counts = { ordered: 0, inProgress: 0, completed: 0 }
      for (const row of data ?? []) {
        if (row.status === 'ordered') counts.ordered++
        else if (row.status === 'in_progress') counts.inProgress++
        else if (row.status === 'completed') counts.completed++
      }
      return counts
    },
    enabled: !!user,
    staleTime: 60_000,
  })
}
