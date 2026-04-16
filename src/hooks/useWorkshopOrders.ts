import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PRODUCT } from '@/lib/config'
import dayjs from 'dayjs'

export type WorkshopOrderStatus =
  | 'received'
  | 'diagnosing'
  | 'waiting_approval'
  | 'waiting_parts'
  | 'in_progress'
  | 'ready'
  | 'issued'
  | 'paid'
  | 'refused'
  | 'cancelled'

export type WorkshopPaymentStatus = 'unpaid' | 'partial' | 'paid'
export type WorkshopSortBy = 'newest' | 'oldest' | 'amount_desc' | 'deadline_asc'

export interface WorkshopItemType {
  id: string
  product: string
  name: string
  category: string | null
  default_diagnostic_price: number
  default_days: number
  default_warranty_days: number
  icon: string | null
  sort_order: number
  active: boolean
}

export interface WorkshopDevice {
  id: string
  client_id: string
  item_type_id: string | null
  item_type_name: string
  brand: string | null
  model: string | null
  serial_number: string | null
  imei: string | null
  purchase_date: string | null
  notes: string | null
  created_at: string
}

export interface WorkshopOrderWork {
  id: string
  order_id: string
  service_id: string | null
  name: string
  price: number
  quantity: number
  performed_by: string | null
  done: boolean
}

export interface WorkshopOrderPart {
  id: string
  order_id: string
  inventory_item_id: string | null
  name: string
  sku: string | null
  quantity: number
  cost_price: number
  sell_price: number
  warranty_days: number
}

export interface WorkshopOrder {
  id: string
  product: string
  number: string
  client_id: string | null
  device_id: string | null
  accepted_by: string | null
  assigned_to: string | null
  item_type_id: string | null
  item_type_name: string
  brand: string | null
  model: string | null
  serial_number: string | null
  imei: string | null
  defect_description: string | null
  visible_defects: string | null
  completeness: string | null
  diagnostic_notes: string | null
  diagnostic_price: number
  estimated_cost: number | null
  client_approved: boolean
  client_approved_at: string | null
  approval_token: string | null
  status: WorkshopOrderStatus
  payment_status: WorkshopPaymentStatus
  prepaid_amount: number
  works_amount: number
  parts_amount: number
  total_amount: number
  paid_amount: number
  ready_date: string | null
  issued_at: string | null
  warranty_days: number
  notes: string | null
  photos: string[]
  created_at: string
  updated_at: string
  // joined
  client?: { id: string; first_name: string; last_name?: string | null; phone: string | null; tg_chat_id: string | null } | null
  accepted_by_profile?: { id: string; display_name: string } | null
  assigned_to_profile?: { id: string; display_name: string; commission_rate?: number } | null
  works?: WorkshopOrderWork[]
  parts?: WorkshopOrderPart[]
}

export const WORKSHOP_ORDERS_KEY = 'workshop_orders'

export const WORKSHOP_STATUS_LABELS: Record<WorkshopOrderStatus, string> = {
  received: 'Принят',
  diagnosing: 'Диагностика',
  waiting_approval: 'Ждём клиента',
  waiting_parts: 'Ждём запчасти',
  in_progress: 'В ремонте',
  ready: 'Готов',
  issued: 'Выдан',
  paid: 'Оплачен',
  refused: 'Отказ',
  cancelled: 'Отменён',
}

// ── Справочник типов устройств ───────────────────────────────────────────────
export function useWorkshopItemTypes() {
  return useQuery({
    queryKey: ['workshop_item_types', PRODUCT],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshop_item_types')
        .select('*')
        .eq('product', PRODUCT)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as WorkshopItemType[]
    },
    staleTime: 60_000,
  })
}

export function useUpsertWorkshopItemType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<WorkshopItemType> & { name: string }) => {
      const { error } = await supabase
        .from('workshop_item_types')
        .upsert({ product: PRODUCT, ...payload }, { onConflict: 'product,name' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop_item_types'] }),
  })
}

export function useDeleteWorkshopItemType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workshop_item_types').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop_item_types'] }),
  })
}

