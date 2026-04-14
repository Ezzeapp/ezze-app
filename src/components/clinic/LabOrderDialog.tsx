import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useClinicLabTests } from '@/hooks/useClinicLabTests'
import { useCreateLabOrder } from '@/hooks/useClinicLabOrders'
import { toast } from '@/components/shared/Toaster'
import type { ClinicLabTest } from '@/types'

interface LabOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId?: string
  visitId?: string
}

interface ClientResult {
  id: string
  first_name: string
  last_name?: string | null
}

export function LabOrderDialog({ open, onOpenChange, clientId, visitId }: LabOrderDialogProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: allTests = [], isLoading: testsLoading } = useClinicLabTests()
  const createOrder = useCreateLabOrder()

  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState<ClientResult[]>([])
  const [clientLoading, setClientLoading] = useState(false)
  const [selectedTestIds, setSelectedTestIds] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedTestIds(new Set())
      setNotes('')
      setClientSearch('')
      setClientResults([])
      if (!clientId) {
        setSelectedClient(null)
      }
    }
  }, [open, clientId])

  // Pre-select client if clientId provided
  useEffect(() => {
    if (!clientId || !open) return
    ;(async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, first_name, last_name')
        .eq('id', clientId)
        .single()
      if (data) setSelectedClient(data as ClientResult)
    })()
  }, [clientId, open])

  // Search clients with debounce
  const searchClients = useCallback(async (query: string) => {
    if (!query.trim() || !user) {
      setClientResults([])
      return
    }
    setClientLoading(true)
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, first_name, last_name')
        .eq('master_id', user.id)
        .ilike('first_name', `%${query}%`)
        .limit(10)
      setClientResults((data ?? []) as ClientResult[])
    } finally {
      setClientLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!clientSearch.trim()) {
      setClientResults([])
      return
    }
    const timer = setTimeout(() => searchClients(clientSearch), 300)
    return () => clearTimeout(timer)
  }, [clientSearch, searchClients])

  const toggleTest = (testId: string) => {
    setSelectedTestIds(prev => {
      const next = new Set(prev)
      if (next.has(testId)) next.delete(testId)
      else next.add(testId)
      return next
    })
  }

  const selectedTests = allTests.filter(t => selectedTestIds.has(t.id))

  const handleSubmit = async () => {
    if (!selectedClient) {
      toast.error(t('clinic.lab.selectPatientRequired'))
      return
    }
    if (selectedTests.length === 0) {
      toast.error(t('clinic.lab.selectTestsRequired'))
      return
    }

    try {
      await createOrder.mutateAsync({
        client_id: selectedClient.id,
        visit_id: visitId ?? null,
        notes: notes.trim() || null,
        items: selectedTests.map(test => ({
          test_id: test.id,
          test_name: test.name,
          result_unit: test.unit ?? null,
          ref_min: test.ref_min ?? null,
          ref_max: test.ref_max ?? null,
          ref_text: test.ref_text ?? null,
        })),
      })
      toast.success(t('clinic.lab.orderCreated'))
      onOpenChange(false)
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const formatRef = (test: ClinicLabTest) => {
    if (test.ref_min != null && test.ref_max != null) {
      return `${test.ref_min} - ${test.ref_max}${test.unit ? ` ${test.unit}` : ''}`
    }
    return test.ref_text || null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('clinic.lab.newOrder')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient selection */}
          <div>
            <Label className="text-sm">{t('clinic.lab.patient')}</Label>
            {selectedClient ? (
              <div className="flex items-center gap-2 mt-1.5 p-2 rounded-md border bg-muted/50">
                <span className="text-sm font-medium flex-1">
                  {selectedClient.first_name} {selectedClient.last_name || ''}
                </span>
                {!clientId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => { setSelectedClient(null); setClientSearch('') }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-1.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="h-9 pl-8"
                    placeholder={t('clinic.lab.searchPatientPlaceholder')}
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                {clientLoading && (
                  <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t('common.loading')}
                  </div>
                )}
                {clientResults.length > 0 && (
                  <div className="mt-1 border rounded-md divide-y max-h-[150px] overflow-y-auto">
                    {clientResults.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onClick={() => {
                          setSelectedClient(c)
                          setClientSearch('')
                          setClientResults([])
                        }}
                      >
                        {c.first_name} {c.last_name || ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test selection */}
          <div>
            <Label className="text-sm">{t('clinic.lab.selectTests')}</Label>
            {testsLoading ? (
              <div className="space-y-2 mt-1.5">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-md" />)}
              </div>
            ) : allTests.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-1.5">{t('clinic.lab.noTestsConfigured')}</p>
            ) : (
              <div className="mt-1.5 space-y-1 max-h-[250px] overflow-y-auto border rounded-md p-1">
                {allTests.map(test => {
                  const checked = selectedTestIds.has(test.id)
                  const ref = formatRef(test)
                  return (
                    <button
                      key={test.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                        checked ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-accent'
                      }`}
                      onClick={() => toggleTest(test.id)}
                    >
                      <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                        checked ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                      }`}>
                        {checked && <Check className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{test.name}</span>
                        {ref && (
                          <span className="text-xs text-muted-foreground ml-2">{ref}</span>
                        )}
                      </div>
                      {test.category && (
                        <Badge variant="outline" className="text-[10px] shrink-0">{test.category}</Badge>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Selected chips */}
            {selectedTests.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedTests.map(test => (
                  <Badge key={test.id} variant="secondary" className="gap-1 pr-1">
                    {test.name}
                    <button
                      type="button"
                      className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                      onClick={() => toggleTest(test.id)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm">{t('clinic.lab.notes')}</Label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1.5 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder={t('clinic.lab.notesPlaceholder')}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createOrder.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedClient || selectedTests.length === 0 || createOrder.isPending}
          >
            {createOrder.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {t('clinic.lab.createOrder')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
