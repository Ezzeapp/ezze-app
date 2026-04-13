import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PRODUCT } from '@/lib/config'
import { Shirt, LayoutGrid, Sofa, type LucideIcon } from 'lucide-react'
import dayjs from 'dayjs'

export type OrderType = 'clothing' | 'carpet' | 'furniture'
export type OrderStatus = 'received' | 'in_progress' | 'ready' | 'issued' | 'paid' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid'
export type ItemStatus = 'pending' | 'ready' | 'issued'
export type SortBy = 'newest' | 'oldest' | 'amount_desc' | 'deadline_asc'

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
  // ковры
  width_m: number | null
  length_m: number | null
  area_m2: number | null
  created_at: string
}

export interface CleaningOrder {
  id: string
  product: string
  number: string
  order_type: OrderType
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
  // ковры
  pickup_date: string | null
  delivery_date: string | null
  // мебель
  visit_address: string | null
  visit_date: string | null
  created_at: string
  updated_at: string
  // joined
  client?: { id: string; first_name: string; last_name?: string | null; phone: string | null; tg_chat_id: string | null } | null
  accepted_by_profile?: { id: string; display_name: string } | null
  assigned_to_profile?: { id: string; display_name: string } | null
  items?: CleaningOrderItem[]
}

export const ORDERS_KEY = 'cleaning_orders'

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  clothing:  'Одежда',
  carpet:    'Ковёр',
  furniture: 'Мебель',
}

export const ORDER_TYPE_ICONS: Record<OrderType, LucideIcon> = {
  clothing:  Shirt,
  carpet:    LayoutGrid,
  furniture: Sofa,
}

// ── Список заказов (с пагинацией и фильтрами) ─────────────────────────────────

export function useCleaningOrders(opts: {
  status?: OrderStatus | 'all'
  orderType?: OrderType | 'all'
  paymentStatus?: PaymentStatus | 'all'
  search?: string
  assignedToMe?: boolean
  page?: number
  perPage?: number
  sortBy?: SortBy
} = {}) {
  const { user } = useAuth()
  const {
    status = 'all',
    orderType = 'all',
    paymentStatus = 'all',
    search = '',
    assignedToMe = false,
    page = 1,
    perPage = 20,
    sortBy = 'newest',
  } = opts

  return useQuery({
    queryKey: [ORDERS_KEY, 'list', user?.id, status, orderType, paymentStatus, search, assignedToMe, page, sortBy],
    queryFn: async () => {
      const from = (page - 1) * perPage
      const to = page * perPage - 1

      let q = supabase
        .from('cleaning_orders')
        .select(`
          *,
          client:clients(id, first_name, last_name, phone, tg_chat_id),
          accepted_by_profile:master_profiles!cleaning_orders_accepted_by_fkey(id, display_name),
          assigned_to_profile:master_profiles!cleaning_orders_assigned_to_fkey(id, display_name)
        `, { count: 'exact' })
        .eq('product', PRODUCT)
        .range(from, to)

      // Сортировка
      if (sortBy === 'oldest') {
        q = q.order('created_at', { ascending: true })
      } else if (sortBy === 'amount_desc') {
        q = q.order('total_amount', { ascending: false })
      } else if (sortBy === 'deadline_asc') {
        q = q.order('ready_date', { ascending: true, nullsFirst: false })
      } else {
        q = q.order('created_at', { ascending: false })
      }

      if (status !== 'all') q = q.eq('status', status)
      if (orderType !== 'all') q = q.eq('order_type', orderType)
      if (paymentStatus !== 'all') q = q.eq('payment_status', paymentStatus)
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
        q = q.or(`number.ilike.%${search}%`)
      }

      const { data, error, count } = await q
      if (error) throw error
      return { orders: (data ?? []) as CleaningOrder[], total: count ?? 0 }
    },
    enabled: !!user,
    staleTime: 30_000,
  })
}

// ── Один заказ с изделиями ────────────────────────────────────────────────────