// ── Список заказов с фильтрами ──────────────────────────────────────────────
export function useWorkshopOrders(opts: {
  status?: WorkshopOrderStatus | 'all'
  paymentStatus?: WorkshopPaymentStatus | 'all'
  search?: string
  assignedToMe?: boolean
  page?: number
  perPage?: number
  sortBy?: WorkshopSortBy
  dateFrom?: string
  dateTo?: string
} = {}) {
  const { user } = useAuth()
  const {
    status = 'all',
    paymentStatus = 'all',
    search = '',
    assignedToMe = false,
    page = 1,
    perPage = 20,
    sortBy = 'newest',
    dateFrom = '',
    dateTo = '',
  } = opts

  return useQuery({
    queryKey: [WORKSHOP_ORDERS_KEY, 'list', user?.id, status, paymentStatus, search, assignedToMe, page, sortBy, dateFrom, dateTo],
    queryFn: async () => {
      const from = (page - 1) * perPage
      const to = page * perPage - 1

      let q = supabase
        .from('workshop_orders')
        .select(`
          *,
          client:clients(id, first_name, last_name, phone, tg_chat_id),
          accepted_by_profile:master_profiles!workshop_orders_accepted_by_fkey(id, display_name),
          assigned_to_profile:master_profiles!workshop_orders_assigned_to_fkey(id, display_name)
        `, { count: 'exact' })
        .eq('product', PRODUCT)
        .range(from, to)

      if (sortBy === 'oldest')           q = q.order('created_at', { ascending: true })
      else if (sortBy === 'amount_desc') q = q.order('total_amount', { ascending: false })
      else if (sortBy === 'deadline_asc') q = q.order('ready_date', { ascending: true, nullsFirst: false })
      else                                q = q.order('created_at', { ascending: false })

      if (status !== 'all')        q = q.eq('status', status)
      if (paymentStatus !== 'all') q = q.eq('payment_status', paymentStatus)
      if (dateFrom)                q = q.gte('created_at', dateFrom + 'T00:00:00')
      if (dateTo)                  q = q.lte('created_at', dateTo + 'T23:59:59')
      if (assignedToMe && user) {
        const { data: mp } = await supabase
          .from('master_profiles').select('id')
          .eq('user_id', user.id).eq('product', PRODUCT).maybeSingle()
        if (mp) q = q.eq('assigned_to', mp.id)
      }
      if (search) {
        q = q.or(`number.ilike.%${search}%,serial_number.ilike.%${search}%,brand.ilike.%${search}%,model.ilike.%${search}%`)
      }

      const { data, error, count } = await q
      if (error) throw error
      return { orders: (data ?? []) as WorkshopOrder[], total: count ?? 0 }
    },
    enabled: !!user,
    staleTime: 30_000,
  })
}

// ── Один заказ с работами и запчастями ──────────────────────────────────────
export function useWorkshopOrder(id: string | undefined) {
  return useQuery({
    queryKey: [WORKSHOP_ORDERS_KEY, 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshop_orders')
        .select(`
          *,
          client:clients(id, first_name, last_name, phone, tg_chat_id),
          accepted_by_profile:master_profiles!workshop_orders_accepted_by_fkey(id, display_name),
          assigned_to_profile:master_profiles!workshop_orders_assigned_to_fkey(id, display_name, commission_rate),
          works:workshop_order_works(*),
          parts:workshop_order_parts(*)
        `)
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as WorkshopOrder
    },
    enabled: !!id,
    staleTime: 10_000,
  })
}

// ── Создать заказ ────────────────────────────────────────────────────────────
export interface CreateWorkshopOrderPayload {
  client_id?: string | null
  device_id?: string | null
  accepted_by?: string | null
  assigned_to?: string | null
  item_type_id?: string | null
  item_type_name: string
  brand?: string | null
  model?: string | null
  serial_number?: string | null
  imei?: string | null
  defect_description?: string | null
  visible_defects?: string | null
  completeness?: string | null
  diagnostic_price?: number
  estimated_cost?: number | null
  prepaid_amount?: number
  ready_date?: string | null
  warranty_days?: number
  notes?: string | null
  photos?: string[]
}

