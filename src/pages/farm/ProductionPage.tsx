import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/shared/PageHeader'
import { Plus, Loader2 } from 'lucide-react'
import { useCurrentFarm, useProduction } from '@/hooks/farm/useFarmData'
import { ProductionDialog } from '@/components/farm/SimpleDialogs'
import { FarmOnboarding } from '@/components/farm/FarmOnboarding'
import type { ProductionType } from '@/types/farm'
import dayjs from 'dayjs'

const UNIT_KEY: Record<ProductionType, string> = {
  milk: 'farm.common.liters', eggs: 'farm.common.pieces', meat: 'farm.common.kg',
  wool: 'farm.common.kg', honey: 'farm.common.kg', offspring: 'farm.common.pieces',
}

export function ProductionPage() {
  const { t } = useTranslation()
  const { data: farm, isLoading } = useCurrentFarm()
  const [type, setType] = useState<ProductionType | ''>('')
  const { data: records } = useProduction({ farmId: farm?.id, type: type || undefined })
  const [open, setOpen] = useState(false)

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!farm) return <FarmOnboarding />

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <PageHeader title={t('farm.production.title')}>
        <Select value={type || '__all'} onValueChange={v => setType(v === '__all' ? '' : v as ProductionType)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">{t('farm.common.all')}</SelectItem>
            {(['milk','eggs','meat','wool','honey','offspring'] as ProductionType[]).map(p =>
              <SelectItem key={p} value={p}>{t(`farm.production.type.${p}`)}</SelectItem>
            )}
          </SelectContent>
        </Select>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> {t('farm.production.add')}</Button>
      </PageHeader>

      {(records ?? []).length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('farm.production.empty')}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {(records ?? []).map(r => (
            <Card key={r.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge>{t(`farm.production.type.${r.type}`)}</Badge>
                    <span className="text-xs text-muted-foreground">{dayjs(r.date).format('DD.MM.YYYY')}</span>
                  </div>
                  {r.quality && <p className="text-xs text-muted-foreground mt-1">{r.quality}</p>}
                </div>
                <span className="text-lg font-bold">{r.quantity} {t(UNIT_KEY[r.type])}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProductionDialog open={open} onOpenChange={setOpen} farmId={farm.id} />
    </div>
  )
}
