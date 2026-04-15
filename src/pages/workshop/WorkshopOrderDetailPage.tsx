import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Loader2, Trash2, Plus, CircleDollarSign, Wrench, Package,
  History, Phone, User, Calendar, AlertTriangle, Printer, Link2,
} from 'lucide-react'
import { printWorkshopReceipt } from './printReceipt'
import { WorkshopPhotosUploader } from './WorkshopPhotosUploader'
import { useWorkshopReceiptTemplate } from '@/pages/settings/WorkshopReceiptTemplateTab'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/components/shared/Toaster'
import {
  useWorkshopOrder, useUpdateWorkshopOrder, useUpdateWorkshopStatus,
  useAddWorkshopWork, useRemoveWorkshopWork, useToggleWorkshopWorkDone,
  useAddWorkshopPart, useRemoveWorkshopPart,
  useAcceptWorkshopPayment, useDeleteWorkshopOrder, useWorkshopOrderHistory,
  useClientWorkshopOrders,
  type WorkshopOrderStatus,
} from '@/hooks/useWorkshopOrders'
import { useInventory } from '@/hooks/useInventory'
import { useServices } from '@/hooks/useServices'
import { formatCurrency, cn } from '@/lib/utils'
import dayjs from 'dayjs'

const NEXT_STATUS_FLOW: Record<WorkshopOrderStatus, WorkshopOrderStatus[]> = {
  received:         ['diagnosing', 'cancelled'],
  diagnosing:       ['waiting_approval', 'in_progress', 'refused'],
  waiting_approval: ['in_progress', 'waiting_parts', 'refused'],
  waiting_parts:    ['in_progress', 'cancelled'],
  in_progress:      ['ready', 'waiting_parts'],
  ready:            ['issued'],
  issued:           ['paid'],
  paid:             [],
  refused:          [],
  cancelled:        [],
}

