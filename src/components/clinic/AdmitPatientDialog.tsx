import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useClients } from '@/hooks/useClients'
import { useClinicWards } from '@/hooks/useClinicWards'
import { useAdmitPatient } from '@/hooks/useClinicHospitalizations'
import { toast } from '@/components/shared/Toaster'
import type { ClinicWard, ClinicRoom, ClinicBed, Client } from '@/types'

interface AdmitPatientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId?: string
}

export function AdmitPatientDialog({ open, onOpenChange, clientId }: AdmitPatientDialogProps) {
  const { t } = useTranslation()
  const { data: clients = [], isLoading: clientsLoading } = useClients()
  const { data: wards = [], isLoading: wardsLoading } = useClinicWards()
  const admitMutation = useAdmitPatient()

  const [search, setSearch] = useState('')
  const [selectedClientId, setSelectedClientId] = useState(clientId ?? '')
  const [wardId, setWardId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [bedId, setBedId] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [diagnosisCode, setDiagnosisCode] = useState('')
  const [reason, setReason] = useState('')
  const [attendingDoctor, setAttendingDoctor] = useState('')
  const [notes, setNotes] = useState('')

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSearch('')
      setSelectedClientId(clientId ?? '')
      setWardId('')
      setRoomId('')
      setBedId('')
      setDiagnosis('')
      setDiagnosisCode('')
      setReason('')
      setAttendingDoctor('')
      setNotes('')
    }
  }, [open, clientId])

  // Reset room when ward changes
  useEffect(() => { setRoomId(''); setBedId('') }, [wardId])
  useEffect(() => { setBedId('') }, [roomId])

  // Filtered clients for search
  const filteredClients = useMemo(() => {
    if (clientId) return clients.filter((c: Client) => c.id === clientId)
    if (!search.trim()) return clients.slice(0, 20)
    const q = search.toLowerCase()
    return clients.filter((c: Client) => {
      const name = [c.first_name, c.last_name].filter(Boolean).join(' ').toLowerCase()
      return name.includes(q) || c.phone?.includes(q)
    }).slice(0, 20)
  }, [clients, search, clientId])

  // Cascading: rooms for selected ward
  const selectedWard = useMemo(
    () => wards.find((w: ClinicWard) => w.id === wardId),
    [wards, wardId],
  )
  const rooms = selectedWard?.rooms ?? []

  // Cascading: free beds for selected room
  const selectedRoom = useMemo(
    () => rooms.find((r: ClinicRoom) => r.id === roomId),
    [rooms, roomId],
  )
  const freeBeds = useMemo(
    () => (selectedRoom?.beds ?? []).filter((b: ClinicBed) => b.status === 'free'),
    [selectedRoom],
  )

  const canSubmit = selectedClientId && wardId && roomId && bedId

  async function handleSubmit() {
    if (!canSubmit) return
    try {
      await admitMutation.mutateAsync({
        client_id: selectedClientId,
        ward_id: wardId,
        room_id: roomId,
        bed_id: bedId,
        diagnosis: diagnosis || null,
        diagnosis_code: diagnosisCode || null,
        reason: reason || null,
        attending_doctor: attendingDoctor || null,
        notes: notes || null,
      })
      toast({ title: t('clinic.admit.success'), variant: 'success' })
      onOpenChange(false)
    } catch {
      toast({ title: t('clinic.admit.error'), variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('clinic.admit.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient selection */}
          {!clientId && (
            <div className="space-y-2">
              <Label>{t('clinic.admit.patient')}</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder={t('clinic.admit.searchPatient')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {clientsLoading ? (
                <div className="flex justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="max-h-32 overflow-y-auto border rounded-md">
                  {filteredClients.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      {t('clinic.admit.noClients')}
                    </p>
                  ) : (
                    filteredClients.map((c: Client) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors ${selectedClientId === c.id ? 'bg-accent font-medium' : ''}`}
                        onClick={() => setSelectedClientId(c.id)}
                      >
                        {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                        {c.phone && <span className="ml-2 text-xs text-muted-foreground">{c.phone}</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Ward */}
          <div className="space-y-2">
            <Label>{t('clinic.admit.ward')}</Label>
            <Select value={wardId} onValueChange={setWardId} disabled={wardsLoading}>
              <SelectTrigger>
                <SelectValue placeholder={t('clinic.admit.selectWard')} />
              </SelectTrigger>
              <SelectContent>
                {wards.map((w: ClinicWard) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} ({t(`clinic.ward.types.${w.ward_type}`)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Room */}
          <div className="space-y-2">
            <Label>{t('clinic.admit.room')}</Label>
            <Select value={roomId} onValueChange={setRoomId} disabled={!wardId}>
              <SelectTrigger>
                <SelectValue placeholder={t('clinic.admit.selectRoom')} />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r: ClinicRoom) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bed */}
          <div className="space-y-2">
            <Label>{t('clinic.admit.bed')}</Label>
            <Select value={bedId} onValueChange={setBedId} disabled={!roomId}>
              <SelectTrigger>
                <SelectValue placeholder={t('clinic.admit.selectBed')} />
              </SelectTrigger>
              <SelectContent>
                {freeBeds.map((b: ClinicBed) => (
                  <SelectItem key={b.id} value={b.id}>
                    {t('clinic.ward.bed')} {b.number}
                  </SelectItem>
                ))}
                {freeBeds.length === 0 && roomId && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    {t('clinic.admit.noFreeBeds')}
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Diagnosis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('clinic.admit.diagnosis')}</Label>
              <Input
                value={diagnosis}
                onChange={e => setDiagnosis(e.target.value)}
                placeholder={t('clinic.admit.diagnosisPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('clinic.admit.diagnosisCode')}</Label>
              <Input
                value={diagnosisCode}
                onChange={e => setDiagnosisCode(e.target.value)}
                placeholder="ICD-10"
              />
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>{t('clinic.admit.reason')}</Label>
            <Input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t('clinic.admit.reasonPlaceholder')}
            />
          </div>

          {/* Attending doctor */}
          <div className="space-y-2">
            <Label>{t('clinic.admit.attendingDoctor')}</Label>
            <Input
              value={attendingDoctor}
              onChange={e => setAttendingDoctor(e.target.value)}
              placeholder={t('clinic.admit.attendingDoctorPlaceholder')}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>{t('clinic.admit.notes')}</Label>
            <textarea
              className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('clinic.admit.notesPlaceholder')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={admitMutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || admitMutation.isPending}>
            {admitMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {t('clinic.admit.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
