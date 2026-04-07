import { useState, useMemo } from 'react'
import {
  LifeBuoy, ChevronDown, ChevronUp, Trash2, Send, Clock,
  CheckCircle2, XCircle, Loader2, User, Search, RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/shared/Toaster'
import { cn } from '@/lib/utils'
import {
  useAdminSupportTickets,
  useAdminUpdateTicket,
  useAdminDeleteTicket,
  type SupportTicketWithMaster,
  type TicketStatus,
  type TicketType,
} from '@/hooks/useSupportTickets'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import dayjs from 'dayjs'

// ── Константы ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS: { id: TicketStatus | 'all'; label: string }[] = [
  { id: 'all',         label: 'Все'      },
  { id: 'new',         label: 'Новые'    },
  { id: 'in_progress', label: 'В работе' },
  { id: 'resolved',    label: 'Решено'   },
  { id: 'closed',      label: 'Закрыто'  },
]

const STATUS_CONFIG: Record<TicketStatus, { label: string; icon: React.ReactNode; className: string }> = {
  new:         { label: 'Новое',    icon: <Clock className="h-3 w-3" />,        className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  in_progress: { label: 'В работе', icon: <Loader2 className="h-3 w-3" />,      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  resolved:    { label: 'Решено',   icon: <CheckCircle2 className="h-3 w-3" />, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  closed:      { label: 'Закрыто',  icon: <XCircle className="h-3 w-3" />,      className: 'bg-muted text-muted-foreground' },
}

const TYPE_LABELS: Record<TicketType, string> = {
  bug:     'Ошибка',
  feature: 'Функционал',
  question:'Вопрос',
  other:   'Другое',
}

const TYPE_COLORS: Record<TicketType, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  bug:     'destructive',
  feature: 'default',
  question:'secondary',
  other:   'outline',
}

// ── Бейдж статуса ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TicketStatus }) {
  const { label, icon, className } = STATUS_CONFIG[status]
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', className)}>
      {icon}{label}
    </span>
  )
}

// ── Карточка тикета ───────────────────────────────────────────────────────────

