import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, XCircle, AlertTriangle, Wrench, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { formatCurrency, cn } from '@/lib/utils'
import dayjs from 'dayjs'

interface ApproveOrder {
  id: string
  number: string
  status: string
  client_approved: boolean
  item_type_name: string
  brand: string | null
  model: string | null
  defect_description: string | null
  diagnostic_notes: string | null
  estimated_cost: number | null
  diagnostic_price: number
  ready_date: string | null
  warranty_days: number
}

export function WorkshopApprovePage() {
  const { token } = useParams<{ token: string }>()
  const [order, setOrder] = useState<ApproveOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null)

  useEffect(() => {
    if (!token) return
    ;(async () => {
      const { data, error } = await supabase
        .from('workshop_orders')
        .select('id, number, status, client_approved, item_type_name, brand, model, defect_description, diagnostic_notes, estimated_cost, diagnostic_price, ready_date, warranty_days')
        .eq('approval_token', token)
        .maybeSingle()

      if (error || !data) {
        setNotFound(true)
      } else {
        setOrder(data as ApproveOrder)
        if (data.client_approved) setDone('approved')
      }
      setLoading(false)
    })()
  }, [token])

  async function submit() {
    if (!decision || !token) return
    setSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('workshop-approve-decision', {
        body: { token, action: decision },
      })
      if (error || !data?.ok) throw new Error((data as any)?.error || error?.message || 'Ошибка')
      setDone(decision === 'approve' ? 'approved' : 'rejected')
    } catch (e: any) {
      alert(e.message ?? 'Ошибка')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Ссылка недействительна</h1>
          <p className="text-sm text-muted-foreground">Возможно, она уже использована или истёк срок действия.</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border bg-card p-6 text-center">
          {done === 'approved' ? (
            <>
              <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h1 className="text-xl font-semibold mb-2">Смета утверждена</h1>
              <p className="text-sm text-muted-foreground">Мы приступаем к ремонту. Мастер свяжется, когда устройство будет готово.</p>
            </>
          ) : (
            <>
              <XCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
              <h1 className="text-xl font-semibold mb-2">Вы отказались от ремонта</h1>
              <p className="text-sm text-muted-foreground">Мастер свяжется, чтобы договориться о выдаче устройства.</p>
            </>
          )}
        </div>
      </div>
    )
  }

  const device = [order.item_type_name, order.brand, order.model].filter(Boolean).join(' ')
  const total = order.estimated_cost ?? 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 sm:p-8">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Wrench className="h-4 w-4" /> Согласование стоимости ремонта
          </div>
          <h1 className="text-2xl font-bold">{order.number}</h1>
          <p className="text-muted-foreground mt-1">{device || 'Устройство'}</p>
        </div>

        {order.defect_description && (
          <div className="rounded-2xl border bg-card p-4 mb-4">
            <div className="text-xs text-muted-foreground mb-1">Что сообщили при приёме</div>
            <div className="text-sm">{order.defect_description}</div>
          </div>
        )}

        {order.diagnostic_notes && (
          <div className="rounded-2xl border bg-card p-4 mb-4">
            <div className="text-xs text-muted-foreground mb-1">Результат диагностики</div>
            <div className="text-sm whitespace-pre-wrap">{order.diagnostic_notes}</div>
          </div>
        )}

        <div className="rounded-2xl border bg-card p-6 mb-6">
          <div className="text-sm text-muted-foreground mb-1">Оценка стоимости ремонта</div>
          <div className="text-3xl font-bold">{formatCurrency(total)}</div>
          {order.diagnostic_price > 0 && (
            <div className="text-xs text-muted-foreground mt-2">
              Диагностика в случае отказа — {formatCurrency(order.diagnostic_price)}
            </div>
          )}
          {order.ready_date && (
            <div className="text-xs text-muted-foreground mt-1">
              Плановая дата готовности — {dayjs(order.ready_date).format('DD.MM.YYYY')}
            </div>
          )}
          {order.warranty_days > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              Гарантия на ремонт — {order.warranty_days} дн.
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setDecision('approve')}
            className={cn(
              'w-full rounded-xl border-2 p-4 text-left transition-all',
              decision === 'approve'
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                : 'border-border hover:border-emerald-300 bg-card'
            )}
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className={cn('h-6 w-6', decision === 'approve' ? 'text-emerald-500' : 'text-muted-foreground')} />
              <div>
                <div className="font-semibold">Утвердить смету</div>
                <div className="text-xs text-muted-foreground">Приступить к ремонту за указанную сумму</div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setDecision('reject')}
            className={cn(
              'w-full rounded-xl border-2 p-4 text-left transition-all',
              decision === 'reject'
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                : 'border-border hover:border-amber-300 bg-card'
            )}
          >
            <div className="flex items-center gap-3">
              <XCircle className={cn('h-6 w-6', decision === 'reject' ? 'text-amber-500' : 'text-muted-foreground')} />
              <div>
                <div className="font-semibold">Отказаться от ремонта</div>
                <div className="text-xs text-muted-foreground">
                  {order.diagnostic_price > 0
                    ? `Оплатить только диагностику ${formatCurrency(order.diagnostic_price)} и забрать устройство`
                    : 'Забрать устройство без ремонта'}
                </div>
              </div>
            </div>
          </button>
        </div>

        <Button
          className="w-full mt-6"
          disabled={!decision || submitting}
          onClick={submit}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Подтвердить решение
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Решение окончательное и будет передано мастеру.
        </p>
      </div>
    </div>
  )
}
