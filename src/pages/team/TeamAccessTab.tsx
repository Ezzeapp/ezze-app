import { useEffect, useState } from 'react'
import { Loader2, ShieldCheck, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/shared/Toaster'
import {
  ALL_MODULES,
  REQUIRED_MODULES,
  DEFAULT_MODULE_ACCESS,
  useTeamModuleAccess,
  useUpdateTeamModuleAccess,
  type TeamModule,
  type ModuleAccessMap,
} from '@/hooks/useTeamAccess'

const ROLES: { key: 'admin' | 'operator' | 'worker'; label: string; description: string }[] = [
  { key: 'admin',    label: 'Админ',    description: 'Управление командой и настройки (без биллинга)' },
  { key: 'operator', label: 'Оператор', description: 'POS, заказы, клиенты, оплаты' },
  { key: 'worker',   label: 'Сотрудник', description: 'Видит только заказы, назначенные на него' },
]

export function TeamAccessTab({ team }: { team: { id: string } }) {
  const { data: serverAccess, isLoading } = useTeamModuleAccess()
  const update = useUpdateTeamModuleAccess()

  const [draft, setDraft] = useState<ModuleAccessMap>({})

  useEffect(() => {
    if (serverAccess) setDraft(serverAccess)
  }, [serverAccess])

  function isOn(role: 'admin' | 'operator' | 'worker', module: TeamModule): boolean {
    if (REQUIRED_MODULES.includes(module)) return true
    const list = draft[role] ?? DEFAULT_MODULE_ACCESS[role] ?? []
    return list.includes(module)
  }

  function toggle(role: 'admin' | 'operator' | 'worker', module: TeamModule, on: boolean) {
    if (REQUIRED_MODULES.includes(module)) return
    setDraft(prev => {
      const current = prev[role] ?? DEFAULT_MODULE_ACCESS[role] ?? []
      const next = on
        ? Array.from(new Set([...current, module]))
        : current.filter(m => m !== module)
      return { ...prev, [role]: next }
    })
  }

  async function handleSave() {
    try {
      await update.mutateAsync({ teamId: team.id, access: draft })
      toast.success('Настройки доступа сохранены')
    } catch {
      toast.error('Не удалось сохранить')
    }
  }

  function handleReset() {
    setDraft(DEFAULT_MODULE_ACCESS)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Доступы по ролям
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Включите модули, которые сотрудник с этой ролью видит в кабинете. Владелец всегда
            видит всё. Раздел «Заказы» нельзя отключить — без него работа невозможна.
          </p>
        </CardHeader>
      </Card>

      {ROLES.map(({ key, label, description }) => (
        <Card key={key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{label}</CardTitle>
            <p className="text-xs text-muted-foreground">{description}</p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid gap-1 sm:grid-cols-2">
              {ALL_MODULES.map(({ slug, label: mLabel, description: mDesc }) => {
                const required = REQUIRED_MODULES.includes(slug)
                return (
                  <label
                    key={slug}
                    className="flex items-start justify-between gap-3 px-3 py-2 rounded-md border border-border/60 bg-background hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{mLabel}</p>
                      {(mDesc || required) && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {required ? 'обязательный модуль' : mDesc}
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={isOn(key, slug)}
                      onCheckedChange={v => toggle(key, slug, v)}
                      disabled={required}
                      className="shrink-0 mt-0.5"
                    />
                  </label>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background border-t flex gap-2 lg:static lg:mx-0 lg:px-0 lg:border-0 lg:py-0">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={update.isPending}
          className="flex-1 sm:flex-none"
        >
          Сбросить к умолчанию
        </Button>
        <Button
          onClick={handleSave}
          loading={update.isPending}
          className="flex-1 sm:flex-none gap-1.5"
        >
          <Save className="h-4 w-4" />
          Сохранить
        </Button>
      </div>
    </div>
  )
}
