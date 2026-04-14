import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Loader2, Thermometer, Heart, Wind } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useClinicObservations, useCreateObservation } from '@/hooks/useClinicHospitalizations'
import { toast } from '@/components/shared/Toaster'
import type { ClinicDailyObservation } from '@/types'

interface DailyObservationPanelProps {
  hospitalizationId: string
}

function vitalColor(value: number | null | undefined, warn: number, danger: number, direction: 'above' | 'below' = 'above') {
  if (value == null) return ''
  if (direction === 'above') {
    if (value >= danger) return 'text-red-600 dark:text-red-400 font-medium'
    if (value >= warn) return 'text-amber-600 dark:text-amber-400 font-medium'
  } else {
    if (value <= danger) return 'text-red-600 dark:text-red-400 font-medium'
    if (value <= warn) return 'text-amber-600 dark:text-amber-400 font-medium'
  }
  return ''
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function DailyObservationPanel({ hospitalizationId }: DailyObservationPanelProps) {
  const { t } = useTranslation()
  const { data: observations = [], isLoading } = useClinicObservations(hospitalizationId)
  const createMutation = useCreateObservation()
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [obsDate, setObsDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [temperature, setTemperature] = useState('')
  const [bpSystolic, setBpSystolic] = useState('')
  const [bpDiastolic, setBpDiastolic] = useState('')
  const [pulse, setPulse] = useState('')
  const [spo2, setSpo2] = useState('')
  const [respRate, setRespRate] = useState('')
  const [obsNotes, setObsNotes] = useState('')
  const [treatmentNotes, setTreatmentNotes] = useState('')

  function resetForm() {
    setObsDate(new Date().toISOString().slice(0, 10))
    setTemperature('')
    setBpSystolic('')
    setBpDiastolic('')
    setPulse('')
    setSpo2('')
    setRespRate('')
    setObsNotes('')
    setTreatmentNotes('')
  }

  async function handleSave() {
    try {
      await createMutation.mutateAsync({
        hospitalization_id: hospitalizationId,
        observation_date: obsDate,
        temperature: temperature ? parseFloat(temperature) : null,
        bp_systolic: bpSystolic ? parseInt(bpSystolic) : null,
        bp_diastolic: bpDiastolic ? parseInt(bpDiastolic) : null,
        pulse: pulse ? parseInt(pulse) : null,
        spo2: spo2 ? parseInt(spo2) : null,
        respiratory_rate: respRate ? parseInt(respRate) : null,
        notes: obsNotes || null,
        treatment_notes: treatmentNotes || null,
      })
      toast({ title: t('clinic.obs.saved'), variant: 'success' })
      resetForm()
      setShowForm(false)
    } catch {
      toast({ title: t('clinic.obs.error'), variant: 'destructive' })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => <Skeleton key={i} className="h-12 rounded-md" />)}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{t('clinic.obs.title')}</h4>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 h-7 text-xs"
          onClick={() => setShowForm(prev => !prev)}
        >
          <Plus className="h-3.5 w-3.5" />
          {t('clinic.obs.add')}
        </Button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{t('clinic.obs.date')}</Label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={obsDate}
                onChange={e => setObsDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('clinic.obs.temperature')}</Label>
              <Input
                type="number"
                step="0.1"
                className="h-8 text-xs"
                placeholder="36.6"
                value={temperature}
                onChange={e => setTemperature(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('clinic.obs.pulse')}</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                placeholder="72"
                value={pulse}
                onChange={e => setPulse(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('clinic.obs.bpSystolic')}</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                placeholder="120"
                value={bpSystolic}
                onChange={e => setBpSystolic(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('clinic.obs.bpDiastolic')}</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                placeholder="80"
                value={bpDiastolic}
                onChange={e => setBpDiastolic(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('clinic.obs.spo2')}</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                placeholder="98"
                value={spo2}
                onChange={e => setSpo2(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('clinic.obs.respRate')}</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                placeholder="16"
                value={respRate}
                onChange={e => setRespRate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">{t('clinic.obs.notes')}</Label>
            <textarea
              className="w-full min-h-[40px] rounded-md border border-input bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              value={obsNotes}
              onChange={e => setObsNotes(e.target.value)}
              placeholder={t('clinic.obs.notesPlaceholder')}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">{t('clinic.obs.treatmentNotes')}</Label>
            <textarea
              className="w-full min-h-[40px] rounded-md border border-input bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              value={treatmentNotes}
              onChange={e => setTreatmentNotes(e.target.value)}
              placeholder={t('clinic.obs.treatmentPlaceholder')}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { resetForm(); setShowForm(false) }}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {t('common.save')}
            </Button>
          </div>
        </div>
      )}

      {/* Observations list */}
      {observations.length === 0 && !showForm ? (
        <p className="text-xs text-muted-foreground italic text-center py-3">
          {t('clinic.obs.empty')}
        </p>
      ) : (
        <div className="space-y-1.5">
          {observations.map((obs: ClinicDailyObservation) => (
            <div
              key={obs.id}
              className="rounded-md border bg-card p-2.5 text-xs"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-medium">{formatDate(obs.observation_date)}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {obs.temperature != null && (
                  <span className={`flex items-center gap-1 ${vitalColor(obs.temperature, 37.2, 37.5)}`}>
                    <Thermometer className="h-3 w-3" />
                    {obs.temperature.toFixed(1)}
                  </span>
                )}
                {(obs.bp_systolic != null || obs.bp_diastolic != null) && (
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    {obs.bp_systolic ?? '—'}/{obs.bp_diastolic ?? '—'}
                  </span>
                )}
                {obs.pulse != null && (
                  <span className={`${vitalColor(obs.pulse, 90, 100)}`}>
                    {t('clinic.obs.pulse')}: {obs.pulse}
                  </span>
                )}
                {obs.spo2 != null && (
                  <span className={`${vitalColor(obs.spo2, 96, 95, 'below')}`}>
                    SpO2: {obs.spo2}%
                  </span>
                )}
                {obs.respiratory_rate != null && (
                  <span className="flex items-center gap-1">
                    <Wind className="h-3 w-3" />
                    {obs.respiratory_rate}
                  </span>
                )}
              </div>
              {obs.notes && (
                <p className="text-muted-foreground mt-1 line-clamp-2">{obs.notes}</p>
              )}
              {obs.treatment_notes && (
                <p className="text-muted-foreground mt-0.5 line-clamp-2 italic">{obs.treatment_notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
