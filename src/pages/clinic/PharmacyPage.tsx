import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useClinicPharmacyItems,
  useCreatePharmacyItem,
  useUpdatePharmacyItem,
  useDeletePharmacyItem,
  usePharmacyStats,
} from '@/hooks/useClinicPharmacy'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { toast } from '@/components/shared/Toaster'
import { PharmacyReceiptDialog } from '@/components/clinic/PharmacyReceiptDialog'
import { DispenseDialog } from '@/components/clinic/DispenseDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
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
import {
  Plus,
  ArrowRightFromLine,
  Search,
  Pencil,
  PackagePlus,
  Trash2,
  Pill,
  Package,
  AlertTriangle,
  DollarSign,
} from 'lucide-react'
import dayjs from 'dayjs'
import type { ClinicPharmacyItem, DosageForm } from '@/types'

const DOSAGE_FORMS: DosageForm[] = [
  'tablet', 'capsule', 'injection', 'syrup', 'cream', 'drops',
  'ointment', 'powder', 'solution', 'suppository', 'inhaler', 'other',
]

const EMPTY_FORM = {
  name: '',
  generic_name: '',
  category: '',
  dosage_form: '' as string,
  manufacturer: '',
  sku: '',
  quantity: 0,
  min_quantity: 0,
  cost_price: 0,
  sell_price: 0,
  expiry_date: '',
  prescription_required: false,
  unit: '',
  notes: '',
}