export function useCreateWorkshopOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateWorkshopOrderPayload) => {
      const { data: numData, error: numErr } = await supabase
        .rpc('generate_workshop_order_number', { p_product: PRODUCT })
      if (numErr) throw numErr

      const { data: order, error: orderErr } = await supabase
        .from('workshop_orders')
        .insert({
          product: PRODUCT,
          number: numData,
          client_id:          payload.client_id ?? null,
          device_id:          payload.device_id ?? null,
          accepted_by:        payload.accepted_by ?? null,
          assigned_to:        payload.assigned_to ?? null,
          item_type_id:       payload.item_type_id ?? null,
          item_type_name:     payload.item_type_name,
          brand:              payload.brand ?? null,
          model:              payload.model ?? null,
          serial_number:      payload.serial_number ?? null,
          imei:               payload.imei ?? null,
          defect_description: payload.defect_description ?? null,
          visible_defects:    payload.visible_defects ?? null,
          completeness:       payload.completeness ?? null,
          diagnostic_price:   payload.diagnostic_price ?? 0,
          estimated_cost:     payload.estimated_cost ?? null,
          prepaid_amount:     payload.prepaid_amount ?? 0,
          ready_date:         payload.ready_date ?? null,
          warranty_days:      payload.warranty_days ?? 0,
          notes:              payload.notes ?? null,
          photos:             payload.photos ?? [],
        })
        .select()
        .single()
      if (orderErr) throw orderErr

      // Автоматически создаём запись устройства если её не было
      if (payload.client_id && !payload.device_id) {
        await supabase.from('workshop_devices').insert({
          product: PRODUCT,
          client_id: payload.client_id,
          item_type_id: payload.item_type_id ?? null,
          item_type_name: payload.item_type_name,
          brand: payload.brand ?? null,
          model: payload.model ?? null,
          serial_number: payload.serial_number ?? null,
          imei: payload.imei ?? null,
        })
      }

      await supabase.from('workshop_order_history').insert({
        order_id: order.id,
        new_status: 'received',
        note: 'Заказ принят',
      })

      return order as WorkshopOrder
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [WORKSHOP_ORDERS_KEY] }),
  })
}

// ── Обновить заказ ──────────────────────────────────────────────────────────
export function useUpdateWorkshopOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WorkshopOrder> }) => {
      const { error } = await supabase.from('workshop_orders').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: [WORKSHOP_ORDERS_KEY, 'detail', id] })
      qc.invalidateQueries({ queryKey: [WORKSHOP_ORDERS_KEY, 'list'] })
    },
  })
}

// ── Удалить заказ ───────────────────────────────────────────────────────────
export function useDeleteWorkshopOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('workshop_order_works').delete().eq('order_id', id)
      await supabase.from('workshop_order_parts').delete().eq('order_id', id)
      await supabase.from('workshop_order_history').delete().eq('order_id', id)
      const { error } = await supabase.from('workshop_orders').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [WORKSHOP_ORDERS_KEY] }),
  })
}

// ── Смена статуса с записью в историю + уведомление клиенту ────────────────
export function useUpdateWorkshopStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: WorkshopOrderStatus; note?: string }) => {
      const { data: current } = await supabase
        .from('workshop_orders').select('status').eq('id', id).single()

      const updates: any = { status }
      if (status === 'issued') updates.issued_at = new Date().toISOString()

      const { error } = await supabase.from('workshop_orders').update(updates).eq('id', id)
      if (error) throw error

      await supabase.from('workshop_order_history').insert({
        order_id: id,
        old_status: current?.status,
        new_status: status,
        note: note ?? null,
      })

      // Fire-and-forget уведомление клиенту (не блокирует UI при сбое)
      supabase.functions.invoke('workshop-notify-status', {
        body: { order_id: id, status },
      }).catch(err => console.warn('workshop-notify-status failed:', err))
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: [WORKSHOP_ORDERS_KEY, 'detail', id] })
      qc.invalidateQueries({ queryKey: [WORKSHOP_ORDERS_KEY, 'list'] })
    },
  })
}

// ── Работы в заказе ─────────────────────────────────────────────────────────
async function recalcTotals(orderId: string) {
  const [{ data: works }, { data: parts }] = await Promise.all([
    supabase.from('workshop_order_works').select('price,quantity').eq('order_id', orderId),
    supabase.from('workshop_order_parts').select('sell_price,quantity').eq('order_id', orderId),
  ])
  const works_amount = (works ?? []).reduce((s: number, w: any) => s + (w.price ?? 0) * (w.quantity ?? 1), 0)
  const parts_amount = (parts ?? []).reduce((s: number, p: any) => s + (p.sell_price ?? 0) * (p.quantity ?? 1), 0)
  const total_amount = works_amount + parts_amount
  await supabase.from('workshop_orders')
    .update({ works_amount, parts_amount, total_amount })
    .eq('id', orderId)
}

