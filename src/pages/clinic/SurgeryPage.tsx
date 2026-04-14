import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Syringe, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useClinicSurgeries } from '@/hooks/useClinicSurgeries'
import { SurgeryDialog } from '@/components/clinic/SurgeryDialog'
import { SurgeryProtocolPanel } from '@/components/clinic/SurgeryProtocolPanel'
import type { SurgeryStatus, ClinicSurgery } from '@/types'

const STATUS_BADGE: Record<SurgeryStatus, 'default' | 'warning' | 'success' | 'destructive'> = {
  scheduled: 'default',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'destructive',
}

export function SurgeryPage() {
  const { t } = useTranslation()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editSurgery, setEditSurgery] = useState<ClinicSurgery | undefined>()
  const [protocolSurgery, setProtocolSurgery] = useState<ClinicSurgery | null>(null)

  const filterStatus = statusFilter !== 'all' ? (statusFilter as SurgeryStatus) : undefined
  const { data: surgeries = [], isLoading } = useClinicSurgeries(filterStatus)

  const sorted = useMemo(
    () => [...surgeries].sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()),
    [surgeries],
  )

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  const clientName = (s: ClinicSurgery) =>
    [s.client?.first_name, s.client?.last_name].filter(Boolean).join(' ') || t('common.unknown')

  const handleCardClick = (surgery: ClinicSurgery) => {
    if (surgery.status === 'in_progress' || surgery.status === 'completed') {
      setProtocolSurgery(surgery)
    } else {
      setEditSurgery(surgery)
      setDialogOpen(true)
    }
  }

  const handleNewSurgery = () => {
    setEditSurgery(undefined)
    setDialogOpen(true)
  }

  return (
    <div className="container max-w-3xl mx-auto px-4 py-6">
      <PageHeader title={t('clinic.surgery.title')}>
        <Button className="gap-1.5" onClick={handleNewSurgery}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('clinic.surgery.schedule')}</span>
        </Button>
      </PageHeader>

      {/* Status filter */}
      <div className="flex gap-2 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder={t('clinic.surgery.allStatuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('clinic.surgery.allStatuses')}</SelectItem>
            <SelectItem value="scheduled">{t('clinic.surgery.status_scheduled')}</SelectItem>
            <SelectItem value="in_progress">{t('clinic.surgery.status_in_progress')}</SelectItem>
            <SelectItem value="completed">{t('clinic.surgery.status_completed')}</SelectItem>
            <SelectItem value="cancelled">{t('clinic.surgery.status_cancelled')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Surgery list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Syringe}
          title={t('clinic.surgery.emptyTitle')}
          description={t('clinic.surgery.emptyDescription')}
          action={{ label: t('clinic.surgery.schedule'), onClick: handleNewSurgery }}
        />
      ) : (
        <div className="space-y-3">
          {sorted.map(surgery => (
            <Card
              key={surgery.id}
              className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-shadow"
              onClick={() => handleCardClick(surgery)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{clientName(surgery)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{surgery.procedure_name}</p>
                  </div>
                  <Badge variant={STATUS_BADGE[surgery.status]}>
                    {t(`clinic.surgery.status_${surgery.status}`)}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                  <span>{formatDate(surgery.scheduled_date)}</span>
                  {surgery.surgeon_name && <span>{surgery.surgeon_name}</span>}
                  {surgery.operating_room?.name && <span>{surgery.operating_room.name}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <SurgeryDialog
        open={dialogOpen}
        onOpenChange={open => {
          setDialogOpen(open)
          if (!open) setEditSurgery(undefined)
        }}
        surgery={editSurgery}
      />

      {/* Protocol Dialog */}
      <Dialog open={!!protocolSurgery} onOpenChange={open => { if (!open) setProtocolSurgery(null) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('clinic.surgery.protocol')}</DialogTitle>
          </DialogHeader>
          {protocolSurgery && (
            <SurgeryProtocolPanel surgery={protocolSurgery} onClose={() => setProtocolSurgery(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
