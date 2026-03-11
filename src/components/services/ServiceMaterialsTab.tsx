import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Package, Calculator, Search, ChevronDown } from 'lucide-react'
import { useServiceMaterials, useCreateServiceMaterial, useDeleteServiceMaterial } from '@/hooks/useServiceMaterials'
import { useInventory } from '@/hooks/useInventory'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/shared/Toaster'
import { formatCurrency } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'

interface Props {
  serviceId: string
}

export function ServiceMaterialsTab({ serviceId }: Props) {
  const { t, i18n } = useTranslation()
  const currency = useCurrency()
  const [selectedItem, setSelectedItem] = useState('')
  const [qty, setQty] = useState<number>(1)
  const [itemSearch, setItemSearch] = useState('')
  const [itemOpen, setItemOpen] = useState(false)
  const itemDropRef = useRef<HTMLDivElement>(null)

  const { data: materials, isLoading } = useServiceMaterials(serviceId)
  const { data: inventoryItems } = useInventory()
  const createMaterial = useCreateServiceMaterial()
  const deleteMaterial = useDeleteServiceMaterial()

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (itemDropRef.current && !itemDropRef.current.contains(e.target as Node)) {
        setItemOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const totalCost = materials?.reduce((sum, m) => {
    const costPrice = m.expand?.inventory_item?.cost_price ?? 0
    return sum + costPrice * m.quantity
  }, 0) ?? 0

  const usedItemIds = new Set(materials?.map((m) => m.inventory_item) ?? [])
  const availableItems = inventoryItems?.filter((i) => !usedItemIds.has(i.id)) ?? []

  const filteredItems = availableItems.filter((i) =>
    i.name.toLowerCase().includes(itemSearch.toLowerCase())
  )

  const selectedItemData = inventoryItems?.find((i) => i.id === selectedItem)

  const handleAdd = async () => {
    if (!selectedItem) return
    try {
      await createMaterial.mutateAsync({ service_id: serviceId, inventory_item_id: selectedItem, quantity: qty })
      setSelectedItem('')
      setItemSearch('')
      setQty(1)
      toast.success(t('services.materialAdded'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteMaterial.mutateAsync({ id, serviceId })
      toast.success(t('services.materialDeleted'))
    } catch {
      toast.error(t('common.deleteError'))
    }
  }

  return (
    <div className="space-y-4">
      {/* Добавить материал */}
      <div className="space-y-2 rounded-xl border border-dashed border-border p-3 bg-muted/20">
        {/* Строка 1: Товар */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t('services.materialItem')}</Label>
          <div className="relative" ref={itemDropRef}>
            <button
              type="button"
              onClick={() => setItemOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <span className={selectedItemData ? 'text-foreground' : 'text-muted-foreground'}>
                {selectedItemData
                  ? `${selectedItemData.name}${selectedItemData.unit ? ` (${selectedItemData.unit})` : ''}`
                  : t('services.selectMaterial')}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
            {itemOpen && (
              <div className="absolute left-0 top-full mt-1 z-50 w-full bg-white dark:bg-zinc-900 border border-border rounded-lg shadow-xl overflow-hidden">
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      autoFocus
                      type="text"
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      placeholder={t('common.search')}
                      className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/40 rounded-md outline-none"
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredItems.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      {t('inventory.empty')}
                    </div>
                  ) : (
                    filteredItems.map((i) => (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => {
                          setSelectedItem(i.id)
                          setItemSearch('')
                          setItemOpen(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 flex items-center justify-between gap-2 ${
                          selectedItem === i.id ? 'bg-muted/40 font-medium' : ''
                        }`}
                      >
                        <span>{i.name}{i.unit ? ` (${i.unit})` : ''}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{i.quantity} шт.</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Строка 2: Кол-во + кнопка добавить */}
        <div className="flex items-end gap-2">
          <div className="space-y-1.5 w-28">
            <Label className="text-xs text-muted-foreground">{t('services.materialQty')}</Label>
            <Input
              type="number"
              min={0.01}
              step={0.01}
              value={qty}
              onChange={(e) => setQty(parseFloat(e.target.value) || 1)}
            />
          </div>
          <Button
            type="button"
            className="flex-1"
            onClick={handleAdd}
            disabled={!selectedItem || createMaterial.isPending}
            loading={createMaterial.isPending}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {t('services.addMaterial')}
          </Button>
        </div>
      </div>

      {/* Список материалов */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : materials?.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
          <Package className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('services.noMaterials')}</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left p-2 font-medium">{t('services.materialItem')}</th>
                <th className="text-right p-2 font-medium">{t('services.materialQty')}</th>
                <th className="text-right p-2 font-medium">{t('services.costCalc')}</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {materials?.map((m) => {
                const item = m.expand?.inventory_item
                const lineCost = (item?.cost_price ?? 0) * m.quantity
                return (
                  <tr key={m.id} className="border-t hover:bg-muted/20">
                    <td className="p-2">
                      <span className="font-medium">{item?.name ?? '—'}</span>
                      {item?.unit && (
                        <Badge variant="secondary" className="ml-2 text-xs">{item.unit}</Badge>
                      )}
                    </td>
                    <td className="p-2 text-right font-mono">{m.quantity}</td>
                    <td className="p-2 text-right text-muted-foreground">
                      {item?.cost_price ? formatCurrency(lineCost, currency, i18n.language) : '—'}
                    </td>
                    <td className="p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Итого себестоимость */}
      {(materials?.length ?? 0) > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Calculator className="h-4 w-4 text-primary" />
            {t('services.totalCost')}
          </div>
          <span className="font-semibold text-primary">{formatCurrency(totalCost, currency, i18n.language)}</span>
        </div>
      )}
    </div>
  )
}
