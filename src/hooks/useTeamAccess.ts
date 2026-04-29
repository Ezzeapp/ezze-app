import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useTeamScope, type TeamRole } from '@/contexts/TeamContext'

// ── Список настраиваемых модулей ─────────────────────────────────────────────
// Каждый модуль = пункт сайдбара или крупный раздел кабинета.
// Owner всегда имеет доступ ко всему. Для остальных ролей — настройка владельца.
export type TeamModule =
  | 'dashboard'       // Статистика / Dashboard
  | 'orders'          // Заказы / Календарь — НЕ ОТКЛЮЧАЕМО (worker без него вообще ничего не делает)
  | 'clients'         // Клиенты
  | 'services'        // Услуги / Каталог
  | 'inventory'       // Склад
  | 'promo'           // Промокоды
  | 'loyalty'         // Лояльность
  | 'marketing'       // Маркетинг (Рассылки / Авто / Отзывы)
  | 'reports'         // Отчёты
  | 'delivery'        // Доставка (cleaning)
  | 'team_analytics'  // Аналитика команды

export const ALL_MODULES: { slug: TeamModule; label: string; description?: string }[] = [
  { slug: 'dashboard',      label: 'Статистика',        description: 'Главная панель с показателями' },
  { slug: 'orders',         label: 'Заказы / Календарь', description: 'Основной рабочий раздел' },
  { slug: 'clients',        label: 'Клиенты',           description: 'База клиентов' },
  { slug: 'services',       label: 'Услуги',            description: 'Каталог услуг и цен' },
  { slug: 'inventory',      label: 'Склад',             description: 'Учёт товаров' },
  { slug: 'promo',          label: 'Промокоды' },
  { slug: 'loyalty',        label: 'Лояльность' },
  { slug: 'marketing',      label: 'Маркетинг',         description: 'Рассылки, авто-уведомления, отзывы' },
  { slug: 'reports',        label: 'Отчёты' },
  { slug: 'delivery',       label: 'Доставка' },
  { slug: 'team_analytics', label: 'Аналитика команды' },
]

// ── Модули, которые нельзя отключить (рабочая основа) ───────────────────────
export const REQUIRED_MODULES: TeamModule[] = ['orders']

// ── Дефолтная карта прав (совпадает с миграцией 076) ────────────────────────
export const DEFAULT_MODULE_ACCESS: Record<Exclude<TeamRole, null | 'owner'>, TeamModule[]> = {
  admin:    ['dashboard','orders','clients','services','inventory','promo','loyalty','marketing','reports','delivery','team_analytics'],
  operator: ['orders','clients','services','promo','loyalty','delivery'],
  worker:   ['orders'],
  member:   ['orders','clients','services','promo','loyalty'],
}

export type ModuleAccessMap = Partial<Record<Exclude<TeamRole, null | 'owner'>, TeamModule[]>>

// ── Загрузка module_access для текущей команды ───────────────────────────────

const TEAM_ACCESS_KEY = 'team_module_access'

export function useTeamModuleAccess() {
  const { effectiveTeamId } = useTeamScope()

  return useQuery({
    queryKey: [TEAM_ACCESS_KEY, effectiveTeamId],
    queryFn: async (): Promise<ModuleAccessMap> => {
      if (!effectiveTeamId) return DEFAULT_MODULE_ACCESS
      const { data } = await supabase
        .from('teams')
        .select('module_access')
        .eq('id', effectiveTeamId)
        .maybeSingle()
      const raw = (data?.module_access ?? null) as ModuleAccessMap | null
      // Сливаем с дефолтом, чтобы у БД могли отсутствовать ключи
      return { ...DEFAULT_MODULE_ACCESS, ...(raw || {}) }
    },
    enabled: !!effectiveTeamId,
    staleTime: 5 * 60_000,
  })
}

// ── Сохранение настроек (только owner) ───────────────────────────────────────

export function useUpdateTeamModuleAccess() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ teamId, access }: { teamId: string; access: ModuleAccessMap }) => {
      const { error } = await supabase
        .from('teams')
        .update({ module_access: access })
        .eq('id', teamId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TEAM_ACCESS_KEY] })
    },
  })
}

// ── Главный хук: можно ли текущему пользователю видеть module ────────────────

export function useTeamAccess(module: TeamModule): boolean {
  const { isOwner, isTeamOnly, isMember, role } = useTeamScope()
  const { data: access } = useTeamModuleAccess()

  // Не в команде — все модули доступны (личный кабинет, проверки нет)
  if (!isOwner && !isTeamOnly && !isMember) return true

  // Владелец видит всё
  if (isOwner) return true

  // Required module всегда виден
  if (REQUIRED_MODULES.includes(module)) return true

  // Member-роль (не сотрудник, а просто участник без team_only_for) — пока тоже видит всё.
  // Точнее: для team_only_for сотрудников и ролей admin/operator/worker — фильтруем.
  if (!isTeamOnly && !isMember) return true

  if (!role || role === 'owner') return true

  const list = access?.[role] ?? DEFAULT_MODULE_ACCESS[role as keyof typeof DEFAULT_MODULE_ACCESS] ?? []
  return list.includes(module)
}