export function useCleaningOrder(id: string | undefined) {
  return useQuery({
    queryKey: [ORDERS_KEY, 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cleaning_orders')
        .select(`
          *,
          client:clients(id, first_name, last_name, phone, tg_chat_id),
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

// ── Создать заказ ─────────────────────────────────────────────────────────────

export interface CreateOrderPayload {
  order_type?: OrderType
  client_id?: string | null
  accepted_by?: string | null
  assigned_to?: string | null
  prepaid_amount?: number
  total_amount?: number
  ready_date?: string | null
  notes?: string | null
  // ковры
  pickup_date?: string | null
  delivery_date?: string | null
  // мебель
  visit_address?: string | null
  visit_date?: string | null
  items: {
    item_type_id?: string | null
    item_type_name: string
    color?: string | null
    brand?: string | null
    defects?: string | null
    price: number
    ready_date?: string | null
    // ковры
    width_m?: number | null
    length_m?: number | null
    area_m2?: number | null
  }[]
}

export function useCreateOrder() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateOrderPayload) => {
      const { data: numData, error: numErr } = await supabase
        .rpc('generate_cleaning_order_number', { p_product: PRODUCT })
      if (numErr) throw numErr

      const { data: order, error: orderErr } = await supabase
        .from('cleaning_orders')
        .insert({
          product:        PRODUCT,
          number:         numData,
          order_type:     payload.order_type ?? 'clothing',
          client_id:      payload.client_id ?? null,
          accepted_by:    payload.accepted_by ?? null,
          assigned_to:    payload.assigned_to ?? null,
          prepaid_amount: payload.prepaid_amount ?? 0,
          total_amount:   payload.total_amount ?? 0,
          ready_date:     payload.ready_date ?? null,
          notes:          payload.notes ?? null,
          pickup_date:    payload.pickup_date ?? null,
          delivery_date:  payload.delivery_date ?? null,
          visit_address:  payload.visit_address ?? null,
          visit_date:     payload.visit_date ?? null,
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

// ── Удалить заказ ─────────────────────────────────────────────────────────────

export function useDeleteOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // Удалить изделия → историю → заказ
      await supabase.from('cleaning_order_items').delete().eq('order_id', id)
      await supabase.from('cleaning_order_history').delete().eq('order_id', id)
      const { error } = await supabase.from('cleaning_orders').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ORDERS_KEY] }),
  })
}

// ── Привязать клиента к заказу ────────────────────────────────────────────────

export function useAssignClientToOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, client_id }: { id: string; client_id: string | null }) => {
      const { error } = await supabase
        .from('cleaning_orders')
        .update({ client_id })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'detail', id] })
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'list'] })
    },
  })
}

// ── Добавить изделие к заказу ─────────────────────────────────────────────────

export function useAddItemToOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, item }: {
      orderId: string
      item: {
        item_type_name: string
        price: number
        ready_date?: string | null
        color?: string | null
        brand?: string | null
        defects?: string | null
        item_type_id?: string | null
      }
    }) => {
      const { error } = await supabase
        .from('cleaning_order_items')
        .insert({ ...item, order_id: orderId })
      if (error) throw error
      // Пересчитать сумму заказа
      const { data: items } = await supabase
        .from('cleaning_order_items')
        .select('price')
        .eq('order_id', orderId)
      const newTotal = (items ?? []).reduce((s: number, i: any) => s + (i.price ?? 0), 0)
      await supabase.from('cleaning_orders').update({ total_amount: newTotal }).eq('id', orderId)
    },
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'detail', orderId] })
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'list'] })
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'stats'] })
    },
  })
}

// ── Удалить изделие из заказа ─────────────────────────────────────────────────

export function useRemoveItemFromOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, itemId }: { orderId: string; itemId: string }) => {
      const { error } = await supabase
        .from('cleaning_order_items')
        .delete()
        .eq('id', itemId)
      if (error) throw error
      // Пересчитать сумму заказа
      const { data: items } = await supabase
        .from('cleaning_order_items')
        .select('price')
        .eq('order_id', orderId)
      const newTotal = (items ?? []).reduce((s: number, i: any) => s + (i.price ?? 0), 0)
      await supabase.from('cleaning_orders').update({ total_amount: newTotal }).eq('id', orderId)
    },
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'detail', orderId] })
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'list'] })
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'stats'] })
    },
  })
}

// ── Обновить изделие ──────────────────────────────────────────────────────────

export function useUpdateOrderItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, itemId, data }: {
      orderId: string
      itemId: string
      data: Partial<Pick<CleaningOrderItem, 'item_type_name' | 'price' | 'ready_date' | 'color' | 'brand' | 'defects'>>
    }) => {
      const { error } = await supabase
        .from('cleaning_order_items')
        .update(data)
        .eq('id', itemId)
      if (error) throw error
      // Пересчитать сумму если изменилась цена
      if (data.price !== undefined) {
        const { data: items } = await supabase
          .from('cleaning_order_items')
          .select('price')
          .eq('order_id', orderId)
        const newTotal = (items ?? []).reduce((s: number, i: any) => s + (i.price ?? 0), 0)
        await supabase.from('cleaning_orders').update({ total_amount: newTotal }).eq('id', orderId)
      }
    },
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'detail', orderId] })
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'list'] })
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'stats'] })
    },
  })
}

// ── Обновить статус заказа ────────────────────────────────────────────────────

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

      await supabase.from('cleaning_order_history').insert({
        order_id:   id,
        old_status: current?.status,
        new_status: status,
        note:       note ?? null,
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
      const { error: itemsErr } = await supabase
        .from('cleaning_order_items')
        .update({ status: 'issued' })
        .in('id', itemIds)
      if (itemsErr) throw itemsErr

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

// ── Принять оплату ────────────────────────────────────────────────────────────

export function useAcceptPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const { data: curr } = await supabase
        .from('cleaning_orders')
        .select('paid_amount, total_amount')
        .eq('id', id)
        .single()
      const newPaid = (curr?.paid_amount ?? 0) + amount
      const newPayStatus: PaymentStatus =
        newPaid >= (curr?.total_amount ?? 0) ? 'paid' : 'partial'
      const { error } = await supabase
        .from('cleaning_orders')
        .update({ paid_amount: newPaid, payment_status: newPayStatus })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'detail', id] })
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'list'] })
      qc.invalidateQueries({ queryKey: [ORDERS_KEY, 'stats'] })
    },
  })
}

// ── Статистика заказов (за текущий месяц) ─────────────────────────────────────

export interface OrdersStats {
  total_today: number
  total_month: number
  unpaid_count: number
  unpaid_amount: number
  total_revenue: number
}

export function useOrdersStats() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [ORDERS_KEY, 'stats', PRODUCT],
    queryFn: async (): Promise<OrdersStats> => {
      const { data } = await supabase
        .from('cleaning_orders')
        .select('status, payment_status, total_amount, paid_amount, created_at')
        .eq('product', PRODUCT)
        .gte('created_at', dayjs().startOf('month').toISOString())
        .not('status', 'eq', 'cancelled')
      const orders = data ?? []
      const todayStart = dayjs().startOf('day').toISOString()
      const total_today = orders.filter(o => o.created_at >= todayStart).length
      const unpaid = orders.filter(o => (o.payment_status ?? 'unpaid') !== 'paid')
      return {
        total_today,
        total_month: orders.length,
        unpaid_count: unpaid.length,
        unpaid_amount: unpaid.reduce((s, o) => s + Math.max(0, o.total_amount - (o.paid_amount ?? 0)), 0),
        total_revenue: orders.reduce((s, o) => s + o.total_amount, 0),
      }
    },
    enabled: !!user,
    staleTime: 60_000,
  })
}

// ── Обновить поля заказа ──────────────────────────────────────────────────────

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