function TicketCard({
  ticket,
  siblingCount,
  onDeleted,
}: {
  ticket: SupportTicketWithMaster
  siblingCount: number   // сколько других тикетов от того же мастера
  onDeleted: () => void
}) {
  const [expanded, setExpanded]   = useState(false)
  const [reply, setReply]         = useState(ticket.admin_reply ?? '')
  const [status, setStatus]       = useState<TicketStatus>(ticket.status)
  const [confirmDel, setConfirmDel] = useState(false)

  const update = useAdminUpdateTicket()
  const remove = useAdminDeleteTicket()

  const masterDisplay = ticket.master_name || ticket.master_email || '—'

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        id: ticket.id,
        status,
        admin_reply: reply.trim() || null,
      })
      toast.success('Сохранено')
    } catch {
      toast.error('Ошибка сохранения')
    }
  }

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(ticket.id)
      toast.success('Обращение удалено')
      onDeleted()
    } catch {
      toast.error('Ошибка удаления')
    }
  }

  return (
    <>
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Заголовок карточки */}
        <button
          className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors"
          onClick={() => setExpanded(v => !v)}
        >
          <div className="flex-1 min-w-0">
            {/* Тип + статус */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant={TYPE_COLORS[ticket.type]} className="text-xs">
                {TYPE_LABELS[ticket.type]}
              </Badge>
              <StatusBadge status={ticket.status} />
            </div>
            {/* Заголовок */}
            <p className="font-medium text-sm leading-snug">{ticket.title}</p>
            {/* Мастер + дата */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                {masterDisplay}
                {ticket.master_profession && (
                  <span className="text-muted-foreground/60">· {ticket.master_profession}</span>
                )}
              </span>
              {siblingCount > 0 && (
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  +{siblingCount} обращ.
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {dayjs(ticket.created_at).format('D MMM YYYY, HH:mm')}
              </span>
            </div>
          </div>
          <div className="text-muted-foreground mt-1 shrink-0">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {/* Развёрнутое содержимое */}
        {expanded && (
          <div className="px-4 pb-4 border-t pt-3 space-y-4">
            {/* Текст обращения */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Сообщение</p>
              <p className="text-sm whitespace-pre-wrap">{ticket.message}</p>
            </div>

            {/* Статус */}
            <div className="flex items-center gap-3">
              <p className="text-xs font-semibold text-muted-foreground w-16 shrink-0">Статус</p>
              <Select value={status} onValueChange={v => setStatus(v as TicketStatus)}>
                <SelectTrigger className="h-8 text-sm w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Новое</SelectItem>
                  <SelectItem value="in_progress">В работе</SelectItem>
                  <SelectItem value="resolved">Решено</SelectItem>
                  <SelectItem value="closed">Закрыто</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ответ */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Ответ</p>
              <Textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder="Напишите ответ мастеру..."
                rows={3}
                className="resize-none text-sm"
              />
            </div>

            {/* Кнопки */}
            <div className="flex items-center justify-between gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                onClick={() => setConfirmDel(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Удалить
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={update.isPending}
                className="gap-1.5"
              >
                {update.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Send className="h-3.5 w-3.5" />}
                Сохранить
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={handleDelete}
        title="Удалить обращение?"
        description="Это действие нельзя отменить."
        confirmLabel="Удалить"
        loading={remove.isPending}
      />
    </>
  )
}

// ── История по мастеру ────────────────────────────────────────────────────────

function MasterHistoryGroup({
  masterId,
  masterDisplay,
  tickets,
}: {
  masterId: string
  masterDisplay: string
  tickets: SupportTicketWithMaster[]
}) {
  const [open, setOpen] = useState(false)
  const newCount = tickets.filter(t => t.status === 'new').length

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-medium truncate">{masterDisplay}</p>
            <p className="text-xs text-muted-foreground">{tickets.length} обращений</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {newCount > 0 && (
            <span className="h-5 min-w-5 px-1.5 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">
              {newCount}
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="border-t divide-y">
          {tickets.map(ticket => (
            <div key={ticket.id} className="px-3 py-2">
              <TicketCard
                ticket={ticket}
                siblingCount={0}
                onDeleted={() => {}}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Главный компонент ─────────────────────────────────────────────────────────

export function AdminSupportTab() {
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all')
  const [viewMode, setViewMode]         = useState<'list' | 'by_master'>('list')
  const [search, setSearch]             = useState('')

  const { data: tickets = [], isLoading, refetch } = useAdminSupportTickets(statusFilter)

  // Подсчёт по статусам
  const { data: allTickets = [] } = useAdminSupportTickets('all')
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: allTickets.length }
    allTickets.forEach(t => { c[t.status] = (c[t.status] ?? 0) + 1 })
    return c
  }, [allTickets])

  // Поиск
  const filtered = useMemo(() => {
    if (!search.trim()) return tickets
    const q = search.toLowerCase()
    return tickets.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.message.toLowerCase().includes(q) ||
      (t.master_name ?? '').toLowerCase().includes(q) ||
      (t.master_email ?? '').toLowerCase().includes(q)
    )
  }, [tickets, search])

  // Группировка по мастеру
  const byMaster = useMemo(() => {
    const map = new Map<string, { display: string; tickets: SupportTicketWithMaster[] }>()
    filtered.forEach(t => {
      const key = t.master_id
      if (!map.has(key)) {
        map.set(key, {
          display: t.master_name || t.master_email || t.master_id,
          tickets: [],
        })
      }
      map.get(key)!.tickets.push(t)
    })
    // Сортируем: сначала мастера с новыми тикетами
    return [...map.entries()].sort(([, a], [, b]) => {
      const aN = a.tickets.filter(t => t.status === 'new').length
      const bN = b.tickets.filter(t => t.status === 'new').length
      return bN - aN
    })
  }, [filtered])

  // sibling counts для режима list (кол-во других тикетов от того же мастера)
  const siblingCounts = useMemo(() => {
    const map = new Map<string, number>()
    filtered.forEach(t => {
      const cur = map.get(t.master_id) ?? 0
      map.set(t.master_id, cur + 1)
    })
    return map
  }, [filtered])

  return (
    <div className="space-y-5">
      {/* Заголовок */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10 text-primary">
          <LifeBuoy className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Поддержка</h2>
          <p className="text-sm text-muted-foreground">Обращения мастеров</p>
        </div>
        <Button
          size="sm" variant="ghost"
          className="ml-auto gap-1.5 text-muted-foreground"
          onClick={() => refetch()}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Обновить
        </Button>
      </div>

      {/* Фильтры статусов */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setStatusFilter(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              statusFilter === id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {label}
            {counts[id] !== undefined && counts[id] > 0 && (
              <span className={cn(
                'h-4.5 min-w-4.5 px-1 rounded-full text-[10px] font-bold',
                statusFilter === id
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : id === 'new' ? 'bg-blue-500 text-white' : 'bg-muted-foreground/20'
              )}>
                {counts[id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Поиск + режим просмотра */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Поиск по теме или мастеру..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex rounded-lg border overflow-hidden shrink-0">
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'px-3 text-xs font-medium transition-colors',
              viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            Список
          </button>
          <button
            onClick={() => setViewMode('by_master')}
            className={cn(
              'px-3 text-xs font-medium transition-colors border-l',
              viewMode === 'by_master' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            По мастеру
          </button>
        </div>
      </div>

      {/* Контент */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl border bg-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <LifeBuoy className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground text-sm">Обращений нет</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {filtered.map(ticket => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              siblingCount={(siblingCounts.get(ticket.master_id) ?? 1) - 1}
              onDeleted={() => {}}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {byMaster.map(([masterId, { display, tickets: mTickets }]) => (
            <MasterHistoryGroup
              key={masterId}
              masterId={masterId}
              masterDisplay={display}
              tickets={mTickets}
            />
          ))}
        </div>
      )}
    </div>
  )
}
