import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useClinicPatientCard, useUpsertPatientCard } from '@/hooks/useClinicPatientCard'
import { useClinicVisitsByPatient } from '@/hooks/useClinicVisits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, Pencil, AlertTriangle, Calendar, Stethoscope, FileText } from 'lucide-react'
import { toast } from '@/components/shared/Toaster'
import type { Gender, BloodType } from '@/types'

const BLOOD_TYPES: BloodType[] = ['I+', 'I-', 'II+', 'II-', 'III+', 'III-', 'IV+', 'IV-']

export function ClinicMedicalCard({ clientId }: { clientId: string }) {
  const { t } = useTranslation()
  const { data: card, isLoading } = useClinicPatientCard(clientId)
  const { data: visits = [] } = useClinicVisitsByPatient(clientId)
  const upsert = useUpsertPatientCard()
  const [editing, setEditing] = useState(false)

  const [form, setForm] = useState({
    gender: '' as Gender | '',
    blood_type: '' as BloodType | '',
    allergies: '',
    contraindications: '',
    chronic_diseases: '',
    insurance_number: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  })

  useEffect(() => {
    if (card) {
      setForm({
        gender: card.gender || '',
        blood_type: card.blood_type || '',
        allergies: card.allergies || '',
        contraindications: card.contraindications || '',
        chronic_diseases: card.chronic_diseases || '',
        insurance_number: card.insurance_number || '',
        emergency_contact_name: card.emergency_contact_name || '',
        emergency_contact_phone: card.emergency_contact_phone || '',
      })
    }
  }, [card])

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        client_id: clientId,
        gender: form.gender || null,
        blood_type: form.blood_type || null,
        allergies: form.allergies || null,
        contraindications: form.contraindications || null,
        chronic_diseases: form.chronic_diseases || null,
        insurance_number: form.insurance_number || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
      })
      toast.success(t('common.saved'))
      setEditing(false)
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
      </div>
    )
  }

  const hasAllergies = !!card?.allergies
  const hasContraindications = !!card?.contraindications

  return (
    <div className="space-y-4">
      {/* Предупреждения */}
      {(hasAllergies || hasContraindications) && !editing && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900/50 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-semibold">{t('clinic.medcard.allergies')}</span>
          </div>
          {hasAllergies && <p className="text-sm text-orange-800 dark:text-orange-300">{card.allergies}</p>}
          {hasContraindications && (
            <>
              <p className="text-xs font-medium text-orange-700 dark:text-orange-400 mt-1">{t('clinic.medcard.contraindications')}:</p>
              <p className="text-sm text-orange-800 dark:text-orange-300">{card.contraindications}</p>
            </>
          )}
        </div>
      )}

      {/* Кнопка редактирования */}
      {!editing && (
        <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          {card ? t('common.edit') : t('clinic.medcard.noCardDesc')}
        </Button>
      )}

      {/* Форма */}
      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t('clinic.medcard.gender')}</Label>
              <Select value={form.gender} onValueChange={(v) => setForm(f => ({ ...f, gender: v as Gender }))}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t('clinic.medcard.male')}</SelectItem>
                  <SelectItem value="female">{t('clinic.medcard.female')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('clinic.medcard.bloodType')}</Label>
              <Select value={form.blood_type} onValueChange={(v) => setForm(f => ({ ...f, blood_type: v as BloodType }))}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_TYPES.map(bt => (
                    <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">{t('clinic.medcard.allergies')}</Label>
            <Input
              className="h-9 mt-1"
              placeholder={t('clinic.medcard.allergiesPlaceholder')}
              value={form.allergies}
              onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))}
            />
          </div>

          <div>
            <Label className="text-xs">{t('clinic.medcard.contraindications')}</Label>
            <Input
              className="h-9 mt-1"
              placeholder={t('clinic.medcard.contraindicationsPlaceholder')}
              value={form.contraindications}
              onChange={e => setForm(f => ({ ...f, contraindications: e.target.value }))}
            />
          </div>

          <div>
            <Label className="text-xs">{t('clinic.medcard.chronicDiseases')}</Label>
            <Input
              className="h-9 mt-1"
              placeholder={t('clinic.medcard.chronicDiseasesPlaceholder')}
              value={form.chronic_diseases}
              onChange={e => setForm(f => ({ ...f, chronic_diseases: e.target.value }))}
            />
          </div>

          <div>
            <Label className="text-xs">{t('clinic.medcard.insuranceNumber')}</Label>
            <Input
              className="h-9 mt-1"
              value={form.insurance_number}
              onChange={e => setForm(f => ({ ...f, insurance_number: e.target.value }))}
            />
          </div>

          <div className="border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">{t('clinic.medcard.emergencyContact')}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t('clinic.medcard.emergencyName')}</Label>
                <Input
                  className="h-9 mt-1"
                  value={form.emergency_contact_name}
                  onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">{t('clinic.medcard.emergencyPhone')}</Label>
                <Input
                  className="h-9 mt-1"
                  value={form.emergency_contact_phone}
                  onChange={e => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" size="sm" className="flex-1" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" className="flex-1 gap-1.5" disabled={upsert.isPending} onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              {t('common.save')}
            </Button>
          </div>
        </div>
      ) : card ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {card.gender && (
              <div className="rounded-lg bg-muted/50 p-2.5">
                <p className="text-xs text-muted-foreground">{t('clinic.medcard.gender')}</p>
                <p className="font-medium">{t(`clinic.medcard.${card.gender}`)}</p>
              </div>
            )}
            {card.blood_type && (
              <div className="rounded-lg bg-muted/50 p-2.5">
                <p className="text-xs text-muted-foreground">{t('clinic.medcard.bloodType')}</p>
                <p className="font-medium">{card.blood_type}</p>
              </div>
            )}
          </div>
          {card.chronic_diseases && (
            <div className="rounded-lg bg-muted/50 p-2.5 text-sm">
              <p className="text-xs text-muted-foreground">{t('clinic.medcard.chronicDiseases')}</p>
              <p>{card.chronic_diseases}</p>
            </div>
          )}
          {card.insurance_number && (
            <div className="rounded-lg bg-muted/50 p-2.5 text-sm">
              <p className="text-xs text-muted-foreground">{t('clinic.medcard.insuranceNumber')}</p>
              <p>{card.insurance_number}</p>
            </div>
          )}
          {(card.emergency_contact_name || card.emergency_contact_phone) && (
            <div className="rounded-lg bg-muted/50 p-2.5 text-sm">
              <p className="text-xs text-muted-foreground">{t('clinic.medcard.emergencyContact')}</p>
              <p>{card.emergency_contact_name} {card.emergency_contact_phone}</p>
            </div>
          )}
        </div>
      ) : null}

      {/* История приёмов */}
      {visits.length > 0 && (
        <div className="border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5">
            <Stethoscope className="h-3.5 w-3.5" />
            {t('clinic.visit.visitHistory')}
          </p>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {visits.map((v: any) => (
              <div key={v.id} className="rounded-lg border p-2.5 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span className="text-xs">{v.appointment_date} {v.appointment_time?.slice(0, 5)}</span>
                  </div>
                  {v.service_name && <Badge variant="secondary" className="text-xs">{v.service_name}</Badge>}
                </div>
                {v.diagnosis && (
                  <div className="flex items-start gap-1.5">
                    <FileText className="h-3 w-3 text-muted-foreground mt-0.5" />
                    <p className="text-xs">{v.diagnosis}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