export function PharmacyPage() {
  const { t } = useTranslation()
  const currency = useCurrency()

  const [search, setSearch] = useState('')
  const { data: items = [], isLoading } = useClinicPharmacyItems(search || undefined)
  const { data: stats } = usePharmacyStats()

  const createItem = useCreatePharmacyItem()
  const updateItem = useUpdatePharmacyItem()
  const deleteItem = useDeletePharmacyItem()

  const [editOpen, setEditOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ClinicPharmacyItem | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptItemId, setReceiptItemId] = useState<string | undefined>()
  const [receiptItemName, setReceiptItemName] = useState<string | undefined>()
  const [dispenseOpen, setDispenseOpen] = useState(false)

  const isCreate = !editingItem

  useEffect(() => {
    if (editingItem) {
      setForm({
        name: editingItem.name,
        generic_name: editingItem.generic_name || '',
        category: editingItem.category || '',
        dosage_form: editingItem.dosage_form || '',
        manufacturer: editingItem.manufacturer || '',
        sku: editingItem.sku || '',
        quantity: editingItem.quantity,
        min_quantity: editingItem.min_quantity,
        cost_price: editingItem.cost_price ?? 0,
        sell_price: editingItem.sell_price ?? 0,
        expiry_date: editingItem.expiry_date || '',
        prescription_required: editingItem.prescription_required,
        unit: editingItem.unit || '',
        notes: editingItem.notes || '',
      })
    }
  }, [editingItem])

  const openCreate = () => {
    setEditingItem(null)
    setForm(EMPTY_FORM)
    setEditOpen(true)
  }

  const openEdit = (item: ClinicPharmacyItem) => {
    setEditingItem(item)
    setEditOpen(true)
  }

  const openReceipt = (item: ClinicPharmacyItem) => {
    setReceiptItemId(item.id)
    setReceiptItemName(item.name)
    setReceiptOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: t('clinic.pharmacy.nameRequired'), variant: 'destructive' })
      return
    }
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      generic_name: form.generic_name.trim() || null,
      category: form.category.trim() || null,
      dosage_form: form.dosage_form || null,
      manufacturer: form.manufacturer.trim() || null,
      sku: form.sku.trim() || null,
      quantity: Number(form.quantity) || 0,
      min_quantity: Number(form.min_quantity) || 0,
      cost_price: Number(form.cost_price) || null,
      sell_price: Number(form.sell_price) || null,
      expiry_date: form.expiry_date || null,
      prescription_required: form.prescription_required,
      unit: form.unit.trim() || null,
      notes: form.notes.trim() || null,
    }

    try {
      if (isCreate) {
        await createItem.mutateAsync(payload as Partial<ClinicPharmacyItem> & { name: string })
        toast({ title: t('clinic.pharmacy.created') })
      } else {
        await updateItem.mutateAsync({ id: editingItem!.id, ...payload } as Partial<ClinicPharmacyItem> & { id: string })
        toast({ title: t('clinic.pharmacy.updated') })
      }
      setEditOpen(false)
    } catch {
      toast({ title: t('common.error'), variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteItem.mutateAsync(deletingId)
      toast({ title: t('clinic.pharmacy.deleted') })
      setDeleteOpen(false)
      setDeletingId(null)
    } catch {
      toast({ title: t('common.error'), variant: 'destructive' })
    }
  }

  const setField = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }))

  const soonDate = useMemo(() => dayjs().add(30, 'day').format('YYYY-MM-DD'), [])

  const qtyColor = (item: ClinicPharmacyItem) => {
    if (item.quantity <= 0) return 'text-red-600'
    if (item.min_quantity > 0 && item.quantity <= item.min_quantity) return 'text-amber-600'
    return 'text-green-600'
  }

  const isExpiringSoon = (d?: string | null) => d && d <= soonDate

  return (
    <div className="space-y-4">
      <PageHeader title={t('clinic.pharmacy.title')}>
        <Button variant="outline" onClick={() => setDispenseOpen(true)}>
          <ArrowRightFromLine className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">{t('clinic.pharmacy.dispense')}</span>
        </Button>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">{t('clinic.pharmacy.addMedicine')}</span>
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Package className="h-5 w-5 text-blue-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{t('clinic.pharmacy.totalItems')}</p>
              <p className="text-lg font-semibold">{stats ? items.length : <Skeleton className="h-5 w-8 inline-block" />}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{t('clinic.pharmacy.lowStock')}</p>
              <p className="text-lg font-semibold text-amber-600">
                {stats ? stats.lowStock : <Skeleton className="h-5 w-8 inline-block" />}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Pill className="h-5 w-5 text-orange-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{t('clinic.pharmacy.expiringSoon')}</p>
              <p className="text-lg font-semibold text-orange-600">
                {stats ? stats.expiringSoon : <Skeleton className="h-5 w-8 inline-block" />}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <DollarSign className="h-5 w-5 text-green-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{t('clinic.pharmacy.totalValue')}</p>
              <p className="text-lg font-semibold">
                {stats ? formatCurrency(stats.totalValue, currency) : <Skeleton className="h-5 w-12 inline-block" />}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('clinic.pharmacy.searchPlaceholder')}
          className="pl-9"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Pill}
          title={t('clinic.pharmacy.emptyTitle')}
          description={t('clinic.pharmacy.emptyDescription')}
          action={{ label: t('clinic.pharmacy.addMedicine'), onClick: openCreate }}
        />
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground truncate">{item.name}</span>
                      {item.dosage_form && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {t(`clinic.pharmacy.dosageForms.${item.dosage_form}`)}
                        </Badge>
                      )}
                      {item.prescription_required && (
                        <Badge variant="outline" className="text-xs shrink-0">Rx</Badge>
                      )}
                    </div>
                    {item.generic_name && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">{item.generic_name}</p>
                    )}
                    {item.manufacturer && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.manufacturer}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 flex-wrap text-sm">
                    <div className="text-center min-w-[60px]">
                      <p className="text-xs text-muted-foreground">{t('clinic.pharmacy.qty')}</p>
                      <p className={`font-semibold ${qtyColor(item)}`}>{item.quantity}</p>
                    </div>

                    {item.expiry_date && (
                      <div className="text-center min-w-[80px]">
                        <p className="text-xs text-muted-foreground">{t('clinic.pharmacy.expiry')}</p>
                        <p className={`font-medium ${isExpiringSoon(item.expiry_date) ? 'text-red-600' : ''}`}>
                          {dayjs(item.expiry_date).format('DD.MM.YYYY')}
                        </p>
                      </div>
                    )}

                    {item.sell_price != null && item.sell_price > 0 && (
                      <div className="text-center min-w-[70px]">
                        <p className="text-xs text-muted-foreground">{t('clinic.pharmacy.price')}</p>
                        <p className="font-medium">{formatCurrency(item.sell_price, currency)}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title={t('common.edit')}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openReceipt(item)} title={t('clinic.pharmacy.addReceipt')}>
                        <PackagePlus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setDeletingId(item.id); setDeleteOpen(true) }}
                        title={t('common.delete')}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreate ? t('clinic.pharmacy.addMedicine') : t('clinic.pharmacy.editMedicine')}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('clinic.pharmacy.fields.name')} *</Label>
                <Input value={form.name} onChange={e => setField('name', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('clinic.pharmacy.fields.genericName')}</Label>
                <Input value={form.generic_name} onChange={e => setField('generic_name', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('clinic.pharmacy.fields.category')}</Label>
                <Input value={form.category} onChange={e => setField('category', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('clinic.pharmacy.fields.dosageForm')}</Label>
                <Select value={form.dosage_form} onValueChange={v => setField('dosage_form', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.select')} />
                  </SelectTrigger>
                  <SelectContent>
                    {DOSAGE_FORMS.map(df => (
                      <SelectItem key={df} value={df}>
                        {t(`clinic.pharmacy.dosageForms.${df}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('clinic.pharmacy.fields.manufacturer')}</Label>
                <Input value={form.manufacturer} onChange={e => setField('manufacturer', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('clinic.pharmacy.fields.sku')}</Label>
                <Input value={form.sku} onChange={e => setField('sku', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>{t('clinic.pharmacy.fields.quantity')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={e => setField('quantity', Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('clinic.pharmacy.fields.minQuantity')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.min_quantity}
                  onChange={e => setField('min_quantity', Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('clinic.pharmacy.fields.unit')}</Label>
                <Input value={form.unit} onChange={e => setField('unit', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('clinic.pharmacy.fields.costPrice')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.cost_price}
                  onChange={e => setField('cost_price', Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('clinic.pharmacy.fields.sellPrice')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sell_price}
                  onChange={e => setField('sell_price', Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('clinic.pharmacy.fields.expiryDate')}</Label>
              <Input
                type="date"
                value={form.expiry_date}
                onChange={e => setField('expiry_date', e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>{t('clinic.pharmacy.fields.prescriptionRequired')}</Label>
              <Switch
                checked={form.prescription_required}
                onCheckedChange={v => setField('prescription_required', v)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('clinic.pharmacy.fields.notes')}</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              loading={createItem.isPending || updateItem.isPending}
            >
              {isCreate ? t('common.create') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeletingId(null) }}
        onConfirm={handleDelete}
        title={t('clinic.pharmacy.deleteTitle')}
        description={t('clinic.pharmacy.deleteDescription')}
        loading={deleteItem.isPending}
      />

      {/* Receipt Dialog */}
      <PharmacyReceiptDialog
        open={receiptOpen}
        onOpenChange={v => { setReceiptOpen(v); if (!v) { setReceiptItemId(undefined); setReceiptItemName(undefined) } }}
        itemId={receiptItemId}
        itemName={receiptItemName}
      />

      {/* Dispense Dialog */}
      <DispenseDialog open={dispenseOpen} onOpenChange={setDispenseOpen} />
    </div>
  )
}
