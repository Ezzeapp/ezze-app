import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { generateInviteCode } from '@/lib/utils'
import { SERVICES_KEY, CATEGORIES_KEY } from './useServices'
import { INVENTORY_KEY } from './useInventory'
import { SERVICE_MATERIALS_KEY } from './useServiceMaterials'
import type {
  CopySnapshot,
  CopySnapshotData,
  ImportResult,
} from '@/types'

export const COPY_SNAPSHOTS_KEY = 'copy_snapshots'

export type ImportStrategy = 'skip' | 'replace'

export interface ImportOptions {
  includeServices: boolean
  includeInventory: boolean
  strategy: ImportStrategy
}

// ── Получить активный снимок текущего мастера ─────────────────────────────────

export function useMyCopySnapshot() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [COPY_SNAPSHOTS_KEY, 'mine', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('copy_snapshots')
        .select('*')
        .eq('source_user_id', user!.id)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()
      return (data as CopySnapshot | null) ?? null
    },
    enabled: !!user,
  })
}

// ── Создать снимок (мастер А) ─────────────────────────────────────────────────

export function useCreateCopySnapshot() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async () => {
      // 1. Параллельно читаем все данные мастера
      const [
        { data: categories },
        { data: services },
        { data: inventory },
        { data: materials },
      ] = await Promise.all([
        supabase.from('service_categories').select('*').eq('master_id', user!.id).order('order').order('name'),
        supabase.from('services').select('*').eq('master_id', user!.id).order('order').order('name'),
        supabase.from('inventory_items').select('*').eq('master_id', user!.id).order('name'),
        supabase.from('service_materials').select('*, service:services!inner(master_id)').eq('service.master_id', user!.id),
      ])

      // 2. Деактивируем старый снимок (если есть)
      const { data: existing } = await supabase
        .from('copy_snapshots')
        .select('id')
        .eq('source_user_id', user!.id)
        .eq('used', false)
        .maybeSingle()
      if (existing) {
        await supabase.from('copy_snapshots').update({ used: true }).eq('id', existing.id)
      }

      // 3. Формируем payload
      const token = generateInviteCode(12)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 1) // 24 часа

      const data: CopySnapshotData = {
        service_categories: (categories ?? []).map((c: any) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          order: c.order,
        })),
        services: (services ?? []).map((s: any) => ({
          id: s.id,
          category_id: s.category_id,
          name: s.name,
          description: s.description,
          duration_min: s.duration_min,
          price: s.price,
          price_max: s.price_max,
          is_active: s.is_active,
          is_bookable: s.is_bookable,
          order: s.order,
        })),
        service_materials: (materials ?? []).map((m: any) => ({
          service_id: m.service_id,
          inventory_item_id: m.inventory_item_id,
          quantity: m.quantity,
        })),
        inventory_items: (inventory ?? []).map((i: any) => ({
          id: i.id,
          name: i.name,
          sku: i.sku,
          category: i.category,
          description: i.description,
          unit: i.unit,
          quantity: i.quantity,
          min_quantity: i.min_quantity,
          cost_price: i.cost_price,
          sell_price: i.sell_price,
          supplier: i.supplier,
        })),
      }

      const { data: snapshot, error } = await supabase
        .from('copy_snapshots')
        .insert({
          source_user_id: user!.id,
          token,
          data,
          expires_at: expiresAt.toISOString(),
          used: false,
        })
        .select()
        .single()
      if (error) throw error
      return snapshot as CopySnapshot
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COPY_SNAPSHOTS_KEY, 'mine'] })
    },
  })
}

// ── Отозвать снимок (мастер А) ───────────────────────────────────────────────

export function useRevokeCopySnapshot() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('copy_snapshots')
        .update({ used: true })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COPY_SNAPSHOTS_KEY, 'mine', user?.id] })
    },
  })
}

// ── Получить снимок по токену (мастер Б) ─────────────────────────────────────

export function useFetchSnapshotByToken() {
  return useMutation({
    mutationFn: async (token: string): Promise<CopySnapshot | null> => {
      const { data } = await supabase
        .from('copy_snapshots')
        .select('*')
        .eq('token', token.trim().toLowerCase())
        .eq('used', false)
        .maybeSingle()
      if (!data) return null
      if (new Date(data.expires_at) < new Date()) return null
      return data as CopySnapshot
    },
  })
}

// ── Импортировать данные из снимка (мастер Б) ────────────────────────────────

