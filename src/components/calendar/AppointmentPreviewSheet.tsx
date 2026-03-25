import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, UserCircle, Banknote, Trash2, Pencil, MessageSquare, CheckCircle2, Clock, X } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { useProfileIcon } from '@/hooks/useProfileIcon'
import { toast } from '@/components/shared/Toaster'
import { getAppointmentServiceNames, cleanAppointmentNotes, useConfirmAppointment } from '@/hooks/useAppointments'
import type { Appointment, Service } from '@/types'

dayjs.locale('ru')

type ApptStatus = 'scheduled' | 'done' | 'cancelled' | 'no_show'

const STATUS_ACTIVE: Record<ApptStatus, string> = {
  scheduled: 'bg-blue-500 text-white',
  done:      'bg-emerald-500 text-white',
  cancelled: 'bg-red-500 text-white',
  no_show:   'bg-amber-500 text-white',
}

const STATUS_INACTIVE: Record<ApptStatus, string> = {
  scheduled: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
  done:      'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
  cancelled: 'bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400',
  no_show:   'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
}

const STATUS_DOT: Record<ApptStatus, string> = {
  scheduled: 'bg-blue-500',
  done:      'bg-emerald-500',
  cancelled: 'bg-red-500',
  no_show:   'bg-amber-500',
}

const STATUSES: ApptStatus[] = ['scheduled', 'done', 'cancelled', 'no_show']

interface AppointmentPreviewSheetProps {
  appt: Appointment | null
  open: boolean
  onClose: () => void
  onEditStep: (step: 0 | 1 | 2) => void
  onDelete: () => void
  onStatusChange: (status: ApptStatus) => void
  services?: Service[]
}

export function AppointmentPreviewSheet({
  appt,
  open,
  onClose,
  onEditStep,
  onDelete,
  onStatusChange,
  services = [],
}: AppointmentPreviewSheetProps) {
  const { t, i18n } = useTranslation()
  const currency = useCurrency()
  const ServiceIcon = useProfileIcon()
  const [statusLoading, setStatusLoading] = useState<ApptStatus | null>(null)
  const confirm = useConfirmAppointment()

  // ── Свайп вниз для закрытия ─────────────────────────────────────────────
  const touchStartY = useRef<number | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return
    const delta = e.changedTouches[0].clientY - touchStartY.current
    if (delta > 60) onClose()
    touchStartY.current = null
  }

  if (!appt) return null

  const clientName = appt.expand?.client
    ? `${appt.expand.client.first_name} ${appt.expand.client.last_name || ''}`.trim()
    : appt.client_name || t('appointments.guestClient')

  const serviceName = getAppointmentServiceNames(appt, services) || '—'
  const cleanNotes = cleanAppointmentNotes(appt.notes)

  const dateStr = dayjs(appt.date).format('dd, D MMMM')
  const timeStr = `${appt.start_time.slice(0, 5)}${appt.end_time ? ` – ${appt.end_time.slice(0, 5)}` : ''}`

  const currentStatus = appt.status as ApptStatus

  const handleStatusChange = async (s: ApptStatus) => {
    if (s === currentStatus) return
    setStatusLoading(s)
    await onStatusChange(s)
    setStatusLoading(null)
    toast.success(t('appointments.updated'))
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        hideClose
        className={cn(
          'fixed bottom-0 left-0 right-0 top-auto max-h-[85vh]',
          '!translate-x-0 !translate-y-0 !left-0 !right-0 !top-auto !bottom-0',
          'w-full max-w-none rounded-t-2xl rounded-b-none',
          'p-0 gap-0 border-x-0 border-b-0',
          'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
          'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          '!data-[state=open]:slide-in-from-left-1/2 !data-[state=open]:slide-in-from-top-[48%]',
          'lg:hidden',
        )}
      >
        <VisuallyHidden><DialogTitle>Запись</DialogTitle></VisuallyHidden>
        {/* Drag handle + кнопки */}
        <div
          className="relative flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          ref={sheetRef}
        >
          <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
          <button
            type="button"
            onClick={onClose}
            className="absolute left-3 top-1.5 p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="absolute right-3 top-1.5 p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 pb-6 overflow-y-auto">

          {/* Дата и время */}
          <button
            type="button"
            onClick={() => onEditStep(1)}
            className="w-full flex items-center gap-3 py-3 border-b border-border/50 text-left active:bg-muted/40 rounded-lg -mx-1 px-1 transition-colors"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted shrink-0">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium leading-tight">
                {t('appointments.date')} · {t('appointments.time')}
              </p>
              <p className="text-sm font-semibold capitalize">{dateStr} · {timeStr}</p>
            </div>
          </button>

          {/* Услуга */}
          <button
            type="button"
            onClick={() => onEditStep(0)}
            className="w-full flex items-center gap-3 py-3 border-b border-border/50 text-left active:bg-muted/40 rounded-lg -mx-1 px-1 transition-colors"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted shrink-0">
              <ServiceIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium leading-tight">
                {t('appointments.service')}
              </p>
              <p className="text-sm font-semibold truncate">{serviceName}</p>
            </div>
          </button>

          {/* Клиент */}
          <button
            type="button"
            onClick={() => onEditStep(2)}
            className="w-full flex items-center gap-3 py-3 border-b border-border/50 text-left active:bg-muted/40 rounded-lg -mx-1 px-1 transition-colors"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted shrink-0">
              <UserCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium leading-tight">
                {t('appointments.client')}
              </p>
              <p className="text-sm font-semibold truncate">{clientName}</p>
            </div>
          </button>

          {/* Цена */}
          {appt.price != null && appt.price > 0 && (
            <div className="flex items-center gap-3 py-3 border-b border-border/50">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted shrink-0">
                <Banknote className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium leading-tight">
                  {t('appointments.price')}
                </p>
                <p className="text-sm font-semibold">{formatCurrency(appt.price, currency, i18n.language)}</p>
              </div>
            </div>
          )}

          {/* Заметки */}
          {cleanNotes.length > 0 && (
            <button
              type="button"
              onClick={() => onEditStep(2)}
              className="w-full flex items-center gap-3 py-3 border-b border-border/50 text-left active:bg-muted/40 rounded-lg -mx-1 px-1 transition-colors"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted shrink-0">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium leading-tight">
                  {t('appointments.notes')}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-2">{cleanNotes}</p>
              </div>
            </button>
          )}

          {/* Баннер: ожидает подтверждения */}
          {appt.booked_via === 'online' && !appt.confirmed_at && appt.status === 'scheduled' && (
            <div className="mt-3 p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Ожидает подтверждения</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Онлайн-запись от клиента</p>
              </div>
              <Button
                size="sm"
                className="shrink-0 h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                onClick={async () => {
                  await confirm.mutateAsync(appt.id)
                  toast.success('Запись подтверждена')
                }}
                disabled={confirm.isPending}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Подтвердить
              </Button>
            </div>
          )}

          {/* Статус */}
          <div className="pt-3 pb-1">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-2">
              {t('appointments.statusLabel')}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {STATUSES.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatusChange(s)}
                  disabled={!!statusLoading}
                  className={cn(
                    'h-9 px-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5',
                    'disabled:opacity-60',
                    currentStatus === s ? STATUS_ACTIVE[s] : STATUS_INACTIVE[s]
                  )}
                >
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    currentStatus === s ? 'bg-white' : STATUS_DOT[s]
                  )} />
                  {t(`appointments.status.${s}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Кнопки действий */}
          <div className="mt-4">
            <Button
              size="sm"
              className="w-full"
              onClick={() => onEditStep(0)}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              {t('common.edit')}
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
