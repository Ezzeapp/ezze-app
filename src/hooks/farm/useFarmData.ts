import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type {
  Farm, Animal, AnimalGroup, AnimalEvent, Field, Crop,
  FeedStockItem, FeedConsumption, ProductionRecord,
  FarmExpense, FarmEquipment, EquipmentMaintenance,
  Pasture, Incubation, AnimalSpecies, AnimalStatus,
  AnimalCostBreakdown, FarmDashboardStats, ProductionType,
  FarmExpenseCategory,
} from '@/types/farm'

const KEY = 'farm'

// ── Farm (ферма) ─────────────────────────────────────────────────
export function useCurrentFarm() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [KEY, 'current-farm', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const { data, error } = await supabase
        .from('farms').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: true }).limit(1).maybeSingle()
      if (error) throw error
      return data as Farm | null
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  })
}

export function useUpsertFarm() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: Partial<Farm> & { name: string }) => {
      if (!user?.id) throw new Error('not authenticated')
      const { data, error } = await supabase
        .from('farms')
        .upsert({ user_id: user.id, ...payload })
        .select().single()
      if (error) throw error
      return data as Farm
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

// ── Animals ──────────────────────────────────────────────────────
export function useAnimals(farmId: string | null | undefined, filters?: { species?: AnimalSpecies; groupId?: string; status?: AnimalStatus; search?: string }) {
  return useQuery({
    queryKey: [KEY, 'animals', farmId, filters],
    queryFn: async () => {
      if (!farmId) return []
      let q = supabase.from('animals').select('*, group:animal_groups(id, name)').eq('farm_id', farmId)
      if (filters?.species) q = q.eq('species', filters.species)
      if (filters?.groupId) q = q.eq('group_id', filters.groupId)
      if (filters?.status)  q = q.eq('status', filters.status)
      if (filters?.search)  q = q.or(`tag.ilike.%${filters.search}%,name.ilike.%${filters.search}%`)
      const { data, error } = await q.order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Animal[]
    },
    enabled: !!farmId,
    staleTime: 30_000,
  })
}

export function useAnimal(id: string | null | undefined) {
  return useQuery({
    queryKey: [KEY, 'animal', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('animals').select('*, group:animal_groups(id, name)').eq('id', id).single()
      if (error) throw error
      return data as Animal
    },
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useUpsertAnimal() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: Partial<Animal> & { farm_id: string; tag: string; species: AnimalSpecies }) => {
      if (!user?.id) throw new Error('not authenticated')
      const { error } = await supabase.from('animals').upsert({ master_id: user.id, ...payload })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDeleteAnimal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('animals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

// ── Animal Groups ────────────────────────────────────────────────
export function useAnimalGroups(farmId: string | null | undefined) {
  return useQuery({
    queryKey: [KEY, 'animal-groups', farmId],
    queryFn: async () => {
      if (!farmId) return []
      const { data, error } = await supabase
        .from('animal_groups').select('*').eq('farm_id', farmId).order('name')
      if (error) throw error
      return (data ?? []) as AnimalGroup[]
    },
    enabled: !!farmId,
    staleTime: 60_000,
  })
}

export function useUpsertAnimalGroup() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: Partial<AnimalGroup> & { farm_id: string; name: string; species: AnimalSpecies }) => {
      if (!user?.id) throw new Error('not authenticated')
      const { error } = await supabase.from('animal_groups').upsert({ master_id: user.id, ...payload })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDeleteAnimalGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('animal_groups').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

// ── Animal Events ────────────────────────────────────────────────
export function useAnimalEvents(params: { farmId?: string | null; animalId?: string | null; groupId?: string | null; from?: string; to?: string }) {
  return useQuery({
    queryKey: [KEY, 'animal-events', params],
    queryFn: async () => {
      let q = supabase.from('animal_events').select('*')
      if (params.farmId)   q = q.eq('farm_id', params.farmId)
      if (params.animalId) q = q.eq('animal_id', params.animalId)
      if (params.groupId)  q = q.eq('group_id', params.groupId)
      if (params.from)     q = q.gte('event_date', params.from)
      if (params.to)       q = q.lte('event_date', params.to)
      const { data, error } = await q.order('event_date', { ascending: false })
      if (error) throw error
      return (data ?? []) as AnimalEvent[]
    },
    enabled: !!(params.farmId || params.animalId || params.groupId),
    staleTime: 30_000,
  })
}

export function useAddAnimalEvent() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: Partial<AnimalEvent> & { farm_id: string; event_type: AnimalEvent['event_type'] }) => {
      if (!user?.id) throw new Error('not authenticated')
      const { error } = await supabase.from('animal_events').insert({ master_id: user.id, ...payload })
      if (error) throw error
      // Если это взвешивание — обновим current_weight_kg у животного
      if (payload.event_type === 'weighing' && payload.animal_id && payload.weight_kg) {
        await supabase.from('animals').update({ current_weight_kg: payload.weight_kg }).eq('id', payload.animal_id)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

// ── Fields ───────────────────────────────────────────────────────
export function useFields(farmId: string | null | undefined) {
  return useQuery({
    queryKey: [KEY, 'fields', farmId],
    queryFn: async () => {
      if (!farmId) return []
      const { data, error } = await supabase.from('fields').select('*').eq('farm_id', farmId).order('name')
      if (error) throw error
      return (data ?? []) as Field[]
    },
    enabled: !!farmId,
    staleTime: 60_000,
  })
}

export function useUpsertField() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: Partial<Field> & { farm_id: string; name: string; area_ha: number }) => {
      if (!user?.id) throw new Error('not authenticated')
      const { error } = await supabase.from('fields').upsert({ master_id: user.id, ...payload })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDeleteField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fields').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

// ── Crops ────────────────────────────────────────────────────────
export function useCrops(farmId: string | null | undefined, fieldId?: string) {
  return useQuery({
    queryKey: [KEY, 'crops', farmId, fieldId],
    queryFn: async () => {
      if (!farmId) return []
      let q = supabase.from('crops').select('*').eq('farm_id', farmId)
      if (fieldId) q = q.eq('field_id', fieldId)
      const { data, error } = await q.order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Crop[]
    },
    enabled: !!farmId,
    staleTime: 60_000,
  })
}

export function useUpsertCrop() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: Partial<Crop> & { farm_id: string; field_id: string; name: string }) => {
      if (!user?.id) throw new Error('not authenticated')
      const { error } = await supabase.from('crops').upsert({ master_id: user.id, ...payload })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

// ── Feed Stock ───────────────────────────────────────────────────
export function useFeedStock(farmId: string | null | undefined) {
  return useQuery({
    queryKey: [KEY, 'feed-stock', farmId],
    queryFn: async () => {
      if (!farmId) return []
      const { data, error } = await supabase.from('feed_stock').select('*').eq('farm_id', farmId).order('name')
      if (error) throw error
      return (data ?? []) as FeedStockItem[]
    },
    enabled: !!farmId,
    staleTime: 30_000,
  })
}

export function useUpsertFeedStock() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: Partial<FeedStockItem> & { farm_id: string; name: string }) => {
      if (!user?.id) throw new Error('not authenticated')
      const { error } = await supabase.from('feed_stock').upsert({ master_id: user.id, ...payload })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDeleteFeedStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('feed_stock').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useFeedConsumption(params: { farmId?: string | null; from?: string; to?: string }) {
  return useQuery({
    queryKey: [KEY, 'feed-consumption', params],
    queryFn: async () => {
      if (!params.farmId) return []
      let q = supabase.from('feed_consumption').select('*').eq('farm_id', params.farmId)
      if (params.from) q = q.gte('date', params.from)
      if (params.to)   q = q.lte('date', params.to)
      const { data, error } = await q.order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as FeedConsumption[]
    },
    enabled: !!params.farmId,
    staleTime: 30_000,
  })
}

export function useAddFeedConsumption() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: Partial<FeedConsumption> & { farm_id: string; feed_id: string; quantity: number }) => {
      if (!user?.id) throw new Error('not authenticated')
      // Списываем со склада
      const { data: stock } = await supabase.from('feed_stock').select('quantity').eq('id', payload.feed_id).single()
      if (stock) {
        const newQty = Math.max(0, (stock.quantity ?? 0) - (payload.quantity ?? 0))
        await supabase.from('feed_stock').update({ quantity: newQty }).eq('id', payload.feed_id)
      }
      const { error } = await supabase.from('feed_consumption').insert({ master_id: user.id, ...payload })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

// ── Production ───────────────────────────────────────────────────
export function useProduction(params: { farmId?: string | null; type?: ProductionType; from?: string; to?: string }) {
  return useQuery({
    queryKey: [KEY, 'production', params],
    queryFn: async () => {
      if (!params.farmId) return []
      let q = supabase.from('production').select('*').eq('farm_id', params.farmId)
      if (params.type) q = q.eq('type', params.type)
      if (params.from) q = q.gte('date', params.from)
      if (params.to)   q = q.lte('date', params.to)
      const { data, error } = await q.order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as ProductionRecord[]
    },
    enabled: !!params.farmId,
    staleTime: 30_000,
  })
}

export function useAddProduction() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: Partial<ProductionRecord> & { farm_id: string; type: ProductionType; quantity: number }) => {
      if (!user?.id) throw new Error('not authenticated')
      const { error } = await supabase.from('production').insert({ master_id: user.id, ...payload })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

// ── Farm Expenses ────────────────────────────────────────────────
export function useFarmExpenses(params: { farmId?: string | null; category?: FarmExpenseCategory; from?: string; to?: string }) {
  return useQuery({
    queryKey: [KEY, 'expenses', params],
    queryFn: async () => {
      if (!params.farmId) return []
      let q = supabase.from('farm_expenses').select('*').eq('farm_id', params.farmId)
      if (params.category) q = q.eq('category', params.category)
      if (params.from)     q = q.gte('date', params.from)
      if (params.to)       q = q.lte('date', params.to)
      const { data, error } = await q.order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as FarmExpense[]
    },
    enabled: !!params.farmId,
    staleTime: 30_000,
  })
}

export function useAddFarmExpense() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: Partial<FarmExpense> & { farm_id: string; category: FarmExpenseCategory; amount: number }) => {
      if (!user?.id) throw new Error('not authenticated')
      const { error } = await supabase.from('farm_expenses').insert({ master_id: user.id, ...payload })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDeleteFarmExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('farm_expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

// ── Equipment ────────────────────────────────────────────────────
export function useFarmEquipment(farmId: string | null | undefined) {
  return useQuery({
    queryKey: [KEY, 'equipment', farmId],
    queryFn: async () => {
      if (!farmId) return []
      const { data, error } = await supabase.from('farm_equipment').select('*').eq('farm_id', farmId).order('name')
      if (error) throw error
      return (data ?? []) as FarmEquipment[]
    },
    enabled: !!farmId,
    staleTime: 60_000,
  })
}

export function useUpsertEquipment() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: Partial<FarmEquipment> & { farm_id: string; name: string }) => {
      if (!user?.id) throw new Error('not authenticated')
      const { error } = await supabase.from('farm_equipment').upsert({ master_id: user.id, ...payload })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useEquipmentMaintenance(equipmentId: string | null | undefined) {
  return useQuery({
    queryKey: [KEY, 'equipment-maintenance', equipmentId],
    queryFn: async () => {
      if (!equipmentId) return []
      const { data, error } = await supabase
        .from('equipment_maintenance').select('*').eq('equipment_id', equipmentId).order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as EquipmentMaintenance[]
    },
    enabled: !!equipmentId,
    staleTime: 60_000,
  })
}

export function useAddMaintenance() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (payload: Partial<EquipmentMaintenance> & { farm_id: string; equipment_id: string; type: EquipmentMaintenance['type']; cost: number }) => {
      if (!user?.id) throw new Error('not authenticated')
      const { error } = await supabase.from('equipment_maintenance').insert({ master_id: user.id, ...payload })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

// ── Pastures / Incubations ───────────────────────────────────────
export function usePastures(farmId: string | null | undefined) {
  return useQuery({
    queryKey: [KEY, 'pastures', farmId],
    queryFn: async () => {
      if (!farmId) return []
      const { data, error } = await supabase.from('pastures').select('*').eq('farm_id', farmId).order('name')
      if (error) throw error
      return (data ?? []) as Pasture[]
    },
    enabled: !!farmId,
    staleTime: 60_000,
  })
}

export function useIncubations(farmId: string | null | undefined) {
  return useQuery({
    queryKey: [KEY, 'incubations', farmId],
    queryFn: async () => {
      if (!farmId) return []
      const { data, error } = await supabase.from('incubations').select('*').eq('farm_id', farmId).order('start_date', { ascending: false })
      if (error) throw error
      return (data ?? []) as Incubation[]
    },
    enabled: !!farmId,
    staleTime: 60_000,
  })
}

// ── Dashboard Stats ──────────────────────────────────────────────
export function useFarmDashboardStats(farmId: string | null | undefined) {
  return useQuery({
    queryKey: [KEY, 'stats', farmId],
    queryFn: async (): Promise<FarmDashboardStats | null> => {
      if (!farmId) return null
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)
      const [animalsRes, fieldsRes, feedRes, prodRes, expRes] = await Promise.all([
        supabase.from('animals').select('species, status').eq('farm_id', farmId),
        supabase.from('fields').select('area_ha').eq('farm_id', farmId),
        supabase.from('feed_stock').select('quantity, cost_per_unit').eq('farm_id', farmId),
        supabase.from('production').select('type, quantity, date').eq('farm_id', farmId).gte('date', since),
        supabase.from('farm_expenses').select('amount, date').eq('farm_id', farmId).gte('date', since),
      ])
      const animals = animalsRes.data ?? []
      const fields = fieldsRes.data ?? []
      const feed = feedRes.data ?? []
      const prod = prodRes.data ?? []
      const exp = expRes.data ?? []

      const animals_by_species: Record<string, number> = {}
      const active = animals.filter(a => a.status !== 'sold' && a.status !== 'slaughtered' && a.status !== 'dead')
      active.forEach(a => { animals_by_species[a.species] = (animals_by_species[a.species] ?? 0) + 1 })

      const production_last_30d: Record<string, number> = {}
      prod.forEach(p => { production_last_30d[p.type] = (production_last_30d[p.type] ?? 0) + Number(p.quantity) })

      return {
        animals_total: active.length,
        animals_by_species: animals_by_species as any,
        fields_total_ha: fields.reduce((s, f) => s + Number(f.area_ha ?? 0), 0),
        feed_stock_total_value: feed.reduce((s, f) => s + Number(f.quantity) * Number(f.cost_per_unit), 0),
        production_last_30d: production_last_30d as any,
        expenses_last_30d: exp.reduce((s, e) => s + Number(e.amount), 0),
        revenue_last_30d: 0, // TODO: подключить продажи когда появятся
      }
    },
    enabled: !!farmId,
    staleTime: 30_000,
  })
}

// ── Cost breakdown по животным ───────────────────────────────────
export function useAnimalCosts(farmId: string | null | undefined) {
  return useQuery({
    queryKey: [KEY, 'animal-costs', farmId],
    queryFn: async (): Promise<AnimalCostBreakdown[]> => {
      if (!farmId) return []
      const [animalsRes, eventsRes, feedRes, feedStockRes, expRes] = await Promise.all([
        supabase.from('animals').select('id, tag, name, acquisition_cost, group_id').eq('farm_id', farmId),
        supabase.from('animal_events').select('animal_id, event_type, cost').eq('farm_id', farmId),
        supabase.from('feed_consumption').select('animal_id, group_id, feed_id, quantity').eq('farm_id', farmId),
        supabase.from('feed_stock').select('id, cost_per_unit').eq('farm_id', farmId),
        supabase.from('farm_expenses').select('amount, animal_id, group_id').eq('farm_id', farmId),
      ])
      const animals = animalsRes.data ?? []
      const events = eventsRes.data ?? []
      const feedC = feedRes.data ?? []
      const feedS = feedStockRes.data ?? []
      const exp = expRes.data ?? []
      const feedCost = new Map<string, number>(feedS.map(f => [f.id, Number(f.cost_per_unit)]))

      // Группировка животных по group_id для аллокации группового расхода
      const animalsByGroup = new Map<string, string[]>()
      animals.forEach(a => {
        if (a.group_id) {
          const list = animalsByGroup.get(a.group_id) ?? []
          list.push(a.id)
          animalsByGroup.set(a.group_id, list)
        }
      })

      // Накопительные расходы на животное
      const perAnimal = new Map<string, { feed: number; vet: number; overhead: number }>()
      animals.forEach(a => perAnimal.set(a.id, { feed: 0, vet: 0, overhead: 0 }))

      // Корма: прямой animal_id или делим по группе
      feedC.forEach(c => {
        const cost = Number(c.quantity) * (feedCost.get(c.feed_id) ?? 0)
        if (c.animal_id && perAnimal.has(c.animal_id)) {
          perAnimal.get(c.animal_id)!.feed += cost
        } else if (c.group_id && animalsByGroup.has(c.group_id)) {
          const list = animalsByGroup.get(c.group_id)!
          const per = cost / Math.max(1, list.length)
          list.forEach(id => perAnimal.get(id)!.feed += per)
        }
      })

      // Ветеринария: события с cost, привязанные к animal_id
      events.forEach(e => {
        if (e.animal_id && perAnimal.has(e.animal_id) && e.cost) {
          perAnimal.get(e.animal_id)!.vet += Number(e.cost)
        }
      })

      // Расходы без аллокации → делим на всех (overhead)
      const directAnimalExp = new Map<string, number>()
      const directGroupExp = new Map<string, number>()
      let overheadPool = 0
      exp.forEach(e => {
        if (e.animal_id) directAnimalExp.set(e.animal_id, (directAnimalExp.get(e.animal_id) ?? 0) + Number(e.amount))
        else if (e.group_id) directGroupExp.set(e.group_id, (directGroupExp.get(e.group_id) ?? 0) + Number(e.amount))
        else overheadPool += Number(e.amount)
      })
      const overheadPerHead = animals.length > 0 ? overheadPool / animals.length : 0

      return animals.map(a => {
        const p = perAnimal.get(a.id)!
        const groupDirect = a.group_id && directGroupExp.has(a.group_id)
          ? (directGroupExp.get(a.group_id)! / (animalsByGroup.get(a.group_id!)?.length ?? 1))
          : 0
        const acquisition = Number(a.acquisition_cost ?? 0)
        const direct = directAnimalExp.get(a.id) ?? 0
        const total = acquisition + p.feed + p.vet + overheadPerHead + direct + groupDirect
        return {
          animal_id: a.id,
          tag: a.tag,
          name: a.name,
          acquisition_cost: acquisition,
          feed_cost: p.feed,
          veterinary_cost: p.vet,
          allocated_overhead: overheadPerHead + direct + groupDirect,
          total_cost: total,
          revenue: 0, // TODO
          margin: -total,
        }
      }).sort((a, b) => b.total_cost - a.total_cost)
    },
    enabled: !!farmId,
    staleTime: 60_000,
  })
}
