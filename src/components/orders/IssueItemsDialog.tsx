import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useIssueItems } from '@/hooks/useCleaningOrders'
import { toast } from '@/components/shared/Toaster'
import type { CleaningOrder, CleaningOrderItem } from '@/hooks/useCleaningOrders'
import { formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'

interface IssueItemsDialogProps {
  order: CleaningOrder
  open: boolean
  onClose: () => void
}

export function IssueItemsDialog({ order, open, onClose }: IssueItemsDialogProps) {
  const symbol = useCurrencySymbol()
  const items = (order.items ?? []).filter(i => i.status !== 'issued')

  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map(i => i.id)))
  const [payAmount, setPayAmount] = useState<string>('')

  const { mutateAsync: issueItems, isPending } = useIssueItems()

  const remaining = order.total_amount - order.paid_amount
  const selectedItems = items.filter(i => selected.has(i.id))
  const selectedTotal = selectedItems.reduce((s, i) => s + i.price, 0)

  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set())
    else setSelected(new Set(items.map(i => i.id)))
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    if (selected.size === 0) {
      toast.error('Выберите хотя бы одно изделие')
      return
    }
    const pay = parseFloat(payAmount) || 0
    // Защита от переплаты — близнец fix-а в OrderDetailPage.handleConfirmPayment.
    if (pay > remaining + 0.01) {
      toast.error(`Сумма больше остатка (${formatCurrency(remaining)} ${symbol})`)
      return
    }
    try {
      await issueItems({
        orderId: order.id,
        itemIds: [...selected],
        payAmount: pay,
      })
      toast.success('Изделия выданы')
      onClose()
    } catch {
      toast.error('Ошибка при выдаче')
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent mobileFullscreen className="max-w-md max-sm:flex max-sm:flex-col">
        <DialogHeader>
          <DialogTitle>Выдача изделий — {order.number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Изделия */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Изделия к выдаче</Label>
              <button onClick={toggleAll} className="text-xs text-primary hover:underline">
                {selected.size === items.length ? 'Снять всё' : 'Выбрать всё'}
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет изделий для выдачи</p>
              ) : items.map(item => (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  <Checkbox
                    checked={selected.has(item.id)}
                    onCheckedChange={() => toggle(item.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.item_type_name}</p>
                    {item.color && <p className="text-xs text-muted-foreground">{item.color}</p>}
                  </div>
                  <span className="text-sm font-medium shrink-0">
                    {formatCurrency(item.price)} {symbol}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Итого */}
          <div className="rounded-lg bg-muted/50 px-3 py-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Сумма выданных</span>
              <span>{formatCurrency(selectedTotal)} {symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Остаток к оплате</span>
              <span className="font-semibold">{formatCurrency(remaining)} {symbol}</span>
            </div>
          </div>

          {/* Оплата */}
          <div>
            <Label htmlFor="pay">Принять оплату сейчас</Label>
            <div className="relative mt-1">
              <Input
                id="pay"
                type="number"
                min={0}
                placeholder="0"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                className="pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                {symbol}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={isPending || selected.size === 0}>
            {isPending ? 'Выдаём...' : 'Выдать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
