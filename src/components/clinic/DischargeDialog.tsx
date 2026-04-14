import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDischargePatient } from '@/hooks/useClinicHospitalizations'
import { toast } from '@/components/shared/Toaster'
import type { ClinicHospitalization } from '@/types'

interface DischargeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hospitalization: ClinicHospitalization
}

function toLocalDatetime(date: Date) {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

export function DischargeDialog({ open, onOpenChange, hospitalization }: DischargeDialogProps) {
  const { t } = useTranslation()
  const dischargeMutation = useDischargePatient()

  const [dischargeDate, setDischargeDate] = useState(() => toLocalDatetime(new Date()))
  const [summary, setSummary] = useState('')
  const [notes, setNotes] = useState('')

  // Reset on open
  useEffect(() => {
    if (open) {
      setDischargeDate(toLocalDatetime(new Date()))
      setSummary('')
      setNotes('')
    }
  }, [open])

  const patientName = [hospitalization.client?.first_name, hospitalization.client?.last_name]
    .filter(Boolean).join(' ') || '—'

  async function handleConfirm() {
    try {
      await dischargeMutation.mutateAsync({
        id: hospitalization.id,
        bed_id: hospitalization.bed_id,
        discharge_summary: summary || null,
        notes: notes || null,
      })
      toast({ title: t('clinic.discharge.success'), variant: 'success' })
      onOpenChange(false)
    } catch {
      toast({ title: t('clinic.discharge.error'), variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('clinic.discharge.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('clinic.discharge.confirm', { name: patientName })}
          </p>

          <div className="space-y-2">
            <Label>{t('clinic.discharge.date')}</Label>
            <Input
              type="datetime-local"
              value={dischargeDate}
              onChange={e => setDischargeDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('clinic.discharge.summary')}</Label>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder={t('clinic.discharge.summaryPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('clinic.discharge.notes')}</Label>
            <textarea
              className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('clinic.discharge.notesPlaceholder')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={dischargeMutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={dischargeMutation.isPending}>
            {dischargeMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {t('clinic.discharge.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
