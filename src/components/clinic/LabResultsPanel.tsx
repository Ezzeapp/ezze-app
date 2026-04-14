import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, Play, CheckCircle, Loader2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useClinicLabOrder, useUpdateLabOrderItems, useUpdateLabOrderStatus } from '@/hooks/useClinicLabOrders'
import { toast } from '@/components/shared/Toaster'
import { printLabResults } from '@/lib/printMedicalDocument'
import type { LabOrderStatus, LabResultFlag, ClinicLabOrderItem } from '@/types'

interface LabResultsPanelProps {
  orderId: string
  onClose?: () => void
}

interface ItemForm {
  id: string
  test_name: string
  result_value: string
  result_unit: string | null
  ref_min: number | null
  ref_max: number | null
  ref_text: string | null
  flag: LabResultFlag | null
  notes: string
}

const FLAG_COLORS: Record<LabResultFlag, string> = {
  normal: 'bg-green-500',
  low: 'bg-orange-500',
  high: 'bg-red-500',
  abnormal: 'bg-purple-500',
}

const FLAG_TEXT_COLORS: Record<LabResultFlag, string> = {
  normal: 'text-green-600 dark:text-green-400',
  low: 'text-orange-600 dark:text-orange-400',
  high: 'text-red-600 dark:text-red-400',
  abnormal: 'text-purple-600 dark:text-purple-400',
}

function computeFlag(value: string, refMin: number | null, refMax: number | null): LabResultFlag | null {
  if (!value.trim()) return null
  const num = parseFloat(value)
  if (isNaN(num)) return null // non-numeric results -> manual flagging
  if (refMin != null && refMax != null) {
    if (num < refMin) return 'low'
    if (num > refMax) return 'high'
    return 'normal'
  }
  if (refMin != null && num < refMin) return 'low'
  if (refMax != null && num > refMax) return 'high'
  if (refMin != null || refMax != null) return 'normal'
  return null
}

export function LabResultsPanel({ orderId, onClose }: LabResultsPanelProps) {
  const { t } = useTranslation()
  const { data: order, isLoading } = useClinicLabOrder(orderId)
  const updateItems = useUpdateLabOrderItems()
  const updateStatus = useUpdateLabOrderStatus()

  const [itemForms, setItemForms] = useState<ItemForm[]>([])
  const [pendingStatus, setPendingStatus] = useState<LabOrderStatus | null>(null)

  useEffect(() => {
    if (!order?.items) return
    setItemForms(
      order.items.map((item: ClinicLabOrderItem) => ({
        id: item.id,
        test_name: item.test_name,
        result_value: item.result_value ?? '',
        result_unit: item.result_unit ?? null,
        ref_min: item.ref_min ?? null,
        ref_max: item.ref_max ?? null,
        ref_text: item.ref_text ?? null,
        flag: item.flag ?? null,
        notes: item.notes ?? '',
      }))
    )
    setPendingStatus(null)
  }, [order])

  const updateItemField = useCallback((idx: number, field: keyof ItemForm, value: string) => {
    setItemForms(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      if (field === 'result_value') {
        updated.flag = computeFlag(value, item.ref_min, item.ref_max)
      }
      return updated
    }))
  }, [])

  const effectiveStatus = pendingStatus ?? order?.status ?? 'ordered'

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

  const formatRef = (item: ItemForm) => {
    if (item.ref_min != null && item.ref_max != null) {
      return `${item.ref_min} - ${item.ref_max}${item.result_unit ? ` ${item.result_unit}` : ''}`
    }
    if (item.ref_min != null) return `>= ${item.ref_min}${item.result_unit ? ` ${item.result_unit}` : ''}`
    if (item.ref_max != null) return `<= ${item.ref_max}${item.result_unit ? ` ${item.result_unit}` : ''}`
    if (item.ref_text) return item.ref_text
    return null
  }

  const STATUS_BADGE_MAP: Record<LabOrderStatus, 'default' | 'warning' | 'success' | 'destructive'> = {
    ordered: 'default',
    in_progress: 'warning',
    completed: 'success',
    cancelled: 'destructive',
  }

  const isSaving = updateItems.isPending || updateStatus.isPending

  const handleSave = async () => {
    try {
      // Save item results
      const itemUpdates = itemForms.map(item => ({
        id: item.id,
        result_value: item.result_value.trim() || null,
        flag: item.flag,
        notes: item.notes.trim() || null,
      }))
      await updateItems.mutateAsync(itemUpdates)

      // Update status if changed
      if (pendingStatus && pendingStatus !== order?.status) {
        await updateStatus.mutateAsync({ id: orderId, status: pendingStatus })
      }

      toast.success(t('clinic.lab.resultsSaved'))
      onClose?.()
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    )
  }

  if (!order) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {t('clinic.lab.orderNotFound')}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Badge variant={STATUS_BADGE_MAP[effectiveStatus]}>
          {t(`clinic.lab.status_${effectiveStatus}`)}
        </Badge>
        <span className="text-xs text-muted-foreground">{formatDate(order.ordered_at)}</span>
      </div>

      {/* Items */}
      <div className="space-y-3">
        {itemForms.map((item, idx) => {
          const ref = formatRef(item)
          return (
            <div key={item.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                {item.flag && (
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${FLAG_COLORS[item.flag]}`}
                    title={t(`clinic.lab.flag_${item.flag}`)}
                  />
                )}
                <span className="text-sm font-semibold flex-1">{item.test_name}</span>
                {item.flag && (
                  <span className={`text-xs font-medium ${FLAG_TEXT_COLORS[item.flag]}`}>
                    {t(`clinic.lab.flag_${item.flag}`)}
                  </span>
                )}
              </div>

              <div>
                <Label className="text-xs">{t('clinic.lab.resultValue')}</Label>
                <Input
                  className="h-8 mt-1 text-sm"
                  placeholder={t('clinic.lab.resultPlaceholder')}
                  value={item.result_value}
                  onChange={e => updateItemField(idx, 'result_value', e.target.value)}
                />
              </div>

              {ref && (
                <p className="text-xs text-muted-foreground">
                  {t('clinic.lab.referenceRange')}: {ref}
                </p>
              )}

              <div>
                <Label className="text-xs">{t('clinic.lab.itemNotes')}</Label>
                <Input
                  className="h-8 mt-1 text-sm"
                  placeholder={t('clinic.lab.itemNotesPlaceholder')}
                  value={item.notes}
                  onChange={e => updateItemField(idx, 'notes', e.target.value)}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Status controls */}
      <div className="flex items-center gap-2">
        {effectiveStatus === 'ordered' && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setPendingStatus('in_progress')}
          >
            <Play className="h-3.5 w-3.5" />
            {t('clinic.lab.startProcessing')}
          </Button>
        )}
        {effectiveStatus === 'in_progress' && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setPendingStatus('completed')}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            {t('clinic.lab.markCompleted')}
          </Button>
        )}
        {pendingStatus && (
          <span className="text-xs text-muted-foreground">
            {t('clinic.lab.statusWillChange')}
          </span>
        )}
      </div>

      {/* Save + Print */}
      <div className="flex gap-2">
        <Button className="flex-1 gap-1.5" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t('clinic.lab.saveResults')}
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={() => {
          if (order) {
            const cName = `${(order.client as any)?.first_name || ''} ${(order.client as any)?.last_name || ''}`.trim()
            printLabResults({ ordered_at: order.ordered_at, notes: order.notes }, order.items || [], { name: cName }, '')
          }
        }}>
          <Printer className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
