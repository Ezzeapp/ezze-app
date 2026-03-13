import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { APPOINTMENTS_KEY } from './useAppointments'

export function useAppointmentsRealtime() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`appointments:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `master_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] })
          queryClient.invalidateQueries({ queryKey: ['client_stats'] })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, queryClient])
}
