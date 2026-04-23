import { useState } from 'react'
import { Percent, X, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/shared/Toaster'
import { formatCurrency } from '@/lib/utils'
import { useCleaningItemTypes, useUpsertItemType } from '@/hooks/useCleaningItemTypes'
import { CleaningCatalogTab } from './CleaningCatalogTab'

export function CleaningServicesPage() {
  const { t } = useTranslation()
  const [priceModalOpen, setPriceModalOpen] = useState(false)
  const [pricePercent, setPricePercent] = useState('')
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false)

  const { data: itemTypes = [] } = useCleaningItemTypes()
  const upsertItemType = useUpsertItemType()

  const handleMassPriceChange = async () => {
    const pct = parseFloat(pricePercent)
    if (isNaN(pct) || pct === 0) return
    setIsUpdatingPrices(true)
    try {
      const multiplier = 1 + pct / 100
      for (const item of itemTypes) {
        const newPrice = Math.max(0, Math.round(item.default_price * multiplier))
        await upsertItemType.mutateAsync({
          id: item.id,
          name: item.name,
          default_price: newPrice,
          default_days: item.default_days,
          sort_order: item.sort_order,
          product: item.product,
        })
      }
      toast.success(`Цены обновлены на ${pct > 0 ? '+' : ''}${pct}%`)
      setPriceModalOpen(false)
      setPricePercent('')
    } catch {
      toast.error('Ошибка обновления цен')
    } finally {
      setIsUpdatingPrices(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 sticky top-0 z-10 bg-background -mx-[18px] px-[18px] -mt-4 pt-4 lg:-mt-6 lg:pt-6 pb-3 shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground flex-1">{t('nav.services')}</h1>
          <Button variant="outline" size="icon" className="sm:hidden" onClick={() => setPriceModalOpen(true)}>
            <Percent className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="hidden sm:flex" onClick={() => setPriceModalOpen(true)}>
            <Percent className="h-4 w-4 mr-2" />
            Изменить цены
          </Button>
        </div>
      </div>

      {/* Catalog */}
      <CleaningCatalogTab />

      {/* Mass price change modal */}
      {priceModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl shadow-2xl p-6 w-full max-w-xs sm:w-80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Изменить все цены</h3>
              <button onClick={() => setPriceModalOpen(false)}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Введите процент изменения. Например: +10 для увеличения на 10%, -20 для уменьшения на 20%.
            </p>
            <div>
              <Label>Процент изменения</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  placeholder="+10"
                  value={pricePercent}
                  onChange={e => setPricePercent(e.target.value)}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              {pricePercent && itemTypes.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Например: {itemTypes[0]?.name} {formatCurrency(itemTypes[0]?.default_price)} →{' '}
                  {formatCurrency(Math.round(itemTypes[0]?.default_price * (1 + parseFloat(pricePercent) / 100)))}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                size="sm"
                onClick={() => { setPriceModalOpen(false); setPricePercent('') }}
              >
                Отмена
              </Button>
              <Button
                className="flex-1"
                size="sm"
                disabled={!pricePercent || isUpdatingPrices}
                onClick={handleMassPriceChange}
              >
                {isUpdatingPrices && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Применить
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
