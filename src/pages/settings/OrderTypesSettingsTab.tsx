import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Layers, Plus, Trash2, ChevronDown } from 'lucide-react'
import {
  useCleaningOrderTypesConfig, useUpdateCleaningOrderTypesConfig, getOrderTypeIcon, CLEANING_ICON_NAMES,
} from '@/hooks/useCleaningOrders'
import type { CleaningOrderTypeConfig } from '@/hooks/useCleaningOrders'
import { toast } from '@/components/shared/Toaster'
import { cn } from '@/lib/utils'

function slugify(label: string): string {
  return label.trim().toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_а-яёa-я]/gi, '')
    .slice(0, 40) || `custom_${Date.now()}`
}

export function OrderTypesSettingsTab() {
  const { data: allTypes = [] } = useCleaningOrderTypesConfig()
  const update = useUpdateCleaningOrderTypesConfig()

  const [addOpen, setAddOpen] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newIcon, setNewIcon] = useState('Package')
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null)

  const toggle = async (slug: string) => {
    const type = allTypes.find(t => t.slug === slug)
    if (!type) return
    if (type.active && allTypes.filter(t => t.active).length <= 1) {
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

  const handleAdd = async () => {
    const label = newLabel.trim()
    if (!label) return
    const slug = slugify(label)
    if (allTypes.some(t => t.slug === slug)) {
      toast.error('Категория с таким именем уже существует')
      return
    }
    const newType: CleaningOrderTypeConfig = {
      slug,
      label,
      icon: newIcon,
      sort_order: allTypes.length,
      active: true,
    }
    try {
      await update.mutateAsync([...allTypes, newType])
      toast.success('Категория добавлена')
      setNewLabel('')
      setNewIcon('Package')
      setAddOpen(false)
    } catch {
      toast.error('Ошибка сохранения')
    }
  }

  const handleDelete = async (slug: string) => {
    const activeCount = allTypes.filter(t => t.active).length
    const type = allTypes.find(t => t.slug === slug)
    if (type?.active && activeCount <= 1) {
      toast.error('Нельзя удалить последний активный тип')
      return
    }
    setDeletingSlug(slug)
    try {
      const next = allTypes.filter(t => t.slug !== slug).map((t, i) => ({ ...t, sort_order: i }))
      await update.mutateAsync(next)
      toast.success('Удалено')
    } catch {
      toast.error('Ошибка удаления')
    } finally {
      setDeletingSlug(null)
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
          const isDeleting = deletingSlug === type.slug
          return (
            <div
              key={type.slug}
              className={cn('flex items-center justify-between py-3 border-b last:border-0', isDeleting && 'opacity-40')}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`p-2 rounded-lg shrink-0 ${isEnabled ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Icon className={`h-4 w-4 ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${!isEnabled && 'text-muted-foreground'}`}>
                    {type.label}
                  </p>
                  {type.description && (
                    <p className="text-xs text-muted-foreground truncate">{type.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <Switch
                  checked={isEnabled}
                  onCheckedChange={() => toggle(type.slug)}
                  disabled={update.isPending || isDeleting}
                />
                <button
                  onClick={() => handleDelete(type.slug)}
                  disabled={update.isPending || isDeleting}
                  className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30 p-1"
                  title="Удалить тип"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}

        {/* Add new category */}
        {addOpen ? (
          <div className="pt-3 space-y-3">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Новая категория</p>
              <Input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Название, например: Игрушки"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAddOpen(false) }}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Иконка</p>
              <div className="relative">
                <select
                  value={newIcon}
                  onChange={e => setNewIcon(e.target.value)}
                  className="w-full h-9 appearance-none rounded-md border border-input bg-background px-3 pr-8 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {CLEANING_ICON_NAMES.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { setAddOpen(false); setNewLabel(''); setNewIcon('Package') }}>
                Отмена
              </Button>
              <Button size="sm" className="flex-1" disabled={!newLabel.trim() || update.isPending} onClick={handleAdd}>
                Добавить
              </Button>
            </div>
          </div>
        ) : (
          <div className="pt-2">
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Добавить тип
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
