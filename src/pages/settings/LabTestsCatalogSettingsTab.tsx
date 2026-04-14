import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClinicLabTests, useUpsertLabTest, useDeleteLabTest } from '@/hooks/useClinicLabTests'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { toast } from '@/components/shared/Toaster'
import { Plus, Pencil, Trash2, FlaskConical, Save } from 'lucide-react'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/utils'
import type { ClinicLabTest } from '@/types'

interface TestForm {
  id?: string
  name: string
  category: string
  unit: string
  ref_min: string
  ref_max: string
  ref_text: string
  price: string
}

const EMPTY_FORM: TestForm = {
  name: '', category: '', unit: '', ref_min: '', ref_max: '', ref_text: '', price: '',
}

export function LabTestsCatalogSettingsTab() {
  const { t, i18n } = useTranslation()
  const currency = useCurrency()
  const { data: tests = [], isLoading } = useClinicLabTests()
  const upsert = useUpsertLabTest()
  const remove = useDeleteLabTest()

  const [editing, setEditing] = useState<TestForm | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const openCreate = () => setEditing({ ...EMPTY_FORM })
  const openEdit = (test: ClinicLabTest) => setEditing({
    id: test.id,
    name: test.name,
    category: test.category || '',
    unit: test.unit || '',
    ref_min: test.ref_min != null ? String(test.ref_min) : '',
    ref_max: test.ref_max != null ? String(test.ref_max) : '',
    ref_text: test.ref_text || '',
    price: test.price != null ? String(test.price) : '',
  })

  const handleSave = async () => {
    if (!editing || !editing.name.trim()) return
    try {
      await upsert.mutateAsync({
        ...(editing.id ? { id: editing.id } : {}),
        name: editing.name.trim(),
        category: editing.category || null,
        unit: editing.unit || null,
        ref_min: editing.ref_min ? Number(editing.ref_min) : null,
        ref_max: editing.ref_max ? Number(editing.ref_max) : null,
        ref_text: editing.ref_text || null,
        price: editing.price ? Number(editing.price) : null,
      })
      toast.success(t('common.saved'))
      setEditing(null)
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting)
      toast.success(t('common.deleted'))
      setDeleting(null)
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('clinic.lab.testCatalog')}</h3>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          {t('clinic.lab.addTest')}
        </Button>
      </div>

      {!isLoading && tests.length === 0 && (
        <EmptyState
          icon={FlaskConical}
          title={t('clinic.lab.noTests')}
          description={t('clinic.lab.noTestsDesc')}
        />
      )}

      <div className="space-y-2">
        {tests.map(test => (
          <Card key={test.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{test.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                  {test.category && <span>{test.category}</span>}
                  {test.unit && <span>{test.unit}</span>}
                  {(test.ref_min != null || test.ref_max != null) && (
                    <span className="text-muted-foreground/70">
                      {test.ref_min ?? '...'} — {test.ref_max ?? '...'} {test.unit || ''}
                    </span>
                  )}
                  {test.ref_text && <span className="text-muted-foreground/70">{test.ref_text}</span>}
                  {test.price != null && (
                    <span className="font-medium text-foreground">{formatCurrency(test.price, currency, i18n.language)}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(test)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleting(test.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing.id ? t('clinic.lab.editTest') : t('clinic.lab.addTest')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t('clinic.lab.testName')}</Label>
                <Input className="h-9 mt-1" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('clinic.lab.category')}</Label>
                  <Input className="h-9 mt-1" value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{t('clinic.lab.unit')}</Label>
                  <Input className="h-9 mt-1" placeholder="ммоль/л" value={editing.unit} onChange={e => setEditing({ ...editing, unit: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('clinic.lab.refMin')}</Label>
                  <Input type="number" className="h-9 mt-1" value={editing.ref_min} onChange={e => setEditing({ ...editing, ref_min: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{t('clinic.lab.refMax')}</Label>
                  <Input type="number" className="h-9 mt-1" value={editing.ref_max} onChange={e => setEditing({ ...editing, ref_max: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">{t('clinic.lab.refText')}</Label>
                <Input className="h-9 mt-1" placeholder="отрицательный" value={editing.ref_text} onChange={e => setEditing({ ...editing, ref_text: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">{t('clinic.lab.price')}</Label>
                <Input type="number" className="h-9 mt-1" value={editing.price} onChange={e => setEditing({ ...editing, price: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
              <Button disabled={!editing.name.trim() || upsert.isPending} onClick={handleSave} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                {t('common.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deleting && (
        <ConfirmDialog
          open
          title={t('common.delete')}
          description={t('common.deleteConfirm')}
          onConfirm={handleDelete}
          onClose={() => setDeleting(null)}
          loading={remove.isPending}
        />
      )}
    </div>
  )
}