export function WorkshopOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { data: order, isLoading } = useWorkshopOrder(id)
  const { data: history } = useWorkshopOrderHistory(id)
  const { data: receiptTpl } = useWorkshopReceiptTemplate()

  const updateOrder = useUpdateWorkshopOrder()
  const updateStatus = useUpdateWorkshopStatus()
  const deleteOrder = useDeleteWorkshopOrder()
  const acceptPayment = useAcceptWorkshopPayment()

  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [payDialog, setPayDialog] = useState(false)
  const [payAmount, setPayAmount] = useState<number>(0)

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }
  if (!order) {
    return <div className="p-8 text-center text-muted-foreground">—</div>
  }

  const client = order.client
  const clientName = client ? `${client.first_name} ${client.last_name ?? ''}`.trim() : null
  const remaining = order.total_amount - order.paid_amount
  const nextStatuses = NEXT_STATUS_FLOW[order.status] ?? []

  async function handleStatusChange(newStatus: WorkshopOrderStatus) {
    try {
      await updateStatus.mutateAsync({ id: order!.id, status: newStatus })
      toast.success(t(`workshop.status.${newStatus}`))
    } catch (e: any) {
      toast.error(e.message ?? 'Error')
    }
  }

  async function handleDelete() {
    try {
      await deleteOrder.mutateAsync(order!.id)
      toast.success(t('workshop.detail.deleted'))
      navigate('/orders')
    } catch (e: any) {
      toast.error(e.message ?? 'Error')
    }
  }

  async function handlePay() {
    if (payAmount <= 0) return
    try {
      await acceptPayment.mutateAsync({ id: order!.id, amount: payAmount })
      toast.success(formatCurrency(payAmount))
      setPayDialog(false); setPayAmount(0)
    } catch (e: any) {
      toast.error(e.message ?? 'Error')
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> {t('workshop.detail.back')}
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="sm"
            onClick={() => {
              const url = `${window.location.origin}/track/${encodeURIComponent(order!.number)}`
              navigator.clipboard?.writeText(url)
              toast.success(`Скопировано: ${url}`)
            }}
          >
            <Link2 className="h-4 w-4 mr-1" /> Ссылка клиенту
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => {
              if (!receiptTpl) return
              const trackUrl = `${window.location.origin}/track/${encodeURIComponent(order!.number)}`
              printWorkshopReceipt({
                order: order!,
                template: receiptTpl,
                statusLabel: t(`workshop.status.${order!.status}`),
                trackUrl,
              })
            }}
          >
            <Printer className="h-4 w-4 mr-1" /> Печать
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(true)} className="text-red-600">
            <Trash2 className="h-4 w-4 mr-1" /> {t('workshop.detail.delete')}
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">{order.number}</h1>
          <span className="text-sm px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {t(`workshop.status.${order.status}`)}
          </span>
          {order.payment_status !== 'unpaid' && (
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              order.payment_status === 'paid'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            )}>
              {t(order.payment_status === 'paid' ? 'workshop.status.paid' : 'workshop.detail.paid')}
            </span>
          )}
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {dayjs(order.created_at).format('DD.MM.YYYY HH:mm')}
        </div>
      </div>

      {nextStatuses.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {nextStatuses.map(s => (
            <Button key={s} size="sm" variant="outline" onClick={() => handleStatusChange(s)}>
              → {t(`workshop.status.${s}`)}
            </Button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          <Card title={t('workshop.detail.device')} icon={Wrench}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Info label={t('workshop.form.itemType')} value={order.item_type_name} />
              <Info label={`${t('workshop.form.brand')} / ${t('workshop.form.model')}`} value={[order.brand, order.model].filter(Boolean).join(' ') || '—'} />
              <Info label={t('workshop.form.serial')} value={order.serial_number || '—'} />
              <Info label={t('workshop.form.imei')} value={order.imei || '—'} />
            </div>
            {order.defect_description && (
              <div className="mt-3 pt-3 border-t text-sm">
                <div className="font-semibold mb-1">{t('workshop.form.defect')}</div>
                <div className="text-muted-foreground">{order.defect_description}</div>
              </div>
            )}
            {order.visible_defects && (
              <div className="mt-3 pt-3 border-t text-sm">
                <div className="font-semibold mb-1">{t('workshop.form.visible')}</div>
                <div className="text-muted-foreground">{order.visible_defects}</div>
              </div>
            )}
            {order.completeness && (
              <div className="mt-3 pt-3 border-t text-sm">
                <div className="font-semibold mb-1">{t('workshop.form.completeness')}</div>
                <div className="text-muted-foreground">{order.completeness}</div>
              </div>
            )}
            <div className="mt-3 pt-3 border-t">
              <div className="text-sm font-semibold mb-2">Фото</div>
              <WorkshopPhotosUploader
                orderId={order.id}
                photos={order.photos ?? []}
                onChange={(photos) => updateOrder.mutate({ id: order.id, data: { photos } })}
                compact
              />
            </div>
          </Card>

          <DiagnosticCard order={order} onUpdate={(data) => updateOrder.mutate({ id: order.id, data })} />
          <WorksCard orderId={order.id} works={order.works ?? []} />
          <PartsCard orderId={order.id} parts={order.parts ?? []} />

          <Card title={t('workshop.detail.history')} icon={History}>
            {history && history.length > 0 ? (
              <div className="space-y-2 text-sm">
                {history.map((h: any) => (
                  <div key={h.id} className="flex items-start gap-2 text-xs">
                    <div className="text-muted-foreground shrink-0 w-32">
                      {dayjs(h.created_at).format('DD.MM HH:mm')}
                    </div>
                    <div>
                      {h.old_status && `${t(`workshop.status.${h.old_status}`)} → `}
                      <span className="font-semibold">{t(`workshop.status.${h.new_status}`)}</span>
                      {h.note && <span className="text-muted-foreground"> · {h.note}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">—</div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title={t('workshop.detail.client')} icon={User}>
            {clientName ? (
              <div className="text-sm space-y-1">
                <div className="font-semibold">{clientName}</div>
                {client?.phone && (
                  <a href={`tel:${client.phone}`} className="flex items-center gap-1 text-primary">
                    <Phone className="h-3 w-3" /> {client.phone}
                  </a>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">{t('workshop.detail.noClient')}</div>
            )}
          </Card>

          {client && <ClientHistoryCard clientId={client.id} currentOrderId={order.id} onOpen={(id) => navigate(`/orders/${id}`)} />}

          <Card title={t('workshop.detail.finance')} icon={CircleDollarSign}>
            <div className="space-y-2 text-sm">
              <Row label={t('workshop.detail.worksAmount')} value={formatCurrency(order.works_amount)} />
              <Row label={t('workshop.detail.partsAmount')} value={formatCurrency(order.parts_amount)} />
              <div className="border-t pt-2">
                <Row label={t('workshop.detail.total')} value={formatCurrency(order.total_amount)} bold />
              </div>
              <Row label={t('workshop.detail.prepaid')} value={formatCurrency(order.prepaid_amount)} />
              <Row label={t('workshop.detail.paid')} value={formatCurrency(order.paid_amount)} />
              {remaining > 0 && (
                <Row label={t('workshop.detail.remaining')} value={formatCurrency(remaining)} bold accent />
              )}
              {order.assigned_to_profile?.commission_rate && order.assigned_to_profile.commission_rate > 0 && order.works_amount > 0 && (
                <div className="border-t pt-2">
                  <Row
                    label={`Выплата мастеру (${order.assigned_to_profile.commission_rate}%)`}
                    value={formatCurrency(Math.round(order.works_amount * order.assigned_to_profile.commission_rate / 100))}
                  />
                </div>
              )}
              {(order.parts ?? []).some((p: any) => p.cost_price > 0) && (
                <Row
                  label="Прибыль по запчастям"
                  value={formatCurrency(
                    (order.parts ?? []).reduce((s: number, p: any) =>
                      s + ((p.sell_price - (p.cost_price ?? 0)) * (p.quantity ?? 1)), 0)
                  )}
                />
              )}
            </div>
            {remaining > 0 && (
              <Button size="sm" className="w-full mt-3" onClick={() => { setPayAmount(remaining); setPayDialog(true) }}>
                {t('workshop.detail.acceptPayment')}
              </Button>
            )}
          </Card>

          <Card title={t('workshop.detail.timing')} icon={Calendar}>
            <div className="space-y-2 text-sm">
              {order.ready_date && (
                <Row
                  label={t('workshop.detail.dueDate')}
                  value={dayjs(order.ready_date).format('DD.MM.YYYY')}
                  accent={dayjs(order.ready_date).isBefore(dayjs(), 'day') && !['issued','paid','cancelled','refused'].includes(order.status)}
                />
              )}
              {order.issued_at && (
                <Row label={t('workshop.detail.issuedAt')} value={dayjs(order.issued_at).format('DD.MM.YYYY')} />
              )}
              <Row label={t('workshop.detail.warranty')} value={t('workshop.detail.warrantyDays', { n: order.warranty_days })} />
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('workshop.detail.acceptPayment')}</DialogTitle></DialogHeader>
          <div>
            <Label>{t('workshop.detail.price')}</Label>
            <Input type="number" value={payAmount} onChange={e => setPayAmount(Number(e.target.value))} />
            <div className="text-xs text-muted-foreground mt-1">{t('workshop.detail.remaining')}: {formatCurrency(remaining)}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(false)}>{t('workshop.detail.cancel')}</Button>
            <Button onClick={handlePay} disabled={acceptPayment.isPending}>{t('workshop.detail.acceptPayment')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" /> {t('workshop.detail.confirmDelete', { number: order.number })}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('workshop.detail.confirmDeleteHint')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>{t('workshop.detail.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t('workshop.detail.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Diagnostic section ───────────────────────────────────────────────────────
function DiagnosticCard({ order, onUpdate }: { order: any; onUpdate: (data: any) => void }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(order.diagnostic_notes ?? '')
  const [estimated, setEstimated] = useState<number | ''>(order.estimated_cost ?? '')

  function save() {
    onUpdate({ diagnostic_notes: notes || null, estimated_cost: estimated === '' ? null : Number(estimated) })
    setEditing(false)
  }

  return (
    <Card title={t('workshop.detail.diagnostics')} icon={AlertTriangle}>
      {editing ? (
        <div className="space-y-2">
          <div>
            <Label>{t('workshop.detail.diagnosticResults')}</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>{t('workshop.detail.estimatedCost')}</Label>
            <Input type="number" value={estimated} onChange={e => setEstimated(e.target.value === '' ? '' : Number(e.target.value))} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>{t('workshop.detail.cancel')}</Button>
            <Button size="sm" onClick={save}>{t('workshop.detail.save')}</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
            {order.diagnostic_notes || '—'}
          </div>
          {order.estimated_cost != null && (
            <div className="mt-2 text-sm">{t('workshop.detail.estimatedCost')}: <span className="font-semibold">{formatCurrency(order.estimated_cost)}</span></div>
          )}
          <Button size="sm" variant="outline" className="mt-2" onClick={() => setEditing(true)}>
            {t('workshop.detail.edit')}
          </Button>
        </>
      )}
    </Card>
  )
}

// ── Works ────────────────────────────────────────────────────────────────────
function WorksCard({ orderId, works }: { orderId: string; works: any[] }) {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState<number>(0)
  const [serviceId, setServiceId] = useState<string | null>(null)
  const add = useAddWorkshopWork()
  const remove = useRemoveWorkshopWork()
  const toggle = useToggleWorkshopWorkDone()

  async function onAdd() {
    if (!name || price <= 0) return
    await add.mutateAsync({ orderId, work: { name, price, service_id: serviceId } })
    setName(''); setPrice(0); setServiceId(null); setAdding(false)
  }

  return (
    <Card title={t('workshop.detail.works')} icon={Wrench}>
      <div className="space-y-2">
        {works.map(w => (
          <div key={w.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox" checked={w.done}
              onChange={e => toggle.mutate({ orderId, workId: w.id, done: e.target.checked })}
              className="h-4 w-4"
            />
            <div className={cn('flex-1', w.done && 'line-through text-muted-foreground')}>{w.name}</div>
            <div className="font-mono">{formatCurrency(w.price * (w.quantity ?? 1))}</div>
            <button onClick={() => remove.mutate({ orderId, workId: w.id })} className="text-red-600 p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {works.length === 0 && <div className="text-sm text-muted-foreground">{t('workshop.detail.noWorks')}</div>}
      </div>

      {adding ? (
        <div className="mt-3 pt-3 border-t space-y-2">
          <ServicePicker onPick={(s) => { setName(s.name); setPrice(s.price); setServiceId(s.id) }} />
          <Input placeholder={t('workshop.detail.workName')} value={name} onChange={e => { setName(e.target.value); setServiceId(null) }} />
          <Input type="number" placeholder={t('workshop.detail.price')} value={price} onChange={e => setPrice(Number(e.target.value))} />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setAdding(false)}>{t('workshop.detail.cancel')}</Button>
            <Button size="sm" onClick={onAdd}>{t('workshop.detail.save')}</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="mt-3" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> {t('workshop.detail.addWork')}
        </Button>
      )}
    </Card>
  )
}

// ── Parts ────────────────────────────────────────────────────────────────────
function PartsCard({ orderId, parts }: { orderId: string; parts: any[] }) {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [sellPrice, setSellPrice] = useState<number>(0)
  const [costPrice, setCostPrice] = useState<number>(0)
  const [qty, setQty] = useState<number>(1)
  const [warranty, setWarranty] = useState<number>(30)
  const [inventoryItemId, setInventoryItemId] = useState<string | null>(null)
  const [sku, setSku] = useState<string | null>(null)
  const add = useAddWorkshopPart()
  const remove = useRemoveWorkshopPart()

  async function onAdd() {
    if (!name || sellPrice <= 0) return
    await add.mutateAsync({
      orderId,
      part: {
        name, sku,
        sell_price: sellPrice, cost_price: costPrice,
        quantity: qty, warranty_days: warranty,
        inventory_item_id: inventoryItemId,
      },
    })
    setName(''); setSellPrice(0); setCostPrice(0); setQty(1); setWarranty(30)
    setInventoryItemId(null); setSku(null); setAdding(false)
  }

  return (
    <Card title={t('workshop.detail.parts')} icon={Package}>
      <div className="space-y-2">
        {parts.map(p => (
          <div key={p.id} className="flex items-center gap-2 text-sm">
            <div className="flex-1">
              <div>{p.name} {p.quantity > 1 && <span className="text-muted-foreground">× {p.quantity}</span>}</div>
              {p.warranty_days > 0 && (
                <div className="text-xs text-muted-foreground">{t('workshop.detail.warranty')} {t('workshop.detail.warrantyDays', { n: p.warranty_days })}</div>
              )}
            </div>
            <div className="font-mono">{formatCurrency(p.sell_price * (p.quantity ?? 1))}</div>
            <button onClick={() => remove.mutate({ orderId, partId: p.id })} className="text-red-600 p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {parts.length === 0 && <div className="text-sm text-muted-foreground">{t('workshop.detail.noParts')}</div>}
      </div>

      {adding ? (
        <div className="mt-3 pt-3 border-t space-y-2">
          <InventoryPartPicker onPick={(item) => {
            setName(item.name)
            setSku(item.sku ?? null)
            setSellPrice(item.sell_price ?? 0)
            setCostPrice(item.cost_price ?? 0)
            setInventoryItemId(item.id)
          }} />
          <Input placeholder={t('workshop.detail.partName')} value={name} onChange={e => { setName(e.target.value); setInventoryItemId(null) }} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" placeholder={t('workshop.detail.sellPrice')} value={sellPrice} onChange={e => setSellPrice(Number(e.target.value))} />
            <Input type="number" placeholder={t('workshop.detail.costPrice')} value={costPrice} onChange={e => setCostPrice(Number(e.target.value))} />
            <Input type="number" placeholder={t('workshop.detail.quantity')} value={qty} onChange={e => setQty(Number(e.target.value))} />
            <Input type="number" placeholder={t('workshop.detail.warranty')} value={warranty} onChange={e => setWarranty(Number(e.target.value))} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setAdding(false)}>{t('workshop.detail.cancel')}</Button>
            <Button size="sm" onClick={onAdd}>{t('workshop.detail.save')}</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="mt-3" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> {t('workshop.detail.addPart')}
        </Button>
      )}
    </Card>
  )
}

// ── История заказов клиента ─────────────────────────────────────────────────
function ClientHistoryCard({ clientId, currentOrderId, onOpen }: {
  clientId: string; currentOrderId: string; onOpen: (id: string) => void
}) {
  const { data: orders } = useClientWorkshopOrders(clientId, currentOrderId)
  if (!orders || orders.length === 0) return null
  return (
    <Card title={`История ремонтов (${orders.length})`} icon={History}>
      <div className="space-y-1.5">
        {orders.slice(0, 5).map((o: any) => (
          <button
            key={o.id}
            onClick={() => onOpen(o.id)}
            className="w-full text-left flex items-center justify-between gap-2 text-xs hover:bg-accent/60 rounded px-2 py-1.5 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{o.number}</span>
                <span className="text-muted-foreground">{dayjs(o.created_at).format('DD.MM.YY')}</span>
              </div>
              <div className="text-muted-foreground truncate">
                {[o.item_type_name, o.brand, o.model].filter(Boolean).join(' ')}
              </div>
            </div>
            <span className="font-mono text-xs">{formatCurrency(o.total_amount)}</span>
          </button>
        ))}
      </div>
    </Card>
  )
}

// ── Service picker ───────────────────────────────────────────────────────────
function ServicePicker({ onPick }: { onPick: (s: { id: string | null; name: string; price: number }) => void }) {
  const { data: services } = useServices()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const active = (services ?? []).filter((s: any) => s.is_active)
  const filtered = q
    ? active.filter((s: any) => s.name.toLowerCase().includes(q.toLowerCase()))
    : active

  if (!active.length) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-xs text-primary hover:underline"
      >
        + из каталога услуг
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-64 overflow-auto">
          <Input
            autoFocus placeholder="Поиск..." value={q} onChange={e => setQ(e.target.value)}
            className="m-2 w-[calc(100%-16px)]"
          />
          {filtered.slice(0, 30).map((s: any) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onPick({ id: s.id, name: s.name, price: s.price ?? 0 })
                setOpen(false); setQ('')
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left"
            >
              <span>{s.name}</span>
              <span className="text-muted-foreground">{formatCurrency(s.price ?? 0)}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">—</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Inventory part picker ────────────────────────────────────────────────────
function InventoryPartPicker({ onPick }: {
  onPick: (item: { id: string; name: string; sku?: string; cost_price?: number; sell_price?: number }) => void
}) {
  const { data: items } = useInventory()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const filtered = q
    ? (items ?? []).filter((i: any) => i.name.toLowerCase().includes(q.toLowerCase()) || (i.sku ?? '').toLowerCase().includes(q.toLowerCase()))
    : (items ?? [])

  if (!items || !items.length) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-xs text-primary hover:underline"
      >
        + со склада
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-64 overflow-auto">
          <Input
            autoFocus placeholder="Поиск по названию, SKU..." value={q} onChange={e => setQ(e.target.value)}
            className="m-2 w-[calc(100%-16px)]"
          />
          {filtered.slice(0, 30).map((i: any) => (
            <button
              key={i.id}
              type="button"
              disabled={i.quantity <= 0}
              onClick={() => {
                onPick({
                  id: i.id, name: i.name, sku: i.sku,
                  cost_price: i.cost_price ?? 0,
                  sell_price: i.sell_price ?? i.cost_price ?? 0,
                })
                setOpen(false); setQ('')
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div>
                <div>{i.name}</div>
                {i.sku && <div className="text-xs text-muted-foreground">SKU {i.sku}</div>}
              </div>
              <div className="text-right">
                <div className="text-xs">{formatCurrency(i.sell_price ?? 0)}</div>
                <div className={cn('text-xs', i.quantity <= 0 ? 'text-red-600' : 'text-muted-foreground')}>
                  ост. {i.quantity}
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">—</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function Card({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  )
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(bold && 'font-semibold', accent && 'text-red-600 dark:text-red-400')}>{value}</span>
    </div>
  )
}
