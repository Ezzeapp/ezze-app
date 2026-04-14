import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Clock, X, Percent, User, UserPlus, CalendarCheck, ChevronLeft, ChevronRight, Copy, ArrowRightLeft, Plus, CreditCard, StickyNote, Repeat, Info, Printer, CheckCircle2 } from 'lucide-react'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { supabase } from '@/lib/supabase'

dayjs.extend(isoWeek)
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDuration, parseTimeToMinutes, minutesToTime, normalizePhone } from '@/lib/utils'
import { useCurrency, useCurrencySymbol } from '@/hooks/useCurrency'
import { useSchedule, useScheduleBreaks } from '@/hooks/useSchedule'
import { useCreateClient } from '@/hooks/useClients'
import { useClientStats } from '@/hooks/useClientStats'
import { useAuth } from '@/contexts/AuthContext'
import { useFeature } from '@/hooks/useFeatureFlags'
import { useDraft } from '@/hooks/useDraft'
import { useConfirmAppointment } from '@/hooks/useAppointments'
import { toast } from '@/components/shared/Toaster'
import { printReceipt } from '@/lib/printReceipt'
import { PRODUCT } from '@/lib/config'
import { ClinicVisitPanel } from '@/components/clinic/ClinicVisitPanel'
import type { Appointment, Service, Client, Schedule, ScheduleBreak } from '@/types'

// Тип данных черновика новой записи
interface AppointmentDraft {
  serviceIds: string[]
  date: string
  time: string
  clientId: string | null
  isGuest: boolean
  guestName: string
  guestPhone: string
  priceInput: string
  notes: string
  discount: number
  customDiscount: string
  paymentMethod: string
}

// Стабильный пустой массив — чтобы не вызывать бесконечный цикл useEffect
const EMPTY_BREAKS: ScheduleBreak[] = []

// ── Типы ────────────────────────────────────────────────────────────────────

export interface AppointmentFormData {
  service: string
  services: Service[]   // все выбранные услуги (для appointment_services)
  date: string
  start_time: string
  end_time: string
  client: string
  client_name: string
  client_phone: string
  price: number | undefined
  notes: string
  status: 'scheduled' | 'done' | 'cancelled' | 'no_show'
  notify_telegram: boolean
  recurring: boolean
  recurring_weeks: number
  discount: number
  payment_method?: 'cash' | 'card' | 'transfer' | 'other'
}

interface Props {
  open: boolean
  onClose: () => void
  editAppt: Appointment | null
  defaultDate: string
  defaultTime: string
  services: Service[]
  clients: Client[]
  onSubmit: (data: AppointmentFormData) => Promise<void>
  onDelete?: () => void
  onDuplicate?: () => void
  duplicateFrom?: Appointment | null
  isLoading: boolean
  hasTelegram: boolean
  initialStep?: 0 | 1 | 2 | 3
}

// ── Хелперы слотов ───────────────────────────────────────────────────────────

const DOW_MAP: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' }

type BusyReason = 'break' | 'appointment' | 'outOfBounds' | null
interface SlotInfo { time: string; busy: boolean; reason: BusyReason }

async function computeSlots(
  date: string,
  duration: number,        // 0 = показать все слоты без проверки "влезет ли"
  schedule: Schedule | null,
  breaks: ScheduleBreak[],
  masterId: string,
  excludeApptId?: string,
): Promise<SlotInfo[]> {
  if (!schedule || !date) return []

  const dow = dayjs(date).day()
  const key = DOW_MAP[dow]
  const enabled = schedule[`${key}_enabled` as keyof Schedule] as boolean
  if (!enabled) return []

  const startStr = schedule[`${key}_start` as keyof Schedule] as string
  const endStr   = schedule[`${key}_end`   as keyof Schedule] as string
  const slotDur  = schedule.slot_duration || 30

  const start = parseTimeToMinutes(startStr)
  const end   = parseTimeToMinutes(endStr)
  const dur   = duration > 0 ? duration : slotDur  // если услуга не выбрана — проверяем на slotDur

  const times: number[] = []
  for (let t = start; t + slotDur <= end; t += slotDur) times.push(t)

  const dayBreaks = breaks.filter(b => b.day_of_week === dow)

  let appts: Appointment[] = []
  try {
    let query = supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('master_id', masterId)
      .eq('date', date)
      .neq('status', 'cancelled')
    if (excludeApptId) query = query.neq('id', excludeApptId)
    const { data } = await query
    appts = (data ?? []) as unknown as Appointment[]
  } catch { /* ignore */ }

  return times.map(t => {
    const breakBusy = dayBreaks.some(b => {
      const bs = parseTimeToMinutes(b.start_time)
      const be = parseTimeToMinutes(b.end_time)
      return t >= bs && t < be
    })
    const apptBusy = appts.some(a => {
      const as_ = parseTimeToMinutes(a.start_time)
      const ae  = parseTimeToMinutes(a.end_time)
      return t < ae && t + dur > as_
    })
    const outOfBounds = t + dur > end
    const busy = breakBusy || apptBusy || outOfBounds
    const reason: BusyReason = breakBusy ? 'break' : apptBusy ? 'appointment' : outOfBounds ? 'outOfBounds' : null
    return { time: minutesToTime(t), busy, reason }
  })
}

const DISCOUNT_PRESETS = [5, 10, 15, 20]

// ── Компонент ────────────────────────────────────────────────────────────────

