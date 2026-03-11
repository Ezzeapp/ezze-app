import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getFileUrl, uploadFile } from '@/lib/storage'
import type { MasterProfile } from '@/types'

export const PROFILE_KEY = 'master_profile'

export function useProfile() {
  const { user } = useAuth()

  return useQuery({
    queryKey: [PROFILE_KEY, user?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('master_profiles')
          .select('*')
          .eq('user_id', user!.id)
          .single()
        if (error) return null
        return data as MasterProfile
      } catch {
        return null
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
  })
}

export function useUpsertProfile() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Record<string, any> }) => {
      let payload = { ...data }

      // Handle avatar file upload
      if ('_avatarFile' in payload) {
        const file: File | null = payload._avatarFile
        delete payload._avatarFile
        if (file) {
          const path = await uploadFile('avatars', `${user!.id}/avatar`, file)
          payload.avatar = path
        } else {
          payload.avatar = null
        }
      }

      // Handle portfolio file uploads
      if ('_portfolioFiles' in payload) {
        const files: File[] = payload._portfolioFiles ?? []
        delete payload._portfolioFiles
        if (files.length > 0) {
          const paths = await Promise.all(
            files.map(f => uploadFile('portfolio', `${user!.id}/${f.name}`, f))
          )
          payload.portfolio = [...(payload.portfolio ?? []), ...paths]
        }
      }

      if (id) {
        const { data: updated, error } = await supabase
          .from('master_profiles')
          .update(payload)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return updated as MasterProfile
      } else {
        const { data: created, error } = await supabase
          .from('master_profiles')
          .insert({ ...payload, user_id: user!.id })
          .select()
          .single()
        if (error) throw error
        return created as MasterProfile
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROFILE_KEY] })
    },
  })
}

/** Returns a public URL for a profile avatar stored in the avatars bucket */
export function getProfileAvatarUrl(profile: MasterProfile | null | undefined): string {
  if (!profile?.avatar) return ''
  return getFileUrl('avatars', profile.avatar)
}

/** Returns a public URL for a portfolio image stored in the portfolio bucket */
export function getPortfolioFileUrl(path: string): string {
  return getFileUrl('portfolio', path)
}
