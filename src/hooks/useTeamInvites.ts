import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { generateInviteCode } from '@/lib/utils'
import { TEAM_KEY, TEAM_MEMBERS_KEY } from './useTeam'
import type { TeamInvite, TeamMember } from '@/types'

export const TEAM_INVITES_KEY = 'team_invites'

// ── Список инвайтов команды (для владельца) ──────────────────────────────────

export function useTeamInvites(teamId: string) {
  return useQuery({
    queryKey: [TEAM_INVITES_KEY, teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_invites')
        .select('*')
        .eq('team_id', teamId)
        .order('id', { ascending: false })
      if (error) throw error
      return (data ?? []) as TeamInvite[]
    },
    enabled: !!teamId,
    refetchInterval: 15_000, // обновляем каждые 15 сек, чтобы счётчик был актуален
    refetchOnWindowFocus: true,
  })
}

// ── Создать инвайт-код ───────────────────────────────────────────────────────

export function useCreateTeamInvite() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      teamId,
      label,
      maxUses = 1,
      expiryDays = 7,
      customCode,
    }: {
      teamId: string
      label?: string
      maxUses?: number
      expiryDays?: number
      customCode?: string
    }) => {
      const code = customCode?.trim() || generateInviteCode(12)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + expiryDays)

      const { data, error } = await supabase
        .from('team_invites')
        .insert({
          team_id: teamId,
          code,
          created_by_id: user!.id,
          expires_at: expiresAt.toISOString(),
          max_uses: maxUses,
          use_count: 0,
          is_active: true,
          label: label || '',
        })
        .select()
        .single()
      if (error) throw error
      return data as TeamInvite
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [TEAM_INVITES_KEY, vars.teamId] })
    },
  })
}

// ── Деактивировать инвайт ────────────────────────────────────────────────────

export function useDeactivateTeamInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { data, error } = await supabase
        .from('team_invites')
        .update({ is_active: false })
        .eq('id', inviteId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEAM_INVITES_KEY] })
    },
  })
}

// ── Проверить инвайт-код (публичный) ────────────────────────────────────────

export interface ValidatedInvite {
  invite: TeamInvite
  teamName: string
  ownerName: string
}

export function useValidateInviteCode(code: string) {
  return useQuery({
    queryKey: ['team_invite_validate', code],
    queryFn: async (): Promise<ValidatedInvite | null> => {
      const { data: invite } = await supabase
        .from('team_invites')
        .select('*, team:teams(*, owner:users(*))')
        .eq('code', code)
        .maybeSingle()

      if (!invite) return null

      // Проверяем валидность
      if (!invite.is_active) return null
      if (new Date(invite.expires_at) < new Date()) return null
      if (invite.max_uses > 0 && invite.use_count >= invite.max_uses) return null

      const team = (invite as any).team
      const owner = team?.owner

      return {
        invite: invite as TeamInvite,
        teamName: team?.name ?? '',
        ownerName: owner?.name ?? '',
      }
    },
    enabled: !!code,
    retry: false,
    staleTime: 30_000, // 30 сек
  })
}

// ── Вступить в команду по коду ───────────────────────────────────────────────

export function useJoinTeam() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ code }: { code: string }) => {
      // 1. Получаем инвайт
      const { data: invite, error: invErr } = await supabase
        .from('team_invites')
        .select('*')
        .eq('code', code)
        .maybeSingle()
      if (invErr) throw invErr
      if (!invite) throw new Error('invite_not_found')

      // Валидация
      if (!invite.is_active) throw new Error('invite_inactive')
      if (new Date(invite.expires_at) < new Date()) throw new Error('invite_expired')
      if (invite.max_uses > 0 && invite.use_count >= invite.max_uses) throw new Error('invite_used')

      // 2. Проверяем существующее членство (любой статус — включая "removed")
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', invite.team_id)
        .eq('user_id', user!.id)
        .maybeSingle()

      if (existingMember?.status === 'active') throw new Error('already_member')

      // 3. Создаём запись участника или реактивируем удалённого
      let member: TeamMember
      const isRejoin = !!existingMember // возвращение ранее удалённого участника

      if (existingMember) {
        // Реактивируем ранее удалённого участника
        const { data, error } = await supabase
          .from('team_members')
          .update({ status: 'active', joined_at: new Date().toISOString() })
          .eq('id', existingMember.id)
          .select()
          .single()
        if (error) throw error
        member = data as TeamMember
      } else {
        const { data, error } = await supabase
          .from('team_members')
          .insert({
            team_id: invite.team_id,
            user_id: user!.id,
            role: 'member',
            status: 'active',
            joined_at: new Date().toISOString(),
          })
          .select()
          .single()
        if (error) throw error
        member = data as TeamMember
      }

      // 4. Увеличиваем счётчик только для новых участников (не для возвращающихся)
      // Повторное вступление не «тратит» использование кода — тот же человек, не новый
      if (!isRejoin) {
        const newCount = invite.use_count + 1
        const updates: Record<string, unknown> = { use_count: newCount }
        if (invite.max_uses > 0 && newCount >= invite.max_uses) {
          updates.is_active = false
        }
        await supabase.from('team_invites').update(updates).eq('id', invite.id)
      }

      return member
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEAM_KEY] })
      queryClient.invalidateQueries({ queryKey: [TEAM_MEMBERS_KEY] })
      queryClient.invalidateQueries({ queryKey: [TEAM_INVITES_KEY] })
      queryClient.invalidateQueries({ queryKey: ['team_invite_validate'] })
    },
  })
}
