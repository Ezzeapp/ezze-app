import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { CLIENTS_KEY } from './useClients'

export function useClientsRealtime() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`clients:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
          filter: `master_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, queryClient])
}
