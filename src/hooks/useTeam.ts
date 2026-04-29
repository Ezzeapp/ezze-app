import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { uploadFile, uploadImage } from '@/lib/storage'
import { useAuth } from '@/contexts/AuthContext'
import { PRODUCT } from '@/lib/config'
import type { Team, TeamMember, TeamRole } from '@/types'

export const TEAM_KEY = 'team'
export const TEAM_MEMBERS_KEY = 'team_members'

// ── Моя команда + роль ───────────────────────────────────────────────────────

export interface MyTeamResult {
  team: Team | null
  role: TeamRole
  isOwner: boolean
  isMember: boolean
}

export function useMyTeam() {
  const { user } = useAuth()

  return useQuery({
    queryKey: [TEAM_KEY, user?.id],
    queryFn: async (): Promise<MyTeamResult> => {
      if (!user) return { team: null, role: null, isOwner: false, isMember: false }

      // 1. Проверяем — является ли пользователь владельцем команды
      const { data: ownedTeam } = await supabase
        .from('teams')
        .select('*, owner:users(*)')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (ownedTeam) {
        const t = { ...ownedTeam, expand: { owner: (ownedTeam as any).owner } } as Team
        return { team: t, role: 'owner', isOwner: true, isMember: false }
      }

      // 2. Проверяем — является ли участником команды
      const { data: membership } = await supabase
        .from('team_members')
        .select('*, team:teams(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      if (membership) {
        const team = (membership as any).team ?? null
        return { team, role: 'member', isOwner: false, isMember: true }
      }

      return { team: null, role: null, isOwner: false, isMember: false }
    },
    enabled: !!user,
    staleTime: 5 * 60_000, // 5 минут кэш
  })
}

// ── Команда по slug (публичная, без auth) ────────────────────────────────────

export function useTeamBySlug(slug: string) {
  return useQuery({
    queryKey: [TEAM_KEY, 'slug', slug],
    queryFn: async () => {
      const { data } = await supabase
        .from('teams')
        .select('id, name, slug, description, logo, is_public, currency, owner_id, created_at, updated_at, owner:users(*)')
        .eq('slug', slug)
        .eq('is_public', true)
        .maybeSingle()
      if (!data) return null
      return { ...data, expand: { owner: (data as any).owner } } as unknown as Team
    },
    enabled: !!slug,
    staleTime: 5 * 60_000,
  })
}

// ── Участники команды (публичный, для страницы записи команды) ───────────────

export function usePublicTeamMembers(teamId: string) {
  return useQuery({
    queryKey: ['public_team_members', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, team_id, user_id, role, status, joined_at, user:users(*)')
        .eq('team_id', teamId)
        .eq('status', 'active')
        .order('joined_at')
      if (error) throw error
      return (data ?? []).map((m: any) => ({ ...m, expand: { user: m.user } })) as TeamMember[]
    },
    enabled: !!teamId,
    staleTime: 2 * 60_000,
  })
}

// ── Участники команды (для владельца) ────────────────────────────────────────

export function useTeamMembers(teamId: string) {
  const queryClient = useQueryClient()

  // Realtime: мгновенное обновление при изменении участников
  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`team_members_${teamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_members', filter: `team_id=eq.${teamId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: [TEAM_MEMBERS_KEY, teamId] })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [teamId, queryClient])

  return useQuery({
    queryKey: [TEAM_MEMBERS_KEY, teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*, user:users(*)')
        .eq('team_id', teamId)
        .neq('status', 'removed')
        .order('joined_at')
      if (error) throw error
      return (data ?? []).map((m: any) => ({ ...m, expand: { user: m.user } })) as TeamMember[]
    },
    enabled: !!teamId,
    staleTime: 5 * 60_000,
  })
}

// ── Создать команду ──────────────────────────────────────────────────────────