export function useAddWorkshopWork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, work }: {
      orderId: string
      work: { name: string; price: number; quantity?: number; service_id?: string | null; performed_by?: string | null }
    }) => {
      const { error } = await supabase.from('workshop_order_works').insert({
        order_id: orderId,
        name: work.name,
        price: work.price,
        quantity: work.quantity ?? 1,
        service_id: work.service_id ?? null,
        performed_by: work.performed_by ?? null,
      })
      if (error) throw error
      await recalcTotals(orderId)
    },
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: [WORKSHOP_ORDERS_KEY, 'detail', orderId] })
      qc.invalidateQueries({ queryKey: [WORKSHOP_ORDERS_KEY, 'list'] })
    },
  })
}

export function useRemoveWorkshopWork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, workId }: { orderId: string; workId: string }) => {
      const { error } = await supabase.from('workshop_order_works').delete().eq('id', workId)
      if (error) throw error
      await recalcTotals(orderId)
    },
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: [WORKSHOP_ORDERS_KEY, 'detail', orderId] })
    },
  })
}

export function useToggleWorkshopWorkDone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ workId, done }: { orderId: string; workId: string; done: boolean }) => {
      const { error } = await supabase.from('workshop_order_works').update({ done }).eq('id', workId)
      if (error) throw error
    },
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: [WORKSHOP_ORDERS_KEY, 'detail', orderId] })
    },
  })
}

// ── Запчасти в заказе ───────────────────────────────────────────────────────
export function useAddWorkshopPart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, part }: {
      orderId: string
      part: {
        name: string
        sku?: string | null
        quantity?: number
        cost_price?: number
        sell_price: number
        warranty_days?: number
        inventory_item_id?: string | null
      }
    }) => {
      const { error } = await supabase.from('workshop_order_parts').insert({
        order_id: orderId,
        name: part.name,
        sku: part.sku ?? null,
        quantity: part.quantity ?? 1,
        cost_price: part.cost_price ?? 0,
        sell_price: part.sell_price,
        warranty_days: part.warranty_days ?? 0,
        inventory_item_id: part.inventory_item_id ?? null,
      })
      if (error) throw error

      // Списание со склада
      if (part.inventory_item_id) {
        const qty = part.quantity ?? 1
        const { data: inv } = await supabase
          .from('inventory_items').select('quantity').eq('id', part.inventory_item_id).single()
        if (inv) {
          await supabase.from('inventory_items')
            .update({ quantity: Math.max(0, (inv.quantity ?? 0) - qty) })
            .eq('id', part.inventory_item_id)
        }
      }
      await recalcTotals(orderId)
    },
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: [WORKSHOP_ORDERS_KEY, 'detail', orderId] })
      qc.invalidateQueries({ queryKey: ['inventory_items'] })
    },
  })
}

export function useRemoveWorkshopPart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, partId }: { orderId: string; partId: string }) => {
      const { error } = await supabase.from('workshop_order_parts').delete().eq('id', partId)
      if (error) throw error
      await recalcTotals(orderId)
    },
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: [WORKSHOP_ORDERS_KEY, 'detail', orderId] })
    },
  })
}

// ── Отправка сметы клиенту на согласование ─────────────────────────────────
export function useSendApprovalLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string }): Promise<string> => {
      // Генерируем криптостойкий токен
      const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')

      const { error } = await supabase
        .from('workshop_orders')
        .update({ approval_token: token, status: 'waiting_approval', client_approved: false })
        .eq('id', id)
      if (error) throw error

      await supabase.from('workshop_order_history').insert({
        order_id: id,
        new_status: 'waiting_approval',
        note: 'Отправлено клиенту на согласование',
      })

      // Уведомление (fire-and-forget) — шаблон waiting_approval получит {approve_url}
      supabase.functions.invoke('workshop-notify-status', {
        body: { order_id: id, status: 'waiting_approval' },
      }).catch(err => console.warn('notify-status failed:', err))

      return token
    },
    onSuccess: (_t, { id }) => {
      qc.invalidateQueries({ queryKey: [WORKSHOP_ORDERS_KEY, 'detail', id] })
      qc.invalidateQueries({ queryKey: [WORKSHOP_ORDERS_KEY, 'list'] })
    },
  })
}

