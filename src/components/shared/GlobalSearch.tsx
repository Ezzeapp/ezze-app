import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, User, CalendarDays, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useClients } from '@/hooks/useClients'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import type { Appointment, Client } from '@/types'

const APPT_EXPAND = 'client,service'

interface Props {
  open: boolean
  onClose: () => void
}

export function GlobalSearch({ open, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const currency = useCurrency()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const searchStart = dayjs().subtract(90, 'day').format('YYYY-MM-DD')
  const searchEnd   = dayjs().add(14, 'day').format('YYYY-MM-DD')

  const { data: allClients } = useClients()

  const { data: searchAppts } = useQuery({
    queryKey: ['global_search_appts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, client:clients(id,first_name,last_name), service:services(id,name)')
        .eq('master_id', user!.id)
        .gte('date', searchStart)
        .lte('date', searchEnd)
        .order('date', { ascending: false })
        .order('start_time', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Appointment[]
    },
    enabled: open && !!user,
    staleTime: 60_000,
  })

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const q = query.trim().toLowerCase()

  const filteredClients = useMemo((): Client[] => {
    if (!q || !allClients) return []
    return allClients.filter(c =>
      `${c.first_name} ${c.last_name || ''}`.toLowerCase().includes(q) ||
      (c.phone || '').replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
      (c.email || '').toLowerCase().includes(q)
    ).slice(0, 5)
  }, [allClients, q])

  const filteredAppts = useMemo((): Appointment[] => {
    if (!q || !searchAppts) return []
    return searchAppts.filter(a => {
      const clientName = a.expand?.client
        ? `${a.expand.client.first_name} ${a.expand.client.last_name || ''}`.toLowerCase()
        : (a.client_name || '').toLowerCase()
      const svcName = (a.expand?.service?.name || '').toLowerCase()
      const date = a.date || ''
      const formattedDate = dayjs(date).format('D MMMM').toLowerCase()
      return clientName.includes(q) || svcName.includes(q) || date.includes(q) || formattedDate.includes(q)
    }).slice(0, 5)
  }, [searchAppts, q])

  const hasResults = filteredClients.length > 0 || filteredAppts.length > 0
  const showEmpty  = q.length >= 2 && !hasResults

  const handleClientClick = (client: Client) => {
    onClose()
    navigate('/clients', { state: { searchId: client.id } })
  }

  const handleApptClick = (appt: Appointment) => {
    onClose()
    navigate(`/calendar?date=${appt.date}`)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-0 gap-0 max-w-lg overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {!q && (
            <p className="text-sm text-muted-foreground text-center py-8">{t('search.hint')}</p>
          )}

          {showEmpty && (
            <p className="text-sm text-muted-foreground text-center py-8">{t('search.noResults')}</p>
          )}

          {filteredClients.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 pt-3 pb-1">
                {t('nav.clients')}
              </p>
              {filteredClients.map(client => {
                const name = `${client.first_name} ${client.last_name || ''}`.trim()
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleClientClick(client)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors text-left"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{name}</p>
                      {client.phone && (
                        <p className="text-xs text-muted-foreground">{client.phone}</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {filteredAppts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 pt-3 pb-1">
                {t('nav.calendar')}
              </p>
              {filteredAppts.map(appt => {
                const clientName = appt.expand?.client
                  ? `${appt.expand.client.first_name} ${appt.expand.client.last_name || ''}`.trim()
                  : (appt.client_name || t('appointments.guestClient'))
                const svcName = appt.expand?.service?.name || '—'
                const multiMatch = (appt.notes || '').match(/^\[(.+)\]/)
                const displaySvc = multiMatch ? multiMatch[1] : svcName
                return (
                  <button
                    key={appt.id}
                    type="button"
                    onClick={() => handleApptClick(appt)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors text-left"
                  >
                    <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
                      <CalendarDays className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{clientName}</p>
                      <p className="text-xs text-muted-foreground truncate">{displaySvc}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-mono text-muted-foreground">
                        {dayjs(appt.date).format('D MMM')} · {appt.start_time.slice(0, 5)}
                      </p>
                      {appt.price ? (
                        <p className="text-xs font-medium">{formatCurrency(appt.price, currency, i18n.language)}</p>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Hint at bottom */}
          {hasResults && (
            <p className="text-xs text-muted-foreground text-center py-2 border-t">
              {t('search.enterToOpen')}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
