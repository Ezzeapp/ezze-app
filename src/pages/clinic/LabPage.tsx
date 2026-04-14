import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, FlaskConical, Search, ClipboardList, Loader2, Timer } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useClinicLabOrders, useClinicLabStats } from '@/hooks/useClinicLabOrders'
import { LabOrderDialog } from '@/components/clinic/LabOrderDialog'
import { LabResultsPanel } from '@/components/clinic/LabResultsPanel'
import type { LabOrderStatus, ClinicLabOrder } from '@/types'

const STATUS_BADGE_MAP: Record<LabOrderStatus, 'default' | 'warning' | 'success' | 'destructive'> = {
  ordered: 'default',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'destructive',
}

export function LabPage() {
  const { t } = useTranslation()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [orderDialogOpen, setOrderDialogOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  const filters = statusFilter !== 'all' ? { status: statusFilter as LabOrderStatus } : undefined
  const { data: orders = [], isLoading } = useClinicLabOrders(filters)
  const { data: stats, isLoading: statsLoading } = useClinicLabStats()

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders
    const q = search.toLowerCase()
    return orders.filter((o: ClinicLabOrder) => {
      const name = [o.client?.first_name, o.client?.last_name].filter(Boolean).join(' ').toLowerCase()
      return name.includes(q)
    })
  }, [orders, search])

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

  const clientName = (order: ClinicLabOrder) =>
    [order.client?.first_name, order.client?.last_name].filter(Boolean).join(' ') || t('common.unknown')

  return (
    <div className="container max-w-3xl mx-auto px-4 py-6">
      <PageHeader title={t('clinic.lab.title')}>
        <Button className="gap-1.5" onClick={() => setOrderDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('clinic.lab.newOrder')}</span>
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {statsLoading ? (
          <>
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-[72px] rounded-lg" />)}
          </>
        ) : (
          <>
            <Card>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-2">
                  <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xl font-semibold">{stats?.ordered ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{t('clinic.lab.statusOrdered')}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-2">
                  <Timer className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xl font-semibold">{stats?.inProgress ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{t('clinic.lab.statusInProgress')}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-2">
                  <FlaskConical className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xl font-semibold">{stats?.completed ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{t('clinic.lab.statusCompleted')}</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder={t('clinic.lab.allStatuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('clinic.lab.allStatuses')}</SelectItem>
            <SelectItem value="ordered">{t('clinic.lab.statusOrdered')}</SelectItem>
            <SelectItem value="in_progress">{t('clinic.lab.statusInProgress')}</SelectItem>
            <SelectItem value="completed">{t('clinic.lab.statusCompleted')}</SelectItem>
            <SelectItem value="cancelled">{t('clinic.lab.statusCancelled')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-9 pl-8"
            placeholder={t('clinic.lab.searchPatient')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Orders list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title={t('clinic.lab.emptyTitle')}
          description={t('clinic.lab.emptyDescription')}
          action={{ label: t('clinic.lab.newOrder'), onClick: () => setOrderDialogOpen(true) }}
        />
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order: ClinicLabOrder) => (
            <Card
              key={order.id}
              className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-shadow"
              onClick={() => setSelectedOrderId(order.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{clientName(order)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(order.ordered_at)}</p>
                  </div>
                  <Badge variant={STATUS_BADGE_MAP[order.status]}>
                    {t(`clinic.lab.status_${order.status}`)}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>
                    {t('clinic.lab.testCount', { count: (order as any).items?.length ?? 0 })}
                  </span>
                  {order.notes && (
                    <span className="truncate max-w-[200px]">{order.notes}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Order Dialog */}
      <LabOrderDialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen} />

      {/* Results Panel Dialog */}
      <Dialog open={!!selectedOrderId} onOpenChange={open => { if (!open) setSelectedOrderId(null) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('clinic.lab.resultsTitle')}</DialogTitle>
          </DialogHeader>
          {selectedOrderId && (
            <LabResultsPanel orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