// ── Приём оплаты ────────────────────────────────────────────────────────────
export function useAcceptWorkshopPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const { data: curr } = await supabase
        .from('workshop_orders').select('paid_amount, total_amount').eq('id', id).single()
      const newPaid = (curr?.paid_amount ?? 0) + amount
      const newPayStatus: WorkshopPaymentStatus =
        newPaid >= (curr?.total_amount ?? 0) ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid'
      const { error } = await supabase.from('workshop_orders')
        .update({ paid_amount: newPaid, payment_status: newPayStatus })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: [WORKSHOP_ORDERS_KEY, 'detail', id] })
      qc.invalidateQueries({ queryKey: [WORKSHOP_ORDERS_KEY, 'list'] })
      qc.invalidateQueries({ queryKey: [WORKSHOP_ORDERS_KEY, 'stats'] })
    },
  })
}

// ── Предыдущие заказы клиента ───────────────────────────────────────────────
export function useClientWorkshopOrders(clientId: string | undefined, excludeOrderId?: string) {
  return useQuery({
    queryKey: [WORKSHOP_ORDERS_KEY, 'by-client', clientId, excludeOrderId],
    queryFn: async () => {
      let q = supabase
        .from('workshop_orders')
        .select('id, number, status, item_type_name, brand, model, total_amount, created_at')
        .eq('product', PRODUCT)
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false })
        .limit(10)
      if (excludeOrderId) q = q.neq('id', excludeOrderId)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    enabled: !!clientId,
    staleTime: 60_000,
  })
}

// ── Устройства клиента ──────────────────────────────────────────────────────
export function useClientWorkshopDevices(clientId: string | undefined) {
  return useQuery({
    queryKey: ['workshop_devices', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshop_devices').select('*')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as WorkshopDevice[]
    },
    enabled: !!clientId,
  })
}

// ── История статусов заказа ────────────────────────────────────────────────
export function useWorkshopOrderHistory(orderId: string | undefined) {
  return useQuery({
    queryKey: [WORKSHOP_ORDERS_KEY, 'history', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshop_order_history').select('*')
        .eq('order_id', orderId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!orderId,
  })
}

// ── Статистика ──────────────────────────────────────────────────────────────
export interface WorkshopOrdersStats {
  total_today: number
  revenue_today: number
  total_month: number
  revenue_month: number
  avg_check: number
  unpaid_count: number
  unpaid_amount: number
  ready_count: number
  in_progress_count: number
  overdue_count: number
}

export function useWorkshopOrdersStats() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [WORKSHOP_ORDERS_KEY, 'stats', PRODUCT],
    queryFn: async (): Promise<WorkshopOrdersStats> => {
      const { data } = await supabase
        .from('workshop_orders')
        .select('status,payment_status,total_amount,paid_amount,created_at,ready_date')
        .eq('product', PRODUCT)
        .gte('created_at', dayjs().startOf('month').toISOString())
        .not('status', 'eq', 'cancelled')
      const orders = data ?? []
      const todayStart = dayjs().startOf('day').toISOString()
      const todayOrders = orders.filter(o => o.created_at >= todayStart)
      const unpaid = orders.filter(o => (o.payment_status ?? 'unpaid') !== 'paid')
      const total_month = orders.length
      const revenue_month = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
      const now = dayjs()
      return {
        total_today: todayOrders.length,
        revenue_today: todayOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0),
        total_month,
        revenue_month,
        avg_check: total_month > 0 ? Math.round(revenue_month / total_month) : 0,
        unpaid_count: unpaid.length,
        unpaid_amount: unpaid.reduce((s, o) => s + Math.max(0, (o.total_amount ?? 0) - (o.paid_amount ?? 0)), 0),
        ready_count: orders.filter(o => o.status === 'ready').length,
        in_progress_count: orders.filter(o => ['diagnosing','in_progress','waiting_parts','waiting_approval'].includes(o.status)).length,
        overdue_count: orders.filter(o =>
          o.ready_date && dayjs(o.ready_date).isBefore(now, 'day') &&
          !['issued','paid','cancelled','refused'].includes(o.status)
        ).length,
      }
    },
    enabled: !!user,
    staleTime: 60_000,
  })
}
