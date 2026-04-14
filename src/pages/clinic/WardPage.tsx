import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { BedDouble, UserPlus, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useClinicWards } from '@/hooks/useClinicWards'
import { AdmitPatientDialog } from '@/components/clinic/AdmitPatientDialog'
import type { ClinicWard, ClinicRoom, ClinicBed, BedStatus } from '@/types'

const BED_COLOR: Record<BedStatus, string> = {
  free: 'bg-green-500',
  occupied: 'bg-red-500',
  maintenance: 'bg-gray-400',
}

function BedSquare({ bed }: { bed: ClinicBed }) {
  const { t } = useTranslation()
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        className={`w-7 h-7 rounded-sm ${BED_COLOR[bed.status]} hover:opacity-80 transition-opacity flex items-center justify-center text-[10px] font-medium text-white`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(prev => !prev)}
        aria-label={`${t('clinic.ward.bed')} ${bed.number} — ${t(`clinic.ward.bedStatus.${bed.status}`)}`}
      >
        {bed.number}
      </button>
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10 px-2 py-1 rounded bg-popover border text-xs text-popover-foreground whitespace-nowrap shadow-md">
          {t('clinic.ward.bed')} {bed.number} — {t(`clinic.ward.bedStatus.${bed.status}`)}
        </div>
      )}
    </div>
  )
}

function RoomRow({ room }: { room: ClinicRoom }) {
  const { t } = useTranslation()
  const beds = room.beds ?? []

  return (
    <div className="py-2 px-3 border-t first:border-t-0">
      <p className="text-xs font-medium text-muted-foreground mb-1.5">
        {room.name} ({beds.length} {t('clinic.ward.beds')})
      </p>
      {beds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {beds.map(bed => (
            <BedSquare key={bed.id} bed={bed} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">{t('clinic.ward.noBeds')}</p>
      )}
    </div>
  )
}

function WardCard({ ward }: { ward: ClinicWard }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const rooms = ward.rooms ?? []

  const totalBeds = useMemo(
    () => rooms.reduce((sum, r) => sum + (r.beds?.length ?? 0), 0),
    [rooms],
  )
  const occupiedBeds = useMemo(
    () => rooms.reduce((sum, r) => sum + (r.beds?.filter(b => b.status === 'occupied').length ?? 0), 0),
    [rooms],
  )
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0

  return (
    <Card>
      <CardContent className="p-4">
        <button
          type="button"
          className="w-full text-left flex items-start justify-between gap-2"
          onClick={() => setExpanded(prev => !prev)}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-sm">{ward.name}</h3>
              <Badge variant="outline" className="text-[10px]">
                {t(`clinic.ward.types.${ward.ward_type}`)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {rooms.length} {t('clinic.ward.rooms')}
            </p>

            {/* Occupancy bar */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${occupancyPct > 85 ? 'bg-red-500' : occupancyPct > 60 ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${occupancyPct}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {occupiedBeds}/{totalBeds}
              </span>
            </div>
          </div>

          <div className="pt-0.5">
            {expanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            }
          </div>
        </button>

        {expanded && rooms.length > 0 && (
          <div className="mt-3 rounded-md border bg-muted/30">
            {rooms.map(room => (
              <RoomRow key={room.id} room={room} />
            ))}
          </div>
        )}
        {expanded && rooms.length === 0 && (
          <p className="mt-3 text-xs text-muted-foreground italic text-center py-3">
            {t('clinic.ward.noRooms')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function WardPage() {
  const { t } = useTranslation()
  const { data: wards = [], isLoading } = useClinicWards()
  const [admitOpen, setAdmitOpen] = useState(false)

  return (
    <div className="container max-w-3xl mx-auto px-4 py-6">
      <PageHeader title={t('clinic.ward.title')}>
        <Button className="gap-1.5" onClick={() => setAdmitOpen(true)}>
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('clinic.ward.admit')}</span>
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      ) : wards.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title={t('clinic.ward.emptyTitle')}
          description={t('clinic.ward.emptyDescription')}
        />
      ) : (
        <div className="space-y-3">
          {wards.map((ward: ClinicWard) => (
            <WardCard key={ward.id} ward={ward} />
          ))}
        </div>
      )}

      {/* Bed legend */}
      {!isLoading && wards.length > 0 && (
        <div className="flex items-center gap-4 mt-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-green-500" />
            {t('clinic.ward.bedStatus.free')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-500" />
            {t('clinic.ward.bedStatus.occupied')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-gray-400" />
            {t('clinic.ward.bedStatus.maintenance')}
          </span>
        </div>
      )}

      <AdmitPatientDialog open={admitOpen} onOpenChange={setAdmitOpen} />
    </div>
  )
}
