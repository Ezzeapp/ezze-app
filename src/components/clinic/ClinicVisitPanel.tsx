import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useClinicVisit, useCreateClinicVisit, useUpdateClinicVisit } from '@/hooks/useClinicVisits'
import { useClinicVisitTemplates } from '@/hooks/useClinicVisitTemplates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, Plus, Trash2, FileText, FlaskConical, Pill } from 'lucide-react'
import { LabOrderDialog } from './LabOrderDialog'
import { DispenseDialog } from './DispenseDialog'
import { toast } from '@/components/shared/Toaster'
import type { Prescription } from '@/types'

interface ClinicVisitPanelProps {
  appointmentId: string
  clientId?: string
}

export function ClinicVisitPanel({ appointmentId, clientId }: ClinicVisitPanelProps) {
  const { t } = useTranslation()
  const { data: visit, isLoading } = useClinicVisit(appointmentId)
  const { data: templates = [] } = useClinicVisitTemplates()
  const createVisit = useCreateClinicVisit()
  const updateVisit = useUpdateClinicVisit()

  const [labDialogOpen, setLabDialogOpen] = useState(false)
  const [dispenseDialogOpen, setDispenseDialogOpen] = useState(false)

  const [form, setForm] = useState({
    complaints: '',
    examination: '',
    diagnosis: '',
    diagnosis_code: '',
    treatment: '',
    recommendations: '',
    next_visit_date: '',
    prescriptions: [] as Prescription[],
  })

  useEffect(() => {
    if (visit) {
      setForm({
        complaints: visit.complaints || '',
        examination: visit.examination || '',
        diagnosis: visit.diagnosis || '',
        diagnosis_code: visit.diagnosis_code || '',
        treatment: visit.treatment || '',
        recommendations: visit.recommendations || '',
        next_visit_date: visit.next_visit_date || '',
        prescriptions: visit.prescriptions || [],
      })
    }
  }, [visit])

  const addPrescription = () => {
    setForm(f => ({
      ...f,
      prescriptions: [...f.prescriptions, { name: '', dosage: '', frequency: '', duration: '' }],
    }))
  }

  const updatePrescription = (idx: number, field: keyof Prescription, value: string) => {
    setForm(f => ({
      ...f,
      prescriptions: f.prescriptions.map((p, i) => i === idx ? { ...p, [field]: value } : p),
    }))
  }

  const removePrescription = (idx: number) => {
    setForm(f => ({ ...f, prescriptions: f.prescriptions.filter((_, i) => i !== idx) }))
  }

  const applyTemplate = (templateId: string) => {
    const tmpl = templates.find(t => t.id === templateId)
    if (!tmpl) return
    setForm(f => ({
      ...f,
      complaints: tmpl.complaints || f.complaints,
      examination: tmpl.examination || f.examination,
      diagnosis: tmpl.diagnosis || f.diagnosis,
      treatment: tmpl.treatment || f.treatment,
      recommendations: tmpl.recommendations || f.recommendations,
      prescriptions: tmpl.prescriptions?.length ? tmpl.prescriptions : f.prescriptions,
    }))
  }

  const handleSave = async () => {
    try {
      const payload = {
        complaints: form.complaints || null,
        examination: form.examination || null,
        diagnosis: form.diagnosis || null,
        diagnosis_code: form.diagnosis_code || null,
        treatment: form.treatment || null,
        recommendations: form.recommendations || null,
        next_visit_date: form.next_visit_date || null,
        prescriptions: form.prescriptions.filter(p => p.name),
        attachments: visit?.attachments ?? [],
      }

      if (visit) {
        await updateVisit.mutateAsync({ id: visit.id, ...payload })
      } else {
        await createVisit.mutateAsync({ appointment_id: appointmentId, ...payload, template_id: null })
      }
      toast.success(t('clinic.visit.visitSaved'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
  }

  const isPending = createVisit.isPending || updateVisit.isPending

  return (
    <div className="space-y-3 border-t pt-3 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-primary" />
          {t('clinic.visit.title')}
        </p>
        {templates.length > 0 && (
          <Select onValueChange={applyTemplate}>
            <SelectTrigger className="h-8 w-auto text-xs gap-1">
              <SelectValue placeholder={t('clinic.visit.fromTemplate')} />
            </SelectTrigger>
            <SelectContent>
              {templates.map(tmpl => (
                <SelectItem key={tmpl.id} value={tmpl.id}>{tmpl.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div>
        <Label className="text-xs">{t('clinic.visit.complaints')}</Label>
        <textarea
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder={t('clinic.visit.complaintsPlaceholder')}
          value={form.complaints}
          onChange={e => setForm(f => ({ ...f, complaints: e.target.value }))}
        />
      </div>

      <div>
        <Label className="text-xs">{t('clinic.visit.examination')}</Label>
        <textarea
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder={t('clinic.visit.examinationPlaceholder')}
          value={form.examination}
          onChange={e => setForm(f => ({ ...f, examination: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">{t('clinic.visit.diagnosis')}</Label>
          <Input
            className="h-9 mt-1"
            placeholder={t('clinic.visit.diagnosisPlaceholder')}
            value={form.diagnosis}
            onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-xs">{t('clinic.visit.diagnosisCode')}</Label>
          <Input
            className="h-9 mt-1"
            placeholder="K02.1"
            value={form.diagnosis_code}
            onChange={e => setForm(f => ({ ...f, diagnosis_code: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">{t('clinic.visit.treatment')}</Label>
        <textarea
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder={t('clinic.visit.treatmentPlaceholder')}
          value={form.treatment}
          onChange={e => setForm(f => ({ ...f, treatment: e.target.value }))}
        />
      </div>

      {/* Рецепты */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs">{t('clinic.visit.prescriptions')}</Label>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addPrescription}>
            <Plus className="h-3 w-3" />
            {t('clinic.visit.addPrescription')}
          </Button>
        </div>
        {form.prescriptions.map((p, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-1.5 mb-1.5 items-end">
            <Input
              className="h-8 text-xs"
              placeholder={t('clinic.visit.prescriptionName')}
              value={p.name}
              onChange={e => updatePrescription(idx, 'name', e.target.value)}
            />
            <Input
              className="h-8 text-xs w-20"
              placeholder={t('clinic.visit.prescriptionDosage')}
              value={p.dosage}
              onChange={e => updatePrescription(idx, 'dosage', e.target.value)}
            />
            <Input
              className="h-8 text-xs w-20"
              placeholder={t('clinic.visit.prescriptionFrequency')}
              value={p.frequency}
              onChange={e => updatePrescription(idx, 'frequency', e.target.value)}
            />
            <Input
              className="h-8 text-xs w-20"
              placeholder={t('clinic.visit.prescriptionDuration')}
              value={p.duration}
              onChange={e => updatePrescription(idx, 'duration', e.target.value)}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removePrescription(idx)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <div>
        <Label className="text-xs">{t('clinic.visit.recommendations')}</Label>
        <textarea
          className="flex min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder={t('clinic.visit.recommendationsPlaceholder')}
          value={form.recommendations}
          onChange={e => setForm(f => ({ ...f, recommendations: e.target.value }))}
        />
      </div>

      <div>
        <Label className="text-xs">{t('clinic.visit.nextVisitDate')}</Label>
        <Input
          type="date"
          className="h-9 mt-1 w-auto"
          value={form.next_visit_date}
          onChange={e => setForm(f => ({ ...f, next_visit_date: e.target.value }))}
        />
      </div>

      <Button className="w-full gap-1.5" disabled={isPending} onClick={handleSave}>
        <Save className="h-4 w-4" />
        {t('clinic.visit.saveVisit')}
      </Button>

      {/* Lab & Pharmacy buttons (only if visit is saved) */}
      {visit && clientId && (
        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setLabDialogOpen(true)}>
            <FlaskConical className="h-3.5 w-3.5" />
            {t('clinic.lab.sendToLab')}
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setDispenseDialogOpen(true)}>
            <Pill className="h-3.5 w-3.5" />
            {t('clinic.pharmacy.dispenseMedicines')}
          </Button>
        </div>
      )}

      {labDialogOpen && clientId && (
        <LabOrderDialog
          open={labDialogOpen}
          onOpenChange={setLabDialogOpen}
          clientId={clientId}
          visitId={visit?.id}
        />
      )}

      {dispenseDialogOpen && clientId && (
        <DispenseDialog
          open={dispenseDialogOpen}
          onOpenChange={setDispenseDialogOpen}
          clientId={clientId}
          visitId={visit?.id}
          prescriptions={form.prescriptions}
        />
      )}
    </div>
  )
}