export function useImportFromSnapshot() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      snapshot,
      options,
      onProgress,
    }: {
      snapshot: CopySnapshot
      options: ImportOptions
      onProgress?: (step: string) => void
    }): Promise<ImportResult> => {
      const result: ImportResult = {
        categoriesAdded: 0,
        categoriesReplaced: 0,
        categoriesSkipped: 0,
        servicesAdded: 0,
        servicesReplaced: 0,
        servicesSkipped: 0,
        materialsAdded: 0,
        inventoryAdded: 0,
        inventoryReplaced: 0,
        inventorySkipped: 0,
      }

      const data = snapshot.data
      // Маппинги: old_id → new_id (нужны для связей)
      const catIdMap: Record<string, string> = {}
      const invIdMap: Record<string, string> = {}
      const svcIdMap: Record<string, string> = {}

      // ── ШАГ 1: Склад (сначала! нужен для service_materials) ────────────────
      if (options.includeInventory && data.inventory_items.length > 0) {
        onProgress?.('inventory')

        const { data: existingInv } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('master_id', user!.id)
        const byName = new Map((existingInv ?? []).map((i: any) => [i.name.toLowerCase(), i]))

        for (const item of data.inventory_items) {
          const existing = byName.get(item.name.toLowerCase())
          if (existing) {
            if (options.strategy === 'replace') {
              await supabase.from('inventory_items').update({
                sku: item.sku,
                category: item.category,
                description: item.description,
                unit: item.unit,
                quantity: item.quantity,
                min_quantity: item.min_quantity,
                cost_price: item.cost_price,
                sell_price: item.sell_price,
                supplier: item.supplier,
              }).eq('id', (existing as any).id)
              result.inventoryReplaced++
            } else {
              result.inventorySkipped++
            }
            invIdMap[item.id] = (existing as any).id
          } else {
            const { data: created } = await supabase.from('inventory_items').insert({
              master_id: user!.id,
              name: item.name,
              sku: item.sku,
              category: item.category,
              description: item.description,
              unit: item.unit,
              quantity: item.quantity,
              min_quantity: item.min_quantity,
              cost_price: item.cost_price,
              sell_price: item.sell_price,
              supplier: item.supplier,
            }).select().single()
            if (created) {
              invIdMap[item.id] = (created as any).id
              result.inventoryAdded++
            }
          }
        }
      }

      // ── ШАГ 2: Категории услуг ─────────────────────────────────────────────
      if (options.includeServices && data.service_categories.length > 0) {
        onProgress?.('categories')

        const { data: existingCats } = await supabase
          .from('service_categories')
          .select('*')
          .eq('master_id', user!.id)
        const byName = new Map((existingCats ?? []).map((c: any) => [c.name.toLowerCase(), c]))

        for (const cat of data.service_categories) {
          const existing = byName.get(cat.name.toLowerCase())
          if (existing) {
            if (options.strategy === 'replace') {
              await supabase.from('service_categories').update({
                color: cat.color,
                order: cat.order,
              }).eq('id', (existing as any).id)
              result.categoriesReplaced++
            } else {
              result.categoriesSkipped++
            }
            catIdMap[cat.id] = (existing as any).id
          } else {
            const { data: created } = await supabase.from('service_categories').insert({
              master_id: user!.id,
              name: cat.name,
              color: cat.color,
              order: cat.order,
            }).select().single()
            if (created) {
              catIdMap[cat.id] = (created as any).id
              result.categoriesAdded++
            }
          }
        }
      }

      // ── ШАГ 3: Услуги ─────────────────────────────────────────────────────
      if (options.includeServices && data.services.length > 0) {
        onProgress?.('services')

        const { data: existingSvcs } = await supabase
          .from('services')
          .select('*')
          .eq('master_id', user!.id)
        const byName = new Map((existingSvcs ?? []).map((s: any) => [s.name.toLowerCase(), s]))

        for (const svc of data.services) {
          const existing = byName.get(svc.name.toLowerCase())
          const newCategoryId = svc.category_id ? catIdMap[svc.category_id] : undefined

          if (existing) {
            if (options.strategy === 'replace') {
              await supabase.from('services').update({
                category_id: newCategoryId ?? null,
                description: svc.description,
                duration_min: svc.duration_min,
                price: svc.price,
                price_max: svc.price_max,
                is_active: svc.is_active,
                is_bookable: svc.is_bookable,
                order: svc.order,
              }).eq('id', (existing as any).id)
              result.servicesReplaced++
            } else {
              result.servicesSkipped++
            }
            svcIdMap[svc.id] = (existing as any).id
          } else {
            const { data: created } = await supabase.from('services').insert({
              master_id: user!.id,
              category_id: newCategoryId ?? null,
              name: svc.name,
              description: svc.description,
              duration_min: svc.duration_min,
              price: svc.price,
              price_max: svc.price_max,
              is_active: svc.is_active,
              is_bookable: svc.is_bookable,
              order: svc.order,
            }).select().single()
            if (created) {
              svcIdMap[svc.id] = (created as any).id
              result.servicesAdded++
            }
          }
        }
      }

      // ── ШАГ 4: Материалы к услугам (только для новых услуг) ───────────────
      if (options.includeServices && data.service_materials.length > 0) {
        onProgress?.('materials')

        for (const mat of data.service_materials) {
          const newSvcId = svcIdMap[mat.service_id]
          const newInvId = invIdMap[mat.inventory_item_id]
          // Создаём только если обе стороны связи доступны
          if (newSvcId && newInvId) {
            try {
              await supabase.from('service_materials').insert({
                service_id: newSvcId,
                inventory_item_id: newInvId,
                quantity: mat.quantity,
              })
              result.materialsAdded++
            } catch { /* пропускаем дубликат */ }
          }
        }
      }

      // ── ШАГ 5: Помечаем снимок использованным ─────────────────────────────
      onProgress?.('done')
      await supabase.from('copy_snapshots').update({ used: true }).eq('id', snapshot.id)

      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICES_KEY] })
      queryClient.invalidateQueries({ queryKey: [CATEGORIES_KEY] })
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY] })
      queryClient.invalidateQueries({ queryKey: [SERVICE_MATERIALS_KEY] })
    },
  })
}
