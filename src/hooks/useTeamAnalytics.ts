import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Appointment, TeamMember, TeamMemberStats } from '@/types'

// ── Аналитика команды (для владельца) ────────────────────────────────────────
//
// Запрашивает записи всех участников команды за период.
// Делаем N+1 запросов: по одному на каждого участника.
// Это нормально при малом числе участников (2–20 мастеров).

export interface TeamAnalyticsResult {
  stats: TeamMemberStats[]          // по одному на каждого участника
  totalRevenue: number
  totalAppts: number
  totalDone: number
}

interface FetchOptions {
  teamId: string
  members: TeamMember[]          // участники команды (уже загружены)
  start: string                  // YYYY-MM-DD
  end: string                    // YYYY-MM-DD
}

type ApptSummary = Pick<Appointment, 'id' | 'status' | 'price' | 'date'>

async function fetchMemberAppointments(
  userId: string,
  start: string,
  end: string,
): Promise<ApptSummary[]> {
  const { data } = await supabase
    .from('appointments')
    .select('id, master_id, status, price, date')
    .eq('master_id', userId)
    .gte('date', start)
    .lte('date', end)
  return (data ?? []) as unknown as ApptSummary[]
}

async function fetchTeamAnalytics({
  members,
  start,
  end,
}: FetchOptions): Promise<TeamAnalyticsResult> {
  const stats: TeamMemberStats[] = []

  // Параллельные запросы для всех участников
  const results = await Promise.all(
    members.map(async (member) => {
      const userId = (member as any).user_id ?? (member as any).user
      const memberUser = (member as any).user
      const appts = await fetchMemberAppointments(userId, start, end)

      const done = appts.filter(a => a.status === 'done')
      const revenue = done.reduce((s, a) => s + (a.price || 0), 0)
      const avgCheck = done.length > 0 ? revenue / done.length : 0

      return {
        userId,
        userName: memberUser?.name ?? userId,
        userAvatar: memberUser?.avatar,
        revenue,
        appointmentCount: appts.length,
        doneCount: done.length,
        avgCheck,
      } satisfies TeamMemberStats
    })
  )

  stats.push(...results)
  stats.sort((a, b) => b.revenue - a.revenue)

  const totalRevenue = stats.reduce((s, m) => s + m.revenue, 0)
  const totalAppts = stats.reduce((s, m) => s + m.appointmentCount, 0)
  const totalDone = stats.reduce((s, m) => s + m.doneCount, 0)

  return { stats, totalRevenue, totalAppts, totalDone }
}

export function useTeamAnalytics(
  teamId: string,
  members: TeamMember[],
  start: string,
  end: string,
) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['team_analytics', teamId, start, end],
    queryFn: () =>
      fetchTeamAnalytics({ teamId, members, start, end }),
    enabled: !!teamId && !!user && members.length > 0 && !!start && !!end,
    staleTime: 2 * 60_000,
  })
}
