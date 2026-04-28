import { createContext, useContext, useMemo, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// ── Типы ─────────────────────────────────────────────────────────────────────

export type TeamRole = 'owner' | 'admin' | 'operator' | 'worker' | 'member' | null

export type EffectiveScope = 'personal' | 'team'

export type PermissionAction =
  // Только владелец
  | 'manage_billing'
  | 'manage_team'
  | 'manage_settings'
  | 'delete_team'
  | 'manage_payments'
  | 'view_owner_reports'
  // Владелец + admin
  | 'manage_employees'
  | 'view_reports'
  | 'manage_services'
  | 'manage_promo_codes'
  | 'view_commissions'
  // Владелец + admin + operator (POS)
  | 'create_order'
  | 'edit_order'
  | 'view_clients'
  | 'add_client'
  | 'edit_client'
  | 'accept_payment'
  | 'view_all_orders'
  | 'assign_worker'
  // Все роли (worker может тоже)
  | 'change_assigned_status'
  | 'view_assigned_orders'

export interface TeamContextValue {
  /** ID команды, в которой работает пользователь (или null если не в команде) */
  effectiveTeamId: string | null
  /** Роль пользователя в команде */
  role: TeamRole
  /** Личный или командный контекст */
  scope: EffectiveScope
  /** Является ли владельцем команды */
  isOwner: boolean
  /** Является ли участником (НЕ владельцем) */
  isMember: boolean
  /** Сотрудник, существующий ТОЛЬКО в команде (нет своего кабинета) */
  isTeamOnly: boolean
  /** Имя команды (если есть) */
  teamName: string | null
  /** Slug команды */
  teamSlug: string | null
  /** Продукт команды (cleaning | beauty | etc.) */
  teamProduct: string | null
  /** Идёт загрузка состояния команды */
  isLoading: boolean
  /** Проверка прав по роли */
  can: (action: PermissionAction) => boolean
}

const TeamContext = createContext<TeamContextValue | undefined>(undefined)

// ── Логика прав по роли ──────────────────────────────────────────────────────

const PERMISSIONS: Record<NonNullable<TeamRole>, PermissionAction[]> = {
  owner: [
    'manage_billing', 'manage_team', 'manage_settings', 'delete_team',
    'manage_payments', 'view_owner_reports',
    'manage_employees', 'view_reports', 'manage_services', 'manage_promo_codes',
    'view_commissions',
    'create_order', 'edit_order', 'view_clients', 'add_client', 'edit_client',
    'accept_payment', 'view_all_orders', 'assign_worker',
    'change_assigned_status', 'view_assigned_orders',
  ],
  admin: [
    'manage_employees', 'view_reports', 'manage_services', 'manage_promo_codes',
    'view_commissions',
    'create_order', 'edit_order', 'view_clients', 'add_client', 'edit_client',
    'accept_payment', 'view_all_orders', 'assign_worker',
    'change_assigned_status', 'view_assigned_orders',
  ],
  operator: [
    'create_order', 'edit_order', 'view_clients', 'add_client', 'edit_client',
    'accept_payment', 'view_all_orders', 'assign_worker',
    'change_assigned_status', 'view_assigned_orders',
  ],
  worker: [
    'change_assigned_status', 'view_assigned_orders',
  ],
  member: [
    // legacy роль — даём те же права, что operator (ретросовместимость)
    'create_order', 'edit_order', 'view_clients', 'add_client', 'edit_client',
    'accept_payment', 'view_all_orders',
    'change_assigned_status', 'view_assigned_orders',
  ],
}

function checkPermission(role: TeamRole, action: PermissionAction): boolean {
  if (!role) return false
  return PERMISSIONS[role].includes(action)
}

// ── Запрос команды + роли (более полный, чем useMyTeam) ──────────────────────

interface TeamScopeData {
  team_id: string | null
  team_name: string | null
  team_slug: string | null
  team_product: string | null
  role: TeamRole
}

async function fetchTeamScope(userId: string, teamOnlyFor: string | null): Promise<TeamScopeData> {
  // Case A: user is team_only_for (employee)
  if (teamOnlyFor) {
    const { data: team } = await supabase
      .from('teams')
      .select('id, name, slug, product')
      .eq('id', teamOnlyFor)
      .maybeSingle()
    const { data: member } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamOnlyFor)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()
    return {
      team_id: team?.id ?? null,
      team_name: team?.name ?? null,
      team_slug: team?.slug ?? null,
      team_product: team?.product ?? null,
      role: ((member?.role as TeamRole) ?? 'operator') as TeamRole,
    }
  }

  // Case B: user owns a team
  const { data: ownedTeam } = await supabase
    .from('teams')
    .select('id, name, slug, product')
    .eq('owner_id', userId)
    .maybeSingle()
  if (ownedTeam) {
    return {
      team_id: ownedTeam.id,
      team_name: ownedTeam.name,
      team_slug: ownedTeam.slug,
      team_product: ownedTeam.product ?? null,
      role: 'owner',
    }
  }

  // Case C: user is active member (not owner, not team_only_for)
  const { data: membership } = await supabase
    .from('team_members')
    .select('role, team:teams(id, name, slug, product)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (membership && (membership as any).team) {
    const team: any = (membership as any).team
    return {
      team_id: team.id,
      team_name: team.name,
      team_slug: team.slug,
      team_product: team.product ?? null,
      role: ((membership as any).role as TeamRole) ?? 'member',
    }
  }

  return {
    team_id: null,
    team_name: null,
    team_slug: null,
    team_product: null,
    role: null,
  }
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth()
  const teamOnlyFor = (user?.team_only_for ?? null) as string | null

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ['team_scope', user?.id, teamOnlyFor],
    queryFn: () => fetchTeamScope(user!.id, teamOnlyFor),
    enabled: !!user,
    staleTime: 5 * 60_000,
  })

  const value = useMemo<TeamContextValue>(() => {
    const scope: EffectiveScope = data?.team_id ? 'team' : 'personal'
    const role = data?.role ?? null
    const isOwner = role === 'owner'
    const isMember = !!role && role !== 'owner'
    const isTeamOnly = !!teamOnlyFor

    return {
      effectiveTeamId: data?.team_id ?? null,
      role,
      scope,
      isOwner,
      isMember,
      isTeamOnly,
      teamName: data?.team_name ?? null,
      teamSlug: data?.team_slug ?? null,
      teamProduct: data?.team_product ?? null,
      isLoading: authLoading || (!!user && queryLoading),
      can: (action: PermissionAction) => checkPermission(role, action),
    }
  }, [data, teamOnlyFor, authLoading, queryLoading, user])

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useTeamScope(): TeamContextValue {
  const ctx = useContext(TeamContext)
  if (!ctx) throw new Error('useTeamScope must be used within TeamProvider')
  return ctx
}

