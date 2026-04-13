import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Layers } from 'lucide-react'
import {
  ALL_ORDER_TYPES, ORDER_TYPE_LABELS, ORDER_TYPE_DESCRIPTIONS, ORDER_TYPE_ICONS,
  useCleaningEnabledOrderTypes, useUpdateCleaningOrderTypes, type OrderType,
} from '@/hooks/useCleaningOrders'
import { toast } from '@/components/shared/Toaster'

export function OrderTypesSettingsTab() {
  const { data: enabled = ['clothing', 'carpet', 'furniture'] as OrderType[] } = useCleaningEnabledOrderTypes()
  const update = useUpdateCleaningOrderTypes()

  const toggle = async (type: OrderType) => {
    const isEnabled = enabled.includes(type)
    if (isEnabled && enabled.length <= 1) {
      toast.error('Нельзя отключить все типы заказов')
      return
    }
    const next = isEnabled
      ? enabled.filter(t => t !== type)
      : [...enabled, type]
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
        {ALL_ORDER_TYPES.map(type => {
          const Icon = ORDER_TYPE_ICONS[type]
          const isEnabled = enabled.includes(type)
          return (
            <div
              key={type}
              className="flex items-center justify-between py-3 border-b last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isEnabled ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Icon className={`h-4 w-4 ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className={`text-sm font-medium ${!isEnabled && 'text-muted-foreground'}`}>
                    {ORDER_TYPE_LABELS[type]}
                  </p>
                  <p className="text-xs text-muted-foreground">{ORDER_TYPE_DESCRIPTIONS[type]}</p>
                </div>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={() => toggle(type)}
                disabled={update.isPending}
              />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
