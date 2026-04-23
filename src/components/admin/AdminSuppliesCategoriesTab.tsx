import { useEffect, useState } from 'react'
import { Plus, Trash2, GripVertical, Loader2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/shared/Toaster'
import {
  useSuppliesCategories,
  useUpdateSuppliesCategories,
  DEFAULT_SUPPLY_CATEGORIES,
  type SupplyCategory,
} from '@/hooks/useSuppliesCategories'

function slugify(label: string): string {
  const map: Record<string, string> = {
    а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',
    о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',
    э:'e',ю:'yu',я:'ya',
  }
  return label.toLowerCase()
    .split('').map(ch => map[ch] ?? ch).join('')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'cat'
}

export function AdminSuppliesCategoriesTab() {
  const { data: saved = [], isLoading } = useSuppliesCategories()
  const { mutateAsync: save, isPending } = useUpdateSuppliesCategories()
  const [local, setLocal] = useState<SupplyCategory[]>([])
  const [newLabel, setNewLabel] = useState('')

  useEffect(() => { setLocal(saved) }, [saved])

  const isDirty = JSON.stringify(local) !== JSON.stringify(saved)

  function toggle(value: string) {
    setLocal(list => list.map(c => c.value === value ? { ...c, enabled: !c.enabled } : c))
  }
  function rename(value: string, label: string) {
    setLocal(list => list.map(c => c.value === value ? { ...c, label } : c))
  }
  function remove(value: string) {
    setLocal(list => list.filter(c => c.value !== value))
  }
  function add() {
    const label = newLabel.trim()
    if (!label) return
    let base = slugify(label)
    let value = base
    let i = 2
    while (local.some(c => c.value === value)) { value = `${base}_${i++}` }
    setLocal(list => [...list, { value, label, enabled: true }])
    setNewLabel('')
  }
  function resetDefaults() {
    setLocal(DEFAULT_SUPPLY_CATEGORIES)
  }
  async function handleSave() {
    try {
      await save(local)
      toast.success('Категории сохранены')
    } catch {
      toast.error('Ошибка сохранения')
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg">Категории расходников</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Включайте/выключайте категории, переименовывайте или добавляйте свои. Отключённые не появляются в фильтрах и форме добавления, но существующие расходники сохраняют свою категорию.
        </p>
      </div>

      <div className="space-y-2">
        {local.map(cat => (
          <div key={cat.value} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={cat.label}
              onChange={e => rename(cat.value, e.target.value)}
              className="h-9 flex-1"
            />
            <span className="text-xs text-muted-foreground font-mono hidden sm:inline">{cat.value}</span>
            <Switch checked={cat.enabled} onCheckedChange={() => toggle(cat.value)} />
            <button
              onClick={() => remove(cat.value)}
              className="h-9 w-9 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
              title="Удалить категорию"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {local.length === 0 && (
          <p className="text-sm text-muted-foreground italic text-center py-6">Категорий нет — добавьте первую ниже.</p>
        )}
      </div>

      <div className="rounded-xl border bg-muted/30 p-3 flex items-center gap-2">
        <Input
          placeholder="Новая категория (например, Инвентарь)"
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          className="h-9 flex-1"
        />
        <Button onClick={add} disabled={!newLabel.trim()} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Добавить
        </Button>
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <Button variant="ghost" size="sm" onClick={resetDefaults}>
          Сбросить к стандартным
        </Button>
        <div className="flex gap-2">
          {isDirty && (
            <Button variant="outline" size="sm" onClick={() => setLocal(saved)}>
              <X className="h-4 w-4 mr-1" /> Отменить
            </Button>
          )}
          <Button onClick={handleSave} disabled={!isDirty || isPending} size="sm">
            {isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  )
}
