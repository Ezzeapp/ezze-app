import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClinicDietTables, useCreateDietTable, useUpdateDietTable, useDeleteDietTable, usePreseedPevznerDiets } from '@/hooks/useClinicNutrition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { toast } from '@/components/shared/Toaster'
import { Plus, Pencil, Trash2, UtensilsCrossed, Save, Sparkles } from 'lucide-react'
import type { ClinicDietTable } from '@/types'

interface DietForm {
  id?: string
  number: string
  name: string
  description: string
  allowed_foods: string
  restricted_foods: string
  calories_target: string
  notes: string
}

const EMPTY: DietForm = { number: '', name: '', description: '', allowed_foods: '', restricted_foods: '', calories_target: '', notes: '' }

export function DietTablesSettingsTab() {
  const { t } = useTranslation()
  const { data: diets = [], isLoading } = useClinicDietTables()
  const create = useCreateDietTable()
  const update = useUpdateDietTable()
  const remove = useDeleteDietTable()
  const preseed = usePreseedPevznerDiets()

  const [editing, setEditing] = useState<DietForm | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const openEdit = (d: ClinicDietTable) => setEditing({
    id: d.id, number: d.number, name: d.name,
    description: d.description || '', allowed_foods: d.allowed_foods || '',
    restricted_foods: d.restricted_foods || '', calories_target: d.calories_target != null ? String(d.calories_target) : '',
    notes: d.notes || '',
  })

  const handleSave = async () => {
    if (!editing || !editing.number.trim() || !editing.name.trim()) return
    try {
      const payload = {
        number: editing.number.trim(),
        name: editing.name.trim(),
        description: editing.description || null,
        allowed_foods: editing.allowed_foods || null,
        restricted_foods: editing.restricted_foods || null,
        calories_target: editing.calories_target ? Number(editing.calories_target) : null,
        notes: editing.notes || null,
      }
      if (editing.id) await update.mutateAsync({ id: editing.id, ...payload })
      else await create.mutateAsync(payload)
      toast.success(t('clinic.nutrition.savedDiet'))
      setEditing(null)
    } catch { toast.error(t('common.saveError')) }
  }

  const handlePreseed = async () => {
    try {
      await preseed.mutateAsync()
      toast.success(t('clinic.nutrition.savedDiet'))
    } catch { toast.error(t('common.saveError')) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold">{t('clinic.nutrition.dietTables')}</h3>
        <div className="flex gap-2">
          {diets.length === 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePreseed} disabled={preseed.isPending}>
              <Sparkles className="h-3.5 w-3.5" />{t('clinic.nutrition.preseedPevzner')}
            </Button>
          )}
          <Button size="sm" className="gap-1.5" onClick={() => setEditing({ ...EMPTY })}>
            <Plus className="h-3.5 w-3.5" />{t('clinic.nutrition.addDiet')}
          </Button>
        </div>
      </div>

      {!isLoading && diets.length === 0 && (
        <EmptyState icon={UtensilsCrossed} title={t('clinic.nutrition.noDiets')} description={t('clinic.nutrition.noDietsDesc')} />
      )}

      <div className="space-y-2">
        {diets.map(d => (
          <Card key={d.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-medium text-sm">
                  <span className="text-primary font-bold mr-1.5">#{d.number}</span>{d.name}
                </p>
                {d.calories_target && <span className="text-xs text-muted-foreground">{d.calories_target} kcal</span>}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleting(d.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing.id ? t('clinic.nutrition.editDiet') : t('clinic.nutrition.addDiet')}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('clinic.nutrition.dietNumber')}</Label>
                  <Input className="h-9 mt-1" value={editing.number} onChange={e => setEditing({ ...editing, number: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{t('clinic.nutrition.caloriesTarget')}</Label>
                  <Input type="number" className="h-9 mt-1" value={editing.calories_target} onChange={e => setEditing({ ...editing, calories_target: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">{t('clinic.nutrition.dietName')}</Label>
                <Input className="h-9 mt-1" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">{t('clinic.nutrition.description')}</Label>
                <textarea className="flex min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">{t('clinic.nutrition.allowedFoods')}</Label>
                <textarea className="flex min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={editing.allowed_foods} onChange={e => setEditing({ ...editing, allowed_foods: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">{t('clinic.nutrition.restrictedFoods')}</Label>
                <textarea className="flex min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={editing.restricted_foods} onChange={e => setEditing({ ...editing, restricted_foods: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
              <Button disabled={!editing.number.trim() || !editing.name.trim()} onClick={handleSave} className="gap-1.5"><Save className="h-3.5 w-3.5" />{t('common.save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deleting && <ConfirmDialog open title={t('common.delete')} description={t('common.deleteConfirm')} onConfirm={async () => { try { await remove.mutateAsync(deleting); toast.success(t('common.deleted')); setDeleting(null) } catch { toast.error(t('common.saveError')) } }} onClose={() => setDeleting(null)} />}
    </div>
  )
}
