import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { InventoryReceipt } from '@/types'

export const RECEIPTS_KEY = 'inventory_receipts'

export function useInventoryReceipts(itemId?: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: [RECEIPTS_KEY, user?.id, itemId],
    queryFn: async () => {
      let query = supabase
        .from('inventory_receipts')
        .select('*, inventory_item:inventory_items(*)')
        .eq('master_id', user!.id)
        .order('date', { ascending: false })

      if (itemId) {
        query = query.eq('inventory_item_id', itemId)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as InventoryReceipt[]
    },
    enabled: !!user,
  })
}

export function useCreateReceipt() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (data: {
      inventory_item_id: string
      date: string
      quantity: number
      cost_price?: number
      supplier?: string
      note?: string
    }) => {
      const { data: receipt, error: receiptErr } = await supabase
        .from('inventory_receipts')
        .insert({ ...data, master_id: user!.id })
        .select()
        .single()
      if (receiptErr) throw receiptErr

      // Increment item quantity
      const { data: item, error: itemErr } = await supabase
        .from('inventory_items')
        .select('quantity, cost_price, supplier')
        .eq('id', data.inventory_item_id)
        .single()
      if (itemErr) throw itemErr

      const { error: updateErr } = await supabase
        .from('inventory_items')
        .update({
          quantity: (item.quantity || 0) + data.quantity,
          cost_price: data.cost_price ?? item.cost_price,
          supplier: data.supplier ?? item.supplier,
        })
        .eq('id', data.inventory_item_id)
      if (updateErr) throw updateErr

      return receipt as InventoryReceipt
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECEIPTS_KEY] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}

export function useDeleteReceipt() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('inventory_receipts')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECEIPTS_KEY] })
    },
  })
}
