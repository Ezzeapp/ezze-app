import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/shared/PageHeader'
import { Plus, Loader2, Trash2 } from 'lucide-react'
import { useCurrentFarm, useFarmExpenses, useDeleteFarmExpense } from '@/hooks/farm/useFarmData'
import { FarmExpenseDialog } from '@/components/farm/SimpleDialogs'
import { FarmOnboarding } from '@/components/farm/FarmOnboarding'
import { formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import type { FarmExpenseCategory } from '@/types/farm'
import dayjs from 'dayjs'

const CATEGORIES: FarmExpenseCategory[] = ['feed','veterinary','salary','utilities','fuel','rent','repair','equipment','seeds','fertilizer','transport','other']

export function ExpensesPage() {
  const { t } = useTranslation()
  const symbol = useCurrencySymbol()
  const { data: farm, isLoading } = useCurrentFarm()
  const [cat, setCat] = useState<FarmExpenseCategory | ''>('')
  const { data: records } = useFarmExpenses({ farmId: farm?.id, category: cat || undefined })
  const del = useDeleteFarmExpense()
  const [open, setOpen] = useState(false)

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!farm) return <FarmOnboarding />

  const total = (records ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const byCat = new Map<string, number>()
  ;(records ?? []).forEach(r => byCat.set(r.category, (byCat.get(r.category) ?? 0) + Number(r.amount)))

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <PageHeader title={t('farm.expenses.title')}>
        <Select value={cat || '__all'} onValueChange={v => setCat(v === '__all' ? '' : v as FarmExpenseCategory)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">{t('farm.common.all')}</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{t(`farm.expenses.category.${c}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> {t('farm.expenses.add')}</Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-4 pb-4">
          <p className="text-sm text-muted-foreground">{t('farm.dashboard.expenses30d')}</p>
          <p className="text-2xl font-bold">{formatCurrency(total)} {symbol}</p>
          <div className="flex gap-2 flex-wrap mt-3">
            {[...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, v]) => (
              <Badge key={c} variant="secondary">{t(`farm.expenses.category.${c}`)}: {formatCurrency(v)}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {(records ?? []).length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('farm.expenses.empty')}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {(records ?? []).map(r => (
            <Card key={r.id}>
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge>{t(`farm.expenses.category.${r.category}`)}</Badge>
                    <span className="text-xs text-muted-foreground">{dayjs(r.date).format('DD.MM.YYYY')}</span>
                  </div>
                  {r.description && <p className="text-sm text-muted-foreground mt-1 truncate">{r.description}</p>}
                </div>
                <span className="text-lg font-bold whitespace-nowrap">{formatCurrency(r.amount)} {symbol}</span>
                <Button size="icon" variant="ghost" onClick={async () => { if (confirm(t('farm.common.confirmDelete'))) await del.mutateAsync(r.id) }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <FarmExpenseDialog open={open} onOpenChange={setOpen} farmId={farm.id} />
    </div>
  )
}
