import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { UserPlus, BedDouble, Stethoscope, Calendar, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useClinicHospitalizations, useDischargePatient } from '@/hooks/useClinicHospitalizations'
import { AdmitPatientDialog } from '@/components/clinic/AdmitPatientDialog'
import { DailyObservationPanel } from '@/components/clinic/DailyObservationPanel'
import { DischargeDialog } from '@/components/clinic/DischargeDialog'
import type { ClinicHospitalization, HospitalizationStatus } from '@/types'

const STATUS_TABS: Array<HospitalizationStatus | 'all'> = [
  'all', 'admitted', 'in_treatment', 'pre_discharge', 'discharged',
]

const STATUS_VARIANT: Record<HospitalizationStatus, 'default' | 'warning' | 'success' | 'secondary'> = {
  admitted: 'default',
  in_treatment: 'warning',
  pre_discharge: 'success',
  discharged: 'secondary',
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

function clientName(h: ClinicHospitalization) {
  return [h.client?.first_name, h.client?.last_name].filter(Boolean).join(' ') || '—'
}

function locationStr(h: ClinicHospitalization) {
  return [h.ward?.name, h.room?.name, h.bed?.number].filter(Boolean).join(' / ')
}

export function HospitalizationsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<HospitalizationStatus | 'all'>('all')
  const [admitOpen, setAdmitOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dischargeTarget, setDischargeTarget] = useState<ClinicHospitalization | null>(null)

  const statusFilter = tab !== 'all' ? tab : undefined
  const { data: hospitalizations = [], isLoading } = useClinicHospitalizations(statusFilter as HospitalizationStatus | undefined)

  return (
    <div className="container max-w-3xl mx-auto px-4 py-6">
      <PageHeader title={t('clinic.hosp.title')}>
        <Button className="gap-1.5" onClick={() => setAdmitOpen(true)}>
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('clinic.ward.admit')}</span>
        </Button>
      </PageHeader>

      {/* Status tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
        {STATUS_TABS.map(s => (
          <Button
            key={s}
            size="sm"
            variant={tab === s ? 'default' : 'outline'}
            className="shrink-0 h-8 text-xs"
            onClick={() => { setTab(s); setExpandedId(null) }}
          >
            {t(`clinic.hosp.tab_${s}`)}
          </Button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      ) : hospitalizations.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title={t('clinic.hosp.emptyTitle')}
          description={t('clinic.hosp.emptyDescription')}
          action={{ label: t('clinic.ward.admit'), onClick: () => setAdmitOpen(true) }}
        />
      ) : (
        <div className="space-y-3">
          {hospitalizations.map((h: ClinicHospitalization) => {
            const isExpanded = expandedId === h.id

            return (
              <Card
                key={h.id}
                className="transition-shadow hover:ring-1 hover:ring-primary/30"
              >
                <CardContent className="p-4">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setExpandedId(isExpanded ? null : h.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{clientName(h)}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <BedDouble className="h-3 w-3" />
                            {locationStr(h)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(h.admission_date)}
                          </span>
                        </div>
                      </div>
                      <Badge variant={STATUS_VARIANT[h.status]}>
                        {t(`clinic.hosp.status_${h.status}`)}
                      </Badge>
                    </div>

                    {(h.diagnosis || h.attending_doctor) && (
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        {h.diagnosis && (
                          <span className="truncate max-w-[200px]">{h.diagnosis}</span>
                        )}
                        {h.attending_doctor && (
                          <span className="flex items-center gap-1">
                            <Stethoscope className="h-3 w-3" />
                            {h.attending_doctor}
                          </span>
                        )}
                      </div>
                    )}
                  </button>

                  {/* Expanded section */}
                  {isExpanded && (
                    <div className="mt-4 border-t pt-4 space-y-4">
                      <DailyObservationPanel hospitalizationId={h.id} />

                      {h.status !== 'discharged' && (
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDischargeTarget(h)}
                          >
                            {t('clinic.hosp.discharge')}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AdmitPatientDialog open={admitOpen} onOpenChange={setAdmitOpen} />

      {dischargeTarget && (
        <DischargeDialog
          open={!!dischargeTarget}
          onOpenChange={open => { if (!open) setDischargeTarget(null) }}
          hospitalization={dischargeTarget}
        />
      )}
    </div>
  )
}
