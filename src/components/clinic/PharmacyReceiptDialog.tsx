import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useClinicPharmacyItems, useCreatePharmacyReceipt } from '@/hooks/useClinicPharmacy'
import { toast } from '@/components/shared/Toaster'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PharmacyReceiptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemId?: string
  itemName?: string
}

const EMPTY_FORM = {
  item_id: '',
  quantity: 1,
  cost_price: '',
  supplier: '',
  batch_number: '',
  expiry_date: '',
  notes: '',
}

export function PharmacyReceiptDialog({ open, onOpenChange, itemId, itemName }: PharmacyReceiptDialogProps) {
  const { t } = useTranslation()
  const { data: items = [] } = useClinicPharmacyItems()
  const createReceipt = useCreatePharmacyReceipt()

  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM, item_id: itemId || '' })
    }
  }, [open, itemId])

  const setField = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }))

  const handleSubmit = async () => {
    const selectedItemId = itemId || form.item_id
    if (!selectedItemId) {
      toast({ title: t('clinic.pharmacy.receipt.selectItem'), variant: 'destructive' })
      return
    }
    if (!form.quantity || form.quantity <= 0) {
      toast({ title: t('clinic.pharmacy.receipt.quantityRequired'), variant: 'destructive' })
      return
    }

    try {
      await createReceipt.mutateAsync({
        item_id: selectedItemId,
        quantity: Number(form.quantity),
        cost_price: form.cost_price ? Number(form.cost_price) : null,
        supplier: form.supplier.trim() || null,
        batch_number: form.batch_number.trim() || null,
        expiry_date: form.expiry_date || null,
        notes: form.notes.trim() || null,
      })
      toast({ title: t('clinic.pharmacy.receipt.success') })
      onOpenChange(false)
    } catch {
      toast({ title: t('common.error'), variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('clinic.pharmacy.receipt.title')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Item selector or fixed name */}
          {itemId && itemName ? (
            <div className="space-y-1.5">
              <Label>{t('clinic.pharmacy.receipt.medicine')}</Label>
              <Input value={itemName} disabled />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>{t('clinic.pharmacy.receipt.medicine')} *</Label>
              <Select value={form.item_id} onValueChange={v => setField('item_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('clinic.pharmacy.receipt.selectMedicine')} />
                </SelectTrigger>
                <SelectContent>
                  {items.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('clinic.pharmacy.receipt.quantity')} *</Label>
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={e => setField('quantity', Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('clinic.pharmacy.receipt.costPrice')}</Label>
              <Input
                type="number"
                min={0}
                value={form.cost_price}
                onChange={e => setField('cost_price', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('clinic.pharmacy.receipt.supplier')}</Label>
              <Input
                value={form.supplier}
                onChange={e => setField('supplier', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('clinic.pharmacy.receipt.batchNumber')}</Label>
              <Input
                value={form.batch_number}
                onChange={e => setField('batch_number', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('clinic.pharmacy.receipt.expiryDate')}</Label>
            <Input
              type="date"
              value={form.expiry_date}
              onChange={e => setField('expiry_date', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('clinic.pharmacy.receipt.notes')}</Label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={createReceipt.isPending}>
            {t('clinic.pharmacy.receipt.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
