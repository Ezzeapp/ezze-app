import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Layers } from 'lucide-react'
import {
  useCleaningOrderTypesConfig, useUpdateCleaningOrderTypesConfig, getOrderTypeIcon,
} from '@/hooks/useCleaningOrders'
import { toast } from '@/components/shared/Toaster'

export function OrderTypesSettingsTab() {
  const { data: allTypes = [] } = useCleaningOrderTypesConfig()
  const update = useUpdateCleaningOrderTypesConfig()

  const toggle = async (slug: string) => {
    const type = allTypes.find(t => t.slug === slug)
    if (!type) return
    const isEnabled = type.active
    if (isEnabled && allTypes.filter(t => t.active).length <= 1) {
      toast.error('Нельзя отключить все типы заказов')
      return
    }
    const next = allTypes.map(t => t.slug === slug ? { ...t, active: !t.active } : t)
    try {
      await update.mutateAsync(next)
      toast.success('Сохранено')
    } catch {
      toast.error('Ошибка сохранения')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Типы заказов
        </CardTitle>
        <CardDescription>
          Скрывайте типы, которые не используются в вашей химчистке. Изменения сразу применяются в кассе.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {[...allTypes].sort((a, b) => a.sort_order - b.sort_order).map(type => {
          const Icon = getOrderTypeIcon(type.icon)
          const isEnabled = type.active
          return (
            <div
              key={type.slug}
              className="flex items-center justify-between py-3 border-b last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isEnabled ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Icon className={`h-4 w-4 ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className={`text-sm font-medium ${!isEnabled && 'text-muted-foreground'}`}>
                    {type.label}
                  </p>
                  {type.description && (
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  )}
                </div>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={() => toggle(type.slug)}
                disabled={update.isPending}
              />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
