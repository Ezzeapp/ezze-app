import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { Plus, Loader2, Trash2, Pencil, User } from 'lucide-react'
import { useCurrentFarm, useFarmSales, useDeleteFarmSale } from '@/hooks/farm/useFarmData'
import { SaleDialog } from '@/components/farm/SaleDialog'
import { FarmOnboarding } from '@/components/farm/FarmOnboarding'
import { formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import type { SalePaymentStatus } from '@/types/farm'
import dayjs from 'dayjs'

const PAY_VARIANT: Record<SalePaymentStatus, 'default' | 'outline' | 'secondary'> = {
  paid: 'default', partial: 'secondary', unpaid: 'outline',
}

export function SalesPage() {
  const { t } = useTranslation()
  const symbol = useCurrencySymbol()
  const { data: farm, isLoading } = useCurrentFarm()
  const { data: sales } = useFarmSales({ farmId: farm?.id })
  const del = useDeleteFarmSale()
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!farm) return <FarmOnboarding />

  const total = (sales ?? []).reduce((s, x) => s + Number(x.total_amount), 0)
  const paid  = (sales ?? []).reduce((s, x) => s + Number(x.paid_amount), 0)
  const debt  = total - paid

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader title={t('farm.sales.title')}>
        <Button onClick={() => { setEditId(null); setOpen(true) }}><Plus className="h-4 w-4 mr-1" /> {t('farm.sales.add')}</Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-sm text-muted-foreground mb-1">{t('farm.sales.totalRevenue')}</p>
          <p className="text-2xl font-bold">{formatCurrency(total)} {symbol}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-sm text-muted-foreground mb-1">{t('farm.sales.paid')}</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(paid)} {symbol}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-sm text-muted-foreground mb-1">{t('farm.sales.debt')}</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(debt)} {symbol}</p>
        </CardContent></Card>
      </div>

      {(sales ?? []).length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('farm.sales.empty')}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {(sales ?? []).map(s => (
            <Card key={s.id}>
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={PAY_VARIANT[s.payment_status]}>{t(`farm.sales.payment.${s.payment_status}`)}</Badge>
                    <Badge variant="secondary">{t(`farm.sales.channel.${s.channel}`)}</Badge>
                    <span className="text-xs text-muted-foreground">{dayjs(s.date).format('DD.MM.YYYY')}</span>
                  </div>
                  {s.buyer_name && (
                    <p className="text-sm mt-1 flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" /> {s.buyer_name}
                      {s.buyer_contact && <span className="text-muted-foreground">· {s.buyer_contact}</span>}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold whitespace-nowrap">{formatCurrency(s.total_amount)} {symbol}</p>
                  {s.paid_amount > 0 && s.paid_amount < s.total_amount && (
                    <p className="text-xs text-muted-foreground">{t('farm.sales.paid')}: {formatCurrency(s.paid_amount)}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditId(s.id); setOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={async () => { if (confirm(t('farm.common.confirmDelete'))) await del.mutateAsync(s.id) }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SaleDialog open={open} onOpenChange={setOpen} farmId={farm.id} saleId={editId} />
    </div>
  )
}
