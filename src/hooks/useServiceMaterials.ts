import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ServiceMaterial } from '@/types'

export const SERVICE_MATERIALS_KEY = 'service_materials'

export function useAllServiceMaterials() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [SERVICE_MATERIALS_KEY, 'all', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_materials')
        .select('*, inventory_item:inventory_items(*), service:services!inner(master_id)')
        .eq('service.master_id', user!.id)
      if (error) throw error
      return (data ?? []).map((m: any) => ({ ...m, expand: { inventory_item: m.inventory_item } })) as ServiceMaterial[]
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  })
}

export function useServiceMaterials(serviceId: string) {
  return useQuery({
    queryKey: [SERVICE_MATERIALS_KEY, serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_materials')
        .select('*, inventory_item:inventory_items(*)')
        .eq('service_id', serviceId)
      if (error) throw error
      return (data ?? []).map((m: any) => ({ ...m, expand: { inventory_item: m.inventory_item } })) as ServiceMaterial[]
    },
    enabled: !!serviceId,
    staleTime: 5 * 60_000,
  })
}

export function useCreateServiceMaterial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { service_id: string; inventory_item_id: string; quantity: number }) => {
      const { data: created, error } = await supabase
        .from('service_materials')
        .insert(data)
        .select()
        .single()
      if (error) throw error
      return created as ServiceMaterial
    },
    onSuccess: (_, vars) =>
      queryClient.invalidateQueries({ queryKey: [SERVICE_MATERIALS_KEY, vars.service_id] }),
  })
}

export function useUpdateServiceMaterial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ServiceMaterial> }) => {
      const { data: updated, error } = await supabase
        .from('service_materials')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return updated as ServiceMaterial
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [SERVICE_MATERIALS_KEY] }),
  })
}

export function useDeleteServiceMaterial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, serviceId }: { id: string; serviceId: string }) => {
      const { error } = await supabase
        .from('service_materials')
        .delete()
        .eq('id', id)
      if (error) throw error
      return serviceId
    },
    onSuccess: (serviceId) =>
      queryClient.invalidateQueries({ queryKey: [SERVICE_MATERIALS_KEY, serviceId] }),
  })
}