export function useCreateTeam() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (data: { name: string; slug: string; description?: string }) => {
      // DIAG: дамп всех id-источников для отладки RLS-несоответствия
      const { data: { user: authUser } } = await supabase.auth.getUser()
      // eslint-disable-next-line no-console
      console.log('[team-diag] before-insert', {
        appUserId: user?.id,
        authUid: authUser?.id,
        match: user?.id === authUser?.id,
        product: PRODUCT,
      })

      const { data: team, error } = await supabase
        .from('teams')
        .insert({
          ...data,
          owner_id: user!.id,
          is_public: false,
          currency: 'UZS',
          product: PRODUCT,
        })
        .select()
        .single()
      if (error) throw error

      // DIAG: сразу читаем то что вставили — если RLS режет SELECT, count=0
      const { data: check, count } = await supabase
        .from('teams')
        .select('id, owner_id, name, product', { count: 'exact' })
        .eq('id', (team as any).id)
      // eslint-disable-next-line no-console
      console.log('[team-diag] post-insert read', {
        insertedId: (team as any).id,
        rowsReadable: count,
        row: check?.[0],
      })

      // DIAG: read-by-owner — то что делает useMyTeam
      const { data: byOwner, count: countOwner } = await supabase
        .from('teams')
        .select('id, owner_id, name', { count: 'exact' })
        .eq('owner_id', user!.id)
      // eslint-disable-next-line no-console
      console.log('[team-diag] read-by-owner_id', {
        ownerId: user?.id,
        rowsFound: countOwner,
        rows: byOwner,
      })

      return team as Team
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEAM_KEY] })
      queryClient.invalidateQueries({ queryKey: ['team_scope'] })
    },
  })
}

// ── Обновить настройки команды ───────────────────────────────────────────────

export function useUpdateTeam() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Team> & { logoFile?: File } }) => {
      const { logoFile, ...rest } = data as any

      if (logoFile) {
        await uploadImage('teams', `${id}/logo`, logoFile, 'logo')
      }

      const { data: team, error } = await supabase
        .from('teams')
        .update(rest)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return team as Team
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEAM_KEY] })
    },
  })
}

// ── Пауза / снятие паузы участника (владелец) ────────────────────────────────

export function useTogglePauseTeamMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ memberId, currentStatus }: { memberId: string; currentStatus: string }) => {
      const { data, error } = await supabase
        .from('team_members')
        .update({ status: currentStatus === 'paused' ? 'active' : 'paused' })
        .eq('id', memberId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEAM_MEMBERS_KEY] })
    },
  })
}

// ── Удалить участника (владелец) ─────────────────────────────────────────────

export function useRemoveTeamMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ memberId, teamId }: { memberId: string; teamId: string }) => {
      const { error } = await supabase
        .from('team_members')
        .update({ status: 'removed' })
        .eq('id', memberId)
      if (error) throw error
    },
    onSuccess: (_data, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: [TEAM_MEMBERS_KEY, teamId] })
      queryClient.refetchQueries({ queryKey: [TEAM_MEMBERS_KEY, teamId] })
    },
  })
}

// ── Обновить комиссию участника (владелец) ──────────────────────────────────

export function useUpdateMemberCommission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ memberId, commissionPct }: { memberId: string; commissionPct: number }) => {
      const pct = Math.max(0, Math.min(100, Math.round(commissionPct)))
      const { data, error } = await supabase
        .from('team_members')
        .update({ commission_pct: pct })
        .eq('id', memberId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEAM_MEMBERS_KEY] })
    },
  })
}

// ── Удалить команду (владелец) ───────────────────────────────────────────────

export function useDeleteTeam() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (teamId: string) => {
      // Удаляем всех участников команды
      await supabase.from('team_members').delete().eq('team_id', teamId)

      // Удаляем все инвайты
      await supabase.from('team_invites').delete().eq('team_id', teamId)

      // Удаляем саму команду
      const { error } = await supabase.from('teams').delete().eq('id', teamId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEAM_KEY] })
      queryClient.invalidateQueries({ queryKey: [TEAM_MEMBERS_KEY] })
      queryClient.invalidateQueries({ queryKey: ['team_scope'] })
    },
  })
}

// ── Покинуть команду (участник) ──────────────────────────────────────────────

export function useLeaveTeam() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async () => {
      // Один запрос: обновляем статус своей активной записи участника
      const { data, error } = await supabase
        .from('team_members')
        .update({ status: 'removed' })
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('membership_not_found')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEAM_KEY] })
      queryClient.invalidateQueries({ queryKey: [TEAM_MEMBERS_KEY] })
      queryClient.invalidateQueries({ queryKey: ['team_scope'] })
      queryClient.refetchQueries({ queryKey: [TEAM_KEY] })
    },
  })
}
