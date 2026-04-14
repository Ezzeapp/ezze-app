import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2 } from 'lucide-react'
import { useAnimals, useProduction, useCrops, useUpsertFarmSale, useFarmSale } from '@/hooks/farm/useFarmData'
import type { FarmSale, FarmSaleItem, SaleChannel, SaleItemType } from '@/types/farm'
import { formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'

type DraftItem = Partial<FarmSaleItem> & { item_type: SaleItemType; quantity: number; price_per_unit: number; _key: string }

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  farmId: string
  saleId?: string | null
}

const CHANNELS: SaleChannel[] = ['retail', 'wholesale', 'market', 'direct', 'other']

export function SaleDialog({ open, onOpenChange, farmId, saleId }: Props) {
  const { t } = useTranslation()
  const symbol = useCurrencySymbol()
  const { data: existing } = useFarmSale(saleId ?? null)
  const { data: animals } = useAnimals(farmId)
  const { data: production } = useProduction({ farmId })
  const { data: crops } = useCrops(farmId)
  const upsert = useUpsertFarmSale()

  const [sale, setSale] = useState<Partial<FarmSale>>({
    date: new Date().toISOString().slice(0, 10),
    channel: 'direct',
    paid_amount: 0,
  })
  const [items, setItems] = useState<DraftItem[]>([])

  useEffect(() => {
    if (!open) return
    if (existing) {
      setSale({ ...existing })
      setItems(existing.items.map((i, idx) => ({ ...i, _key: `${i.id}-${idx}` })))
    } else {
      setSale({ date: new Date().toISOString().slice(0, 10), channel: 'direct', paid_amount: 0 })
      setItems([])
    }
  }, [open, existing])

  const total = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.price_per_unit) || 0), 0)

  const addItem = () => setItems(prev => [...prev, { _key: Math.random().toString(36).slice(2), item_type: 'other', quantity: 1, price_per_unit: 0 }])
  const updItem = (key: string, patch: Partial<DraftItem>) => setItems(prev => prev.map(i => i._key === key ? { ...i, ...patch } : i))
  const delItem = (key: string) => setItems(prev => prev.filter(i => i._key !== key))

  async function save() {
    await upsert.mutateAsync({
      sale: {
        id: sale.id,
        farm_id: farmId,
        date: sale.date!,
        buyer_name: sale.buyer_name ?? null,
        buyer_contact: sale.buyer_contact ?? null,
        channel: sale.channel ?? 'direct',
        paid_amount: Number(sale.paid_amount ?? 0),
        notes: sale.notes ?? null,
      },
      items: items.map(i => ({
        id: i.id,
        item_type: i.item_type,
        animal_id: i.animal_id ?? null,
        production_id: i.production_id ?? null,
        crop_id: i.crop_id ?? null,
        group_id: i.group_id ?? null,
        description: i.description ?? null,
        quantity: Number(i.quantity),
        unit: i.unit ?? null,
        price_per_unit: Number(i.price_per_unit),
      })),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{sale.id ? t('farm.sales.edit') : t('farm.sales.add')}</DialogTitle></DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('farm.sales.fields.date')}>
            <Input type="date" value={sale.date ?? ''} onChange={e => setSale({ ...sale, date: e.target.value })} />
          </Field>
          <Field label={t('farm.sales.fields.channel')}>
            <Select value={sale.channel ?? 'direct'} onValueChange={v => setSale({ ...sale, channel: v as SaleChannel })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{t(`farm.sales.channel.${c}`)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label={t('farm.sales.fields.buyerName')}>
            <Input value={sale.buyer_name ?? ''} onChange={e => setSale({ ...sale, buyer_name: e.target.value })} />
          </Field>
          <Field label={t('farm.sales.fields.buyerContact')}>
            <Input value={sale.buyer_contact ?? ''} onChange={e => setSale({ ...sale, buyer_contact: e.target.value })} />
          </Field>
        </div>

        <div className="space-y-2 border-t pt-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">{t('farm.sales.items')}</Label>
            <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-4 w-4 mr-1" /> {t('farm.sales.addItem')}</Button>
          </div>
          {items.length === 0 && <p className="text-xs text-muted-foreground">{t('farm.sales.noItems')}</p>}
          {items.map(i => (
            <div key={i._key} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-2 bg-muted/20">
              <div className="col-span-3">
                <Label className="text-xs">{t('farm.sales.itemType')}</Label>
                <Select value={i.item_type} onValueChange={v => updItem(i._key, { item_type: v as SaleItemType, animal_id: null, production_id: null, crop_id: null })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="animal">{t('farm.sales.type.animal')}</SelectItem>
                    <SelectItem value="production">{t('farm.sales.type.production')}</SelectItem>
                    <SelectItem value="crop">{t('farm.sales.type.crop')}</SelectItem>
                    <SelectItem value="other">{t('farm.sales.type.other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-4">
                <Label className="text-xs">{t('farm.sales.itemRef')}</Label>
                {i.item_type === 'animal' ? (
                  <Select value={i.animal_id ?? ''} onValueChange={v => updItem(i._key, { animal_id: v, description: (animals ?? []).find(a => a.id === v)?.tag ?? null })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{(animals ?? []).map(a => <SelectItem key={a.id} value={a.id}>{a.tag}{a.name ? ` · ${a.name}` : ''}</SelectItem>)}</SelectContent>
                  </Select>
                ) : i.item_type === 'production' ? (
                  <Select value={i.production_id ?? ''} onValueChange={v => {
                    const p = (production ?? []).find(x => x.id === v)
                    updItem(i._key, { production_id: v, unit: p?.type ?? null, description: p ? `${p.type} · ${p.date}` : null, group_id: p?.group_id ?? null })
                  }}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{(production ?? []).map(p => <SelectItem key={p.id} value={p.id}>{t(`farm.production.type.${p.type}`)} · {p.date} · {p.quantity}</SelectItem>)}</SelectContent>
                  </Select>
                ) : i.item_type === 'crop' ? (
                  <Select value={i.crop_id ?? ''} onValueChange={v => {
                    const c = (crops ?? []).find(x => x.id === v)
                    updItem(i._key, { crop_id: v, description: c?.name ?? null })
                  }}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{(crops ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input placeholder={t('farm.sales.itemDesc')} value={i.description ?? ''} onChange={e => updItem(i._key, { description: e.target.value })} />
                )}
              </div>
              <div className="col-span-2">
                <Label className="text-xs">{t('farm.sales.qty')}</Label>
                <Input type="number" step="0.01" value={i.quantity} onChange={e => updItem(i._key, { quantity: Number(e.target.value) })} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">{t('farm.sales.price')}</Label>
                <Input type="number" step="0.01" value={i.price_per_unit} onChange={e => updItem(i._key, { price_per_unit: Number(e.target.value) })} />
              </div>
              <div className="col-span-1 flex justify-end">
                <Button size="icon" variant="ghost" onClick={() => delItem(i._key)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
              <div className="col-span-12 text-right text-xs text-muted-foreground">
                {formatCurrency((Number(i.quantity) || 0) * (Number(i.price_per_unit) || 0))} {symbol}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('farm.sales.total')}</span>
            <span className="font-bold text-lg">{formatCurrency(total)} {symbol}</span>
          </div>
          <Field label={t('farm.sales.fields.paidAmount')}>
            <Input type="number" step="0.01" value={sale.paid_amount ?? 0} onChange={e => setSale({ ...sale, paid_amount: Number(e.target.value) })} />
          </Field>
          <Field label={t('farm.sales.fields.notes')}>
            <Textarea rows={2} value={sale.notes ?? ''} onChange={e => setSale({ ...sale, notes: e.target.value })} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('farm.common.cancel')}</Button>
          <Button disabled={items.length === 0 || upsert.isPending} onClick={save}>{t('farm.common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>
}
