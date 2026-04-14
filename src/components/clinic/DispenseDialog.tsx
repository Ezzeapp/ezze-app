import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useClinicPharmacyItems } from '@/hooks/useClinicPharmacy'
import { useCreateDispensing } from '@/hooks/useClinicDispensing'
import { useClients } from '@/hooks/useClients'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/utils'
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
import { Plus, Trash2, Search, AlertCircle } from 'lucide-react'
import type { ClinicPharmacyItem } from '@/types'

interface DispenseLine {
  item_id: string
  quantity: number
}

interface DispenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId?: string
  visitId?: string
  prescriptions?: Array<{ name: string; dosage: string; frequency: string; duration: string }>
}

export function DispenseDialog({ open, onOpenChange, clientId, visitId, prescriptions }: DispenseDialogProps) {
  const { t } = useTranslation()
  const currency = useCurrency()
  const { data: pharmacyItems = [] } = useClinicPharmacyItems()
  const { data: clients = [] } = useClients()
  const createDispensing = useCreateDispensing()

  const [selectedClientId, setSelectedClientId] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [lines, setLines] = useState<DispenseLine[]>([{ item_id: '', quantity: 1 }])

  // Build stock map
  const stockMap = useMemo(() => {
    const map = new Map<string, ClinicPharmacyItem>()
    pharmacyItems.forEach(item => map.set(item.id, item))
    return map
  }, [pharmacyItems])

  // Filter clients for search
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients
    const q = clientSearch.toLowerCase()
    return clients.filter(c =>
      `${c.first_name} ${c.last_name || ''}`.toLowerCase().includes(q)
    )
  }, [clients, clientSearch])

  // Find unmatched prescriptions
  const unmatchedPrescriptions = useMemo(() => {
    if (!prescriptions?.length) return []
    return prescriptions.filter(rx => {
      const nameL = rx.name.toLowerCase()
      return !pharmacyItems.some(item =>
        item.name.toLowerCase().includes(nameL) || nameL.includes(item.name.toLowerCase())
      )
    })
  }, [prescriptions, pharmacyItems])

  // Reset form on open
  useEffect(() => {
    if (open) {
      setSelectedClientId(clientId || '')
      setClientSearch('')

      if (prescriptions?.length && pharmacyItems.length) {
        // Auto-match prescriptions to pharmacy items
        const autoLines: DispenseLine[] = []
        for (const rx of prescriptions) {
          const nameL = rx.name.toLowerCase()
          const match = pharmacyItems.find(item =>
            item.name.toLowerCase().includes(nameL) || nameL.includes(item.name.toLowerCase())
          )
          if (match) {
            autoLines.push({ item_id: match.id, quantity: 1 })
          }
        }
        setLines(autoLines.length > 0 ? autoLines : [{ item_id: '', quantity: 1 }])
      } else {
        setLines([{ item_id: '', quantity: 1 }])
      }
    }
  }, [open, clientId, prescriptions, pharmacyItems])

  const addLine = () => setLines(l => [...l, { item_id: '', quantity: 1 }])

  const removeLine = (idx: number) => {
    setLines(l => l.length <= 1 ? l : l.filter((_, i) => i !== idx))
  }

  const updateLine = (idx: number, field: keyof DispenseLine, value: string | number) => {
    setLines(l => l.map((line, i) => i === idx ? { ...line, [field]: value } : line))
  }

  const totalPrice = useMemo(() => {
    return lines.reduce((sum, line) => {
      if (!line.item_id) return sum
      const item = stockMap.get(line.item_id)
      return sum + (item?.sell_price || 0) * (line.quantity || 0)
    }, 0)
  }, [lines, stockMap])

  const handleSubmit = async () => {
    const cid = clientId || selectedClientId
    if (!cid) {
      toast({ title: t('clinic.pharmacy.dispenseDialog.selectPatient'), variant: 'destructive' })
      return
    }

    // Validate lines
    for (const line of lines) {
      if (!line.item_id) {
        toast({ title: t('clinic.pharmacy.dispenseDialog.selectMedicine'), variant: 'destructive' })
        return
      }
      if (!line.quantity || line.quantity <= 0) {
        toast({ title: t('clinic.pharmacy.dispenseDialog.invalidQuantity'), variant: 'destructive' })
        return
      }
      const item = stockMap.get(line.item_id)
      if (item && line.quantity > item.quantity) {
        toast({
          title: t('clinic.pharmacy.dispenseDialog.insufficientStock', { name: item.name }),
          variant: 'destructive',
        })
        return
      }
    }

    try {
      await createDispensing.mutateAsync({
        client_id: cid,
        visit_id: visitId || null,
        items: lines.map(line => ({
          item_id: line.item_id,
          quantity: line.quantity,
          price: stockMap.get(line.item_id)?.sell_price ?? null,
        })),
      })
      toast({ title: t('clinic.pharmacy.dispenseDialog.success') })
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('common.error')
      toast({ title: msg, variant: 'destructive' })
    }
  }

  // Selected client name
  const selectedClient = useMemo(() => {
    const cid = clientId || selectedClientId
    if (!cid) return null
    return clients.find(c => c.id === cid)
  }, [clientId, selectedClientId, clients])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('clinic.pharmacy.dispenseDialog.title')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Patient selector */}
          {clientId && selectedClient ? (
            <div className="space-y-1.5">
              <Label>{t('clinic.pharmacy.dispenseDialog.patient')}</Label>
              <Input
                value={`${selectedClient.first_name} ${selectedClient.last_name || ''}`.trim()}
                disabled
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>{t('clinic.pharmacy.dispenseDialog.patient')} *</Label>
              <div className="relative mb-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  placeholder={t('clinic.pharmacy.dispenseDialog.searchPatient')}
                  className="pl-9"
                />
              </div>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('clinic.pharmacy.dispenseDialog.selectPatient')} />
                </SelectTrigger>
                <SelectContent>
                  {filteredClients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name || ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Unmatched prescriptions info */}
          {unmatchedPrescriptions.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-400">
                  {t('clinic.pharmacy.dispenseDialog.notFound')}
                </p>
                <ul className="mt-1 text-amber-700 dark:text-amber-500">
                  {unmatchedPrescriptions.map((rx, i) => (
                    <li key={i}>{rx.name} {rx.dosage && `(${rx.dosage})`}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Medicine lines */}
          <div className="space-y-3">
            <Label>{t('clinic.pharmacy.dispenseDialog.medicines')}</Label>
            {lines.map((line, idx) => {
              const selectedItem = line.item_id ? stockMap.get(line.item_id) : null
              return (
                <div key={idx} className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    {idx === 0 && (
                      <p className="text-xs text-muted-foreground mb-1">
                        {t('clinic.pharmacy.dispenseDialog.medicine')}
                      </p>
                    )}
                    <Select value={line.item_id} onValueChange={v => updateLine(idx, 'item_id', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('common.select')} />
                      </SelectTrigger>
                      <SelectContent>
                        {pharmacyItems.map(item => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} ({item.quantity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-20 shrink-0">
                    {idx === 0 && (
                      <p className="text-xs text-muted-foreground mb-1">
                        {t('clinic.pharmacy.qty')}
                      </p>
                    )}
                    <Input
                      type="number"
                      min={1}
                      max={selectedItem?.quantity || 9999}
                      value={line.quantity}
                      onChange={e => updateLine(idx, 'quantity', Number(e.target.value))}
                    />
                  </div>

                  <div className="w-24 shrink-0 text-right">
                    {idx === 0 && (
                      <p className="text-xs text-muted-foreground mb-1">
                        {t('clinic.pharmacy.price')}
                      </p>
                    )}
                    <p className="h-9 flex items-center justify-end text-sm font-medium">
                      {selectedItem?.sell_price
                        ? formatCurrency(selectedItem.sell_price * line.quantity, currency)
                        : '-'}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}

            <Button variant="outline" size="sm" onClick={addLine} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              {t('clinic.pharmacy.dispenseDialog.addLine')}
            </Button>
          </div>

          {/* Total */}
          {totalPrice > 0 && (
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="font-medium">{t('clinic.pharmacy.dispenseDialog.total')}</span>
              <span className="text-lg font-semibold">{formatCurrency(totalPrice, currency)}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={createDispensing.isPending}>
            {t('clinic.pharmacy.dispenseDialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
