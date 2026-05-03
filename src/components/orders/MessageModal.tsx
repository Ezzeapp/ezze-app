import { useState, useMemo, useEffect } from 'react'
import {
  Send, X, Users, User, Search, Check, Loader2, ChevronRight,
  CheckCircle, AlertTriangle, Truck, Gift, Star, Plus, Edit3, History,
  Zap, MessageSquare,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import { toast } from '@/components/shared/Toaster'
import { cn, formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { useTeamScope } from '@/contexts/TeamContext'
import { QUICK_TEMPLATES, VARIABLES, COLOR_CLASSES, substituteVars } from '@/lib/messageTemplates'
import type { LucideIcon } from 'lucide-react'

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  CheckCircle, AlertTriangle, Truck, Gift, Star,
}

interface RecipientOrder {
  id: string
  number: string
  status: string
  total_amount: number
  paid_amount: number
  ready_date: string | null
  visit_address: string | null
  client: { id: string; first_name: string; last_name: string | null; tg_chat_id: string | null; phone: string | null } | null
}

interface MessageModalProps {
  /** Если задан — открывается в Compact для этого заказа. */
  orderId?: string
  /** Если открыта без orderId — Expanded с пустым выбором. */
  initialMode?: 'compact' | 'expanded'
  onClose: () => void
}

type Mode = 'compact' | 'expanded'
type Tab = 'quick' | 'write' | 'history'

export function MessageModal({ orderId, initialMode, onClose }: MessageModalProps) {
  const [mode, setMode] = useState<Mode>(initialMode ?? (orderId ? 'compact' : 'expanded'))
  const [tab, setTab] = useState<Tab>('quick')
  const [text, setText] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(orderId ? new Set([orderId]) : new Set())
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'ready' | 'overdue' | 'unpaid'>('all')
  const [sending, setSending] = useState(false)
  const [orders, setOrders] = useState<RecipientOrder[]>([])
  const [history, setHistory] = useState<Array<{ created_at: string; text: string }>>([])
  const symbol = useCurrencySymbol()
  const teamScope = useTeamScope()

  // ── Загрузка списка заказов (для expanded) ──
  useEffect(() => {
    let cancelled = false
    async function load() {
      // Team scoping: иначе worker видит заказы соратников и может разослать
      // массовое сообщение клиентам, к которым доступа не имеет.
      let q = supabase
        .from('cleaning_orders')
        .select('id, number, status, total_amount, paid_amount, ready_date, visit_address, client:clients(id, first_name, last_name, tg_chat_id, phone)')
        .eq('product', PRODUCT)
        .not('status', 'in', '("cancelled","paid")')
        .order('created_at', { ascending: false })
        .limit(200)
      if (teamScope.effectiveTeamId) {
        q = q.or(`team_id.eq.${teamScope.effectiveTeamId},team_id.is.null`)
      }
      const { data } = await q
      if (!cancelled) setOrders((data ?? []) as unknown as RecipientOrder[])
    }
    load()
    return () => { cancelled = true }
  }, [teamScope.effectiveTeamId])

  // ── Загрузка истории сообщений (для compact) ──
  useEffect(() => {
    if (mode !== 'compact' || !orderId || tab !== 'history') return
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('cleaning_order_history')
        .select('created_at, note')
        .eq('order_id', orderId)
        .not('note', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20)
      if (!cancelled) {
        setHistory((data ?? []).map(r => ({ created_at: r.created_at, text: r.note || '' })))
      }
    }
    load()
    return () => { cancelled = true }
  }, [mode, orderId, tab])

  const currentOrder = useMemo(() => orders.find(o => o.id === orderId) || null, [orders, orderId])
  const clientName = currentOrder?.client
    ? [currentOrder.client.first_name, currentOrder.client.last_name].filter(Boolean).join(' ')
    : null

  // ── Фильтрация для expanded ──
  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter(o => {
      if (filter === 'ready' && o.status !== 'ready') return false
      if (filter === 'overdue' && o.status !== 'in_progress') return false
      if (filter === 'unpaid' && o.paid_amount >= o.total_amount) return false
      if (!q) return true
      const name = o.client ? `${o.client.first_name} ${o.client.last_name || ''}`.toLowerCase() : ''
      return o.number.toLowerCase().includes(q) || name.includes(q) || (o.client?.phone || '').includes(q)
    })
  }, [orders, filter, search])

  const filterCounts = useMemo(() => ({
    all: orders.length,
    ready: orders.filter(o => o.status === 'ready').length,
    overdue: orders.filter(o => o.status === 'in_progress').length,
    unpaid: orders.filter(o => o.paid_amount < o.total_amount).length,
  }), [orders])

  const selectedOrders = useMemo(
    () => orders.filter(o => selectedIds.has(o.id)),
    [orders, selectedIds]
  )
  const selectedWithTg = selectedOrders.filter(o => o.client?.tg_chat_id).length

  // ── Превью ──
  const previewOrder = mode === 'compact' ? currentOrder : selectedOrders[0]
  const previewText = useMemo(() => {
    if (!previewOrder || !text) return ''
    return substituteVars(text, {
      'имя':     previewOrder.client ? [previewOrder.client.first_name, previewOrder.client.last_name].filter(Boolean).join(' ') : 'клиент',
      'номер':   previewOrder.number,
      'сумма':   previewOrder.total_amount.toLocaleString('ru'),
      'остаток': Math.max(0, previewOrder.total_amount - previewOrder.paid_amount).toLocaleString('ru'),
      'адрес':   previewOrder.visit_address || '',
      'дата':    previewOrder.ready_date ? previewOrder.ready_date.split('-').reverse().join('.') : '',
    })
  }, [previewOrder, text])

  // ── Действия ──
  function insertVar(v: string) {
    setText(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + v)
  }

  async function sendMessage(messageText: string, orderIds: string[]) {
    if (orderIds.length === 0) {
      toast.error('Не выбраны получатели')
      return
    }
    if (!messageText.trim()) {
      toast.error('Пустое сообщение')
      return
    }
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('cleaning-send-message', {
        body: { order_ids: orderIds, text: messageText },
      })
      if (error) throw error
      const results = (data?.results ?? []) as Array<{ sent: boolean; reason?: string }>
      const ok = results.filter(r => r.sent).length
      const fail = results.length - ok
      if (ok > 0 && fail === 0) toast.success(`Отправлено: ${ok}`)
      else if (ok > 0 && fail > 0) toast.success(`Отправлено: ${ok}, не удалось: ${fail}`)
      else toast.error(`Не удалось отправить (${results[0]?.reason || 'ошибка'})`)
      if (ok > 0) onClose()
    } catch (err) {
      toast.error('Ошибка отправки: ' + String(err).slice(0, 80))
    } finally {
      setSending(false)
    }
  }

  function sendQuickTemplate(tpl: typeof QUICK_TEMPLATES[number]) {
    if (!orderId) return
    sendMessage(tpl.text, [orderId])
  }

  function switchToExpanded() {
    setMode('expanded')
    if (tab === 'history') setTab('quick')
    // При первом переключении подгружаем фильтр «готов»
    if (selectedIds.size === 1 && orderId) setFilter('ready')
  }

  function switchToCompact() {
    if (!orderId) return
    setMode('compact')
    setSelectedIds(new Set([orderId]))
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={cn(
          'bg-background rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]',
          mode === 'compact' ? 'w-full max-w-2xl' : 'w-full max-w-5xl'
        )}
        style={{ transition: 'max-width 0.3s cubic-bezier(.4,0,.2,1)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-5 pt-4 pb-0 border-b shrink-0">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
                <Send className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="font-bold truncate">
                  {mode === 'compact' ? 'Сообщение клиенту' : 'Массовая рассылка'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {mode === 'compact' && currentOrder
                    ? `${clientName || 'Без клиента'} · ${currentOrder.number}`
                    : 'Выбери получателей и шаблон'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {mode === 'compact' && orderId && (
                <button
                  onClick={switchToExpanded}
                  className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1.5 px-2 h-7 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40"
                >
                  <Users className="h-3.5 w-3.5" /> Сделать массовой
                </button>
              )}
              {mode === 'expanded' && orderId && (
                <button
                  onClick={switchToCompact}
                  className="text-xs text-muted-foreground font-semibold hover:underline flex items-center gap-1.5 px-2 h-7 rounded hover:bg-muted"
                >
                  <User className="h-3.5 w-3.5" /> К одному клиенту
                </button>
              )}
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-4 -mb-px">
            <button
              onClick={() => setTab('quick')}
              className={cn(
                'pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors',
                tab === 'quick'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Zap className="h-3.5 w-3.5" /> Быстрые
            </button>
            <button
              onClick={() => setTab('write')}
              className={cn(
                'pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors',
                tab === 'write'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Edit3 className="h-3.5 w-3.5" /> Своё сообщение
            </button>
            {mode === 'compact' && orderId && (
              <button
                onClick={() => setTab('history')}
                className={cn(
                  'pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors',
                  tab === 'history'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
                title="Заметки к смене статуса заказа — не лог отправленных сообщений"
              >
                <History className="h-3.5 w-3.5" /> История заказа
              </button>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {mode === 'compact' && tab === 'quick' && (
            <div className="p-5 space-y-2 overflow-y-auto">
              <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2 tracking-wider">
                Один клик — сообщение уйдёт
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUICK_TEMPLATES.map(tpl => {
                  const Icon = TEMPLATE_ICONS[tpl.iconName] || Star
                  const c = COLOR_CLASSES[tpl.color]
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => sendQuickTemplate(tpl)}
                      disabled={sending}
                      className={cn(
                        'p-3 border-2 rounded-xl text-left transition disabled:opacity-50',
                        c.border, c.hoverBorder, c.hoverBg
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn('h-8 w-8 rounded-full flex items-center justify-center', c.iconBg, c.iconText)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="font-semibold text-sm">{tpl.label}</div>
                      </div>
                      <div className="text-[11px] text-muted-foreground line-clamp-2">«{tpl.text}»</div>
                    </button>
                  )
                })}
                <button
                  onClick={() => setTab('write')}
                  className="p-3 border-2 border-dashed border-border rounded-xl text-center text-muted-foreground hover:text-primary hover:border-primary flex flex-col items-center justify-center gap-1 transition"
                >
                  <Plus className="h-5 w-5" />
                  <div className="text-xs font-semibold">Свой текст</div>
                </button>
              </div>
            </div>
          )}

          {mode === 'compact' && tab === 'write' && (
            <div className="p-5 space-y-3 overflow-y-auto">
              <WriteEditor text={text} onTextChange={setText} onInsertVar={insertVar} />
              {previewText && (
                <PreviewBox text={previewText} title={`Превью для «${clientName || 'клиента'}»`} />
              )}
            </div>
          )}

          {mode === 'compact' && tab === 'history' && (
            <div className="p-5 space-y-2 overflow-y-auto">
              <p className="text-[11px] text-muted-foreground italic">
                Заметки оператора при смене статуса заказа. Лог отправленных
                клиенту сообщений пока не ведётся.
              </p>
              {history.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  Заметок к этому заказу пока нет
                </div>
              ) : history.map((h, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-foreground">Заметка</span>
                    <span className="text-muted-foreground">
                      {new Date(h.created_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{h.text}</div>
                </div>
              ))}
            </div>
          )}

          {mode === 'expanded' && (
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-0 overflow-hidden flex-1">
              {/* LEFT: получатели */}
              <div className="border-r p-4 space-y-3 overflow-y-auto">
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5">Кому</div>
                  <div className="flex flex-wrap gap-1">
                    {([
                      { v: 'all',     label: 'Все',         count: filterCounts.all },
                      { v: 'ready',   label: 'Готов',       count: filterCounts.ready },
                      { v: 'overdue', label: 'В работе',    count: filterCounts.overdue },
                      { v: 'unpaid',  label: 'Не оплачено', count: filterCounts.unpaid },
                    ] as const).map(f => (
                      <button
                        key={f.v}
                        onClick={() => setFilter(f.v)}
                        className={cn(
                          'h-7 px-2.5 rounded-full text-[11px] font-semibold transition-colors flex items-center gap-1',
                          filter === f.v
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background border text-muted-foreground hover:border-primary/40'
                        )}
                      >
                        {f.label} ({f.count})
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Поиск..."
                    className="w-full h-8 pl-8 pr-2 rounded-md border text-xs bg-background"
                  />
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <button
                    onClick={() => {
                      const all = filteredOrders.filter(o => o.client?.tg_chat_id).map(o => o.id)
                      setSelectedIds(new Set(all))
                    }}
                    className="text-primary hover:underline font-semibold"
                  >
                    Выбрать всех с TG ({filteredOrders.filter(o => o.client?.tg_chat_id).length})
                  </button>
                  {selectedIds.size > 0 && (
                    <button onClick={() => setSelectedIds(new Set())} className="text-muted-foreground hover:text-destructive">
                      Снять
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {filteredOrders.map(o => {
                    const hasTg = !!o.client?.tg_chat_id
                    const isSelected = selectedIds.has(o.id)
                    const cName = o.client ? [o.client.first_name, o.client.last_name].filter(Boolean).join(' ') : 'Без клиента'
                    return (
                      <label
                        key={o.id}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded-md cursor-pointer transition',
                          hasTg ? 'hover:bg-muted/50' : 'opacity-50 cursor-not-allowed',
                          isSelected && 'bg-primary/10'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!hasTg}
                          onChange={e => {
                            setSelectedIds(prev => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(o.id)
                              else next.delete(o.id)
                              return next
                            })
                          }}
                          className="h-3.5 w-3.5 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-xs truncate">{cName}</div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {o.number} · {o.client?.phone || 'нет тел.'}
                          </div>
                        </div>
                        {hasTg ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-bold">TG</span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold">—</span>
                        )}
                      </label>
                    )
                  })}
                  {filteredOrders.length === 0 && (
                    <div className="text-xs text-center text-muted-foreground py-4">Нет заказов</div>
                  )}
                </div>
                <div className="border-t pt-3 text-[11px] text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Выбрано:</span>
                    <span className="font-bold text-primary">{selectedIds.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>· Telegram:</span>
                    <span className="text-emerald-700 font-bold">{selectedWithTg}</span>
                  </div>
                </div>
              </div>

              {/* RIGHT: сообщение */}
              <div className="p-4 space-y-3 flex flex-col overflow-y-auto">
                {tab === 'quick' ? (
                  <div className="space-y-2">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2 tracking-wider">
                      Шаблон (автоподстановка по каждому получателю)
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {QUICK_TEMPLATES.map(tpl => {
                        const Icon = TEMPLATE_ICONS[tpl.iconName] || Star
                        const c = COLOR_CLASSES[tpl.color]
                        return (
                          <button
                            key={tpl.id}
                            onClick={() => setText(tpl.text)}
                            className={cn(
                              'p-3 border-2 rounded-xl text-left transition',
                              text === tpl.text ? `${c.border.replace('-200', '-500')} bg-primary/5` : `${c.border} ${c.hoverBorder}`
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div className={cn('h-7 w-7 rounded-full flex items-center justify-center', c.iconBg, c.iconText)}>
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <div className="font-semibold text-xs">{tpl.label}</div>
                            </div>
                            <div className="text-[10px] text-muted-foreground line-clamp-2">{tpl.text}</div>
                          </button>
                        )
                      })}
                    </div>
                    {text && (
                      <>
                        <WriteEditor text={text} onTextChange={setText} onInsertVar={insertVar} compact />
                        {previewText && previewOrder && (
                          <PreviewBox text={previewText} title={`Превью для «${(previewOrder.client ? [previewOrder.client.first_name, previewOrder.client.last_name].filter(Boolean).join(' ') : 'клиент')}»`} />
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <WriteEditor text={text} onTextChange={setText} onInsertVar={insertVar} />
                    {previewText && previewOrder && (
                      <PreviewBox text={previewText} title={`Превью для «${(previewOrder.client ? [previewOrder.client.first_name, previewOrder.client.last_name].filter(Boolean).join(' ') : 'клиент')}»`} />
                    )}
                    {!previewText && (
                      <div className="text-xs text-muted-foreground italic text-center py-8">
                        Выбери шаблон или начни печатать. Превью появится здесь.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t flex items-center justify-between bg-muted/30 shrink-0 gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Telegram</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 h-9 rounded-lg border text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              Отмена
            </button>
            {mode === 'compact' ? (
              tab === 'write' ? (
                <button
                  onClick={() => sendMessage(text, orderId ? [orderId] : [])}
                  disabled={sending || !text.trim()}
                  className="px-4 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Отправить
                </button>
              ) : tab === 'quick' ? (
                <span className="text-xs text-muted-foreground italic">Кликни шаблон</span>
              ) : null
            ) : (
              <button
                onClick={() => sendMessage(text, Array.from(selectedIds))}
                disabled={sending || selectedIds.size === 0 || !text.trim()}
                className="px-5 h-10 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Отправить {selectedIds.size > 0 ? selectedIds.size : ''} {selectedIds.size > 0 ? 'сообщений' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Editor ────────────────────────────────────────────────────────────────────
function WriteEditor({
  text, onTextChange, onInsertVar, compact = false,
}: {
  text: string
  onTextChange: (v: string) => void
  onInsertVar: (v: string) => void
  compact?: boolean
}) {
  return (
    <div>
      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 flex items-center justify-between tracking-wider">
        <span>Текст</span>
        <div className="flex gap-1.5 flex-wrap">
          {VARIABLES.map(v => (
            <button
              key={v.key}
              type="button"
              onClick={() => onInsertVar(v.key)}
              className="text-[10px] text-primary hover:underline font-mono"
              title={v.desc}
            >
              {v.key}
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={text}
        onChange={e => onTextChange(e.target.value)}
        rows={compact ? 4 : 6}
        placeholder="Введите текст или нажмите переменную выше..."
        className="w-full p-3 border rounded-lg text-sm resize-none bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
        <span>{text.length} символов</span>
        <span>Telegram</span>
      </div>
    </div>
  )
}

// ── Preview ───────────────────────────────────────────────────────────────────
function PreviewBox({ text, title }: { text: string; title: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2 tracking-wider">{title}</div>
      <div className="bg-background rounded-2xl p-3 shadow-sm border max-w-sm ml-auto">
        <div className="text-sm whitespace-pre-wrap">{text}</div>
        <div className="text-[10px] text-muted-foreground text-right mt-1">
          {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
