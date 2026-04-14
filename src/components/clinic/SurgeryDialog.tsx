import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useActiveHospitalizations } from '@/hooks/useClinicHospitalizations'
import { useClinicOperatingRooms, useCreateSurgery, useUpdateSurgery } from '@/hooks/useClinicSurgeries'
import { toast } from '@/components/shared/Toaster'
import type { ClinicSurgery, AnesthesiaType } from '@/types'

interface SurgeryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  surgery?: ClinicSurgery
}

const ANESTHESIA_TYPES: AnesthesiaType[] = ['general', 'regional', 'local', 'sedation']

export function SurgeryDialog({ open, onOpenChange, surgery }: SurgeryDialogProps) {
  const { t } = useTranslation()
  const { data: hospitalizations = [], isLoading: hospLoading } = useActiveHospitalizations()
  const { data: rooms = [], isLoading: roomsLoading } = useClinicOperatingRooms()
  const createMut = useCreateSurgery()
  const updateMut = useUpdateSurgery()

  const isEdit = !!surgery

  const [hospId, setHospId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [procedureName, setProcedureName] = useState('')
  const [preOpDiagnosis, setPreOpDiagnosis] = useState('')
  const [surgeonName, setSurgeonName] = useState('')
  const [anesthesiologistName, setAnesthesiologistName] = useState('')
  const [assistants, setAssistants] = useState('')
  const [anesthesiaType, setAnesthesiaType] = useState<string>('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    if (surgery) {
      setHospId(surgery.hospitalization_id)
      setRoomId(surgery.operating_room_id ?? '')
      setScheduledDate(surgery.scheduled_date?.slice(0, 16) ?? '')
      setProcedureName(surgery.procedure_name)
      setPreOpDiagnosis(surgery.pre_op_diagnosis ?? '')
      setSurgeonName(surgery.surgeon_name ?? '')
      setAnesthesiologistName(surgery.anesthesiologist_name ?? '')
      setAssistants(surgery.assistants?.join(', ') ?? '')
      setAnesthesiaType(surgery.anesthesia_type ?? '')
      setNotes(surgery.notes ?? '')
    } else {
      setHospId('')
      setRoomId('')
      setScheduledDate('')
      setProcedureName('')
      setPreOpDiagnosis('')
      setSurgeonName('')
      setAnesthesiologistName('')
      setAssistants('')
      setAnesthesiaType('')
      setNotes('')
    }
  }, [open, surgery])

  const selectedHosp = hospitalizations.find(h => h.id === hospId)

  const hospLabel = (h: typeof hospitalizations[number]) => {
    const name = [h.client?.first_name, h.client?.last_name].filter(Boolean).join(' ')
    const ward = h.ward?.name ?? ''
    return ward ? `${name} — ${ward}` : name
  }

  const handleSubmit = async () => {
    if (!hospId || !procedureName.trim() || !scheduledDate) {
      toast.error(t('common.fillRequired'))
      return
    }

    const payload = {
      hospitalization_id: hospId,
      client_id: selectedHosp?.client_id ?? '',
      operating_room_id: roomId || null,
      scheduled_date: scheduledDate,
      procedure_name: procedureName.trim(),
      pre_op_diagnosis: preOpDiagnosis.trim() || null,
      surgeon_name: surgeonName.trim() || null,
      anesthesiologist_name: anesthesiologistName.trim() || null,
      assistants: assistants.split(',').map(s => s.trim()).filter(Boolean),
      anesthesia_type: (anesthesiaType as AnesthesiaType) || null,
      notes: notes.trim() || null,
    }

    try {
      if (isEdit) {
        await updateMut.mutateAsync({ id: surgery!.id, ...payload })
        toast.success(t('common.saved'))
      } else {
        await createMut.mutateAsync({ ...payload, status: 'scheduled' })
        toast.success(t('clinic.surgery.created'))
      }
      onOpenChange(false)
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const isPending = createMut.isPending || updateMut.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('clinic.surgery.editTitle') : t('clinic.surgery.schedule')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient (hospitalization) */}
          <div>
            <Label className="text-sm">{t('clinic.surgery.patient')}</Label>
            {hospLoading ? (
              <div className="h-9 flex items-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : (
              <Select value={hospId} onValueChange={setHospId} disabled={isEdit}>
                <SelectTrigger className="mt-1.5 h-9">
                  <SelectValue placeholder={t('clinic.surgery.selectPatient')} />
                </SelectTrigger>
                <SelectContent>
                  {hospitalizations.map(h => (
                    <SelectItem key={h.id} value={h.id}>{hospLabel(h)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Operating Room */}
          <div>
            <Label className="text-sm">{t('clinic.surgery.operatingRoom')}</Label>
            {roomsLoading ? (
              <div className="h-9 flex items-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : (
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger className="mt-1.5 h-9">
                  <SelectValue placeholder={t('clinic.surgery.selectRoom')} />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Scheduled date */}
          <div>
            <Label className="text-sm">{t('clinic.surgery.scheduledDate')}</Label>
            <Input
              type="datetime-local"
              className="mt-1.5 h-9"
              value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)}
            />
          </div>

          {/* Procedure name */}
          <div>
            <Label className="text-sm">{t('clinic.surgery.procedureName')}</Label>
            <Input
              className="mt-1.5 h-9"
              placeholder={t('clinic.surgery.procedureNamePlaceholder')}
              value={procedureName}
              onChange={e => setProcedureName(e.target.value)}
            />
          </div>

          {/* Pre-op diagnosis */}
          <div>
            <Label className="text-sm">{t('clinic.surgery.preOpDiagnosis')}</Label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1.5 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={preOpDiagnosis}
              onChange={e => setPreOpDiagnosis(e.target.value)}
            />
          </div>

          {/* Surgeon */}
          <div>
            <Label className="text-sm">{t('clinic.surgery.surgeonName')}</Label>
            <Input
              className="mt-1.5 h-9"
              value={surgeonName}
              onChange={e => setSurgeonName(e.target.value)}
            />
          </div>

          {/* Anesthesiologist */}
          <div>
            <Label className="text-sm">{t('clinic.surgery.anesthesiologistName')}</Label>
            <Input
              className="mt-1.5 h-9"
              value={anesthesiologistName}
              onChange={e => setAnesthesiologistName(e.target.value)}
            />
          </div>

          {/* Assistants */}
          <div>
            <Label className="text-sm">{t('clinic.surgery.assistants')}</Label>
            <Input
              className="mt-1.5 h-9"
              placeholder={t('clinic.surgery.assistantsPlaceholder')}
              value={assistants}
              onChange={e => setAssistants(e.target.value)}
            />
          </div>

          {/* Anesthesia type */}
          <div>
            <Label className="text-sm">{t('clinic.surgery.anesthesiaType')}</Label>
            <Select value={anesthesiaType} onValueChange={setAnesthesiaType}>
              <SelectTrigger className="mt-1.5 h-9">
                <SelectValue placeholder={t('clinic.surgery.selectAnesthesia')} />
              </SelectTrigger>
              <SelectContent>
                {ANESTHESIA_TYPES.map(at => (
                  <SelectItem key={at} value={at}>{t(`clinic.surgery.anesthesia_${at}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm">{t('common.notes')}</Label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1.5 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {isEdit ? t('common.save') : t('clinic.surgery.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
