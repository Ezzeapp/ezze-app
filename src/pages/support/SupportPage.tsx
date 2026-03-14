import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LifeBuoy, Plus, ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/shared/Toaster'
import { cn } from '@/lib/utils'
import { useSupportTickets, useCreateSupportTicket, type TicketType, type TicketStatus, type SupportTicket } from '@/hooks/useSupportTickets'
import dayjs from 'dayjs'

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TicketStatus }) {
  const { t } = useTranslation()
  const map: Record<TicketStatus, { label: string; className: string; icon: React.ReactNode }> = {
    new:         { label: t('support.statusNew'),        className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',   icon: <Clock className="h-3 w-3" /> },
    in_progress: { label: t('support.statusInProgress'), className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', icon: <Loader2 className="h-3 w-3" /> },
    resolved:    { label: t('support.statusResolved'),   className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', icon: <CheckCircle2 className="h-3 w-3" /> },
    closed:      { label: t('support.statusClosed'),     className: 'bg-muted text-muted-foreground', icon: <XCircle className="h-3 w-3" /> },
  }
  const { label, className, icon } = map[status]
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', className)}>
      {icon}{label}
    </span>
  )
}

// ─── Type label ───────────────────────────────────────────────────────────────

function typeColor(type: TicketType) {
  return { bug: 'destructive', feature: 'default', question: 'secondary', other: 'outline' }[type] as 'default' | 'secondary' | 'destructive' | 'outline'
}

// ─── Ticket card ──────────────────────────────────────────────────────────────

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const { t, i18n } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const typeLabel = t(`support.type${ticket.type.charAt(0).toUpperCase() + ticket.type.slice(1)}` as any)

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant={typeColor(ticket.type)} className="text-xs">{typeLabel}</Badge>
            <StatusBadge status={ticket.status} />
          </div>
          <p className="font-medium text-sm truncate">{ticket.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {dayjs(ticket.created_at).locale(i18n.language).format('D MMM YYYY, HH:mm')}
          </p>
        </div>
        <div className="text-muted-foreground mt-1 shrink-0">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3">
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{ticket.message}</p>
          {ticket.admin_reply && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Ответ поддержки:</p>
              <p className="text-sm whitespace-pre-wrap">{ticket.admin_reply}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── New ticket form ──────────────────────────────────────────────────────────

function NewTicketForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const [type, setType] = useState<TicketType>('bug')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const create = useCreateSupportTicket()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) return
    try {
      await create.mutateAsync({ type, title: title.trim(), message: message.trim() })
      toast.success(t('support.submitted'))
      onClose()
    } catch {
      toast.error(t('common.error'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-4 space-y-4">
      <div className="space-y-1.5">
        <Label>{t('support.type')}</Label>
        <Select value={type} onValueChange={v => setType(v as TicketType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bug">{t('support.typeBug')}</SelectItem>
            <SelectItem value="feature">{t('support.typeFeature')}</SelectItem>
            <SelectItem value="question">{t('support.typeQuestion')}</SelectItem>
            <SelectItem value="other">{t('support.typeOther')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="s-title">{t('support.titleField')}</Label>
        <Input
          id="s-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t('support.titlePlaceholder')}
          maxLength={150}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="s-msg">{t('support.message')}</Label>
        <Textarea
          id="s-msg"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={t('support.messagePlaceholder')}
          rows={5}
          maxLength={3000}
          required
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={create.isPending || !title.trim() || !message.trim()}>
          {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t('support.submit')}
        </Button>
      </div>
    </form>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const { t } = useTranslation()
  const { data: tickets, isLoading } = useSupportTickets()
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t('support.title')}</h1>
          </div>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('support.newTicket')}</span>
          </Button>
        )}
      </div>

      {/* New ticket form */}
      {showForm && (
        <NewTicketForm onClose={() => setShowForm(false)} />
      )}

      {/* Tickets list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="rounded-xl border bg-card h-20 animate-pulse" />
          ))}
        </div>
      ) : !tickets?.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <LifeBuoy className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground text-sm">{t('support.noTickets')}</p>
          {!showForm && (
            <Button variant="outline" className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('support.newTicket')}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  )
}
