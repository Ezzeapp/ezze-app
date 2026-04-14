import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { Plus, AlertTriangle, Loader2, Pencil, Trash2, MinusCircle, Package } from 'lucide-react'
import { useCurrentFarm, useFeedStock, useDeleteFeedStock } from '@/hooks/farm/useFarmData'
import { FeedStockDialog, FeedConsumptionDialog } from '@/components/farm/SimpleDialogs'
import { FarmOnboarding } from '@/components/farm/FarmOnboarding'
import { formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import type { FeedStockItem } from '@/types/farm'

export function FeedStockPage() {
  const { t } = useTranslation()
  const symbol = useCurrencySymbol()
  const { data: farm, isLoading } = useCurrentFarm()
  const { data: stock } = useFeedStock(farm?.id)
  const del = useDeleteFeedStock()
  const [open, setOpen] = useState(false)
  const [consOpen, setConsOpen] = useState(false)
  const [editing, setEditing] = useState<FeedStockItem | null>(null)

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!farm) return <FarmOnboarding />

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <PageHeader title={t('farm.feed.title')}>
        <Button variant="outline" onClick={() => setConsOpen(true)}><MinusCircle className="h-4 w-4 mr-1" /> {t('farm.feed.addConsumption')}</Button>
        <Button onClick={() => { setEditing(null); setOpen(true) }}><Plus className="h-4 w-4 mr-1" /> {t('farm.feed.addStock')}</Button>
      </PageHeader>

      {(stock ?? []).length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('farm.feed.empty')}</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(stock ?? []).map(s => {
            const low = s.low_stock_threshold != null && s.quantity <= s.low_stock_threshold
            return (
              <Card key={s.id} className={low ? 'border-amber-400' : ''}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-semibold truncate">{s.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={async () => { if (confirm(t('farm.common.confirmDelete'))) await del.mutateAsync(s.id) }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{s.quantity}</span>
                    <span className="text-sm text-muted-foreground">{t(`farm.feed.unit.${s.unit}`)}</span>
                    {low && <Badge variant="outline" className="ml-auto text-amber-600 border-amber-400"><AlertTriangle className="h-3 w-3 mr-1" />{t('farm.feed.lowStock')}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(s.cost_per_unit)} {symbol} / {t(`farm.feed.unit.${s.unit}`)} · {t(`farm.feed.source.${s.source}`)}
                  </div>
                  <div className="text-xs font-medium">
                    {t('farm.dashboard.feedStockValue')}: {formatCurrency(s.quantity * s.cost_per_unit)} {symbol}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <FeedStockDialog open={open} onOpenChange={setOpen} farmId={farm.id} initial={editing} />
      <FeedConsumptionDialog open={consOpen} onOpenChange={setConsOpen} farmId={farm.id} />
    </div>
  )
}
