import { useState } from 'react'
import { Plus, Trash2, Edit3, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/components/shared/Toaster'
import {
  useWorkshopItemTypes, useUpsertWorkshopItemType, useDeleteWorkshopItemType,
  type WorkshopItemType,
} from '@/hooks/useWorkshopOrders'
import { formatCurrency } from '@/lib/utils'

export function WorkshopItemTypesSettingsTab() {
  const { data: items, isLoading } = useWorkshopItemTypes()
  const upsert = useUpsertWorkshopItemType()
  const remove = useDeleteWorkshopItemType()

  const [editing, setEditing] = useState<WorkshopItemType | null>(null)
  const [showNew, setShowNew] = useState(false)

  async function toggleActive(item: WorkshopItemType) {
    try {
      await upsert.mutateAsync({ ...item, active: !item.active })
    } catch (e: any) {
      toast.error(e.message ?? 'Error')
    }
  }

  async function handleDelete(item: WorkshopItemType) {
    if (!confirm(`Удалить «${item.name}»?`)) return
    try {
      await remove.mutateAsync(item.id)
      toast.success('Удалено')
    } catch (e: any) {
      toast.error(e.message ?? 'Error')
    }
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>

  // Группировка по категории
  const grouped = (items ?? []).reduce<Record<string, WorkshopItemType[]>>((acc, item) => {
    const cat = item.category || 'Без категории'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Типы устройств</h3>
          <p className="text-sm text-muted-foreground">Справочник: смартфоны, часы, бытовая техника и т.д.</p>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-1" /> Добавить
        </Button>
      </div>

      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat}>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-2">{cat}</h4>
          <div className="rounded-lg border divide-y">
            {list.sort((a, b) => a.sort_order - b.sort_order).map(item => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={item.active ? 'font-medium' : 'text-muted-foreground line-through'}>
                      {item.name}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-3 mt-0.5">
                    <span>диагностика {formatCurrency(item.default_diagnostic_price)}</span>
                    <span>срок {item.default_days} дн.</span>
                    <span>гарантия {item.default_warranty_days} дн.</span>
                  </div>
                </div>
                <Switch checked={item.active} onCheckedChange={() => toggleActive(item)} />
                <Button size="icon" variant="ghost" onClick={() => setEditing(item)}>
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-red-600" onClick={() => handleDelete(item)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {showNew && (
        <ItemTypeDialog
          onClose={() => setShowNew(false)}
          onSave={async (data) => { await upsert.mutateAsync(data); toast.success('Сохранено') }}
        />
      )}
      {editing && (
        <ItemTypeDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (data) => { await upsert.mutateAsync({ ...editing, ...data }); toast.success('Сохранено') }}
        />
      )}
    </div>
  )
}

function ItemTypeDialog({ initial, onClose, onSave }: {
  initial?: WorkshopItemType
  onClose: () => void
  onSave: (data: Partial<WorkshopItemType> & { name: string }) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [diagPrice, setDiagPrice] = useState<number>(initial?.default_diagnostic_price ?? 0)
  const [days, setDays] = useState<number>(initial?.default_days ?? 3)
  const [warranty, setWarranty] = useState<number>(initial?.default_warranty_days ?? 30)
  const [icon, setIcon] = useState(initial?.icon ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        category: category || null as any,
        default_diagnostic_price: diagPrice,
        default_days: days,
        default_warranty_days: warranty,
        icon: icon || null as any,
        active,
      })
      onClose()
    } catch (e: any) {
      toast.error(e.message ?? 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? 'Редактировать тип' : 'Новый тип устройства'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Название *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Смартфон" />
          </div>
          <div>
            <Label>Категория</Label>
            <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Электроника" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Диагностика</Label>
              <Input type="number" value={diagPrice} onChange={e => setDiagPrice(Number(e.target.value))} />
            </div>
            <div>
              <Label>Срок, дн.</Label>
              <Input type="number" value={days} onChange={e => setDays(Number(e.target.value))} />
            </div>
            <div>
              <Label>Гарантия, дн.</Label>
              <Input type="number" value={warranty} onChange={e => setWarranty(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label>Иконка (lucide)</Label>
            <Input value={icon} onChange={e => setIcon(e.target.value)} placeholder="Smartphone, Laptop, Watch..." />
          </div>
          <div className="flex items-center justify-between">
            <Label>Активен</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
