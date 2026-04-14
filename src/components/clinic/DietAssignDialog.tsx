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
import { useClinicDietTables, useCreateMealPlan } from '@/hooks/useClinicNutrition'
import { toast } from '@/components/shared/Toaster'

interface DietAssignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DietAssignDialog({ open, onOpenChange }: DietAssignDialogProps) {
  const { t } = useTranslation()
  const { data: hospitalizations = [], isLoading: hospLoading } = useActiveHospitalizations()
  const { data: dietTables = [], isLoading: dietsLoading } = useClinicDietTables()
  const createMut = useCreateMealPlan()

  const [hospId, setHospId] = useState('')
  const [dietTableId, setDietTableId] = useState('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      setHospId('')
      setDietTableId('')
      setStartDate(new Date().toISOString().slice(0, 10))
      setSpecialInstructions('')
      setNotes('')
    }
  }, [open])

  const hospLabel = (h: typeof hospitalizations[number]) => {
    const name = [h.client?.first_name, h.client?.last_name].filter(Boolean).join(' ')
    const ward = h.ward?.name ?? ''
    return ward ? `${name} — ${ward}` : name
  }

  const dietLabel = (d: typeof dietTables[number]) =>
    `${d.number} — ${d.name}`

  const handleSubmit = async () => {
    if (!hospId || !dietTableId) {
      toast.error(t('common.fillRequired'))
      return
    }

    try {
      await createMut.mutateAsync({
        hospitalization_id: hospId,
        diet_table_id: dietTableId,
        start_date: startDate || undefined,
        special_instructions: specialInstructions.trim() || null,
        notes: notes.trim() || null,
      })
      toast.success(t('clinic.nutrition.planCreated'))
      onOpenChange(false)
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('clinic.nutrition.assignDiet')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hospitalization */}
          <div>
            <Label className="text-sm">{t('clinic.nutrition.patient')}</Label>
            {hospLoading ? (
              <div className="h-9 flex items-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : (
              <Select value={hospId} onValueChange={setHospId}>
                <SelectTrigger className="mt-1.5 h-9">
                  <SelectValue placeholder={t('clinic.nutrition.selectPatient')} />
                </SelectTrigger>
                <SelectContent>
                  {hospitalizations.map(h => (
                    <SelectItem key={h.id} value={h.id}>{hospLabel(h)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Diet table */}
          <div>
            <Label className="text-sm">{t('clinic.nutrition.dietTable')}</Label>
            {dietsLoading ? (
              <div className="h-9 flex items-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : (
              <Select value={dietTableId} onValueChange={setDietTableId}>
                <SelectTrigger className="mt-1.5 h-9">
                  <SelectValue placeholder={t('clinic.nutrition.selectDiet')} />
                </SelectTrigger>
                <SelectContent>
                  {dietTables.map(d => (
                    <SelectItem key={d.id} value={d.id}>{dietLabel(d)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Start date */}
          <div>
            <Label className="text-sm">{t('clinic.nutrition.startDate')}</Label>
            <Input
              type="date"
              className="mt-1.5 h-9"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>

          {/* Special instructions */}
          <div>
            <Label className="text-sm">{t('clinic.nutrition.specialInstructions')}</Label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1.5 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={specialInstructions}
              onChange={e => setSpecialInstructions(e.target.value)}
            />
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMut.isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!hospId || !dietTableId || createMut.isPending}>
            {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {t('clinic.nutrition.assign')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
