import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClinicVisitTemplates, useUpsertVisitTemplate, useDeleteVisitTemplate } from '@/hooks/useClinicVisitTemplates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { toast } from '@/components/shared/Toaster'
import { Plus, Pencil, Trash2, FileText, Save } from 'lucide-react'
import type { ClinicVisitTemplate, Prescription } from '@/types'

interface TemplateForm {
  id?: string
  name: string
  specialty: string
  complaints: string
  examination: string
  diagnosis: string
  treatment: string
  recommendations: string
  prescriptions: Prescription[]
}

const EMPTY_FORM: TemplateForm = {
  name: '', specialty: '', complaints: '', examination: '',
  diagnosis: '', treatment: '', recommendations: '', prescriptions: [],
}

export function VisitTemplatesSettingsTab() {
  const { t } = useTranslation()
  const { data: templates = [], isLoading } = useClinicVisitTemplates()
  const upsert = useUpsertVisitTemplate()
  const remove = useDeleteVisitTemplate()

  const [editing, setEditing] = useState<TemplateForm | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const openCreate = () => setEditing({ ...EMPTY_FORM })
  const openEdit = (tmpl: ClinicVisitTemplate) => setEditing({
    id: tmpl.id,
    name: tmpl.name,
    specialty: tmpl.specialty || '',
    complaints: tmpl.complaints || '',
    examination: tmpl.examination || '',
    diagnosis: tmpl.diagnosis || '',
    treatment: tmpl.treatment || '',
    recommendations: tmpl.recommendations || '',
    prescriptions: tmpl.prescriptions || [],
  })

  const handleSave = async () => {
    if (!editing || !editing.name.trim()) return
    try {
      await upsert.mutateAsync({
        ...(editing.id ? { id: editing.id } : {}),
        name: editing.name.trim(),
        specialty: editing.specialty || null,
        complaints: editing.complaints || null,
        examination: editing.examination || null,
        diagnosis: editing.diagnosis || null,
        treatment: editing.treatment || null,
        recommendations: editing.recommendations || null,
        prescriptions: editing.prescriptions.filter(p => p.name),
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

  const addPrescription = () => {
    if (!editing) return
    setEditing({ ...editing, prescriptions: [...editing.prescriptions, { name: '', dosage: '', frequency: '', duration: '' }] })
  }

  const updatePrescription = (idx: number, field: keyof Prescription, value: string) => {
    if (!editing) return
    setEditing({
      ...editing,
      prescriptions: editing.prescriptions.map((p, i) => i === idx ? { ...p, [field]: value } : p),
    })
  }

  const removePrescription = (idx: number) => {
    if (!editing) return
    setEditing({ ...editing, prescriptions: editing.prescriptions.filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('clinic.settings.visitTemplates')}</h3>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          {t('clinic.settings.addTemplate')}
        </Button>
      </div>

      {!isLoading && templates.length === 0 && (
        <EmptyState
          icon={FileText}
          title={t('clinic.settings.noTemplates')}
          description={t('clinic.settings.noTemplatesDesc')}
        />
      )}

      <div className="space-y-2">
        {templates.map(tmpl => (
          <Card key={tmpl.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{tmpl.name}</p>
                {tmpl.specialty && <p className="text-xs text-muted-foreground">{tmpl.specialty}</p>}
                {tmpl.diagnosis && <p className="text-xs text-muted-foreground mt-0.5 truncate">{tmpl.diagnosis}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tmpl)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleting(tmpl.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit/Create Dialog */}
      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editing.id ? t('clinic.settings.editTemplate') : t('clinic.settings.addTemplate')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('clinic.settings.templateName')}</Label>
                  <Input
                    className="h-9 mt-1"
                    value={editing.name}
                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t('clinic.settings.templateSpecialty')}</Label>
                  <Input
                    className="h-9 mt-1"
                    value={editing.specialty}
                    onChange={e => setEditing({ ...editing, specialty: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">{t('clinic.visit.complaints')}</Label>
                <textarea
                  className="flex min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={editing.complaints}
                  onChange={e => setEditing({ ...editing, complaints: e.target.value })}
                />
              </div>

              <div>
                <Label className="text-xs">{t('clinic.visit.examination')}</Label>
                <textarea
                  className="flex min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={editing.examination}
                  onChange={e => setEditing({ ...editing, examination: e.target.value })}
                />
              </div>

              <div>
                <Label className="text-xs">{t('clinic.visit.diagnosis')}</Label>
                <Input
                  className="h-9 mt-1"
                  value={editing.diagnosis}
                  onChange={e => setEditing({ ...editing, diagnosis: e.target.value })}
                />
              </div>

              <div>
                <Label className="text-xs">{t('clinic.visit.treatment')}</Label>
                <textarea
                  className="flex min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={editing.treatment}
                  onChange={e => setEditing({ ...editing, treatment: e.target.value })}
                />
              </div>

              <div>
                <Label className="text-xs">{t('clinic.visit.recommendations')}</Label>
                <textarea
                  className="flex min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={editing.recommendations}
                  onChange={e => setEditing({ ...editing, recommendations: e.target.value })}
                />
              </div>

              {/* Prescriptions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs">{t('clinic.visit.prescriptions')}</Label>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addPrescription}>
                    <Plus className="h-3 w-3" />
                    {t('clinic.visit.addPrescription')}
                  </Button>
                </div>
                {editing.prescriptions.map((p, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-1.5 mb-1.5 items-end">
                    <Input className="h-8 text-xs" placeholder={t('clinic.visit.prescriptionName')}
                      value={p.name} onChange={e => updatePrescription(idx, 'name', e.target.value)} />
                    <Input className="h-8 text-xs w-16" placeholder={t('clinic.visit.prescriptionDosage')}
                      value={p.dosage} onChange={e => updatePrescription(idx, 'dosage', e.target.value)} />
                    <Input className="h-8 text-xs w-16" placeholder={t('clinic.visit.prescriptionFrequency')}
                      value={p.frequency} onChange={e => updatePrescription(idx, 'frequency', e.target.value)} />
                    <Input className="h-8 text-xs w-16" placeholder={t('clinic.visit.prescriptionDuration')}
                      value={p.duration} onChange={e => updatePrescription(idx, 'duration', e.target.value)} />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removePrescription(idx)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
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

      {/* Delete confirmation */}
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
