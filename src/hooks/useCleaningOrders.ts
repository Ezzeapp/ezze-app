import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PRODUCT } from '@/lib/config'

export type OrderStatus = 'received' | 'in_progress' | 'ready' | 'issued' | 'paid' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid'
export type ItemStatus = 'pending' | 'ready' | 'issued'

export interface CleaningOrderItem {
  id: string
  order_id: string
  item_type_id: string | null
  item_type_name: string
  color: string | null
  brand: string | null
  defects: string | null
  price: number
  ready_date: string | null
  status: ItemStatus
  created_at: string
}

export interface CleaningOrder {
  id: string
  product: string
  number: string
  client_id: string | null
  accepted_by: string | null
  assigned_to: string | null
  status: OrderStatus
  payment_status: PaymentStatus
  prepaid_amount: number
  total_amount: number
  paid_amount: number
  ready_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // joined
  client?: { id: string; first_name: string; last_name?: string | null; phone: string | null; tg_chat_id: string | null } | null
  accepted_by_profile?: { id: string; display_name: string } | null
  assigned_to_profile?: { id: string; display_name: string } | null
  items?: CleaningOrderItem[]
}

export const ORDERS_KEY = 'cleaning_orders'

// ── Список квитанций (с пагинацией и фильтрами) ──────────────────────────────

export function useCleaningOrders(opts: {
  status?: OrderStatus | 'all'
  search?: string
  assignedToMe?: boolean
  page?: number
  perPage?: number
} = {}) {
  const { user } = useAuth()
  const { status = 'all', search = '', assignedToMe = false, page = 1, perPage = 20 } = opts

  return useQuery({
    queryKey: [ORDERS_KEY, 'list', user?.id, status, search, assignedToMe, page],
    queryFn: async () => {
      const from = (page - 1) * perPage
      const to = page * perPage - 1

      let q = supabase
        .from('cleaning_orders')
        .select(`
          *,
          client:clients(id, name, phone, tg_chat_id),
          accepted_by_profile:master_profiles!cleaning_orders_accepted_by_fkey(id, display_name),
          assigned_to_profile:master_profiles!cleaning_orders_assigned_to_fkey(id, display_name)
        `, { count: 'exact' })
        .eq('product', PRODUCT)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (status !== 'all') q = q.eq('status', status)
      if (assignedToMe && user) {
        const { data: mp } = await supabase
          .from('master_profiles')
          .select('id')
          .eq('user_id', user.id)
          .eq('product', PRODUCT)
          .maybeSingle()
        if (mp) q = q.eq('assigned_to', mp.id)
      }
      if (search) {
        q = q.or(`number.ilike.%${search}%,client.name.ilike.%${search}%`)
      }

      const { data, error, count } = await q
      if (error) throw error
      return { orders: (data ?? []) as CleaningOrder[], total: count ?? 0 }
    },
    enabled: !!user,
    staleTime: 30_000,
  })
}

// ── Одна квитанция с изделиями и историей ────────────────────────────────────

export function useCleaningOrder(id: string | undefined) {
  return useQuery({
    queryKey: [ORDERS_KEY, 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cleaning_orders')
        .select(`
          *,
          client:clients(id, name, phone, tg_chat_id),
          accepted_by_profile:master_profiles!cleaning_orders_accepted_by_fkey(id, display_name),
          assigned_to_profile:master_profiles!cleaning_orders_assigned_to_fkey(id, display_name),
          items:cleaning_order_items(*)
        `)
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as CleaningOrder
    },
    enabled: !!id,
    staleTime: 10_000,
  })
}

// ── Создать квитанцию ─────────────────────────────────────────────────────────

export interface CreateOrderPayload {
  client_id?: string | null
  accepted_by?: string | null
  assigned_to?: string | null
  prepaid_amount?: number
  total_amount?: number
  ready_date?: string | null
  notes?: string | null
  items: {
    item_type_id?: string | null
    item_type_name: string
    color?: string | null
    brand?: string | null
    defects?: string | null
    price: number
    ready_date?: string | null
  }[]
}

export function useCreateOrder() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateOrderPayload) => {
      // Генерируем номер
      const { data: numData, error: numErr } = await supabase
        .rpc('generate_cleaning_order_number', { p_product: PRODUCT })
      if (numErr) throw numErr

      const { data: order, error: orderErr } = await supabase
        .from('cleaning_orders')
        .insert({
          product: PRODUCT,
          number: numData,
          client_id: payload.client_id ?? null,
          accepted_by: payload.accepted_by ?? null,
          assigned_to: payload.assigned_to ?? null,
          prepaid_amount: payload.prepaid_amount ?? 0,
          total_amount: payload.total_amount ?? 0,
          ready_date: payload.ready_date ?? null,
          notes: payload.notes ?? null,
        })
        .select()
        .single()
      if (orderErr) throw orderErr

      if (payload.items.length > 0) {
        const { error: itemsErr } = await supabase
          .from('cleaning_order_items')
          .insert(payload.items.map(item => ({ ...item, order_id: order.id })))
        if (itemsErr) throw itemsErr
      }

      return order
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ORDERS_KEY] }),
  })
}

// ── Обновить статус квитанции ─────────────────────────────────────────────────

export function useUpdateOrderStatus() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: OrderStatus; note?: string }) => {
      const { data: current } = await supabase
        .from('cleaning_orders')
        .select('status')
        .eq('id', id)
        .single()

      const { error } = await supabase
        .from('cleaning_orders')
        .update({ status })
        .eq('id', id)
      if (error) throw error

      // История
      await supabase.from('cleaning_order_history').insert({
        order_id: id,
        old_status: current?.status,
        new_status: status,
        note: note ?? null,
      })
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'detail', id] })
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'list'] })
    },
  })
}

// ── Выдача изделий (частичная или полная) ────────────────────────────────────

export function useIssueItems() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ orderId, itemIds, payAmount }: {
      orderId: string
      itemIds: string[]
      payAmount: number
    }) => {
      // Помечаем выданные изделия
      const { error: itemsErr } = await supabase
        .from('cleaning_order_items')
        .update({ status: 'issued' })
        .in('id', itemIds)
      if (itemsErr) throw itemsErr

      // Получаем актуальное состояние заказа
      const { data: order } = await supabase
        .from('cleaning_orders')
        .select('paid_amount, total_amount, items:cleaning_order_items(status)')
        .eq('id', orderId)
        .single()

      const newPaid = (order?.paid_amount ?? 0) + payAmount
      const allItems = (order as any)?.items ?? []
      const allIssued = allItems.every((i: any) => i.status === 'issued' || itemIds.includes(i.id))

      const newStatus: OrderStatus = allIssued ? 'issued' : 'in_progress'
      const newPayStatus: PaymentStatus =
        newPaid >= (order?.total_amount ?? 0) ? 'paid'
        : newPaid > 0 ? 'partial'
        : 'unpaid'

      const { error: orderErr } = await supabase
        .from('cleaning_orders')
        .update({ status: newStatus, payment_status: newPayStatus, paid_amount: newPaid })
        .eq('id', orderId)
      if (orderErr) throw orderErr
    },
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'detail', orderId] })
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'list'] })
    },
  })
}

// ── Обновить поля квитанции ───────────────────────────────────────────────────

export function useUpdateOrder() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CleaningOrder> }) => {
      const { error } = await supabase
        .from('cleaning_orders')
        .update(data)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'detail', id] })
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'list'] })
    },
  })
}