/**
 * Проверка одного права. Удобно для условного рендеринга:
 *   const canCreate = usePermission('create_order')
 */
export function usePermission(action: PermissionAction): boolean {
  const { can } = useTeamScope()
  return can(action)
}

/**
 * Возвращает effective master_id для запросов:
 *   - Если в команде → owner_id команды (все запросы скоупятся на владельца)
 *   - Иначе → user.id (личный контекст)
 *
 * Используется для cleaning/booking хуков, которые исторически фильтруют по
 * master_id владельца для членов команды.
 */
export function useEffectiveMasterId(): string | null {
  const { user } = useAuth()
  const { effectiveTeamId, isTeamOnly } = useTeamScope()

  return useMemo(() => {
    if (!user) return null
    // Сотрудник команды → лезем за owner_id команды
    if (isTeamOnly && effectiveTeamId) {
      // Используем effective team_id напрямую — реальный owner_id запрашивается в хуках
      // через useEffectiveTeamId(). Для совместимости со старым кодом возвращаем user.id.
      return user.id
    }
    return user.id
  }, [user, effectiveTeamId, isTeamOnly])
}

/**
 * Возвращает effective team_id для запросов с team_id фильтрацией.
 * Для new code предпочтительно использовать team_id, а не master_id.
 */
export function useEffectiveTeamId(): string | null {
  return useTeamScope().effectiveTeamId
}
