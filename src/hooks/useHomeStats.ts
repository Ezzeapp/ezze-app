import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import { useAuth } from '@/contexts/AuthContext'
import dayjs from 'dayjs'

export interface HomeStats {
  ordersActive: number          // received | in_progress | ready
  ordersInIntake: number        // received
  ordersReady: number           // ready
  ordersInProgress: number      // in_progress
  clientsTotal: number
  clientsNewWeek: number
  deliveriesToday: number       // delivery_date = today
  suppliesLow: number           // quantity < min_quantity
  revenueMonth: number          // sum total_amount, current month
  revenuePrevMonth: number
  revenueGrowthPct: number | null
}

const EMPTY: HomeStats = {
  ordersActive: 0,
  ordersInIntake: 0,
  ordersReady: 0,
  ordersInProgress: 0,
  clientsTotal: 0,
  clientsNewWeek: 0,
  deliveriesToday: 0,
  suppliesLow: 0,
  revenueMonth: 0,
  revenuePrevMonth: 0,
  revenueGrowthPct: null,
}

/**
 * Сводная статистика для главного экрана.
 * Используется в hybrid_light/dense/bento. Для cleaning — count-запросы по
 * cleaning_orders, clients, cleaning_supplies + reduce для выручки.
 */
export function useHomeStats() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['home_stats', PRODUCT, user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<HomeStats> => {
      if (PRODUCT !== 'cleaning') return EMPTY

      const today = dayjs().format('YYYY-MM-DD')
      const monthStart = dayjs().startOf('month').format('YYYY-MM-DD')
      const prevMonthStart = dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD')
      const weekAgo = dayjs().subtract(7, 'day').toISOString()

      const [
        intakeRes,
        progressRes,
        readyRes,
        deliveriesRes,
        clientsTotalRes,
        clientsWeekRes,
        suppliesRes,
        revMonthRes,
        revPrevRes,
      ] = await Promise.all([
        supabase.from('cleaning_orders').select('id', { count: 'exact', head: true })
          .eq('product', PRODUCT).eq('status', 'received'),
        supabase.from('cleaning_orders').select('id', { count: 'exact', head: true })
          .eq('product', PRODUCT).eq('status', 'in_progress'),
        supabase.from('cleaning_orders').select('id', { count: 'exact', head: true })
          .eq('product', PRODUCT).eq('status', 'ready'),
        supabase.from('cleaning_orders').select('id', { count: 'exact', head: true })
          .eq('product', PRODUCT).eq('delivery_date', today),
        supabase.from('clients').select('id', { count: 'exact', head: true })
          .eq('master_id', user!.id),
        supabase.from('clients').select('id', { count: 'exact', head: true })
          .eq('master_id', user!.id).gte('created_at', weekAgo),
        supabase.from('cleaning_supplies').select('quantity, min_quantity')
          .eq('product', PRODUCT),
        supabase.from('cleaning_orders').select('total_amount')
          .eq('product', PRODUCT).neq('status', 'cancelled')
          .gte('created_at', `${monthStart}T00:00:00`),
        supabase.from('cleaning_orders').select('total_amount')
          .eq('product', PRODUCT).neq('status', 'cancelled')
          .gte('created_at', `${prevMonthStart}T00:00:00`)
          .lt('created_at', `${monthStart}T00:00:00`),
      ])

      const ordersInIntake = intakeRes.count ?? 0
      const ordersInProgress = progressRes.count ?? 0
      const ordersReady = readyRes.count ?? 0
      const ordersActive = ordersInIntake + ordersInProgress + ordersReady

      const suppliesLow = (suppliesRes.data ?? []).filter(
        s => Number(s.quantity ?? 0) < Number(s.min_quantity ?? 0)
      ).length

      const revenueMonth = (revMonthRes.data ?? []).reduce(
        (sum, o) => sum + Number(o.total_amount ?? 0), 0
      )
      const revenuePrevMonth = (revPrevRes.data ?? []).reduce(
        (sum, o) => sum + Number(o.total_amount ?? 0), 0
      )
      const revenueGrowthPct = revenuePrevMonth > 0
        ? Math.round(((revenueMonth - revenuePrevMonth) / revenuePrevMonth) * 100)
        : null

      return {
        ordersActive,
        ordersInIntake,
        ordersReady,
        ordersInProgress,
        clientsTotal: clientsTotalRes.count ?? 0,
        clientsNewWeek: clientsWeekRes.count ?? 0,
        deliveriesToday: deliveriesRes.count ?? 0,
        suppliesLow,
        revenueMonth,
        revenuePrevMonth,
        revenueGrowthPct,
      }
    },
  })
}
