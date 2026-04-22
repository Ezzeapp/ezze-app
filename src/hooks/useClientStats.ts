import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PRODUCT } from '@/lib/config'
import type { Appointment } from '@/types'

export interface ClientStats {
  totalVisits: number
  completedVisits: number
  cancelledVisits: number
  noShowVisits: number
  totalSpent: number
  lastVisit: string | null
  firstVisit: string | null
  appointments: Appointment[]
}

export function useClientStats(clientId: string, clientName?: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['client_stats', clientId, clientName, PRODUCT],
    queryFn: async (): Promise<ClientStats> => {

      // ── Cleaning: считаем из cleaning_orders ──────────────────────────────
      if (PRODUCT === 'cleaning') {
        const { data } = await supabase
          .from('cleaning_orders')
          .select('id, status, payment_status, total_amount, created_at')
          .eq('client_id', clientId)
          .eq('product', PRODUCT)
          .order('created_at', { ascending: true })

        const orders = data ?? []
        const completed = orders.filter(o => o.status === 'issued' || o.status === 'paid')
        const cancelled = orders.filter(o => o.status === 'cancelled')
        const totalSpent = orders
          .filter(o => o.payment_status === 'paid')
          .reduce((sum, o) => sum + (o.total_amount || 0), 0)

        return {
          totalVisits:     orders.length,
          completedVisits: completed.length,
          cancelledVisits: cancelled.length,
          noShowVisits:    0,
          totalSpent,
          firstVisit: orders.length ? orders[0].created_at.slice(0, 10) : null,
          lastVisit:  orders.length ? orders[orders.length - 1].created_at.slice(0, 10) : null,
          appointments: [],
        }
      }

      // ── Остальные продукты: appointments ──────────────────────────────────
      // Query 1: by client_id relation
      const { data: byRelation } = await supabase
        .from('appointments')
        .select('*, service:services(*)')
        .eq('master_id', user!.id)
        .eq('client_id', clientId)
        .order('date', { ascending: false })
        .order('start_time', { ascending: false })

      // Query 2: by client_name (if name provided) — for guest bookings
      let byName: Appointment[] = []
      if (clientName) {
        const { data: nameData } = await supabase
          .from('appointments')
          .select('*, service:services(*)')
          .eq('master_id', user!.id)
          .is('client_id', null)
          .eq('client_name', clientName)
          .order('date', { ascending: false })
          .order('start_time', { ascending: false })
        byName = (nameData ?? []) as Appointment[]
      }

      // Merge, deduplicate by id
      const seen = new Set<string>()
      const appointments = [...(byRelation ?? []) as Appointment[], ...byName].filter(a => {
        if (seen.has(a.id)) return false
        seen.add(a.id)
        return true
      }).sort((a, b) => {
        const d = b.date.localeCompare(a.date)
        return d !== 0 ? d : b.start_time.localeCompare(a.start_time)
      })

      const completed = appointments.filter((a) => a.status === 'done')
      const cancelled = appointments.filter((a) => a.status === 'cancelled')
      const noShow = appointments.filter((a) => a.status === 'no_show')
      const totalSpent = completed.reduce((sum, a) => sum + (a.price || 0), 0)
      const sorted = [...appointments].sort((a, b) => a.date.localeCompare(b.date))

      return {
        totalVisits: appointments.length,
        completedVisits: completed.length,
        cancelledVisits: cancelled.length,
        noShowVisits: noShow.length,
        totalSpent,
        lastVisit: sorted.length ? sorted[sorted.length - 1].date : null,
        firstVisit: sorted.length ? sorted[0].date : null,
        appointments,
      }
    },
    enabled: !!clientId && (PRODUCT === 'cleaning' || !!user),
  })
}
