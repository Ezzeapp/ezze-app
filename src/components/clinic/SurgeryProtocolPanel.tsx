import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Play, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUpdateSurgery } from '@/hooks/useClinicSurgeries'
import { toast } from '@/components/shared/Toaster'
import type { ClinicSurgery } from '@/types'

interface SurgeryProtocolPanelProps {
  surgery: ClinicSurgery
  onClose?: () => void
}

export function SurgeryProtocolPanel({ surgery, onClose }: SurgeryProtocolPanelProps) {
  const { t } = useTranslation()
  const updateMut = useUpdateSurgery()

  const [actualStart, setActualStart] = useState(surgery.actual_start?.slice(0, 16) ?? '')
  const [actualEnd, setActualEnd] = useState(surgery.actual_end?.slice(0, 16) ?? '')
  const [anesthesiaDuration, setAnesthesiaDuration] = useState(surgery.anesthesia_duration_min?.toString() ?? '')
  const [bloodLoss, setBloodLoss] = useState(surgery.blood_loss_ml?.toString() ?? '')
  const [complications, setComplications] = useState(surgery.complications ?? '')
  const [postOpDiagnosis, setPostOpDiagnosis] = useState(surgery.post_op_diagnosis ?? '')
  const [notes, setNotes] = useState(surgery.notes ?? '')

  const clientName = [surgery.client?.first_name, surgery.client?.last_name].filter(Boolean).join(' ') || t('common.unknown')

  const handleSave = async (extraPayload?: Partial<ClinicSurgery>) => {
    try {
      await updateMut.mutateAsync({
        id: surgery.id,
        actual_start: actualStart || null,
        actual_end: actualEnd || null,
        anesthesia_duration_min: anesthesiaDuration ? Number(anesthesiaDuration) : null,
        blood_loss_ml: bloodLoss ? Number(bloodLoss) : null,
        complications: complications.trim() || null,
        post_op_diagnosis: postOpDiagnosis.trim() || null,
        notes: notes.trim() || null,
        ...extraPayload,
      })
      toast.success(t('common.saved'))
      if (extraPayload?.status) onClose?.()
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const handleStart = () => {
    const now = new Date().toISOString().slice(0, 16)
    setActualStart(now)
    handleSave({ status: 'in_progress', actual_start: now })
  }

  const handleComplete = () => {
    const now = new Date().toISOString().slice(0, 16)
    setActualEnd(now)
    handleSave({ status: 'completed', actual_end: now })
  }

  return (
    <div className="space-y-4">
      {/* Read-only info */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">{t('clinic.surgery.patient')}</p>
          <p className="font-medium">{clientName}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">{t('clinic.surgery.procedureName')}</p>
          <p className="font-medium">{surgery.procedure_name}</p>
        </div>
        {surgery.pre_op_diagnosis && (
          <div className="col-span-2">
            <p className="text-muted-foreground text-xs">{t('clinic.surgery.preOpDiagnosis')}</p>
            <p className="font-medium">{surgery.pre_op_diagnosis}</p>
          </div>
        )}
        <div>
          <p className="text-muted-foreground text-xs">{t('clinic.surgery.surgeonName')}</p>
          <p className="font-medium">{surgery.surgeon_name || '—'}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">{t('clinic.surgery.anesthesiologistName')}</p>
          <p className="font-medium">{surgery.anesthesiologist_name || '—'}</p>
        </div>
      </div>

      <hr className="border-border" />

      {/* Editable protocol fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm">{t('clinic.surgery.actualStart')}</Label>
          <Input
            type="datetime-local"
            className="mt-1 h-9"
            value={actualStart}
            onChange={e => setActualStart(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-sm">{t('clinic.surgery.actualEnd')}</Label>
          <Input
            type="datetime-local"
            className="mt-1 h-9"
            value={actualEnd}
            onChange={e => setActualEnd(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-sm">{t('clinic.surgery.anesthesiaDuration')}</Label>
          <Input
            type="number"
            className="mt-1 h-9"
            min={0}
            placeholder={t('clinic.surgery.minutes')}
            value={anesthesiaDuration}
            onChange={e => setAnesthesiaDuration(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-sm">{t('clinic.surgery.bloodLoss')}</Label>
          <Input
            type="number"
            className="mt-1 h-9"
            min={0}
            placeholder="ml"
            value={bloodLoss}
            onChange={e => setBloodLoss(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label className="text-sm">{t('clinic.surgery.complications')}</Label>
        <textarea
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={complications}
          onChange={e => setComplications(e.target.value)}
        />
      </div>

      <div>
        <Label className="text-sm">{t('clinic.surgery.postOpDiagnosis')}</Label>
        <textarea
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={postOpDiagnosis}
          onChange={e => setPostOpDiagnosis(e.target.value)}
        />
      </div>

      <div>
        <Label className="text-sm">{t('common.notes')}</Label>
        <textarea
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-2">
        {surgery.status === 'scheduled' && (
          <Button variant="default" className="gap-1.5" onClick={handleStart} disabled={updateMut.isPending}>
            {updateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {t('clinic.surgery.start')}
          </Button>
        )}
        {surgery.status === 'in_progress' && (
          <Button variant="default" className="gap-1.5" onClick={handleComplete} disabled={updateMut.isPending}>
            {updateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {t('clinic.surgery.complete')}
          </Button>
        )}
        <Button variant="outline" onClick={() => handleSave()} disabled={updateMut.isPending}>
          {updateMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
          {t('common.save')}
        </Button>
      </div>
    </div>
  )
}
