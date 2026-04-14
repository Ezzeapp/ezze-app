import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { Plus, Pencil, Trash2, Loader2, Wrench, Fuel, ShieldCheck, Settings as SettingsIcon, Tractor } from 'lucide-react'
import { useCurrentFarm, useFarmEquipment, useDeleteEquipment, useEquipmentMaintenance } from '@/hooks/farm/useFarmData'
import { EquipmentDialog, MaintenanceDialog } from '@/components/farm/EquipmentDialog'
import { FarmOnboarding } from '@/components/farm/FarmOnboarding'
import { formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import type { FarmEquipment, EquipmentMaintenance } from '@/types/farm'
import dayjs from 'dayjs'

const MAINTENANCE_ICON: Record<EquipmentMaintenance['type'], any> = {
  service: SettingsIcon, repair: Wrench, fuel: Fuel, insurance: ShieldCheck,
}

const STATUS_VARIANT: Record<FarmEquipment['status'], 'default' | 'secondary' | 'outline'> = {
  active: 'default', repair: 'secondary', decommissioned: 'outline',
}

function EquipmentCard({ eq, farmId, onEdit, onDel }: { eq: FarmEquipment; farmId: string; onEdit: () => void; onDel: () => void }) {
  const { t } = useTranslation()
  const symbol = useCurrencySymbol()
  const { data: maint } = useEquipmentMaintenance(eq.id)
  const [mOpen, setMOpen] = useState(false)
  const [open, setOpen] = useState(false)

  const maintTotal = (maint ?? []).reduce((s, m) => s + Number(m.cost), 0)

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Tractor className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-semibold truncate">{eq.name}</span>
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" onClick={onDel}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={STATUS_VARIANT[eq.status]}>{t(`farm.equipment.status.${eq.status}`)}</Badge>
          {eq.category && <Badge variant="outline">{eq.category}</Badge>}
        </div>
        {eq.purchase_cost != null && (
          <div className="text-xs text-muted-foreground">
            {t('farm.equipment.fields.purchaseCost')}: {formatCurrency(eq.purchase_cost)} {symbol}
            {eq.purchase_date && ` · ${dayjs(eq.purchase_date).format('DD.MM.YYYY')}`}
          </div>
        )}
        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t('farm.equipment.maintenance.title')}</span>
            <Button size="sm" variant="ghost" onClick={() => { setOpen(true); setMOpen(true) }}><Plus className="h-3.5 w-3.5 mr-1" /> {t('farm.common.add')}</Button>
          </div>
          {(maint ?? []).slice(0, 3).map(m => {
            const Icon = MAINTENANCE_ICON[m.type]
            return (
              <div key={m.id} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  <span>{t(`farm.equipment.maintenance.type.${m.type}`)}</span>
                  <span className="text-muted-foreground">· {dayjs(m.date).format('DD.MM')}</span>
                </span>
                <span className="font-medium">{formatCurrency(m.cost)} {symbol}</span>
              </div>
            )
          })}
          {maintTotal > 0 && (
            <div className="flex items-center justify-between text-xs font-semibold pt-1 border-t">
              <span>{t('farm.common.all')}:</span>
              <span>{formatCurrency(maintTotal)} {symbol}</span>
            </div>
          )}
        </div>
        <MaintenanceDialog open={open && mOpen} onOpenChange={v => { setOpen(v); setMOpen(v) }} farmId={farmId} equipmentId={eq.id} />
      </CardContent>
    </Card>
  )
}

export function EquipmentPage() {
  const { t } = useTranslation()
  const { data: farm, isLoading } = useCurrentFarm()
  const { data: equipment } = useFarmEquipment(farm?.id)
  const del = useDeleteEquipment()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FarmEquipment | null>(null)

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!farm) return <FarmOnboarding />

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <PageHeader title={t('farm.equipment.title')}>
        <Button onClick={() => { setEditing(null); setOpen(true) }}><Plus className="h-4 w-4 mr-1" /> {t('farm.equipment.add')}</Button>
      </PageHeader>

      {(equipment ?? []).length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('farm.equipment.empty')}</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(equipment ?? []).map(eq => (
            <EquipmentCard
              key={eq.id} eq={eq} farmId={farm.id}
              onEdit={() => { setEditing(eq); setOpen(true) }}
              onDel={async () => { if (confirm(t('farm.common.confirmDelete'))) await del.mutateAsync(eq.id) }}
            />
          ))}
        </div>
      )}

      <EquipmentDialog open={open} onOpenChange={setOpen} farmId={farm.id} initial={editing} />
    </div>
  )
}
