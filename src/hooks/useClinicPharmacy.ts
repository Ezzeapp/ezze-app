import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ClinicPharmacyItem, ClinicPharmacyReceipt } from '@/types'
import dayjs from 'dayjs'

export const CLINIC_PHARMACY_KEY = 'clinic_pharmacy'

export function useClinicPharmacyItems(search?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [CLINIC_PHARMACY_KEY, user?.id, search],
    queryFn: async () => {
      if (!user) return []
      let q = supabase
        .from('clinic_pharmacy_items')
        .select('*')
        .eq('master_id', user.id)
        .order('name', { ascending: true })
      if (search) q = q.ilike('name', `%${search}%`)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ClinicPharmacyItem[]
    },
    enabled: !!user,
    staleTime: 60_000,
  })
}

export function useCreatePharmacyItem() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: Partial<ClinicPharmacyItem> & { name: string }) => {
      const { error } = await supabase
        .from('clinic_pharmacy_items')
        .insert({ ...payload, master_id: user!.id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_PHARMACY_KEY] }),
  })
}

export function useUpdatePharmacyItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ClinicPharmacyItem> & { id: string }) => {
      const { error } = await supabase.from('clinic_pharmacy_items').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_PHARMACY_KEY] }),
  })
}

export function useDeletePharmacyItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clinic_pharmacy_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_PHARMACY_KEY] }),
  })
}

export function useCreatePharmacyReceipt() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: {
      item_id: string
      quantity: number
      cost_price?: number | null
      supplier?: string | null
      batch_number?: string | null
      expiry_date?: string | null
      date?: string
      notes?: string | null
    }) => {
      // 1. Insert receipt
      const { error: rErr } = await supabase
        .from('clinic_pharmacy_receipts')
        .insert({ ...payload, master_id: user!.id })
      if (rErr) throw rErr

      // 2. Get current item qty
      const { data: item, error: iErr } = await supabase
        .from('clinic_pharmacy_items')
        .select('quantity, expiry_date')
        .eq('id', payload.item_id)
        .single()
      if (iErr) throw iErr

      // 3. Update qty + expiry
      const update: Record<string, unknown> = { quantity: (item.quantity || 0) + payload.quantity }
      if (payload.expiry_date && (!item.expiry_date || payload.expiry_date < item.expiry_date)) {
        update.expiry_date = payload.expiry_date
      }
      if (payload.cost_price != null) update.cost_price = payload.cost_price

      const { error: uErr } = await supabase
        .from('clinic_pharmacy_items')
        .update(update)
        .eq('id', payload.item_id)
      if (uErr) throw uErr
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLINIC_PHARMACY_KEY] }),
  })
}

export function usePharmacyReceipts(itemId?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [CLINIC_PHARMACY_KEY, 'receipts', user?.id, itemId],
    queryFn: async () => {
      if (!user) return []
      let q = supabase
        .from('clinic_pharmacy_receipts')
        .select('*, item:clinic_pharmacy_items(name)')
        .eq('master_id', user.id)
        .order('date', { ascending: false })
      if (itemId) q = q.eq('item_id', itemId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ClinicPharmacyReceipt[]
    },
    enabled: !!user,
    staleTime: 30_000,
  })
}

export function usePharmacyStats() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [CLINIC_PHARMACY_KEY, 'stats', user?.id],
    queryFn: async () => {
      if (!user) return { lowStock: 0, outOfStock: 0, expiringSoon: 0, totalValue: 0 }
      const { data, error } = await supabase
        .from('clinic_pharmacy_items')
        .select('quantity, min_quantity, cost_price, expiry_date')
        .eq('master_id', user.id)
      if (error) throw error

      const soon = dayjs().add(30, 'day').format('YYYY-MM-DD')
      let lowStock = 0, outOfStock = 0, expiringSoon = 0, totalValue = 0
      for (const item of data ?? []) {
        if (item.quantity <= 0) outOfStock++
        else if (item.min_quantity > 0 && item.quantity <= item.min_quantity) lowStock++
        if (item.expiry_date && item.expiry_date <= soon && item.quantity > 0) expiringSoon++
        totalValue += (item.quantity || 0) * (item.cost_price || 0)
      }
      return { lowStock, outOfStock, expiringSoon, totalValue }
    },
    enabled: !!user,
    staleTime: 60_000,
  })
}