export function AppointmentDialog({
  open, onClose, editAppt, defaultDate, defaultTime,
  services, clients, onSubmit, onDelete, onDuplicate, duplicateFrom, isLoading, hasTelegram,
  initialStep,
}: Props) {
  const { t, i18n } = useTranslation()
  const currency = useCurrency()
  const currencySymbol = useCurrencySymbol()
  const { user } = useAuth()
  const { data: schedule } = useSchedule()
  const { data: breaksData } = useScheduleBreaks()
  const breaks = breaksData ?? EMPTY_BREAKS
  const createClient = useCreateClient()
  const confirm = useConfirmAppointment()

  // ── Черновик ──────────────────────────────────────────────────────────────
  const draftKey = `appt_draft_${user?.id || 'anon'}`
  const draft = useDraft<AppointmentDraft>(draftKey)
  const [showDraftBanner, setShowDraftBanner] = useState(false)
  const [isConfirmedLocally, setIsConfirmedLocally] = useState(false)

  // ── Feature flags ──────────────────────────────────────────────────────────
  const showNotes     = useFeature('appointment_notes')
  const showRecurring = useFeature('appointment_recurring')

  // ── Услуги ────────────────────────────────────────────────────────────────
  const [svcSearch, setSvcSearch] = useState('')
  const closeSvcDropdown = () => setSvcSearch('')

  const [selectedSvcs, setSelectedSvcs] = useState<Service[]>([])
  const [svcBlockedWarning, setSvcBlockedWarning] = useState<string | null>(null)

  const toggleSvc = (svc: Service) => {
    setSvcBlockedWarning(null)
    setSelectedSvcs(prev => {
      const exists = prev.find(s => s.id === svc.id)
      if (exists) {
        return prev.filter(s => s.id !== svc.id)
      }

      // Проверяем: если время уже выбрано — влезет ли новая услуга?
      if (selectedTime && selectedDate && slots.length > 0) {
        const newDuration = prev.reduce((s, x) => s + x.duration_min, 0) + svc.duration_min
        const chosenSlot = slots.find(s => s.time === selectedTime)
        // Пересчитываем: занят ли слот с новой длительностью
        // Проверяем через уже посчитанные слоты — если текущий слот с новой dur будет busy
        // Делаем проверку напрямую по данным из slots (t + newDur > end или пересечение)
        // Используем schedule из хука — берём из существующего слота
        // Простая проверка: смотрим есть ли свободный слот начиная с selectedTime с длиной newDuration
        const startMin = parseTimeToMinutes(selectedTime)
        const endMin = startMin + newDuration
        // Проверяем реальные блокировщики (запись/перерыв), outOfBounds не считаем
        const blockedInRange = slots.some(s => {
          if (!s.busy || s.reason === 'outOfBounds') return false
          const t = parseTimeToMinutes(s.time)
          return t >= startMin && t < endMin
        })
        // Конец дня берём напрямую из расписания
        const schedKey = DOW_MAP[dayjs(selectedDate).day()]
        const dayEndStr = schedule ? schedule[`${schedKey}_end` as keyof Schedule] as string : ''
        const dayEndMin = dayEndStr ? parseTimeToMinutes(dayEndStr) : 0
        const outOfBounds = dayEndMin > 0 && endMin > dayEndMin

        if (blockedInRange || outOfBounds) {
          setSvcBlockedWarning(
            t('appointments.slotReasonAppointment', { dur: formatDuration(newDuration, t) })
          )
          return prev // не добавляем
        }
      }

      return [...prev, svc]
    })
  }

  const totalDuration = useMemo(
    () => selectedSvcs.reduce((s, svc) => s + svc.duration_min, 0),
    [selectedSvcs]
  )
  const totalBasePrice = useMemo(
    () => selectedSvcs.reduce((s, svc) => s + (svc.price || 0), 0),
    [selectedSvcs]
  )

  // ── Дата / слоты ──────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(defaultDate || dayjs().format('YYYY-MM-DD'))
  const [slots, setSlots] = useState<SlotInfo[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedTime, setSelectedTime] = useState(defaultTime || '')
  // Неделя для пикера дат: начало недели (Пн) содержащей выбранную дату
  const [weekStart, setWeekStart] = useState(() =>
    dayjs(defaultDate || dayjs()).startOf('isoWeek')
  )
  // Месяц для десктоп-календаря (независимый от weekStart)
  const [desktopMonth, setDesktopMonth] = useState(() =>
    dayjs(defaultDate || dayjs()).startOf('month')
  )

  // ── Клиент ────────────────────────────────────────────────────────────────
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [isGuest, setIsGuest] = useState(true)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [showNewClient, setShowNewClient] = useState(false)
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName]   = useState('')
  const [newPhone, setNewPhone]         = useState('')
  const [newEmail, setNewEmail]         = useState('')
  const [savingClient, setSavingClient] = useState(false)
  const clientFullName = selectedClient
    ? `${selectedClient.first_name} ${selectedClient.last_name || ''}`.trim()
    : ''
  const { data: clientStats } = useClientStats(selectedClient?.id ?? '', clientFullName || undefined)

  // ── Финансы ───────────────────────────────────────────────────────────────
  // Ref: ключ услуг при открытии редактирования — чтобы пропустить только инит, а не реальные смены
  const editInitSvcKeyRef = useRef('')
  const [priceInput, setPriceInput]         = useState('')
  const [discount, setDiscount]             = useState(0)
  const [customDiscount, setCustomDiscount] = useState('')
  const [surcharge, setSurcharge]           = useState(0)   // надбавка % (срочность)
  const [customSurcharge, setCustomSurcharge] = useState('')
  const [adjustMode, setAdjustMode]         = useState<'discount' | 'surcharge'>('discount')
  const [paymentMethod, setPaymentMethod]   = useState<'cash' | 'card' | 'transfer' | 'other' | ''>('')

  // ── Прочее ────────────────────────────────────────────────────────────────
  const [notes, setNotes]               = useState('')
  const [status, setStatus]             = useState<AppointmentFormData['status']>('scheduled')
  const [notifyTg, setNotifyTg]         = useState(false)
  const [recurring, setRecurring]       = useState(false)
  const [recurringWeeks, setRecurringWeeks] = useState(4)
  const [isReschedule, setIsReschedule] = useState(false)

  // ── UI-раскрытие секций на шаге 4 ─────────────────────────────────────────
  const [activeSection4, setActiveSection4] = useState<'discount' | 'payment' | 'notes' | 'recurring' | null>(null)

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setMobileStep(initialStep ?? 0)
    setIsConfirmedLocally(false)
    editInitSvcKeyRef.current = '' // сбрасываем при каждом открытии
    if (editAppt) {
      // Восстанавливаем услуги: 1) из appointment_services (новый формат)
      //   2) из notes-префикса "[Услуга, ...]\n" (legacy)  3) из editAppt.service (fallback)
      const apptSvcsExpand = editAppt.expand?.['appointment_services(appointment)'] as Array<{ service: string; sort_order?: number }> | undefined
      let restoredSvcs: Service[] = []
      if (apptSvcsExpand && apptSvcsExpand.length > 0) {
        const sorted = [...apptSvcsExpand].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        restoredSvcs = sorted.map(as => services.find(s => s.id === as.service)).filter(Boolean) as Service[]
      }
      if (restoredSvcs.length === 0) {
        // Legacy: notes-префикс
        const multiMatch = (editAppt.notes || '').match(/^\[(.+)\]\n?/)
        if (multiMatch) {
          const names = multiMatch[1].split(', ').map(n => n.trim().replace(/×\d+$/, ''))
          restoredSvcs = names.map(name => services.find(s => s.name === name)).filter(Boolean) as Service[]
        }
      }
      if (restoredSvcs.length === 0) {
        const primary = services.find(s => s.id === editAppt.service)
        if (primary) restoredSvcs = [primary]
      }
      // Убираем notes-префикс из заметок
      const cleanNotes = (editAppt.notes || '').replace(/^\[.+\]\n?/, '')
      setSelectedSvcs(restoredSvcs)
      editInitSvcKeyRef.current = restoredSvcs.map(s => s.id).join(',') // запоминаем начальный набор
      setSelectedDate(editAppt.date)
      setSelectedTime(editAppt.start_time)
      setIsReschedule(false)
      setNotes(cleanNotes)
      setStatus(editAppt.status)
      // editAppt.price хранит finalPrice (с учётом скидки/надбавки).
      // Восстанавливаем basePrice обратным пересчётом, чтобы скидка не применялась дважды.
      const saved = editAppt.discount ?? 0
      const presets = [5, 10, 15]
      if (saved < 0) {
        const pct = Math.abs(saved)
        setAdjustMode('discount')
        if (presets.includes(pct)) { setDiscount(pct); setCustomDiscount('') }
        else { setDiscount(0); setCustomDiscount(String(pct)) }
        setSurcharge(0); setCustomSurcharge('')
      } else if (saved > 0) {
        setAdjustMode('surcharge')
        if (presets.includes(saved)) { setSurcharge(saved); setCustomSurcharge('') }
        else { setSurcharge(0); setCustomSurcharge(String(saved)) }
        setDiscount(0); setCustomDiscount('')
      } else {
        setDiscount(0); setCustomDiscount(''); setSurcharge(0); setCustomSurcharge(''); setAdjustMode('discount')
      }
      setPaymentMethod((editAppt.payment_method || '') as any)
      setActiveSection4(null)
      // Обратный пересчёт базовой цены из finalPrice: basePrice = finalPrice / (1 + saved/100)
      if (editAppt.price !== undefined) {
        const adjustment = saved !== 0 ? (1 + saved / 100) : 1
        const restoredBase = adjustment !== 0 ? Math.round(editAppt.price / adjustment) : editAppt.price
        setPriceInput(String(restoredBase))
      } else {
        setPriceInput('')
      }
      if (editAppt.client) {
        const c = clients.find(c => c.id === editAppt.client) || null
        setSelectedClient(c); setIsGuest(false)
      } else {
        setSelectedClient(null); setIsGuest(true)
        setGuestName(editAppt.client_name || '')
        setGuestPhone(editAppt.client_phone || '')
      }
    } else if (duplicateFrom) {
      // Дублирование — восстанавливаем услуги/клиента/цену из оригинала
      const dupApptSvcs = duplicateFrom.expand?.['appointment_services(appointment)'] as Array<{ service: string; sort_order?: number }> | undefined
      let dupSvcs: Service[] = []
      if (dupApptSvcs && dupApptSvcs.length > 0) {
        const sorted = [...dupApptSvcs].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        dupSvcs = sorted.map(as => services.find(s => s.id === as.service)).filter(Boolean) as Service[]
      }
      if (dupSvcs.length === 0) {
        const multiMatch = (duplicateFrom.notes || '').match(/^\[(.+)\]\n?/)
        if (multiMatch) {
          const names = multiMatch[1].split(', ').map(n => n.trim().replace(/×\d+$/, ''))
          dupSvcs = names.map(name => services.find(s => s.name === name)).filter(Boolean) as Service[]
        }
      }
      if (dupSvcs.length === 0) {
        const primary = services.find(s => s.id === duplicateFrom.service)
        if (primary) dupSvcs = [primary]
      }
      const dupNotes = (duplicateFrom.notes || '').replace(/^\[.+\]\n?/, '')
      setSelectedSvcs(dupSvcs); setSvcSearch('')
      const initDate = defaultDate || dayjs().format('YYYY-MM-DD')
      setSelectedDate(initDate)
      setSelectedTime('')  // время не копируем — нужно выбрать новое
      setWeekStart(dayjs(initDate).startOf('isoWeek'))
      setNotes(dupNotes); setStatus('scheduled')
      setPriceInput(duplicateFrom.price !== undefined ? String(duplicateFrom.price) : '')
      setDiscount(0); setCustomDiscount(''); setSurcharge(0); setCustomSurcharge(''); setAdjustMode('discount')
      setPaymentMethod('')
      if (duplicateFrom.client) {
        const c = clients.find(c => c.id === duplicateFrom.client) || null
        setSelectedClient(c); setIsGuest(false)
      } else {
        setSelectedClient(null); setIsGuest(true)
        setGuestName(duplicateFrom.client_name || '')
        setGuestPhone(duplicateFrom.client_phone || '')
      }
      setClientSearch(''); setShowNewClient(false)
      setNewFirstName(''); setNewLastName(''); setNewPhone(''); setNewEmail('')
      setNotifyTg(false); setRecurring(false); setRecurringWeeks(4)
      setIsReschedule(false)
      setActiveSection4(null)
      setSlots([])
    } else {
      setSelectedSvcs([]); setSvcSearch('')
      const initDate = defaultDate || dayjs().format('YYYY-MM-DD')
      setSelectedDate(initDate)
      setSelectedTime(defaultTime || '')
      setWeekStart(dayjs(initDate).startOf('isoWeek'))
      setNotes(''); setStatus('scheduled')
      setPriceInput(''); setDiscount(0); setCustomDiscount(''); setSurcharge(0); setCustomSurcharge(''); setAdjustMode('discount')
      setPaymentMethod('')
      setSelectedClient(null); setIsGuest(true)
      setGuestName(''); setGuestPhone('')
      setClientSearch(''); setShowNewClient(false)
      setNewFirstName(''); setNewLastName(''); setNewPhone(''); setNewEmail('')
      setNotifyTg(false); setRecurring(false); setRecurringWeeks(4)
      setIsReschedule(false)
      setActiveSection4(null)
      setSlots([])
      // Проверяем черновик (только для новых записей)
      if (draft.exists()) setShowDraftBanner(true)
      else setShowDraftBanner(false)
    }
  }, [open])

  // Авто-сохранение черновика (только для новых записей)
  useEffect(() => {
    if (!open || editAppt || duplicateFrom || showDraftBanner) return
    if (selectedSvcs.length === 0 && !guestName && !guestPhone && !selectedClient) return
    draft.save({
      serviceIds: selectedSvcs.map(s => s.id),
      date: selectedDate,
      time: selectedTime,
      clientId: selectedClient?.id || null,
      isGuest,
      guestName, guestPhone,
      priceInput, notes,
      discount, customDiscount,
      paymentMethod,
    })
  }, [open, selectedSvcs, selectedDate, selectedTime, selectedClient, isGuest, guestName, guestPhone, priceInput, notes, discount, customDiscount, paymentMethod])

  // Восстановить черновик
  const handleRestoreDraft = () => {
    const saved = draft.load()
    if (!saved) { setShowDraftBanner(false); return }
    const restoredSvcs = saved.serviceIds
      .map(id => services.find(s => s.id === id))
      .filter(Boolean) as Service[]
    setSelectedSvcs(restoredSvcs)
    if (saved.date) { setSelectedDate(saved.date); setWeekStart(dayjs(saved.date).startOf('isoWeek')) }
    if (saved.time) setSelectedTime(saved.time)
    setIsGuest(saved.isGuest)
    setGuestName(saved.guestName || '')
    setGuestPhone(saved.guestPhone || '')
    if (!saved.isGuest && saved.clientId) {
      const c = clients.find(c => c.id === saved.clientId) || null
      setSelectedClient(c)
    }
    setPriceInput(saved.priceInput || '')
    setNotes(saved.notes || '')
    setDiscount(saved.discount || 0)
    setCustomDiscount(saved.customDiscount || '')
    setPaymentMethod((saved.paymentMethod || '') as any)
    setShowDraftBanner(false)
  }

  const handleDiscardDraft = () => {
    draft.clear()
    setShowDraftBanner(false)
  }

  // Авто-цена из услуг (обновляем при смене набора)
  // При редактировании: пропускаем только инициализацию (начальный набор услуг),
  // но пересчитываем при реальной смене услуги мастером
  useEffect(() => {
    if (duplicateFrom) return
    const currentKey = selectedSvcs.map(s => s.id).join(',')
    if (editAppt && currentKey === editInitSvcKeyRef.current) return
    setPriceInput(totalBasePrice > 0 ? String(totalBasePrice) : '')
  }, [selectedSvcs.map(s => s.id).join(',')])

  // Слоты: грузим сразу при выборе даты, даже без услуги
  useEffect(() => {
    if (!selectedDate || !user?.id) { setSlots([]); return }
    setSlotsLoading(true)
    computeSlots(selectedDate, totalDuration, schedule || null, breaks, user.id, editAppt?.id)
      .then(s => {
        setSlots(s)
        setSlotsLoading(false)
        // Автовыбор первого свободного слота только при редактировании
        // (при новой записи — мастер выбирает слот вручную)
        if (editAppt) {
          // ничего не меняем — время уже установлено из editAppt
        }
      })
  }, [selectedDate, totalDuration, schedule, breaks, user?.id])

  // Доступные даты (60 дней, только рабочие)
  const availableDates = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => {
      const d = dayjs().add(i, 'day')
      if (!schedule) return d.format('YYYY-MM-DD')
      const key = DOW_MAP[d.day()]
      return schedule[`${key}_enabled` as keyof Schedule] ? d.format('YYYY-MM-DD') : null
    }).filter(Boolean) as string[]
  }, [schedule])

  // Ячейки месячного календаря для десктопа (0=пн … 6=вс)
  const desktopMonthDays = useMemo(() => {
    const start = desktopMonth.startOf('month')
    const end   = desktopMonth.endOf('month')
    const firstDow = (start.day() + 6) % 7
    const cells: (dayjs.Dayjs | null)[] = Array(firstDow).fill(null)
    for (let d = start; !d.isAfter(end); d = d.add(1, 'day')) cells.push(d)
    return cells
  }, [desktopMonth])

  // Если сегодня выходной — автоматически переключаемся на первый рабочий день
  // и синхронизируем неделю
  useEffect(() => {
    if (!open || editAppt || !schedule || availableDates.length === 0) return
    setSelectedDate(prev => {
      if (availableDates.includes(prev)) return prev
      const first = availableDates[0]
      // Переключаем неделю к первой рабочей дате
      setWeekStart(dayjs(first).startOf('isoWeek'))
      return first
    })
  }, [open, availableDates])

  // Синхронизируем десктоп-месяц при изменении выбранной даты
  useEffect(() => {
    if (selectedDate) setDesktopMonth(dayjs(selectedDate).startOf('month'))
  }, [selectedDate])


  // Поиск услуг
  const filteredSvcs = useMemo(() => {
    const q = svcSearch.toLowerCase().trim()
    const active = services.filter(s => s.is_active)
    if (!q) return active
    return active.filter(s =>
      s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q)
    )
  }, [services, svcSearch])

  // Поиск клиентов
  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase().trim()
    if (!q) return []
    return clients.filter(c =>
      `${c.first_name} ${c.last_name || ''}`.toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    ).slice(0, 8)
  }, [clients, clientSearch])

  // Итоговая цена
  const basePrice = parseFloat(priceInput) || 0
  const effectiveDiscount = discount > 0 ? discount : (parseFloat(customDiscount) || 0)
  const effectiveSurcharge = surcharge > 0 ? surcharge : (parseFloat(customSurcharge) || 0)
  // Скидка и надбавка не суммируются — применяется только одно (surcharge приоритетнее)
  const netAdjustment = effectiveSurcharge > 0 ? effectiveSurcharge : -effectiveDiscount
  const finalPrice = basePrice > 0 ? Math.round(basePrice * (1 + netAdjustment / 100)) : 0

  // Добавление нового клиента
  const handleAddClient = async () => {
    if (!newFirstName.trim()) return
    setSavingClient(true)
    try {
      const c = await createClient.mutateAsync({
        first_name: newFirstName.trim(), last_name: newLastName.trim(),
        phone: normalizePhone(newPhone), email: newEmail.trim(),
      } as any)
      setSelectedClient(c); setIsGuest(false); setShowNewClient(false)
      setNewFirstName(''); setNewLastName(''); setNewPhone(''); setNewEmail('')
      toast.success(t('clients.created'))
    } catch { toast.error(t('common.saveError')) }
    finally { setSavingClient(false) }
  }

  // Submit
  const handleSubmit = async () => {
    if (selectedSvcs.length === 0 || !selectedDate || !selectedTime) return
    const startMin = parseTimeToMinutes(selectedTime)
    const endTime  = minutesToTime(startMin + (totalDuration || 30))
    await onSubmit({
      service: selectedSvcs[0].id,
      services: selectedSvcs,          // все услуги → для appointment_services
      date: selectedDate, start_time: selectedTime, end_time: endTime,
      client: isGuest ? '' : (selectedClient?.id || ''),
      client_name: isGuest ? guestName : '',
      client_phone: isGuest ? guestPhone : '',
      price: basePrice > 0 ? finalPrice : undefined,
      notes,                           // чистые заметки, без префикса
      status, notify_telegram: notifyTg,
      recurring, recurring_weeks: recurringWeeks,
      discount: netAdjustment,
      payment_method: paymentMethod || undefined,
    })
    // Успешно сохранено — очищаем черновик
    if (!editAppt) draft.clear()
  }

  const hasClient = !!selectedClient || (isGuest && !!guestName)
  const canSave = selectedSvcs.length > 0 && !!selectedDate && !!selectedTime && hasClient

  // Мобильный квиз: шаги 0=Дата, 1=Время, 2=Услуга, 3=Детали
  const [mobileStep, setMobileStep] = useState(0)
  const [stepDir, setStepDir] = useState<'forward' | 'back'>('forward')
  const MOBILE_STEPS = 3

  // Отображение клиента в итоговой строке
  const clientLabel = selectedClient
    ? `${selectedClient.first_name} ${selectedClient.last_name || ''}`.trim()
    : guestName || t('appointments.guestClient')

  // ── Рендер ────────────────────────────────────────────────────────────────

  // ── Блок УСЛУГИ (переиспользуется в обоих колонках) ───────────────────────

  const servicesBlock = (
    <section className="relative">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
        {t('appointments.service')}
        {selectedSvcs.length > 0 && (
          <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {selectedSvcs.length}
          </span>
        )}
      </p>
      {/* Поиск + дропдаун */}
      <div className="relative z-20 mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
        <Input
          className="pl-9 pr-9 h-9 text-sm"
          placeholder={t('booking.searchServices')}
          value={svcSearch}
          onChange={e => setSvcSearch(e.target.value)}
        />
        {svcSearch && (
          <button type="button" onClick={closeSvcDropdown}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {/* Дропдаун — absolute под инпутом, z-20 поверх всего */}
        {svcSearch && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-xl shadow-lg z-50 max-h-[220px] overflow-y-auto">
            {filteredSvcs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-3">{t('booking.noServices')}</p>
            )}
            {filteredSvcs.map(svc => {
              const isSel = !!selectedSvcs.find(s => s.id === svc.id)
              const wouldBlock = !isSel && !!selectedTime && !!selectedDate && slots.length > 0 && (() => {
                const newDuration = selectedSvcs.reduce((s, x) => s + x.duration_min, 0) + svc.duration_min
                const startMin = parseTimeToMinutes(selectedTime)
                const endMin = startMin + newDuration
                const blockedInRange = slots.some(s => {
                  if (!s.busy || s.reason === 'outOfBounds') return false
                  const t = parseTimeToMinutes(s.time)
                  return t >= startMin && t < endMin
                })
                const schedKey = DOW_MAP[dayjs(selectedDate).day()]
                const dayEndStr = schedule ? schedule[`${schedKey}_end` as keyof Schedule] as string : ''
                const dayEndMin = dayEndStr ? parseTimeToMinutes(dayEndStr) : 0
                return blockedInRange || (dayEndMin > 0 && endMin > dayEndMin)
              })()
              return (
                <button
                  key={svc.id}
                  type="button"
                  onPointerDown={e => {
                    e.preventDefault()
                    if (!wouldBlock) {
                      toggleSvc(svc)
                      closeSvcDropdown()
                    }
                  }}
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-3 border-b last:border-b-0 transition-colors
                    ${isSel ? 'bg-primary/8' : wouldBlock ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted/60'}`}
                >
                  {svc.expand?.category?.color && (
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: svc.expand.category.color }} />
                  )}
                  <span className="flex-1 text-sm font-medium truncate">{svc.name}</span>
                  <div className="text-right shrink-0 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1 justify-end">
                      <Clock className="h-3 w-3" />{formatDuration(svc.duration_min, t)}
                    </div>
                    {svc.price > 0 && <div className="font-semibold text-foreground mt-0.5">{formatCurrency(svc.price, currency, i18n.language)}</div>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {svcBlockedWarning && (
        <div className="flex items-start gap-2 mt-1.5 px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
          <span className="text-amber-500 mt-0.5 shrink-0">⚠️</span>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {svcBlockedWarning} — {t('appointments.changeTimeOrService')}
          </p>
        </div>
      )}
      {selectedSvcs.length > 0 && (
        <div className="mt-2 pt-2 border-t space-y-1.5">
          {selectedSvcs.map((svc, idx) => (
            <div key={svc.id}
              className="flex items-center gap-2 bg-muted/50 rounded-lg px-2.5 py-1.5">
              {/* Номер */}
              <span className="text-xs text-muted-foreground shrink-0 w-4">{idx + 1}.</span>
              {/* Название */}
              <span className="text-xs font-medium text-primary flex-1 truncate">{svc.name}</span>
              {/* Цена */}
              {svc.price > 0 && (
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {formatCurrency(svc.price, currency, i18n.language)}
                </span>
              )}
              {/* Удалить */}
              <button type="button" onClick={() => toggleSvc(svc)}
                className="text-muted-foreground hover:text-destructive transition-colors ml-0.5 shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {selectedSvcs.length > 0 && (
            <div className="flex items-center justify-between px-1 pt-0.5">
              <span className="text-sm font-semibold text-foreground">{t('appointments.total')}:</span>
              <span className="text-sm font-semibold text-foreground">{formatDuration(totalDuration, t)}{totalBasePrice > 0 && ` · ${formatCurrency(totalBasePrice, currency, i18n.language)}`}</span>
            </div>
          )}
        </div>
      )}

    </section>
  )

  // ── Блок КЛИЕНТ ───────────────────────────────────────────────────────────
  const clientBlock = (
    <section>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('appointments.client')}
        </p>
        {!showNewClient && (
          <button type="button"
            onClick={() => { setShowNewClient(true); setSelectedClient(null); setIsGuest(false) }}
            className="text-xs text-primary hover:underline flex items-center gap-1">
            <UserPlus className="h-3 w-3" />{t('appointments.newClient')}
          </button>
        )}
      </div>
      {showNewClient ? (
        <div className="border rounded-xl p-3 space-y-2 bg-muted/30">
          <p className="text-sm font-medium">{t('appointments.newClientTitle')}</p>
          <div className="grid grid-cols-2 gap-2">
            <Input className="h-8 text-sm col-span-2" placeholder={`${t('clients.firstName')} *`}
              value={newFirstName} onChange={e => setNewFirstName(e.target.value)} autoFocus />
            <Input className="h-8 text-sm" placeholder={t('clients.phone')}
              value={newPhone} onChange={e => setNewPhone(e.target.value)} />
            <Input className="h-8 text-sm" placeholder={t('clients.email')}
              value={newEmail} onChange={e => setNewEmail(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" className="h-7 text-xs"
              loading={savingClient} disabled={!newFirstName.trim()} onClick={handleAddClient}>
              {t('common.save')}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs"
              onClick={() => { setShowNewClient(false); setIsGuest(true) }}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : selectedClient ? (
        <div className="border rounded-xl bg-primary/5 border-primary/20 overflow-hidden">
          {/* Основная строка клиента */}
          <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-primary font-semibold text-sm">
              {selectedClient.first_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedClient.first_name} {selectedClient.last_name || ''}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedClient.phone && (
                  <a href={`tel:${selectedClient.phone}`}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    onClick={e => e.stopPropagation()}>
                    {selectedClient.phone}
                  </a>
                )}
                {selectedClient.source && (
                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                    {selectedClient.source}
                  </span>
                )}
              </div>
            </div>
            <button type="button"
              onClick={() => { setSelectedClient(null); setIsGuest(true); setClientSearch('') }}
              className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Мини-статистика */}
          {clientStats ? (
            <div className="border-t border-primary/10 px-3 py-1.5 flex items-center gap-3 text-[11px] text-muted-foreground bg-background/40 flex-wrap">
              <span>
                {t('clients.statsVisits')}: <span className="font-semibold text-foreground">{clientStats.totalVisits}</span>
              </span>
              {clientStats.totalSpent > 0 && (
                <span>
                  {t('clients.statsSpent')}: <span className="font-semibold text-foreground">{formatCurrency(clientStats.totalSpent, currency, i18n.language)}</span>
                </span>
              )}
              {clientStats.lastVisit ? (
                <span className="ml-auto">
                  {t('clients.statsLastVisit')}: <span className="font-semibold text-foreground">{dayjs(clientStats.lastVisit).format('D MMM')}</span>
                </span>
              ) : (
                <span className="ml-auto italic">{t('clients.statsNoVisits')}</span>
              )}
            </div>
          ) : (
            <div className="border-t border-primary/10 px-3 py-1.5 text-[11px] text-muted-foreground bg-background/40 animate-pulse">
              {t('common.loading')}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-9 h-9 text-sm" placeholder={t('clients.search')}
              value={clientSearch} onChange={e => setClientSearch(e.target.value)} />
          </div>
          {filteredClients.length > 0 && (
            <div className="border rounded-xl overflow-hidden divide-y shadow-sm">
              {filteredClients.map(c => (
                <button key={c.id} type="button"
                  onClick={() => { setSelectedClient(c); setIsGuest(false); setClientSearch('') }}
                  className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-medium">
                    {c.first_name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium">{c.first_name} {c.last_name || ''}</span>
                  {c.phone && <span className="text-xs text-muted-foreground ml-auto">{c.phone}</span>}
                </button>
              ))}
            </div>
          )}
          {clientSearch.trim() && filteredClients.length === 0 && (
            <p className="text-xs text-muted-foreground px-1">{t('clients.empty')}</p>
          )}
        </div>
      )}
    </section>
  )

  // ── Блок ЦЕНА ─────────────────────────────────────────────────────────────
  const PRESETS = adjustMode === 'discount' ? [5, 10, 15] : [5, 10, 15]
  const activePreset = adjustMode === 'discount' ? effectiveDiscount : effectiveSurcharge
  const customAdjust = adjustMode === 'discount' ? customDiscount : customSurcharge

  const handleModeSwitch = (mode: 'discount' | 'surcharge') => {
    setAdjustMode(mode)
    setDiscount(0); setCustomDiscount(''); setSurcharge(0); setCustomSurcharge('')
  }
  const handlePresetClick = (p: number) => {
    if (adjustMode === 'discount') {
      setDiscount(discount === p ? 0 : p); setCustomDiscount('')
    } else {
      setSurcharge(surcharge === p ? 0 : p); setCustomSurcharge('')
    }
  }
  const handleCustomChange = (val: string) => {
    if (adjustMode === 'discount') { setCustomDiscount(val); setDiscount(0) }
    else { setCustomSurcharge(val); setSurcharge(0) }
  }

  // ── Блок ДАТА + ВРЕМЯ ─────────────────────────────────────────────────────
  // 7 дней текущей недели
  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'))
  const todayStr = dayjs().format('YYYY-MM-DD')

  const dateTimeBlock = (
    <>
      {/* ДАТА */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('appointments.date')}
            {selectedDate && (
              <span className="ml-2 font-normal normal-case text-foreground/70">
                {dayjs(selectedDate).format('D MMM, dddd')}
              </span>
            )}
            {isReschedule && (
              <span className="ml-2 font-normal normal-case text-amber-600 dark:text-amber-400 text-[11px]">
                — {t('appointments.rescheduleMode')}
              </span>
            )}
          </p>
          {/* Навигация по неделям */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setWeekStart(w => w.subtract(1, 'week'))}
              disabled={weekStart.isBefore(dayjs().startOf('isoWeek'))}
              className="h-6 w-6 rounded-md border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[11px] text-muted-foreground min-w-[90px] text-center">
              {weekStart.format('D MMM')} — {weekStart.add(6, 'day').format('D MMM')}
            </span>
            <button
              type="button"
              onClick={() => setWeekStart(w => w.add(1, 'week'))}
              className="h-6 w-6 rounded-md border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Недельная сетка 7 дней */}
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(day => {
            const dateStr    = day.format('YYYY-MM-DD')
            const isActive   = selectedDate === dateStr
            const isToday    = dateStr === todayStr
            const isPast     = day.isBefore(dayjs(), 'day')
            const isWeekend  = day.day() === 0 || day.day() === 6
            const isDayOff   = (() => {
              if (!schedule) return false
              const key = DOW_MAP[day.day()]
              return !(schedule[`${key}_enabled` as keyof Schedule] as boolean)
            })()
            const disabled = isPast || isDayOff

            return (
              <button
                key={dateStr}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return
                  setSelectedDate(dateStr)
                  setSelectedTime('')
                  setSvcBlockedWarning(null)
                }}
                className={`flex flex-col items-center py-2 rounded-xl border-2 text-center transition-all
                  ${isActive
                    ? 'border-primary bg-primary text-primary-foreground shadow-md scale-105'
                    : disabled
                      ? 'border-border bg-muted/30 opacity-35 cursor-not-allowed'
                      : isToday
                        ? 'border-primary/40 hover:border-primary/70'
                        : isWeekend
                          ? 'border-red-200 hover:border-red-400'
                          : 'border-border hover:border-primary/50'
                  }`}
              >
                <div className={`text-[9px] font-bold uppercase leading-tight
                  ${isActive ? 'text-primary-foreground/70'
                    : isWeekend && !disabled ? 'text-red-500 dark:text-red-400'
                    : 'text-muted-foreground'}`}>
                  {day.format('dd')}
                </div>
                <div className={`font-bold text-sm leading-tight
                  ${isActive ? 'text-primary-foreground'
                    : isToday && !isActive ? 'text-primary'
                    : isWeekend && !disabled ? 'text-red-500 dark:text-red-400'
                    : ''}`}>
                  {day.format('D')}
                </div>
                <div className={`text-[9px] leading-tight
                  ${isActive ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                  {day.format('MMM')}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* ВРЕМЯ */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
          {t('appointments.time')}
          {selectedSvcs.length === 0 && (
            <span className="font-normal normal-case text-muted-foreground/60 text-[11px]">
              — {t('appointments.selectSvcForAccuracy')}
            </span>
          )}
          {totalDuration > 0 && (
            <span className="font-normal normal-case text-muted-foreground">· {formatDuration(totalDuration, t)}</span>
          )}
          {slotsLoading && (
            <span className="ml-auto">
              <div className="h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </span>
          )}
        </p>
        {/* Оборачиваем в relative-контейнер — спиннер поверх, контент не прыгает */}
        <div className={`relative transition-opacity duration-150 ${slotsLoading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
        {slots.length === 0 && !slotsLoading ? (
          <p className="text-sm text-muted-foreground italic py-1">{t('schedule.dayOff')}</p>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded border-2 border-primary bg-primary/10 inline-block" />
                {t('booking.slotFree')}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded border border-border bg-muted inline-block" />
                {t('booking.slotBusy')}
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-1 max-h-[260px] overflow-y-auto pr-1">
              {slots.map(slot => {
                const isChosen = selectedTime === slot.time
                const isDisabled = slot.busy
                return (
                  <button
                    key={slot.time}
                    type="button"
                    onClick={() => {
                      if (isDisabled) return
                      setSelectedTime(slot.time)
                      setSvcBlockedWarning(null)
                    }}
                    className={`py-1.5 rounded-lg border text-xs font-medium transition-all
                      ${isDisabled
                        ? 'border-border bg-muted/40 text-muted-foreground/40 cursor-not-allowed line-through'
                        : isChosen
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm scale-105'
                          : 'border-border hover:border-primary/60 hover:bg-primary/5 active:scale-95'
                      }`}
                  >
                    {slot.time}
                  </button>
                )
              })}
            </div>
            {(() => {
              const allBusy = slots.every(s => s.busy)
              if (allBusy) return (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 px-0.5">
                  {t('appointments.allSlotsBusy')}
                </p>
              )
              const nextFree = selectedTime
                ? (slots.find(s => !s.busy && s.time > selectedTime) ?? null)
                : slots.find(s => !s.busy) ?? null
              if (nextFree) return (
                <div className="flex items-center gap-2 mt-1.5">
                  <p className="text-xs text-muted-foreground">
                    {selectedTime ? t('appointments.nextFree') : t('appointments.nearestFree')}:
                  </p>
                  <button type="button" onClick={() => setSelectedTime(nextFree.time)}
                    className="text-xs font-semibold text-primary hover:underline">
                    {nextFree.time}
                  </button>
                </div>
              )
              return null
            })()}
          </>
        )}
        </div>{/* конец relative-контейнера */}
      </section>
    </>
  )

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {/* Мобиле: полноэкранный снизу вверх. Десктоп: центрированный диалог */}
      <DialogContent
        mobileFullscreen
        className="w-full p-0 overflow-hidden flex flex-col sm:max-w-xl lg:max-w-5xl sm:h-[65vh] sm:max-h-[65vh] lg:h-[72vh] lg:max-h-[72vh]"
      >

        {/* Заголовок */}
        <DialogHeader className="px-5 pt-4 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-3">
            {editAppt ? t('appointments.edit') : t('appointments.add')}
            {canSave && (
              <span className="hidden lg:flex items-center gap-2 text-xs font-normal text-muted-foreground ml-auto pr-6">
                <CalendarCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                {dayjs(selectedDate).format('D MMM')} · {selectedTime}
                {totalDuration > 0 && (
                  <span className="text-muted-foreground/60">→ {minutesToTime(parseTimeToMinutes(selectedTime) + totalDuration)}</span>
                )}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── Баннер восстановления черновика ─────────────────────── */}
        {showDraftBanner && !editAppt && !duplicateFrom && (
          <div className="flex items-center justify-between gap-3 px-5 py-2.5 bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 shrink-0">
            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">{t('draft.found')}</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleDiscardDraft}>
                {t('draft.discard')}
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleRestoreDraft}>
                {t('draft.restore')}
              </Button>
            </div>
          </div>
        )}

        {/* ── Общий контент (заметки, статус, telegram/повтор) ─────── */}
        {/* Выносим в переменную чтобы не дублировать */}
        {(() => {
          // ── Шаги квиза для мобайла ───────────────────────────────
          const stepLabels = [
            t('appointments.service'),
            `${t('appointments.date')} / ${t('appointments.time')}`,
            t('appointments.client'),
          ]

          // Кастомные блоки только для нужного шага
          const mobileStepCanNext: boolean[] = [
            selectedSvcs.length > 0,          // шаг 0: услуга
            !!selectedDate && !!selectedTime,  // шаг 1: дата И время
            true,                             // шаг 2: клиент (опционально)
          ]

          // Табы цены/деталей (переиспользуются в мобайле и правой панели)
          const tabs4 = [
            { key: 'discount' as const, icon: Percent, label: t('appointments.tabDiscount'), badge: effectiveSurcharge > 0 ? `+${effectiveSurcharge}%` : effectiveDiscount > 0 ? `−${effectiveDiscount}%` : null },
            { key: 'payment' as const, icon: CreditCard, label: t('appointments.tabPayment'), badge: paymentMethod ? ({ cash: t('appointments.paymentCash'), card: t('appointments.paymentCard'), transfer: t('appointments.paymentTransfer'), other: t('appointments.paymentOther') } as Record<string, string>)[paymentMethod] ?? null : null },
            ...(showNotes ? [{ key: 'notes' as const, icon: StickyNote, label: t('appointments.tabNote'), badge: notes.trim() ? '·' : null }] : []),
            ...(!editAppt && showRecurring ? [{ key: 'recurring' as const, icon: Repeat, label: t('appointments.tabRecurring'), badge: recurring ? '·' : null }] : []),
          ]

          const tabsContent = (
            <>
              <div className="grid grid-cols-2 gap-1">
                {tabs4.map(tab => {
                  const Icon = tab.icon
                  const isActive = activeSection4 === tab.key
                  return (
                    <button key={tab.key} type="button"
                      onClick={() => setActiveSection4(isActive ? null : tab.key)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                        isActive ? 'bg-primary/10 text-primary' : tab.badge ? 'bg-muted/70 text-foreground' : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                      }`}>
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="truncate flex-1">{tab.label}</span>
                      {tab.badge && <span className={`shrink-0 text-xs font-semibold ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{tab.badge}</span>}
                    </button>
                  )
                })}
              </div>
              {activeSection4 === 'discount' && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <div className="flex rounded-lg border overflow-hidden shrink-0">
                      <button type="button" onClick={() => handleModeSwitch('discount')}
                        className={`px-3 h-7 text-xs font-medium transition-all border-r ${adjustMode === 'discount' ? 'bg-emerald-500 text-white' : 'bg-background text-muted-foreground hover:text-emerald-600'}`}>
                        {t('appointments.discount')}
                      </button>
                      <button type="button" onClick={() => handleModeSwitch('surcharge')}
                        className={`px-3 h-7 text-xs font-medium transition-all ${adjustMode === 'surcharge' ? 'bg-orange-500 text-white' : 'bg-background text-muted-foreground hover:text-orange-500'}`}>
                        {t('appointments.surcharge')}
                      </button>
                    </div>
                    <span className={`text-sm font-semibold ${effectiveSurcharge > 0 ? 'text-orange-500' : effectiveDiscount > 0 ? 'text-emerald-600' : 'text-muted-foreground/40'}`}>
                      {effectiveSurcharge > 0 ? `+${effectiveSurcharge}%` : effectiveDiscount > 0 ? `−${effectiveDiscount}%` : adjustMode === 'discount' ? '−%' : '+%'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {PRESETS.map(p => (
                      <button key={p} type="button" onClick={() => handlePresetClick(p)}
                        className={`h-7 px-2 rounded-lg border text-xs font-medium transition-all flex-1 ${activePreset === p ? adjustMode === 'discount' ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-orange-500 border-orange-500 text-white' : adjustMode === 'discount' ? 'border-border hover:border-emerald-400 hover:text-emerald-600' : 'border-border hover:border-orange-400 hover:text-orange-500'}`}>
                        {p}%
                      </button>
                    ))}
                    <div className="relative flex-1">
                      <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                      <Input type="number" min={0} max={100}
                        className="h-7 w-full pr-6 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0" value={customAdjust} onChange={e => handleCustomChange(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
              {activeSection4 === 'payment' && (
                <div className="grid grid-cols-2 gap-1 pt-1">
                  {([
                    { key: 'cash', label: t('appointments.paymentCash') },
                    { key: 'card', label: t('appointments.paymentCard') },
                    { key: 'transfer', label: t('appointments.paymentTransfer') },
                    { key: 'other', label: t('appointments.paymentOther') },
                  ] as const).map(m => (
                    <button key={m.key} type="button"
                      onClick={() => setPaymentMethod(paymentMethod === m.key ? '' : m.key)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${paymentMethod === m.key ? 'bg-primary/10 text-primary' : 'bg-muted/40 text-muted-foreground hover:bg-muted'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
              {activeSection4 === 'notes' && showNotes && (
                <div className="pt-1">
                  <Textarea rows={3} className="text-sm resize-none min-h-0"
                    placeholder={t('booking.commentPlaceholder')}
                    value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              )}
              {activeSection4 === 'recurring' && !editAppt && (
                <div className="rounded-xl border divide-y overflow-hidden mt-1">
                  {hasTelegram && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <p className="text-sm">{t('appointments.notifyTelegram')}</p>
                      <Switch checked={notifyTg} onCheckedChange={setNotifyTg} />
                    </div>
                  )}
                  {showRecurring && (
                    <div className="px-4 py-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{t('appointments.recurring')}</p>
                          <p className="text-xs text-muted-foreground">{t('appointments.recurringHelp')}</p>
                        </div>
                        <Switch checked={recurring} onCheckedChange={setRecurring} />
                      </div>
                      {recurring && (
                        <div className="flex items-center gap-3 pt-1">
                          <p className="text-sm text-muted-foreground shrink-0">{t('appointments.recurringWeeks')}</p>
                          <Input type="number" min={2} max={52} className="w-20 h-8"
                            value={recurringWeeks} onChange={e => setRecurringWeeks(Number(e.target.value))} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )

          return (
            <>
              {/* ── МОБАЙЛ + малый десктоп (< lg) ─── */}
              <div className="lg:hidden flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Левая колонка: шаги визарда */}
                <div className="flex flex-col min-h-0 flex-1 lg:flex-none lg:w-[60%] lg:border-r">
                {/* Прогресс-бар — компактный */}
                <div className="shrink-0 px-5 pt-3 pb-2">
                  <div className="flex items-center">
                    {stepLabels.map((_, i) => (
                      <div key={i} className={`flex items-center ${i < stepLabels.length - 1 ? 'flex-1' : ''}`}>
                        <button
                          type="button"
                          onClick={() => { if (editAppt || duplicateFrom || i < mobileStep || mobileStepCanNext.slice(0, i).every(Boolean)) setMobileStep(i) }}
                          className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 transition-all ${
                            i === mobileStep
                              ? 'bg-primary text-primary-foreground scale-110'
                              : i < mobileStep
                                ? 'bg-primary/20 text-primary'
                                : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {i + 1}
                        </button>
                        {i < stepLabels.length - 1 && (
                          <div className={`flex-1 h-0.5 mx-1 rounded-full transition-colors ${i < mobileStep ? 'bg-primary/40' : 'bg-muted'}`} />
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Название текущего шага */}
                  <p className="text-xs font-semibold text-primary mt-1.5">{stepLabels[mobileStep]}</p>
                </div>

                {/* Контент шага */}
                <div key={mobileStep} className={`flex-1 overflow-y-auto px-5 pb-3 space-y-4 ${stepDir === 'forward' ? 'animate-slide-from-right' : 'animate-slide-from-left'}`}>
                  {/* Шаг 0 — Услуга */}
                  {mobileStep === 0 && servicesBlock}

                  {/* Шаг 1 — Дата + Время (объединены) */}
                  {mobileStep === 1 && (
                    <>
                      <section>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {t('appointments.date')}
                            {selectedDate && (
                              <span className="ml-2 font-normal normal-case text-foreground/70">
                                {dayjs(selectedDate).format('D MMM, dddd')}
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-1">
                            <button type="button"
                              onClick={() => setWeekStart(w => w.subtract(1, 'week'))}
                              disabled={weekStart.isBefore(dayjs().startOf('isoWeek'))}
                              className="h-6 w-6 rounded-md border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-[11px] text-muted-foreground min-w-[90px] text-center">
                              {weekStart.format('D MMM')} — {weekStart.add(6, 'day').format('D MMM')}
                            </span>
                            <button type="button"
                              onClick={() => setWeekStart(w => w.add(1, 'week'))}
                              className="h-6 w-6 rounded-md border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day')).map(day => {
                            const dateStr = day.format('YYYY-MM-DD')
                            const isActive = selectedDate === dateStr
                            const isToday = dateStr === dayjs().format('YYYY-MM-DD')
                            const isPast = day.isBefore(dayjs(), 'day')
                            const isWeekend = day.day() === 0 || day.day() === 6
                            const isDayOff = schedule ? !(schedule[`${DOW_MAP[day.day()]}_enabled` as keyof Schedule] as boolean) : false
                            const disabled = isPast || isDayOff
                            return (
                              <button key={dateStr} type="button" disabled={disabled}
                                onClick={() => { if (disabled) return; setSelectedDate(dateStr); setSelectedTime(''); setSvcBlockedWarning(null) }}
                                className={`flex flex-col items-center py-2 rounded-xl border-2 text-center transition-all
                                  ${isActive ? 'border-primary bg-primary text-primary-foreground shadow-md scale-105'
                                    : disabled ? 'border-border bg-muted/30 opacity-35 cursor-not-allowed'
                                    : isToday ? 'border-primary/40 hover:border-primary/70'
                                    : isWeekend ? 'border-red-200 hover:border-red-400'
                                    : 'border-border hover:border-primary/50'}`}>
                                <div className={`text-[9px] font-bold uppercase leading-tight ${isActive ? 'text-primary-foreground/70' : isWeekend && !disabled ? 'text-red-500' : 'text-muted-foreground'}`}>{day.format('dd')}</div>
                                <div className={`font-bold text-sm leading-tight ${isActive ? 'text-primary-foreground' : isToday && !isActive ? 'text-primary' : isWeekend && !disabled ? 'text-red-500' : ''}`}>{day.format('D')}</div>
                                <div className={`text-[9px] leading-tight ${isActive ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{day.format('MMM')}</div>
                              </button>
                            )
                          })}
                        </div>
                      </section>

                      <section>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                          {t('appointments.time')}
                          {selectedSvcs.length === 0 && <span className="font-normal normal-case text-muted-foreground/60 text-[11px]">— {t('appointments.selectSvcForAccuracy')}</span>}
                          {totalDuration > 0 && <span className="font-normal normal-case text-muted-foreground">· {formatDuration(totalDuration, t)}</span>}
                          {slotsLoading && <span className="ml-auto"><div className="h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></span>}
                        </p>
                        <div className={`relative transition-opacity duration-150 ${slotsLoading ? 'opacity-40 pointer-events-none' : ''}`}>
                          {slots.length === 0 && !slotsLoading ? (
                            <p className="text-sm text-muted-foreground italic py-1">{t('schedule.dayOff')}</p>
                          ) : (
                            <>
                              <div className="flex items-center gap-3 mb-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded border-2 border-primary bg-primary/10 inline-block" />{t('booking.slotFree')}</span>
                                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded border border-border bg-muted inline-block" />{t('booking.slotBusy')}</span>
                              </div>
                              <div className="grid grid-cols-4 gap-1 max-h-[260px] overflow-y-auto pr-1">
                                {slots.map(slot => {
                                  const isChosen = selectedTime === slot.time
                                  const isDisabled = slot.busy
                                  return (
                                    <button key={slot.time} type="button"
                                      onClick={() => {
                                        if (isDisabled) return;
                                        setSelectedTime(slot.time);
                                        setSvcBlockedWarning(null);
                                        if (!editAppt && mobileStep === 1) {
                                          setStepDir('forward');
                                          setTimeout(() => setMobileStep(2), 300);
                                        }
                                      }}
                                      className={`py-1.5 rounded-lg border text-xs font-medium transition-all
                                        ${isDisabled ? 'border-border bg-muted/40 text-muted-foreground/40 cursor-not-allowed line-through'
                                          : isChosen ? 'border-primary bg-primary text-primary-foreground shadow-sm scale-105'
                                          : 'border-border hover:border-primary/60 hover:bg-primary/5 active:scale-95'}`}>
                                      {slot.time}
                                    </button>
                                  )
                                })}
                              </div>
                              {(() => {
                                const allBusy = slots.every(s => s.busy)
                                if (allBusy) return <p className="text-xs text-amber-600 mt-1.5">{t('appointments.allSlotsBusy')}</p>
                                const nextFree = selectedTime ? slots.find(s => !s.busy && s.time > selectedTime) : slots.find(s => !s.busy)
                                if (nextFree) return (
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <p className="text-xs text-muted-foreground">{selectedTime ? t('appointments.nextFree') : t('appointments.nearestFree')}:</p>
                                    <button type="button" onClick={() => {
                                      setSelectedTime(nextFree.time);
                                      if (!editAppt && mobileStep === 1) {
                                        setStepDir('forward');
                                        setTimeout(() => setMobileStep(2), 300);
                                      }
                                    }} className="text-xs font-semibold text-primary hover:underline">{nextFree.time}</button>
                                  </div>
                                )
                                return null
                              })()}
                            </>
                          )}
                        </div>
                      </section>
                    </>
                  )}

                  {/* Шаг 2 — Клиент + цена/детали (цена только на мобайле, на десктопе — в правой панели) */}
                  {mobileStep === 2 && (
                    <>
                      {clientBlock}
                      <div className="lg:hidden space-y-3 border-t pt-3">
                        <div className="space-y-1">
                          <div className="relative">
                            <Input type="number" min={0} className="h-14 w-full pr-16"
                              style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}
                              placeholder={totalBasePrice > 0 ? String(totalBasePrice) : t('appointments.pricePlaceholder')}
                              value={priceInput} onChange={e => setPriceInput(e.target.value)} />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base font-medium text-muted-foreground pointer-events-none select-none">{currencySymbol}</span>
                          </div>
                          {(effectiveDiscount > 0 || effectiveSurcharge > 0) && basePrice > 0 && (
                            <div className="flex items-center justify-end gap-1.5 px-1">
                              <span className="text-xs text-muted-foreground line-through">{formatCurrency(basePrice, currency, i18n.language)}</span>
                              <span className="text-xs">→</span>
                              <span className={`text-sm font-semibold ${effectiveSurcharge > 0 ? 'text-orange-500' : 'text-emerald-600'}`}>{formatCurrency(finalPrice, currency, i18n.language)}</span>
                            </div>
                          )}
                        </div>
                        {tabsContent}
                      </div>
                    </>
                  )}
                </div>

                {/* Итоговая мини-плашка — если дата+время выбраны */}
                {selectedDate && selectedTime && mobileStep === 2 && (
                  <div className="shrink-0 mx-5 mb-2 rounded-xl border bg-muted/30 px-3 py-2 flex items-center gap-2 text-xs">
                    <CalendarCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="font-medium text-foreground">{dayjs(selectedDate).format('D MMM')}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{selectedTime}</span>
                    {totalDuration > 0 && <span className="text-muted-foreground">→ {minutesToTime(parseTimeToMinutes(selectedTime) + totalDuration)}</span>}
                  </div>
                )}

                {/* Тулбар действий для режима редактирования */}
                {editAppt && (
                  <div className="shrink-0 px-5 pb-2 pt-2 flex items-center gap-1.5 border-t">
                    {onDelete && (
                      <Button type="button" size="sm" variant="destructive" className="h-7 text-xs shrink-0" onClick={onDelete}>
                        {t('common.delete')}
                      </Button>
                    )}
                    {!isReschedule && onDuplicate && (
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0" onClick={onDuplicate}>
                        <Copy className="h-3 w-3" />{t('appointments.duplicate')}
                      </Button>
                    )}
                    {!isReschedule ? (
                      <Button type="button" size="sm" variant="outline"
                        className="h-7 text-xs gap-1 shrink-0 text-amber-600 border-amber-200 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                        onClick={() => { setIsReschedule(true); setSelectedTime(''); setStepDir('forward'); setMobileStep(1); }}>
                        <ArrowRightLeft className="h-3 w-3" />{t('appointments.reschedule')}
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1 ml-auto shrink-0 text-muted-foreground"
                        onClick={() => { setIsReschedule(false); setSelectedTime(editAppt.start_time); setMobileStep(0); }}>
                        <X className="h-3 w-3" />{t('appointments.rescheduleCancel')}
                      </Button>
                    )}
                    {!isReschedule && (
                      <Button type="button" variant="outline" className="h-7 w-7 p-0 ml-auto shrink-0"
                        onClick={() => printReceipt({ appointment: editAppt, masterName: user?.name || '', services: selectedSvcs, currency })}>
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}

                {/* Мобайл-футер: кнопки Назад / Далее / Сохранить */}
                <div className="lg:hidden shrink-0 border-t px-5 py-3 flex items-center gap-2">
                  {mobileStep > 0 ? (
                    <Button type="button" variant="outline" onClick={() => { setStepDir('back'); setMobileStep(s => s - 1) }} className="gap-1">
                      <ChevronLeft className="h-4 w-4" />{t('common.back') || 'Назад'}
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
                  )}

                  {mobileStep < MOBILE_STEPS - 1 ? (
                    <Button type="button" className="ml-auto gap-1"
                      disabled={!mobileStepCanNext[mobileStep]}
                      onClick={() => { setStepDir('forward'); setMobileStep(s => s + 1) }}>
                      {t('common.next') || 'Далее'}<ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="button" className="ml-auto" loading={isLoading} disabled={!canSave || isLoading} onClick={handleSubmit}>
                      {t('common.save')}
                    </Button>
                  )}
                </div>
                </div>{/* end left column */}

                {/* Правая панель: live summary (только десктоп) */}
                <div className="hidden lg:flex flex-col w-[40%] overflow-y-auto bg-muted/20">
                  <div className="px-5 py-3 border-b shrink-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('appointments.summary')}</p>
                  </div>
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                    {/* Услуги */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        {t('appointments.service')}
                        {totalDuration > 0 && <span className="font-normal normal-case text-muted-foreground/60">· {formatDuration(totalDuration, t)}</span>}
                      </p>
                      {selectedSvcs.length === 0 ? (
                        <p className="text-sm text-muted-foreground/40 italic">—</p>
                      ) : (
                        <div className="space-y-1.5">
                          {selectedSvcs.map(svc => (
                            <div key={svc.id} className="flex items-start justify-between gap-2">
                              <span className="text-sm text-foreground leading-snug">{svc.name}</span>
                              <div className="shrink-0 text-right text-xs text-muted-foreground">
                                <div>{formatDuration(svc.duration_min, t)}</div>
                                {svc.price > 0 && <div className="font-medium text-foreground">{formatCurrency(svc.price, currency, i18n.language)}</div>}
                              </div>
                            </div>
                          ))}
                          {selectedSvcs.length > 1 && totalBasePrice > 0 && (
                            <div className="flex items-center justify-between text-xs font-semibold pt-1.5 border-t text-foreground/80">
                              <span>{t('appointments.total')}</span>
                              <span>{formatCurrency(totalBasePrice, currency, i18n.language)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Дата / Время */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                        {t('appointments.date')} / {t('appointments.time')}
                      </p>
                      <p className="text-sm font-medium text-foreground">{dayjs(selectedDate).format('D MMM, dddd')}</p>
                      {selectedTime ? (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {selectedTime}
                          {totalDuration > 0 && <span className="text-muted-foreground/60"> → {minutesToTime(parseTimeToMinutes(selectedTime) + totalDuration)}</span>}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/40 italic mt-0.5">{t('appointments.time')}...</p>
                      )}
                    </div>

                    {/* Клиент */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                        {t('appointments.client')}
                      </p>
                      {selectedClient ? (
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-primary font-semibold text-xs">
                            {selectedClient.first_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{selectedClient.first_name} {selectedClient.last_name || ''}</p>
                            {selectedClient.phone && <p className="text-xs text-muted-foreground">{selectedClient.phone}</p>}
                          </div>
                        </div>
                      ) : guestName ? (
                        <p className="text-sm text-foreground">{guestName}{guestPhone && <span className="text-xs text-muted-foreground ml-1.5">{guestPhone}</span>}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground/40 italic">{t('appointments.guestClient')}</p>
                      )}
                    </div>

                    {/* Цена + детали */}
                    <div className="pt-3 border-t space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('appointments.total')}</p>
                      <div className="space-y-1">
                        <div className="relative">
                          <Input type="number" min={0} className="h-12 w-full text-2xl font-bold pr-14"
                            placeholder={totalBasePrice > 0 ? String(totalBasePrice) : t('appointments.pricePlaceholder')}
                            value={priceInput} onChange={e => setPriceInput(e.target.value)} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">{currencySymbol}</span>
                        </div>
                        {(effectiveDiscount > 0 || effectiveSurcharge > 0) && basePrice > 0 && (
                          <div className="flex items-center justify-end gap-1.5 px-1">
                            <span className="text-xs text-muted-foreground line-through">{formatCurrency(basePrice, currency, i18n.language)}</span>
                            <span className="text-xs">→</span>
                            <span className={`text-sm font-semibold ${effectiveSurcharge > 0 ? 'text-orange-500' : 'text-emerald-600'}`}>{formatCurrency(finalPrice, currency, i18n.language)}</span>
                          </div>
                        )}
                      </div>
                      {tabsContent}
                    </div>

                    {/* Баннер: ожидает подтверждения (десктоп) */}
                    {editAppt?.booked_via === 'online' && !editAppt.confirmed_at && editAppt.status === 'scheduled' && !isConfirmedLocally && (
                      <div className="pt-3 border-t">
                        <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 flex items-start gap-2.5">
                          <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Ожидает подтверждения</p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Онлайн-запись от клиента</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            className="shrink-0 h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                            onClick={async () => {
                              await confirm.mutateAsync(editAppt.id)
                              setIsConfirmedLocally(true)
                              toast.success('Запись подтверждена')
                            }}
                            disabled={confirm.isPending}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Подтвердить
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Статус (только редактирование) */}
                    {editAppt && (
                      <div className="pt-3 border-t space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('appointments.statusLabel')}</p>
                        <div className="grid grid-cols-2 gap-1">
                          {([
                            { value: 'scheduled', label: t('appointments.status.scheduled'), color: 'text-blue-500 border-blue-500/40 bg-blue-500/10' },
                            { value: 'done',      label: t('appointments.status.done'),      color: 'text-emerald-500 border-emerald-500/40 bg-emerald-500/10' },
                            { value: 'cancelled', label: t('appointments.status.cancelled'), color: 'text-red-500 border-red-500/40 bg-red-500/10' },
                            { value: 'no_show',   label: t('appointments.status.no_show'),   color: 'text-amber-500 border-amber-500/40 bg-amber-500/10' },
                          ] as const).map(opt => (
                            <button key={opt.value} type="button"
                              onClick={() => setStatus(opt.value)}
                              className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-all text-left ${
                                status === opt.value
                                  ? opt.color
                                  : 'border-border text-muted-foreground hover:bg-muted/60'
                              }`}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Clinic visit record (mobile) */}
                    {PRODUCT === 'clinic' && editAppt && (editAppt.status === 'done' || status === 'done') && (
                      <ClinicVisitPanel appointmentId={editAppt.id} clientId={selectedClient?.id} />
                    )}

                  </div>

                  {/* Навигация: Далее / Сохранить */}
                  <div className="shrink-0 border-t px-5 py-3">
                    {mobileStep < MOBILE_STEPS - 1 ? (
                      <Button type="button" className="w-full gap-1"
                        disabled={!mobileStepCanNext[mobileStep]}
                        onClick={() => { setStepDir('forward'); setMobileStep(s => s + 1) }}>
                        {t('common.next') || 'Далее'}<ChevronRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button type="button" className="w-full" loading={isLoading} disabled={!canSave} onClick={handleSubmit}>
                        {t('common.save')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>{/* end mobile wizard */}

              {/* ── БОЛЬШОЙ ДЕСКТОП (≥ lg) ─── */}
              <div className="hidden lg:flex flex-col flex-1 overflow-hidden">
                {/* 3 колонки */}
                <div className="flex-1 flex overflow-hidden divide-x">

                  {/* ── КОЛ 1: УСЛУГИ (28%) ── */}
                  <div className="flex flex-col w-[28%] overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-3">
                      {servicesBlock}
                    </div>
                    {selectedSvcs.length > 0 && (
                      <div className="shrink-0 border-t px-4 py-2 bg-muted/20 text-xs text-muted-foreground flex items-center gap-3">
                        <span className="font-medium text-foreground">{selectedSvcs.length} усл.</span>
                        {totalDuration > 0 && <span>· {formatDuration(totalDuration, t)}</span>}
                        {totalBasePrice > 0 && <span className="ml-auto font-semibold text-foreground">{formatCurrency(totalBasePrice, currency, i18n.language)}</span>}
                      </div>
                    )}
                  </div>

                  {/* ── КОЛ 2: ДАТА + ВРЕМЯ (38%) ── */}
                  <div className="flex flex-col w-[38%] overflow-hidden">
                    {/* Месячный мини-календарь */}
                    <div className="px-4 pt-3 pb-2 shrink-0">
                      {/* Навигация месяц */}
                      <div className="flex items-center justify-between mb-2">
                        <button type="button"
                          onClick={() => setDesktopMonth(m => m.subtract(1, 'month'))}
                          disabled={desktopMonth.isBefore(dayjs().startOf('month'))}
                          className="h-7 w-7 rounded-md border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-sm font-semibold capitalize">
                          {desktopMonth.format('MMMM YYYY')}
                        </span>
                        <button type="button"
                          onClick={() => setDesktopMonth(m => m.add(1, 'month'))}
                          className="h-7 w-7 rounded-md border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* Заголовки дней недели */}
                      <div className="grid grid-cols-7 mb-1">
                        {Array.from({length: 7}, (_, i) => dayjs().startOf('isoWeek').add(i, 'day').format('dd')).map((d, i) => (
                          <div key={i} className="text-center text-[10px] text-muted-foreground py-0.5">{d}</div>
                        ))}
                      </div>
                      {/* Ячейки дней */}
                      <div className="grid grid-cols-7 gap-0.5">
                        {desktopMonthDays.map((d, i) => {
                          if (!d) return <div key={`e${i}`} />
                          const dateStr    = d.format('YYYY-MM-DD')
                          const isToday    = d.isSame(dayjs(), 'day')
                          const isPast     = d.isBefore(dayjs(), 'day')
                          const isWeekend  = d.day() === 0 || d.day() === 6
                          const isWorking  = availableDates.includes(dateStr)
                          const isSelected = dateStr === selectedDate
                          return (
                            <button key={dateStr} type="button"
                              disabled={isPast || !isWorking}
                              onClick={() => { setSelectedDate(dateStr); setSelectedTime(''); setSvcBlockedWarning(null) }}
                              className={`h-8 w-full text-xs rounded-md transition-all font-medium
                                ${isSelected
                                  ? 'bg-primary text-primary-foreground scale-105'
                                  : isToday && !isSelected
                                    ? 'ring-1 ring-primary text-primary hover:bg-muted cursor-pointer'
                                    : isPast || !isWorking
                                      ? 'opacity-30 cursor-not-allowed'
                                      : isWeekend
                                        ? 'text-red-500 hover:bg-muted cursor-pointer'
                                        : 'hover:bg-muted cursor-pointer'
                                }`}>
                              {d.date()}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Слоты времени */}
                    <div className="flex-1 overflow-y-auto border-t px-4 pt-3 pb-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                        {t('appointments.time')}
                        {totalDuration > 0 && <span className="font-normal normal-case text-muted-foreground">· {formatDuration(totalDuration, t)}</span>}
                        {slotsLoading && <span className="ml-auto"><div className="h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></span>}
                      </p>
                      <div className={`relative transition-opacity duration-150 ${slotsLoading ? 'opacity-40 pointer-events-none' : ''}`}>
                        {slots.length === 0 && !slotsLoading ? (
                          <p className="text-sm text-muted-foreground italic py-1">{t('schedule.dayOff')}</p>
                        ) : (
                          <>
                            <div className="grid grid-cols-5 gap-1">
                              {slots.map(slot => {
                                const isChosen   = selectedTime === slot.time
                                const isDisabled = slot.busy
                                return (
                                  <button key={slot.time} type="button"
                                    onClick={() => { if (isDisabled) return; setSelectedTime(slot.time); setSvcBlockedWarning(null) }}
                                    className={`py-1.5 rounded-lg border text-xs font-medium transition-all
                                      ${isDisabled
                                        ? 'border-border bg-muted/40 text-muted-foreground/40 cursor-not-allowed line-through'
                                        : isChosen
                                          ? 'border-primary bg-primary text-primary-foreground shadow-sm scale-105'
                                          : 'border-border hover:border-primary/60 hover:bg-primary/5 active:scale-95'
                                      }`}>
                                    {slot.time}
                                  </button>
                                )
                              })}
                            </div>
                            {(() => {
                              const allBusy = slots.every(s => s.busy)
                              if (allBusy) return <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">{t('appointments.allSlotsBusy')}</p>
                              const nextFree = selectedTime
                                ? slots.find(s => !s.busy && s.time > selectedTime)
                                : slots.find(s => !s.busy)
                              if (nextFree) return (
                                <div className="flex items-center gap-2 mt-1.5">
                                  <p className="text-xs text-muted-foreground">
                                    {selectedTime ? t('appointments.nextFree') : t('appointments.nearestFree')}:
                                  </p>
                                  <button type="button"
                                    onClick={() => setSelectedTime(nextFree.time)}
                                    className="text-xs font-semibold text-primary hover:underline">
                                    {nextFree.time}
                                  </button>
                                </div>
                              )
                              return null
                            })()}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── КОЛ 3: КЛИЕНТ + ОПЛАТА (34%) ── */}
                  <div className="flex flex-col w-[34%] overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">

                      {/* Клиент */}
                      {clientBlock}

                      {/* Цена */}
                      <div className="space-y-1 pt-2 border-t">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                          {t('appointments.total')}
                        </p>
                        <div className="relative">
                          <Input type="number" min={0}
                            className="h-12 w-full text-2xl font-bold pr-14"
                            placeholder={totalBasePrice > 0 ? String(totalBasePrice) : t('appointments.pricePlaceholder')}
                            value={priceInput} onChange={e => setPriceInput(e.target.value)} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">{currencySymbol}</span>
                        </div>
                        {(effectiveDiscount > 0 || effectiveSurcharge > 0) && basePrice > 0 && (
                          <div className="flex items-center justify-end gap-1.5 px-1">
                            <span className="text-xs text-muted-foreground line-through">{formatCurrency(basePrice, currency, i18n.language)}</span>
                            <span className="text-xs">→</span>
                            <span className={`text-sm font-semibold ${effectiveSurcharge > 0 ? 'text-orange-500' : 'text-emerald-600'}`}>{formatCurrency(finalPrice, currency, i18n.language)}</span>
                          </div>
                        )}
                      </div>

                      {/* Скидка / Наценка */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex rounded-lg border overflow-hidden shrink-0">
                            <button type="button" onClick={() => handleModeSwitch('discount')}
                              className={`px-3 h-7 text-xs font-medium transition-all border-r ${adjustMode === 'discount' ? 'bg-emerald-500 text-white' : 'bg-background text-muted-foreground hover:text-emerald-600'}`}>
                              {t('appointments.discount')}
                            </button>
                            <button type="button" onClick={() => handleModeSwitch('surcharge')}
                              className={`px-3 h-7 text-xs font-medium transition-all ${adjustMode === 'surcharge' ? 'bg-orange-500 text-white' : 'bg-background text-muted-foreground hover:text-orange-500'}`}>
                              {t('appointments.surcharge')}
                            </button>
                          </div>
                          <span className={`text-sm font-semibold ${effectiveSurcharge > 0 ? 'text-orange-500' : effectiveDiscount > 0 ? 'text-emerald-600' : 'text-muted-foreground/40'}`}>
                            {effectiveSurcharge > 0 ? `+${effectiveSurcharge}%` : effectiveDiscount > 0 ? `−${effectiveDiscount}%` : adjustMode === 'discount' ? '−%' : '+%'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {PRESETS.map(p => (
                            <button key={p} type="button" onClick={() => handlePresetClick(p)}
                              className={`h-7 px-2 rounded-lg border text-xs font-medium transition-all flex-1 ${activePreset === p ? adjustMode === 'discount' ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-orange-500 border-orange-500 text-white' : adjustMode === 'discount' ? 'border-border hover:border-emerald-400 hover:text-emerald-600' : 'border-border hover:border-orange-400 hover:text-orange-500'}`}>
                              {p}%
                            </button>
                          ))}
                          <div className="relative flex-1">
                            <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                            <Input type="number" min={0} max={100}
                              className="h-7 w-full pr-6 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="0" value={customAdjust} onChange={e => handleCustomChange(e.target.value)} />
                          </div>
                        </div>
                      </div>

                      {/* Способ оплаты */}
                      <div className="grid grid-cols-2 gap-1">
                        {([
                          { key: 'cash',     label: t('appointments.paymentCash') },
                          { key: 'card',     label: t('appointments.paymentCard') },
                          { key: 'transfer', label: t('appointments.paymentTransfer') },
                          { key: 'other',    label: t('appointments.paymentOther') },
                        ] as const).map(m => (
                          <button key={m.key} type="button"
                            onClick={() => setPaymentMethod(paymentMethod === m.key ? '' : m.key)}
                            className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${paymentMethod === m.key ? 'bg-primary/10 text-primary' : 'bg-muted/40 text-muted-foreground hover:bg-muted'}`}>
                            {m.label}
                          </button>
                        ))}
                      </div>

                      {/* Заметки */}
                      {showNotes && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                            {t('appointments.tabNote')}
                          </p>
                          <Textarea rows={2} className="text-sm resize-none min-h-0"
                            placeholder={t('booking.commentPlaceholder')}
                            value={notes} onChange={e => setNotes(e.target.value)} />
                        </div>
                      )}

                      {/* TG уведомление + Повтор */}
                      {!editAppt && (hasTelegram || showRecurring) && (
                        <div className="space-y-2 pt-1 border-t">
                          {hasTelegram && (
                            <div className="flex items-center justify-between">
                              <p className="text-xs">{t('appointments.notifyTelegram')}</p>
                              <Switch checked={notifyTg} onCheckedChange={setNotifyTg} />
                            </div>
                          )}
                          {showRecurring && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium">{t('appointments.recurring')}</p>
                                <Switch checked={recurring} onCheckedChange={setRecurring} />
                              </div>
                              {recurring && (
                                <div className="flex items-center gap-2">
                                  <p className="text-xs text-muted-foreground shrink-0">{t('appointments.recurringWeeks')}</p>
                                  <Input type="number" min={2} max={52} className="w-20 h-7 text-xs"
                                    value={recurringWeeks} onChange={e => setRecurringWeeks(Number(e.target.value))} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Статус (только редактирование) */}
                      {editAppt && (
                        <div className="space-y-2 pt-2 border-t">
                          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('appointments.statusLabel')}</p>
                          <div className="grid grid-cols-2 gap-1">
                            {([
                              { value: 'scheduled', label: t('appointments.status.scheduled'), color: 'text-blue-500 border-blue-500/40 bg-blue-500/10' },
                              { value: 'done',      label: t('appointments.status.done'),      color: 'text-emerald-500 border-emerald-500/40 bg-emerald-500/10' },
                              { value: 'cancelled', label: t('appointments.status.cancelled'), color: 'text-red-500 border-red-500/40 bg-red-500/10' },
                              { value: 'no_show',   label: t('appointments.status.no_show'),   color: 'text-amber-500 border-amber-500/40 bg-amber-500/10' },
                            ] as const).map(opt => (
                              <button key={opt.value} type="button"
                                onClick={() => setStatus(opt.value)}
                                className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-all text-left ${
                                  status === opt.value ? opt.color : 'border-border text-muted-foreground hover:bg-muted/60'
                                }`}>
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Баннер онлайн-подтверждения */}
                      {editAppt?.booked_via === 'online' && !editAppt.confirmed_at && editAppt.status === 'scheduled' && !isConfirmedLocally && (
                        <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 flex items-start gap-2.5">
                          <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Ожидает подтверждения</p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Онлайн-запись от клиента</p>
                          </div>
                          <Button type="button" size="sm"
                            className="shrink-0 h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                            onClick={async () => {
                              await confirm.mutateAsync(editAppt.id)
                              setIsConfirmedLocally(true)
                              toast.success('Запись подтверждена')
                            }}
                            disabled={confirm.isPending}>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Подтвердить
                          </Button>
                        </div>
                      )}

                    </div>
                  </div>

                </div>{/* end 3 columns */}

                {/* ── Clinic visit record (clinic only) ── */}
                {PRODUCT === 'clinic' && editAppt && (editAppt.status === 'done' || status === 'done') && (
                  <div className="px-4 pb-2">
                    <ClinicVisitPanel appointmentId={editAppt.id} clientId={selectedClient?.id} />
                  </div>
                )}

                {/* ── ФУТЕР ДЕСКТОПА ── */}
                <div className="shrink-0 border-t px-4 py-3 flex items-center justify-between bg-background">
                  <div className="flex items-center gap-2">
                    {editAppt && onDelete && (
                      <Button type="button" size="sm" variant="destructive" className="gap-1" onClick={onDelete}>
                        {t('common.delete')}
                      </Button>
                    )}
                    {editAppt && onDuplicate && !isReschedule && (
                      <Button type="button" size="sm" variant="outline" className="gap-1" onClick={onDuplicate}>
                        <Copy className="h-3.5 w-3.5" />{t('appointments.duplicate')}
                      </Button>
                    )}
                    {editAppt && !isReschedule && (
                      <Button type="button" size="sm" variant="outline"
                        className="gap-1 text-amber-600 border-amber-200 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                        onClick={() => setIsReschedule(true)}>
                        <ArrowRightLeft className="h-3.5 w-3.5" />{t('appointments.reschedule')}
                      </Button>
                    )}
                    {editAppt && isReschedule && (
                      <Button type="button" size="sm" variant="outline"
                        className="gap-1 text-muted-foreground"
                        onClick={() => { setIsReschedule(false); setSelectedTime(editAppt.start_time) }}>
                        <X className="h-3.5 w-3.5" />{t('appointments.rescheduleCancel')}
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editAppt && !isReschedule && (
                      <Button type="button" variant="outline" className="h-8 w-8 p-0"
                        onClick={() => printReceipt({ appointment: editAppt, masterName: user?.name || '', services: selectedSvcs, currency })}>
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button type="button" loading={isLoading} disabled={!canSave} onClick={handleSubmit}>
                      {t('common.save')}
                    </Button>
                  </div>
                </div>

              </div>{/* end desktop */}

            </>
          )
        })()}

      </DialogContent>
    </Dialog>
  )
}
