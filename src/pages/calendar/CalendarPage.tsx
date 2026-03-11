import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate as useNav } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Trash2, Edit2, Search, ChevronDown, ChevronUp, ChevronsUpDown, Clock, UserCircle, Download } from 'lucide-react'
import { MobileCalendar, type MobileViewMode } from '@/components/calendar/MobileCalendar'
import { AppointmentDialog, type AppointmentFormData } from '@/components/calendar/AppointmentDialog'
import { AppointmentPreviewSheet } from '@/components/calendar/AppointmentPreviewSheet'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { useAppointments, useMonthAppointments, useCreateAppointmentWithServices, useUpdateAppointmentWithServices, useDeleteAppointment, getAppointmentServiceNames, getAppointmentServices, cleanAppointmentNotes } from '@/hooks/useAppointments'
import { useClients } from '@/hooks/useClients'
import { useServices } from '@/hooks/useServices'
import { useProfile } from '@/hooks/useProfile'
import { useSchedule } from '@/hooks/useSchedule'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PageHeader } from '@/components/shared/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { PlanLimitBanner } from '@/components/shared/PlanLimitBanner'
import { usePlanLimitCheck } from '@/hooks/useAppSettings'
import { toast } from '@/components/shared/Toaster'
import { parseTimeToMinutes, minutesToTime, formatCurrency, formatDuration } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { sendTelegramMessage, buildAppointmentMessage } from '@/lib/telegram'
import type { Appointment } from '@/types'

dayjs.extend(isoWeek)

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200',
  done: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200',
  no_show: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-200',
}

const DEFAULT_HOUR_START = 7
const DEFAULT_HOUR_END = 21

type SortField = 'date' | 'client' | 'service' | 'status' | 'price'
type SortDir = 'asc' | 'desc'

const STATUS_BADGE: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
  no_show: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
}

export function CalendarPage() {
  const { t, i18n } = useTranslation()
  const currency = useCurrency()
  const location = useLocation()
  const navTo = useNav()
  const [view, setView] = useState<'week' | 'day' | 'list'>('week')
  const [currentDate, setCurrentDate] = useState(dayjs())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editAppt, setEditAppt] = useState<Appointment | null>(null)
  const [duplicateFrom, setDuplicateFrom] = useState<Appointment | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteIds, setDeleteIds] = useState<string[]>([])
  const [defaultDate, setDefaultDate] = useState('')
  const [defaultTime, setDefaultTime] = useState('')
  const [wizardKey, setWizardKey] = useState(0)
  // Mobile preview sheet
  const [previewAppt, setPreviewAppt] = useState<Appointment | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [initialStep, setInitialStep] = useState<0 | 1 | 2>(0)

  // Mobile view mode: day (default) or week overview
  const [mobileView, setMobileView] = useState<MobileViewMode>('day')

  // List view state
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [listSearch, setListSearch] = useState('')
  const [listStatus, setListStatus] = useState<string>('all')
  const [listDateFrom, setListDateFrom] = useState('')
  const [listDateTo, setListDateTo] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Открыть диалог новой записи при ?new=1 (FAB из BottomNav)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('new') === '1') {
      setEditAppt(null)
      setDuplicateFrom(null)
      setDefaultDate('')
      setDefaultTime('')
      setInitialStep(0)
      setWizardKey(k => k + 1)
      setDialogOpen(true)
      navTo('/calendar', { replace: true })
    }
  }, [location.search, navTo])

  // Drag & drop state
  const dragApptRef = useRef<Appointment | null>(null)
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null) // "YYYY-MM-DD_HH"
  const [isDragging, setIsDragging] = useState(false)

  const weekStart = currentDate.startOf('isoWeek')
  const weekEnd = currentDate.endOf('isoWeek')
  const mobileStart = currentDate.subtract(7, 'day')
  const mobileEnd = currentDate.add(28, 'day')

  // For list view we load all (no date bounds)
  const { data: allAppointments } = useAppointments()

  const { data: appointments } = useAppointments(
    view === 'list' ? undefined
      : (view === 'week' ? weekStart.subtract(1, 'day') : view === 'day' ? currentDate.subtract(1, 'day') : mobileStart).format('YYYY-MM-DD'),
    view === 'list' ? undefined
      : (view === 'week' ? weekEnd.add(1, 'day') : view === 'day' ? currentDate.add(1, 'day') : mobileEnd).format('YYYY-MM-DD')
  )
  // appts_month limit
  const { data: monthAppts } = useMonthAppointments(dayjs().year(), dayjs().month())
  const apptMonthCount = monthAppts?.length ?? 0
  const { isReached: apptLimitReached } = usePlanLimitCheck('appts_month', apptMonthCount)

  const { data: clients = [] } = useClients()
  const { data: services = [] } = useServices()
  const { data: profile } = useProfile()
  const create = useCreateAppointmentWithServices()
  const update = useUpdateAppointmentWithServices()
  const del = useDeleteAppointment()
  const { data: schedule } = useSchedule()

  const DOW_MAP: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' }
  const isDayOff = (day: dayjs.Dayjs): boolean => {
    if (!schedule) return false
    const key = DOW_MAP[day.day()]
    return !(schedule[`${key}_enabled` as keyof typeof schedule] as boolean)
  }

  // Вычисляем диапазон часов из расписания — min(start) по всем рабочим дням, max(end)
  const calendarHours = useMemo(() => {
    const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    if (!schedule) return Array.from({ length: DEFAULT_HOUR_END - DEFAULT_HOUR_START }, (_, i) => i + DEFAULT_HOUR_START)
    let minH = DEFAULT_HOUR_END
    let maxH = DEFAULT_HOUR_START
    for (const key of dayKeys) {
      const enabled = schedule[`${key}_enabled` as keyof typeof schedule] as boolean
      if (!enabled) continue
      const start = schedule[`${key}_start` as keyof typeof schedule] as string
      const end   = schedule[`${key}_end`   as keyof typeof schedule] as string
      const sh = parseInt(start.split(':')[0])
      const eh = parseInt(end.split(':')[0])
      if (sh < minH) minH = sh
      if (eh > maxH) maxH = eh
    }
    // Добавляем 1 час буфера до начала и после конца для удобства
    const from = Math.max(0, minH - 1)
    const to   = Math.min(23, maxH + 1)
    return Array.from({ length: to - from }, (_, i) => i + from)
  }, [schedule])

  const hasTelegram = !!(profile?.tg_bot_token && profile?.tg_chat_id)

  const openCreate = (date = dayjs().format('YYYY-MM-DD'), time = '') => {
    setEditAppt(null)
    setDuplicateFrom(null)
    setDefaultDate(date)
    setDefaultTime(time)
    setWizardKey(k => k + 1)
    setDialogOpen(true)
  }

  const openEdit = (appt: Appointment) => {
    setEditAppt(appt)
    setDuplicateFrom(null)
    setWizardKey(k => k + 1)
    setDialogOpen(true)
  }

  // Мобильный превью-шит
  const openPreview = (appt: Appointment) => {
    setPreviewAppt(appt)
    setPreviewOpen(true)
  }

  const openEditFromPreview = (step: 0 | 1 | 2) => {
    if (!previewAppt) return
    setEditAppt(previewAppt)
    setDuplicateFrom(null)
    setInitialStep(step)
    setWizardKey(k => k + 1)
    setPreviewOpen(false)
    setPreviewAppt(null)
    setDialogOpen(true)
  }

  const deleteFromPreview = () => {
    if (!previewAppt) return
    setDeleteId(previewAppt.id)
    setPreviewOpen(false)
    setPreviewAppt(null)
  }

  const updateStatusFromPreview = async (status: Appointment['status']) => {
    if (!previewAppt) return
    try {
      await update.mutateAsync({ id: previewAppt.id, data: { status }, services: getAppointmentServices(previewAppt, services) })
      setPreviewAppt(prev => prev ? { ...prev, status } : prev)
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const handleDuplicate = () => {
    if (!editAppt) return
    const src = editAppt
    setEditAppt(null)
    setDuplicateFrom(src)
    setDefaultDate(dayjs(src.date).format('YYYY-MM-DD'))
    setDefaultTime('')
    setWizardKey(k => k + 1)
    // dialogOpen остаётся true — диалог перерендерится с новым key
  }


  const sendTgNotification = async (data: AppointmentFormData, svcName: string, isNew: boolean) => {
    if (!profile?.tg_bot_token || !profile?.tg_chat_id) return
    const clientObj = data.client ? clients.find(c => c.id === data.client) : null
    const clientName = clientObj
      ? `${clientObj.first_name} ${clientObj.last_name || ''}`.trim()
      : data.client_name || t('appointments.guestClient')
    const msg = buildAppointmentMessage({
      clientName,
      serviceName: svcName,
      date: data.date,
      time: data.start_time,
      price: data.price,
      notes: data.notes,
      isNew,
    })
    await sendTelegramMessage(profile.tg_bot_token, profile.tg_chat_id, msg)
  }

  const handleDialogSubmit = async (data: AppointmentFormData) => {
    try {
      const svc = data.services[0]
      const { recurring, recurring_weeks, notify_telegram, services: selectedSvcs, ...rest } = data
      const submitData = {
        ...rest,
        client: data.client || '',
      }

      if (editAppt) {
        await update.mutateAsync({ id: editAppt.id, data: submitData, services: selectedSvcs })
        if (notify_telegram) await sendTgNotification(data, svc?.name || '—', false)
        toast.success(t('appointments.updated'))
      } else if (recurring && recurring_weeks > 1) {
        const weeks = Math.min(recurring_weeks, 52)
        const promises = Array.from({ length: weeks }, (_, i) => {
          const date = dayjs(data.date).add(i, 'week').format('YYYY-MM-DD')
          return create.mutateAsync({ data: { ...submitData, date, booked_via: 'manual' } as any, services: selectedSvcs })
        })
        await Promise.all(promises)
        if (notify_telegram) await sendTgNotification(data, svc?.name || '—', true)
        toast.success(t('appointments.recurringCreated', { count: weeks }))
      } else {
        await create.mutateAsync({ data: { ...submitData, booked_via: 'manual' } as any, services: selectedSvcs })
        if (notify_telegram) await sendTgNotification(data, svc?.name || '—', true)
        toast.success(t('appointments.created'))
      }
      setDialogOpen(false)
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'))
  const today = dayjs().format('YYYY-MM-DD')

  // ── List view helpers ────────────────────────────────────────────────────
  const filteredList = useMemo(() => {
    const src = allAppointments ?? []
    return src
      .filter(a => {
        if (listStatus !== 'all' && a.status !== listStatus) return false
        if (listDateFrom && a.date < listDateFrom) return false
        if (listDateTo && a.date > listDateTo) return false
        if (listSearch) {
          const q = listSearch.toLowerCase()
          const clientName = a.expand?.client
            ? `${a.expand.client.first_name} ${a.expand.client.last_name || ''}`.toLowerCase()
            : (a.client_name || '').toLowerCase()
          const svcName = (a.expand?.service?.name || '').toLowerCase()
          if (!clientName.includes(q) && !svcName.includes(q) && !a.date.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => {
        let va = '', vb = ''
        if (sortField === 'date') { va = `${a.date} ${a.start_time}`; vb = `${b.date} ${b.start_time}` }
        else if (sortField === 'client') {
          va = a.expand?.client ? `${a.expand.client.first_name} ${a.expand.client.last_name || ''}` : (a.client_name || '')
          vb = b.expand?.client ? `${b.expand.client.first_name} ${b.expand.client.last_name || ''}` : (b.client_name || '')
        }
        else if (sortField === 'service') { va = a.expand?.service?.name || ''; vb = b.expand?.service?.name || '' }
        else if (sortField === 'status') { va = a.status; vb = b.status }
        else if (sortField === 'price') { return sortDir === 'asc' ? (a.price ?? 0) - (b.price ?? 0) : (b.price ?? 0) - (a.price ?? 0) }
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      })
  }, [allAppointments, listSearch, listStatus, listDateFrom, listDateTo, sortField, sortDir])

  const exportApptsCSV = () => {
    const list = filteredList.length > 0 ? filteredList : (allAppointments ?? [])
    if (list.length === 0) return
    const STATUS_MAP: Record<string, string> = {
      scheduled: t('appointments.status.scheduled'),
      done: t('appointments.status.done'),
      cancelled: t('appointments.status.cancelled'),
      no_show: t('appointments.status.no_show'),
    }
    const headers = ['Дата', 'Время', 'Клиент', 'Услуга', 'Статус', 'Цена', 'Заметки']
    const rows = list.map(a => {
      const clientName = a.expand?.client
        ? `${a.expand.client.first_name} ${a.expand.client.last_name || ''}`.trim()
        : (a.client_name || '')
      const svcName = getAppointmentServiceNames(a, services)
      const cleanNotes = cleanAppointmentNotes(a.notes)
      return [
        a.date,
        a.start_time.slice(0, 5),
        clientName,
        svcName,
        STATUS_MAP[a.status] || a.status,
        a.price != null ? String(a.price) : '',
        cleanNotes.replace(/\n/g, ' '),
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `appointments_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const allSelected = filteredList.length > 0 && filteredList.every(a => selected.has(a.id))
  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(filteredList.map(a => a.id)))
  }
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />
  }

  // Pre-computed slot map: "YYYY-MM-DD_H" → Appointment[] (O(1) lookup vs O(n) filter per slot)
  const apptsBySlot = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    for (const a of (appointments ?? [])) {
      const key = `${a.date}_${parseInt(a.start_time.split(':')[0])}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    return map
  }, [appointments])

  const getApptForSlot = (date: dayjs.Dayjs, hour: number) =>
    apptsBySlot.get(`${date.format('YYYY-MM-DD')}_${hour}`) ?? []

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, appt: Appointment) => {
    dragApptRef.current = appt
    setIsDragging(true)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', appt.id)
  }, [])

  const handleDragEnd = useCallback(() => {
    dragApptRef.current = null
    setDragOverSlot(null)
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, date: dayjs.Dayjs, hour: number, dayOff: boolean, isOutOfHours: boolean) => {
    if (dayOff || isOutOfHours || !dragApptRef.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverSlot(`${date.format('YYYY-MM-DD')}_${hour}`)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverSlot(null)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, date: dayjs.Dayjs, hour: number, dayOff: boolean, isOutOfHours: boolean) => {
    e.preventDefault()
    setDragOverSlot(null)
    setIsDragging(false)
    const appt = dragApptRef.current
    dragApptRef.current = null
    if (!appt || dayOff || isOutOfHours) return

    const newDate = date.format('YYYY-MM-DD')
    const oldStartMin = parseTimeToMinutes(appt.start_time)
    const oldEndMin   = appt.end_time ? parseTimeToMinutes(appt.end_time) : null
    const dur = oldEndMin != null ? oldEndMin - oldStartMin : 0
    const newStartMin = hour * 60
    const newStart = minutesToTime(newStartMin)
    const newEnd   = oldEndMin != null ? minutesToTime(newStartMin + dur) : appt.end_time

    // Не перемещаем если дата/время не изменились
    const sameDate = newDate === dayjs(appt.date).format('YYYY-MM-DD')
    const sameTime = newStart === appt.start_time.slice(0, 5)
    if (sameDate && sameTime) return

    try {
      await update.mutateAsync({ id: appt.id, data: { date: newDate, start_time: newStart, end_time: newEnd ?? undefined }, services: getAppointmentServices(appt, services) })
      toast.success(t('appointments.updated'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }, [update, t])

  // ── Tooltip card для записи ───────────────────────────────────────────────
  const ApptTooltipContent = useCallback(({ appt }: { appt: Appointment }) => {
    const clientName = appt.expand?.client
      ? `${appt.expand.client.first_name} ${appt.expand.client.last_name || ''}`.trim()
      : appt.client_name || t('dashboard.guestClient')

    const serviceNames = getAppointmentServices(appt, services).map(s => s.name)
    if (serviceNames.length === 0) serviceNames.push('—')
    const cleanNotes = cleanAppointmentNotes(appt.notes)

    // Суммарная длительность: из end_time или из одной услуги
    const duration = appt.end_time
      ? (() => {
          const [sh, sm] = appt.start_time.split(':').map(Number)
          const [eh, em] = appt.end_time.split(':').map(Number)
          return (eh * 60 + em) - (sh * 60 + sm)
        })()
      : appt.expand?.service?.duration_min

    const STATUS_LABEL: Record<string, string> = {
      scheduled: t('appointments.status.scheduled'),
      done:      t('appointments.status.done'),
      cancelled: t('appointments.status.cancelled'),
      no_show:   t('appointments.status.no_show'),
    }

    return (
      <div className="space-y-2 min-w-[180px] max-w-[240px]">
        <div className="flex items-center gap-1.5">
          <UserCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-semibold text-sm">{clientName}</span>
        </div>
        <div className="space-y-0.5">
          {serviceNames.map((name, i) => (
            <div key={i} className="text-sm text-muted-foreground">{name}</div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{appt.start_time.slice(0,5)}{appt.end_time ? ` – ${appt.end_time.slice(0,5)}` : ''}</span>
          {duration && <span>· {formatDuration(duration, t)}</span>}
        </div>
        {appt.price != null && appt.price > 0 && (
          <div className="text-sm font-medium">{formatCurrency(appt.price, currency, i18n.language)}</div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[appt.status]}`}>
            {STATUS_LABEL[appt.status] || appt.status}
          </div>
          {appt.booked_via === 'online' && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
              {t('common.online')}
            </div>
          )}
        </div>
        {cleanNotes && (
          <div className="text-xs text-muted-foreground border-t pt-1.5 mt-1 line-clamp-3">{cleanNotes}</div>
        )}
      </div>
    )
  }, [t])

  return (
    <div className="space-y-4">

      <PlanLimitBanner limitKey="appts_month" count={apptMonthCount} />

      {/* ── Мобильный календарь (только < lg) ── */}
      <div className="lg:hidden -mx-4 -mt-4">
        <MobileCalendar
          currentDate={currentDate}
          appointments={appointments}
          schedule={schedule ?? null}
          services={services}
          onDateChange={setCurrentDate}
          onOpenCreate={openCreate}
          onOpenEdit={openPreview}
          mobileView={mobileView}
          onMobileViewChange={setMobileView}
          limitReached={apptLimitReached}
        />
      </div>

      {/* ── Десктопный заголовок + грид (только lg+) ── */}
      <div className="hidden lg:block">
        <PageHeader title={t('nav.calendar')}>
          {view === 'list' && (
            <Button variant="outline" size="icon" onClick={exportApptsCSV} title={t('common.exportCSV')} disabled={!allAppointments?.length}>
              <Download className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={() => openCreate()} disabled={apptLimitReached}>
            <Plus className="h-4 w-4 mr-2" />{t('appointments.add')}
          </Button>
        </PageHeader>

        <div className="flex items-center gap-4">
          <Tabs value={view} onValueChange={(v) => { setView(v as any); setSelected(new Set()) }}>
            <TabsList>
              <TabsTrigger value="week">{t('calendar.week')}</TabsTrigger>
              <TabsTrigger value="day">{t('calendar.day')}</TabsTrigger>
              <TabsTrigger value="list">{t('calendar.list')}</TabsTrigger>
            </TabsList>
          </Tabs>
          {view !== 'list' && (
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(d => d.subtract(1, view === 'week' ? 'week' : 'day'))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[160px] text-center">
                {view === 'week'
                  ? `${weekStart.format('D MMM')} — ${weekEnd.format('D MMM YYYY')}`
                  : currentDate.format('D MMMM YYYY')}
              </span>
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(d => d.add(1, view === 'week' ? 'week' : 'day'))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(dayjs())}>{t('calendar.today')}</Button>
            </div>
          )}
        </div>

        {/* ── List View ── */}
        {view === 'list' && (
          <div className="space-y-3">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={listSearch}
                  onChange={e => setListSearch(e.target.value)}
                  placeholder={t('calendar.listSearch')}
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <select
                value={listStatus}
                onChange={e => setListStatus(e.target.value)}
                className="text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">{t('calendar.allStatuses')}</option>
                <option value="scheduled">{t('appointments.status.scheduled')}</option>
                <option value="done">{t('appointments.status.done')}</option>
                <option value="cancelled">{t('appointments.status.cancelled')}</option>
                <option value="no_show">{t('appointments.status.no_show')}</option>
              </select>
              <input
                type="date"
                value={listDateFrom}
                onChange={e => setListDateFrom(e.target.value)}
                className="text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={t('calendar.dateFrom')}
              />
              <input
                type="date"
                value={listDateTo}
                onChange={e => setListDateTo(e.target.value)}
                className="text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {(listSearch || listStatus !== 'all' || listDateFrom || listDateTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setListSearch(''); setListStatus('all'); setListDateFrom(''); setListDateTo('') }}>
                  {t('common.clearFilter')}
                </Button>
              )}
              <span className="ml-auto text-sm text-muted-foreground">
                {t('calendar.listCount', { count: filteredList.length })}
              </span>
            </div>

            {/* Bulk actions */}
            {selected.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 rounded-lg border border-primary/20">
                <span className="text-sm font-medium">{t('calendar.selectedCount', { count: selected.size })}</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteIds(Array.from(selected))}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t('calendar.deleteSelected')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  {t('common.cancel')}
                </Button>
              </div>
            )}

            {/* Table */}
            <div className="border rounded-xl overflow-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="w-10 p-3 text-left">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="rounded border-gray-300 cursor-pointer"
                      />
                    </th>
                    <th className="p-3 text-left font-medium cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('date')}>
                      <span className="inline-flex items-center">{t('appointments.date')}<SortIcon field="date" /></span>
                    </th>
                    <th className="p-3 text-left font-medium cursor-pointer select-none" onClick={() => toggleSort('client')}>
                      <span className="inline-flex items-center">{t('appointments.client')}<SortIcon field="client" /></span>
                    </th>
                    <th className="p-3 text-left font-medium cursor-pointer select-none" onClick={() => toggleSort('service')}>
                      <span className="inline-flex items-center">{t('appointments.service')}<SortIcon field="service" /></span>
                    </th>
                    <th className="p-3 text-left font-medium cursor-pointer select-none" onClick={() => toggleSort('status')}>
                      <span className="inline-flex items-center">{t('appointments.statusLabel')}<SortIcon field="status" /></span>
                    </th>
                    <th className="p-3 text-right font-medium cursor-pointer select-none" onClick={() => toggleSort('price')}>
                      <span className="inline-flex items-center justify-end">{t('appointments.price')}<SortIcon field="price" /></span>
                    </th>
                    <th className="p-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        {t('calendar.noAppointments')}
                      </td>
                    </tr>
                  )}
                  {filteredList.map(a => {
                    const clientName = a.expand?.client
                      ? `${a.expand.client.first_name} ${a.expand.client.last_name || ''}`.trim()
                      : a.client_name || t('dashboard.guestClient')
                    const svcName = getAppointmentServiceNames(a, services)
                    return (
                      <tr
                        key={a.id}
                        className={`group transition-colors hover:bg-accent/40 ${selected.has(a.id) ? 'bg-primary/5' : ''}`}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selected.has(a.id)}
                            onChange={() => toggleOne(a.id)}
                            className="rounded border-gray-300 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="font-medium">{dayjs(a.date).format('D MMM YYYY')}</div>
                          <div className="text-muted-foreground text-xs">{a.start_time} – {a.end_time}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-medium flex items-center gap-1.5">
                            {clientName}
                            {a.booked_via === 'online' && (
                              <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                            )}
                          </div>
                          {a.client_phone && <div className="text-xs text-muted-foreground">{a.client_phone}</div>}
                        </td>
                        <td className="p-3 max-w-[200px]">
                          <div className="truncate">{svcName}</div>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[a.status]}`}>
                            {t(`appointments.status.${a.status}`)}
                          </span>
                        </td>
                        <td className="p-3 text-right font-medium whitespace-nowrap">
                          {a.price != null ? `${a.price} ₽` : '—'}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(a)}
                              title={t('common.edit')}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(a.id)}
                              title={t('common.delete')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Week/Day Grid */}
        <TooltipProvider delayDuration={400}>
        <div className={`border rounded-xl overflow-auto ${view === 'list' ? 'hidden' : ''}`}>
          <div className="min-w-[600px]">
            <div className={`grid border-b bg-muted/30 ${view === 'week' ? 'grid-cols-[60px_repeat(7,minmax(0,1fr))]' : 'grid-cols-[60px_minmax(0,1fr)]'}`}>
              <div className="p-2" />
              {(view === 'week' ? weekDays : [currentDate]).map((day) => {
                const isToday = day.format('YYYY-MM-DD') === today
                const isWeekend = day.day() === 6 || day.day() === 0
                const dayOff = isDayOff(day)
                return (
                  <div
                    key={day.format()}
                    className={`p-2 text-center text-xs font-medium border-l min-w-0 ${
                      dayOff
                        ? 'bg-muted/60 dark:bg-muted/30'
                        : isWeekend ? 'bg-red-50/60 dark:bg-red-950/20' : ''
                    }`}
                  >
                    <div className={
                      dayOff ? 'text-muted-foreground/50'
                        : isToday ? 'text-primary'
                        : isWeekend ? 'text-red-400 dark:text-red-400'
                        : 'text-muted-foreground'
                    }>
                      {t(`schedule.days.${['sun','mon','tue','wed','thu','fri','sat'][day.day()]}`)}
                    </div>
                    <div className={`text-lg font-semibold ${
                      dayOff ? 'text-muted-foreground/40'
                        : isToday ? 'text-primary'
                        : isWeekend ? 'text-red-500 dark:text-red-400'
                        : ''
                    }`}>
                      {day.format('D')}
                    </div>
                    {dayOff && (
                      <div className="text-[9px] text-muted-foreground/50 mt-0.5">{t('schedule.dayOff')}</div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="relative">
              {calendarHours.map((hour) => (
                <div
                  key={hour}
                  className={`grid border-b min-h-[56px] ${view === 'week' ? 'grid-cols-[60px_repeat(7,minmax(0,1fr))]' : 'grid-cols-[60px_minmax(0,1fr)]'}`}
                >
                  <div className="p-2 text-xs text-muted-foreground text-right pr-3 pt-1">{hour}:00</div>
                  {(view === 'week' ? weekDays : [currentDate]).map((day) => {
                    const slotAppts = getApptForSlot(day, hour)
                    const isWeekend = day.day() === 6 || day.day() === 0
                    const dayOff = isDayOff(day)
                    const isOutOfHours = (() => {
                      if (dayOff || !schedule) return false
                      const key = DOW_MAP[day.day()]
                      const startH = parseInt((schedule[`${key}_start` as keyof typeof schedule] as string).split(':')[0])
                      const endH   = parseInt((schedule[`${key}_end`   as keyof typeof schedule] as string).split(':')[0])
                      return hour < startH || hour >= endH
                    })()
                    const slotKey = `${day.format('YYYY-MM-DD')}_${hour}`
                    const isDragTarget = dragOverSlot === slotKey
                    return (
                      <div
                        key={day.format()}
                        className={`border-l p-0.5 transition-colors min-w-0 ${
                          dayOff
                            ? 'bg-muted/40 dark:bg-muted/20 cursor-not-allowed'
                            : isOutOfHours
                              ? `bg-muted/25 dark:bg-muted/15 cursor-not-allowed ${isWeekend ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`
                              : isDragTarget
                                ? 'bg-primary/15 border-primary/40 ring-1 ring-inset ring-primary/30'
                                : `cursor-pointer hover:bg-accent/50 ${isWeekend ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`
                        }`}
                        onClick={() => { if (!dayOff && !isOutOfHours && !isDragging && !apptLimitReached) openCreate(day.format('YYYY-MM-DD'), `${String(hour).padStart(2, '0')}:00`) }}
                        onDragOver={(e) => handleDragOver(e, day, hour, dayOff, isOutOfHours)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, day, hour, dayOff, isOutOfHours)}
                      >
                        {slotAppts.map((a) => (
                          <Tooltip key={a.id}>
                            <TooltipTrigger asChild>
                              <div
                                draggable
                                className={`text-xs p-1 rounded border mb-0.5 cursor-grab active:cursor-grabbing select-none relative ${STATUS_COLORS[a.status]} ${isDragging && dragApptRef.current?.id === a.id ? 'opacity-40' : ''}`}
                                onClick={(e) => { e.stopPropagation(); if (!isDragging) openEdit(a) }}
                                onDragStart={(e) => handleDragStart(e, a)}
                                onDragEnd={handleDragEnd}
                              >
                                <div className="font-medium truncate pr-3">
                                  {a.expand?.client
                                    ? `${a.expand.client.first_name} ${a.expand.client.last_name || ''}`
                                    : a.client_name || t('dashboard.guestClient')}
                                </div>
                                <div className="opacity-75 truncate">
                                  {getAppointmentServiceNames(a, services)}
                                </div>
                                {a.booked_via === 'online' && (
                                  <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-sky-400 ring-1 ring-white dark:ring-zinc-800" />
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="p-3 bg-background border shadow-lg">
                              <ApptTooltipContent appt={a} />
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        </TooltipProvider>
      </div>

      {/* ── Легенда цветов (только десктоп, неделя/день) ── */}
      {(view === 'week' || view === 'day') && (
        <div className="hidden lg:flex items-center gap-5 px-1 text-xs text-muted-foreground flex-wrap">
          {[
            { color: 'bg-blue-200',    label: t('appointments.status.scheduled') },
            { color: 'bg-emerald-200', label: t('appointments.status.done')      },
            { color: 'bg-red-200',     label: t('appointments.status.cancelled') },
            { color: 'bg-amber-200',   label: t('appointments.status.no_show')   },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded ${color}`} />
              <span>{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <span>{t('common.online')}</span>
          </div>
        </div>
      )}

      {/* ── Превью-шит для мобильного (только < lg) ── */}
      <AppointmentPreviewSheet
        appt={previewAppt}
        open={previewOpen}
        onClose={() => { setPreviewOpen(false); setPreviewAppt(null) }}
        onEditStep={openEditFromPreview}
        onDelete={deleteFromPreview}
        onStatusChange={updateStatusFromPreview}
        services={services}
      />

      {/* ── Диалог создания/редактирования ── */}
      <AppointmentDialog
        key={wizardKey}
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setDuplicateFrom(null) }}
        editAppt={editAppt}
        duplicateFrom={duplicateFrom}
        defaultDate={defaultDate}
        defaultTime={defaultTime}
        services={services}
        clients={clients}
        onSubmit={handleDialogSubmit}
        onDelete={editAppt ? () => { setDialogOpen(false); setDeleteId(editAppt.id) } : undefined}
        onDuplicate={editAppt ? handleDuplicate : undefined}
        isLoading={create.isPending || update.isPending}
        hasTelegram={hasTelegram}
        initialStep={initialStep}
      />

      {/* Single delete */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          await del.mutateAsync(deleteId!)
          toast.success(t('appointments.deleted'))
          setDeleteId(null)
        }}
        title={t('appointments.deleteConfirm')}
        loading={del.isPending}
      />

      {/* Bulk delete */}
      <ConfirmDialog
        open={deleteIds.length > 0}
        onClose={() => setDeleteIds([])}
        onConfirm={async () => {
          await Promise.all(deleteIds.map(id => del.mutateAsync(id)))
          toast.success(t('calendar.deletedCount', { count: deleteIds.length }))
          setDeleteIds([])
          setSelected(new Set())
        }}
        title={t('calendar.deleteSelectedConfirm', { count: deleteIds.length })}
        loading={del.isPending}
      />
    </div>
  )
}
