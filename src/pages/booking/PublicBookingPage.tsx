import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Clock, MapPin, CheckCircle, ChevronLeft, ChevronRight, Zap, Send as SendIcon, Search, Check, X, ExternalLink, Tag, Star, BanIcon, CalendarDays, UserCircle, Phone, MessageCircle } from 'lucide-react'
import dayjs from 'dayjs'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { formatCurrency, formatDuration, parseTimeToMinutes, minutesToTime, getFileUrl } from '@/lib/utils'
import type { MasterProfile, Service, Schedule, ScheduleBreak, Appointment, Review, DateBlock } from '@/types'
import { isTelegramMiniApp, getTelegramUser, getTelegramUserId, hapticSuccess, buildClientCabinetLink } from '@/lib/telegramWebApp'
import { validatePromoCode } from '@/hooks/usePromoCodes'
import { getThemeVars } from '@/lib/bookingThemes'

const clientSchema = z.object({
  client_name: z.string().min(2),
  client_phone: z.string().min(5),
  client_email: z.string().email().optional().or(z.literal('')),
  client_telegram: z.string().optional(),
  notes: z.string().optional(),
})
type ClientFormValues = z.infer<typeof clientSchema>

interface PublicMaster extends MasterProfile {
  expand?: { user: { name: string; avatar?: string; email: string; id: string } }
}

// Слот с флагом занятости
type BusyReason = 'break' | 'appointment' | 'outOfBounds' | null
interface SlotInfo {
  time: string
  busy: boolean
  reason: BusyReason
}

export function PublicBookingPage() {
  const { t, i18n } = useTranslation()
  const { masterId } = useParams<{ masterId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const fromTeam = searchParams.get('team') // slug команды для кнопки "Назад"
  const canGoBack = fromTeam || (typeof window !== 'undefined' && window.history.length > 1)

  // step: 1 = услуги, 2 = дата+время, 3 = данные клиента
  const [step, setStep] = useState(1)
  const [master, setMaster] = useState<PublicMaster | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [breaks, setBreaks] = useState<ScheduleBreak[]>([])
  const [loading, setLoading] = useState(true)

  // Мультивыбор услуг
  const [selectedServices, setSelectedServices] = useState<Service[]>([])
  const [serviceSearch, setServiceSearch] = useState('')

  // Главные вкладки страницы
  const [mainTab, setMainTab] = useState<'booking' | 'about'>('booking')

  // Дата + время
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [slots, setSlots] = useState<SlotInfo[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  // Занятые дни (нет ни одного свободного слота для выбранных услуг)
  const [fullyBookedDates, setFullyBookedDates] = useState<Set<string>>(new Set())
  const [allPeriodAppts, setAllPeriodAppts] = useState<Appointment[]>([])
  // Текущий месяц в мини-календаре
  const [calendarMonth, setCalendarMonth] = useState(() => dayjs().startOf('month'))
  // Раскрытый/свёрнутый календарь (по умолчанию свёрнут — показывает только 1 неделю)
  const [calendarExpanded, setCalendarExpanded] = useState(false)

  const [submitted, setSubmitted] = useState(false)
  const [bookingDetails, setBookingDetails] = useState<any>(null)
  const [confirming, setConfirming] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [tgUserId, setTgUserId] = useState("") // Telegram user ID для Mini App

  // Date blocks
  const [dateBlocks, setDateBlocks] = useState<DateBlock[]>([])

  // Promo code
  const [promoInput, setPromoInput] = useState('')
  const [promoApplied, setPromoApplied] = useState<{ code: string; discountAmount: number; type: 'percent' | 'fixed'; value: number } | null>(null)
  const [promoError, setPromoError] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)

  // Telegram safe-area top inset (чтобы контент не уходил под нативную шапку)
  const [tgTopPadding, setTgTopPadding] = useState(0)

  // Reviews
  const [reviews, setReviews] = useState<Review[]>([])

  // Review form (shown after booking)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
  })
  const watchedName = watch('client_name', '')
  const watchedPhone = watch('client_phone', '')
  const step3Ready = (watchedName?.length ?? 0) >= 2 && (watchedPhone?.length ?? 0) >= 5

  // Инициализация Telegram Mini App и авто-заполнение данных клиента
  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg) return

    // Страница бронирования: НЕ вызываем requestFullscreen() —
    // клиенту нужна нативная кнопка «× Закрыть» от Telegram.
    // expand() просто разворачивает на всю высоту, не скрывая шапку.
    tg.ready()
    tg.expand()

    // Отступ сверху нужен ТОЛЬКО в fullscreen-режиме (requestFullscreen).
    // В expand()-режиме Telegram сам рисует шапку выше WebView — отступ не нужен.
    const updatePadding = () => {
      if (!tg.isFullscreen) {
        setTgTopPadding(0)
        return
      }
      const safe = tg.safeAreaInset?.top ?? 0
      const content = tg.contentSafeAreaInset?.top ?? 0
      const total = safe + content
      // Fallback 60px на старых версиях Telegram, где API возвращает 0
      setTgTopPadding(total > 0 ? total : 60)
    }
    // Небольшая задержка: дать Telegram время обновить safe area после expand()
    const timer = setTimeout(updatePadding, 100)
    tg.onEvent('safeAreaChanged', updatePadding)
    tg.onEvent('contentSafeAreaChanged', updatePadding)
    tg.onEvent('fullscreenChanged', updatePadding)

    const tgUser = getTelegramUser()
    const tgId = getTelegramUserId()
    if (tgUser) {
      const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ')
      setValue('client_name', fullName)
    }
    if (tgId) setTgUserId(tgId)

    return () => {
      clearTimeout(timer)
      tg.offEvent('safeAreaChanged', updatePadding)
      tg.offEvent('contentSafeAreaChanged', updatePadding)
      tg.offEvent('fullscreenChanged', updatePadding)
    }
  }, [])

  useEffect(() => {
    loadMasterData()
  }, [masterId])

  const loadMasterData = async () => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('master_profiles')
        .select('*, user:users(id, name, email)')
        .eq('booking_slug', masterId)
        .eq('is_public', true)
        .maybeSingle()

      if (profileError || !profile) {
        setLoading(false)
        return
      }

      // Normalise to match PocketBase expand shape
      const profileWithExpand: PublicMaster = {
        ...(profile as any),
        expand: profile.user ? { user: profile.user as any } : undefined,
      }
      setMaster(profileWithExpand)

      // user_id — прямой UUID из master_profiles (всегда доступен anon)
      // user?.id — из JOIN с users (нужна RLS политика users_public_master_read)
      const userId = (profile as any).user_id ?? (profile as any).user?.id

      const [svcsRes, schedRes, bksRes, blocksRes, revsRes] = await Promise.all([
        supabase
          .from('services')
          .select('*')
          .eq('master_id', userId)
          .eq('is_bookable', true)
          .eq('is_active', true)
          .order('order')
          .order('name'),
        supabase
          .from('schedules')
          .select('*')
          .eq('master_id', userId)
          .maybeSingle(),
        supabase
          .from('schedule_breaks')
          .select('*')
          .eq('master_id', userId),
        supabase
          .from('date_blocks')
          .select('*')
          .eq('master_id', userId)
          .order('date_from'),
        supabase
          .from('reviews')
          .select('*')
          .eq('master_id', userId)
          .eq('is_visible', true)
          .order('created', { ascending: false }),
      ])

      setServices((svcsRes.data ?? []) as Service[])
      setSchedule((schedRes.data ?? null) as Schedule | null)
      setBreaks((bksRes.data ?? []) as ScheduleBreak[])
      setDateBlocks((blocksRes.data ?? []) as DateBlock[])
      setReviews((revsRes.data ?? []) as Review[])
    } catch {
      // Master not found or not public
    } finally {
      setLoading(false)
    }
  }

  const DOW_MAP: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' }

  // Суммарная длительность выбранных услуг
  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.duration_min, 0),
    [selectedServices]
  )
  // Суммарная цена до скидки
  const basePrice = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.price, 0),
    [selectedServices]
  )
  // Итоговая цена с учётом промокода
  const totalPrice = useMemo(
    () => Math.max(0, basePrice - (promoApplied?.discountAmount ?? 0)),
    [basePrice, promoApplied]
  )

  // Фильтрованный список услуг по поиску
  const filteredServices = useMemo(() => {
    const q = serviceSearch.toLowerCase().trim()
    if (!q) return services
    return services.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q)
    )
  }, [services, serviceSearch])

  const toggleService = (svc: Service) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === svc.id)
      if (exists) return prev.filter(s => s.id !== svc.id)
      return [...prev, svc]
    })
  }

  const handleApplyPromo = async () => {
    if (!promoInput.trim() || !master) return
    setPromoLoading(true)
    setPromoError('')
    const result = await validatePromoCode(master.user, promoInput.trim(), basePrice)
    setPromoLoading(false)
    if (result.valid && result.promo && result.discountAmount !== undefined) {
      setPromoApplied({
        code: result.promo.code,
        discountAmount: result.discountAmount,
        type: result.promo.discount_type,
        value: result.promo.discount_value,
      })
    } else {
      setPromoError(result.error || 'Промокод не найден')
    }
  }

  const handleSubmitReview = async () => {
    if (!master || reviewRating === 0) return
    setReviewSubmitting(true)
    try {
      await supabase.from('reviews').insert({
        master: master.user,
        rating: reviewRating,
        comment: reviewComment,
        client_name: bookingDetails?.clientName || '',
        telegram_id: tgUserId || '',
        is_visible: true,
      })
      setReviewSubmitted(true)
    } catch {
      // ignore
    } finally {
      setReviewSubmitting(false)
    }
  }

  // Вычислить все слоты дня (свободные и занятые)
  const computeAllSlots = async (date: string): Promise<SlotInfo[]> => {
    if (!schedule || !master || totalDuration === 0) return []
    const dow = dayjs(date).day()
    const dayKey = DOW_MAP[dow] as any
    const enabled = schedule[`${dayKey}_enabled` as keyof Schedule]
    if (!enabled) return []

    const start = parseTimeToMinutes(schedule[`${dayKey}_start` as keyof Schedule] as string)
    const end = parseTimeToMinutes(schedule[`${dayKey}_end` as keyof Schedule] as string)
    const slotDur = schedule.slot_duration || 30

    // Генерируем все слоты с интервалом slotDur
    const allTimes: number[] = []
    for (let t = start; t + slotDur <= end; t += slotDur) {
      allTimes.push(t)
    }

    // Перерывы
    const dayBreaks = breaks.filter(b => b.day_of_week === dow)

    // Занятые записи
    let existingAppts: Appointment[] = []
    try {
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('master_id', (master as any).user_id)
        .eq('date', date)
        .neq('status', 'cancelled')
      existingAppts = (data ?? []) as Appointment[]
    } catch {}

    return allTimes.map(t => {
      // Слот занят перерывом
      const breakBusy = dayBreaks.some(b => {
        const bs = parseTimeToMinutes(b.start_time)
        const be = parseTimeToMinutes(b.end_time)
        return t >= bs && t < be
      })
      // Слот занят — нельзя уместить totalDuration без пересечения с записями или выходом за конец дня
      const apptBusy = existingAppts.some(a => {
        const as_ = parseTimeToMinutes(a.start_time)
        const ae = parseTimeToMinutes(a.end_time)
        return t < ae && t + totalDuration > as_
      })
      const outOfBounds = t + totalDuration > end
      const busy = breakBusy || apptBusy || outOfBounds
      const reason: BusyReason = breakBusy ? 'break' : apptBusy ? 'appointment' : outOfBounds ? 'outOfBounds' : null

      return {
        time: minutesToTime(t),
        busy,
        reason,
      }
    })
  }

  const onDateSelect = async (date: string) => {
    setSelectedDate(date)
    setSelectedSlot('')
    // Обновляем calendarMonth чтобы свёрнутый вид отображал правильную неделю
    setCalendarMonth(dayjs(date).startOf('month'))
    setSlotsLoading(true)
    const result = await computeAllSlots(date)
    setSlots(result)
    setSlotsLoading(false)
  }

  // Вычислить занятые дни из уже загруженных записей
  const computeFullyBooked = (appts: Appointment[], duration: number) => {
    if (!schedule || !master || duration === 0) return new Set<string>()
    const booked = new Set<string>()
    for (const date of availableDates) {
      const dow = dayjs(date).day()
      const dayKey = DOW_MAP[dow] as any
      const enabled = schedule[`${dayKey}_enabled` as keyof Schedule]
      if (!enabled) continue
      const start = parseTimeToMinutes(schedule[`${dayKey}_start` as keyof Schedule] as string)
      const end = parseTimeToMinutes(schedule[`${dayKey}_end` as keyof Schedule] as string)
      const slotDur = schedule.slot_duration || 30
      const dayBreaks = breaks.filter(b => b.day_of_week === dow)
      const dayAppts = appts.filter(a => a.date === date)
      let hasFreeSLot = false
      for (let t = start; t + slotDur <= end; t += slotDur) {
        const breakBusy = dayBreaks.some(b => {
          const bs = parseTimeToMinutes(b.start_time)
          const be = parseTimeToMinutes(b.end_time)
          return t >= bs && t < be
        })
        if (breakBusy) continue
        if (t + duration > end) continue
        const apptBusy = dayAppts.some(a => {
          const as_ = parseTimeToMinutes(a.start_time)
          const ae = parseTimeToMinutes(a.end_time)
          return t < ae && t + duration > as_
        })
        if (!apptBusy) { hasFreeSLot = true; break }
      }
      if (!hasFreeSLot) booked.add(date)
    }
    return booked
  }

  // При переходе на шаг 2 — загрузить все записи за период и выбрать первую доступную дату

  useEffect(() => {
    if (step !== 2 || !master || !schedule) return
    const loadPeriodAppts = async () => {
      if (availableDates.length === 0) return
      const dateFrom = availableDates[0]
      const dateTo = availableDates[availableDates.length - 1]
      try {
        const { data } = await supabase
          .from('appointments')
          .select('*')
          .eq('master_id', (master as any).user_id)
          .gte('date', dateFrom)
          .lte('date', dateTo)
          .neq('status', 'cancelled')
        const appts = (data ?? []) as Appointment[]
        setAllPeriodAppts(appts)
        const booked = computeFullyBooked(appts, totalDuration)
        setFullyBookedDates(booked)
      } catch {}
      // Автовыбор первой доступной даты
      if (!selectedDate && availableDates.length > 0) {
        const firstDate = availableDates[0]
        setCalendarMonth(dayjs(firstDate).startOf('month'))
        onDateSelect(firstDate)
      }
    }
    loadPeriodAppts()
  }, [step])

  // При изменении набора услуг — пересчитать занятые дни и слоты
  useEffect(() => {
    if (step === 2 && master && schedule) {
      const booked = computeFullyBooked(allPeriodAppts, totalDuration)
      setFullyBookedDates(booked)
    }
    if (selectedDate && step === 2) {
      onDateSelect(selectedDate)
    }
  }, [totalDuration])

  const onConfirm = async (values: ClientFormValues) => {
    if (!master || selectedServices.length === 0) return
    setConfirming(true)
    setBookingError(null)
    try {
      const startMin = parseTimeToMinutes(selectedSlot)
      const endTime = minutesToTime(startMin + totalDuration)
      const serviceNames = selectedServices.map(s => s.name).join(', ')

      // Генерируем cancel_token для ссылки отмены
      const cancelToken = crypto.randomUUID()

      // Ищем или создаём клиента в базе
      const nameParts = values.client_name.trim().split(/\s+/)
      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ')

      let clientId: string | null = null
      // Ищем по телефону у этого мастера
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id, first_name, last_name')
        .eq('master_id', (master as any).user_id)
        .eq('phone', values.client_phone)
        .maybeSingle()

      if (existingClient) {
        clientId = existingClient.id
        // Обновляем имя если изменилось
        if (existingClient.first_name !== firstName) {
          await supabase
            .from('clients')
            .update({ first_name: firstName, last_name: lastName || existingClient.last_name || '' })
            .eq('id', existingClient.id)
        }
      } else {
        // Клиент не найден — создаём
        const { data: newClient } = await supabase
          .from('clients')
          .insert({
            master_id: (master as any).user_id,
            first_name: firstName,
            last_name: lastName,
            phone: values.client_phone,
            source: 'online_booking',
          })
          .select('id')
          .single()
        clientId = newClient?.id ?? null
      }

      const { data: appt, error: apptError } = await supabase
        .from('appointments')
        .insert({
          master_id: (master as any).user_id,
          client_id: clientId,
          service_id: selectedServices[0].id,
          date: selectedDate,
          start_time: selectedSlot,
          end_time: endTime,
          status: 'scheduled',
          price: totalPrice,
          booked_via: 'online',
          cancel_token: cancelToken,
          notes: values.notes || '',
          client_name: values.client_name,
          client_phone: values.client_phone,
          client_email: values.client_email || '',
          client_telegram: values.client_telegram || '',
          telegram_id: tgUserId || '',
          promo_code: promoApplied?.code || '',
          promo_discount: promoApplied?.discountAmount || 0,
        })
        .select('id')
        .single()

      if (apptError || !appt) throw apptError ?? new Error('Failed to create appointment')

      // Создаём записи appointment_services (новый формат мультиуслуг)
      await supabase.from('appointment_services').insert(
        selectedServices.map((svc, i) => ({
          appointment_id: appt.id,
          service_id: svc.id,
          service_name: svc.name,
          price: svc.price,
          duration_min: svc.duration_min,
          sort_order: i,
        }))
      )

      // Уведомление мастеру в Telegram
      if (master.tg_bot_token && master.tg_chat_id) {
        const { sendTelegramMessage } = await import('@/lib/telegram')
        const dateFormatted = dayjs(selectedDate).format('D MMMM YYYY')
        const cancelUrl = `${window.location.origin}/cancel/${cancelToken}`
        let msg = `🌐 <b>Онлайн-запись!</b>\n\n`
        msg += `👤 ${values.client_name}`
        if (values.client_phone) msg += ` · ${values.client_phone}`
        msg += `\n💼 ${serviceNames}\n`
        msg += `📅 ${dateFormatted} · ${selectedSlot} – ${endTime}\n`
        if (totalPrice > 0) msg += `💰 ${formatCurrency(totalPrice, master.currency, i18n.language)}\n`
        if (values.notes) msg += `📝 ${values.notes}\n`
        if (values.client_telegram) msg += `✈️ Telegram: @${values.client_telegram.replace('@', '')}\n`
        msg += `\n🔗 <a href="${cancelUrl}">Отменить запись</a>`
        sendTelegramMessage(master.tg_bot_token, master.tg_chat_id, msg).catch(() => {})
      }

      if (isTelegramMiniApp()) hapticSuccess()

      setBookingDetails({
        services: serviceNames,
        date: dayjs(selectedDate).format('D MMMM YYYY'),
        time: selectedSlot,
        duration: formatDuration(totalDuration, t),
        price: formatCurrency(totalPrice, master.currency, i18n.language),
        clientTelegram: values.client_telegram || '',
        cancelToken,
        isTgMiniApp: isTelegramMiniApp(),
        tgCabinetLink: buildClientCabinetLink(),
        clientName: values.client_name,
      })
      setSubmitted(true)
    } catch (err: any) {
      const msg: string = err?.message ?? err?.data?.message ?? ''
      if (msg.includes('plan_limit_reached:appts_month')) {
        setBookingError(t('booking.limitReached'))
      } else if (msg.includes('plan_limit_reached:clients')) {
        setBookingError(t('booking.limitReached'))
      } else {
        setBookingError(t('booking.bookingError'))
      }
    } finally {
      setConfirming(false)
    }
  }

  if (loading) return <LoadingSpinner fullScreen />

  if (!master) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">{t('booking.notFound')}</h1>
          <p className="text-muted-foreground">{t('booking.notFoundDesc')}</p>
        </div>
      </div>
    )
  }

  if (submitted && bookingDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">{t('booking.confirmed')}</h2>
            <p className="text-muted-foreground mb-6">{t('booking.confirmDesc')}</p>
            <div className="space-y-2 text-left bg-muted/50 rounded-xl p-4 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('appointments.service')}</span>
                <span className="font-medium text-right max-w-[60%]">{bookingDetails.services}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('appointments.date')}</span>
                <span className="font-medium">{bookingDetails.date}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('appointments.time')}</span>
                <span className="font-medium">{bookingDetails.time}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('appointments.price')}</span>
                <span className="font-medium">{bookingDetails.price}</span>
              </div>
            </div>
            {/* Location with embedded map */}
            {(master.address || master.city) && (() => {
              const locQuery = [master.address, master.city].filter(Boolean).join(', ')
              const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(locQuery)}&output=embed&z=15`
              const mapsLink = `https://maps.google.com/?q=${encodeURIComponent(locQuery)}`
              return (
                <div className="text-left border rounded-xl overflow-hidden mb-4">
                  <div className="h-36">
                    <iframe
                      src={embedUrl}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen={false}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="location"
                    />
                  </div>
                  <div className="p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{master.address || master.city}</span>
                    </div>
                    <a
                      href={mapsLink}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      {t('booking.openMap')}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )
            })()}

            {master && (master.phone || master.telegram || master.whatsapp) && (
              <div className="text-left border rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t('booking.masterContacts')}</p>
                {master.phone && (
                  <a href={`tel:${master.phone}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />{master.phone}
                  </a>
                )}
                {master.whatsapp && (
                  <a href={`https://wa.me/${master.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                    <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />WhatsApp: {master.whatsapp}
                  </a>
                )}
                {master.telegram && (
                  <a href={`https://t.me/${master.telegram.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                    <SendIcon className="h-3.5 w-3.5 text-muted-foreground" />Telegram: {master.telegram}
                  </a>
                )}
              </div>
            )}
            {bookingDetails.clientTelegram && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-4">{t('booking.telegramConfirmSent')}</p>
            )}
            {/* Кнопка "Мои записи" для Telegram Mini App */}
            {bookingDetails.isTgMiniApp && (
              <div className="mt-4">
                <a
                  href={bookingDetails.tgCabinetLink}
                  className="flex items-center justify-center gap-2 w-full rounded-lg px-4 py-2.5 text-sm font-medium bg-[#2AABEE] hover:bg-[#2AABEE]/90 text-white transition-colors"
                >
                  📋 Мои записи
                </a>
              </div>
            )}
            {/* Форма отзыва */}
            {!reviewSubmitted && (
              <div className="mt-4 pt-4 border-t text-left space-y-3">
                <p className="text-sm font-semibold text-center">Оцените мастера</p>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} type="button" onClick={() => setReviewRating(s)}>
                      <Star className={`h-8 w-8 transition-colors ${s <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30 hover:text-amber-300'}`} />
                    </button>
                  ))}
                </div>
                {reviewRating > 0 && (
                  <textarea
                    className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                    rows={2}
                    placeholder="Ваш комментарий (необязательно)"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                  />
                )}
                {reviewRating > 0 && (
                  <Button
                    className="w-full"
                    variant="outline"
                    size="sm"
                    onClick={handleSubmitReview}
                    loading={reviewSubmitting}
                  >
                    Оставить отзыв
                  </Button>
                )}
              </div>
            )}
            {reviewSubmitted && (
              <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400 text-center">
                ✅ Спасибо за отзыв!
              </p>
            )}

            {bookingDetails.cancelToken && (
              <div className="mt-4 pt-4 border-t">
                <a
                  href={`/cancel/${bookingDetails.cancelToken}`}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2"
                >
                  {t('booking.cancelLink')}
                </a>
              </div>
            )}

            {/* Кнопка «Назад к команде» */}
            {fromTeam && (
              <div className="mt-4 pt-4 border-t">
                <a
                  href={`/book/team/${fromTeam}`}
                  className="inline-flex items-center gap-1.5 w-full justify-center rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('team.booking.backToTeam')}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const masterName = master.expand?.user?.name || 'Master'
  const avatarUrl = master.avatar
    ? getFileUrl('master_profiles', master.avatar)
    : master.expand?.user?.avatar
      ? getFileUrl('avatars', master.expand.user.avatar)
      : undefined

  const advanceDays = schedule?.advance_days || 30
  const availableDates = Array.from({ length: advanceDays }, (_, i) => {
    const d = dayjs().add(i + 1, 'day')
    const dow = d.day()
    const key = DOW_MAP[dow] as any
    const enabled = schedule?.[`${key}_enabled` as keyof Schedule]
    if (!enabled) return null
    const dateStr = d.format('YYYY-MM-DD')
    // Проверяем заблокированные периоды
    const isBlocked = dateBlocks.some(b => dateStr >= b.date_from && dateStr <= b.date_to)
    return isBlocked ? null : dateStr
  }).filter(Boolean) as string[]

  return (
    <div
      className="bg-background"
      style={{
        minHeight: 'var(--tg-viewport-stable-height, 100dvh)',
        ...getThemeVars(master.booking_theme),
      }}
    >
      {/* Header */}
      <div className="border-b py-6 px-4" style={tgTopPadding > 0 ? { paddingTop: `${tgTopPadding + 8}px` } : undefined}>
        <div className="max-w-2xl mx-auto">
          {canGoBack && (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => fromTeam ? navigate(`/book/team/${fromTeam}`) : navigate(-1)}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                {fromTeam ? t('team.booking.backToTeam') : t('common.back')}
              </button>
            </div>
          )}
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20 shrink-0">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="text-2xl">{masterName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">{masterName}</h1>
              <p className="text-muted-foreground">{master.profession}</p>
              {(master.city || master.address) && (
                <a
                  href={master.address ? `https://maps.google.com/?q=${encodeURIComponent(master.address)}` : undefined}
                  target="_blank" rel="noreferrer"
                  className={`text-sm text-muted-foreground flex items-center gap-1 mt-1 ${master.address ? 'hover:text-primary transition-colors' : ''}`}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {master.address || master.city}
                </a>
              )}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {master.phone && (
                  <a href={`tel:${master.phone}`} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {master.phone}
                  </a>
                )}
                {master.instagram && (
                  <a href={`https://instagram.com/${master.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    Instagram
                  </a>
                )}
                {master.telegram && (
                  <a href={`https://t.me/${master.telegram.replace('@', '')}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    Telegram
                  </a>
                )}
                {master.whatsapp && (
                  <a href={`https://wa.me/${master.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
          {/* Переключатель языка — под информацией о мастере */}
          <div className="flex justify-end mt-3">
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      {/* Вкладки: Запись / О мастере (icon tiles) */}
      {(master.bio || (master.portfolio && master.portfolio.length > 0) || reviews.length > 0) && (
        <div className="px-4 py-3 border-b bg-background sticky top-0 z-40">
          <div className="max-w-2xl mx-auto grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMainTab('booking')}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all ${
                mainTab === 'booking'
                  ? 'border-primary bg-primary/8 text-primary shadow-sm'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
            >
              <CalendarDays className="h-5 w-5" />
              <span className="text-xs font-semibold">Запись</span>
            </button>
            <button
              type="button"
              onClick={() => setMainTab('about')}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all ${
                mainTab === 'about'
                  ? 'border-primary bg-primary/8 text-primary shadow-sm'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
            >
              <UserCircle className="h-5 w-5" />
              <span className="text-xs font-semibold flex items-center gap-1">
                О мастере
                {reviews.length > 0 && (
                  <span className="flex items-center gap-0.5 text-amber-500">
                    <Star className="h-3 w-3 fill-amber-400" />
                    {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Вкладка О мастере */}
      {mainTab === 'about' && (
        <div className="max-w-2xl mx-auto p-4 space-y-6">
          {master.bio && (
            <p className="text-sm text-muted-foreground leading-relaxed">{master.bio}</p>
          )}
          {master.portfolio && master.portfolio.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t('booking.portfolio')}</p>
              <div className="grid grid-cols-3 gap-2">
                {master.portfolio.slice(0, 9).map((filename, i) => {
                  const imgUrl = getFileUrl('portfolio', filename)
                  return (
                    <a key={i} href={getFileUrl('portfolio', filename)} target="_blank" rel="noreferrer" className="aspect-square shrink-0 block">
                      <img src={imgUrl} alt={`Portfolio ${i + 1}`} className="w-full h-full object-cover rounded-xl border hover:opacity-90 transition-opacity" />
                    </a>
                  )
                })}
              </div>
            </div>
          )}
          {reviews.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Отзывы</p>
                <div className="flex items-center gap-1 text-xs text-amber-500">
                  <Star className="h-3.5 w-3.5 fill-amber-400" />
                  <span className="font-semibold">{(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}</span>
                  <span className="text-muted-foreground">({reviews.length})</span>
                </div>
              </div>
              <div className="space-y-3">
                {reviews.slice(0, 20).map((rev) => (
                  <div key={rev.id} className="rounded-xl border p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} className={`h-3.5 w-3.5 ${s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/20'}`} />
                        ))}
                      </div>
                      <p className="text-xs font-medium text-muted-foreground">{rev.client_name || 'Клиент'}</p>
                    </div>
                    {rev.comment && <p className="text-sm text-muted-foreground leading-snug">{rev.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {mainTab === 'booking' && <div className="max-w-2xl mx-auto px-4 pt-3 pb-4 space-y-4">
        {/* Thin step progress bar */}
        <div className="flex gap-1.5">
          <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-border'}`} />
          <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-border'}`} />
          <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 3 ? 'bg-primary' : 'bg-border'}`} />
        </div>

        {/* ── Шаг 1: Выбор услуг ── */}
        {step === 1 && (
          <div className={`space-y-4${selectedServices.length > 0 ? ' pb-24' : ''}`}>

            {/* Поиск */}
            {services.length > 4 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder={t('booking.searchServices')}
                  value={serviceSearch}
                  onChange={e => setServiceSearch(e.target.value)}
                />
              </div>
            )}

            {/* Список услуг */}
            {(() => {
              const tabFiltered = filteredServices

              if (tabFiltered.length === 0) {
                return <p className="text-muted-foreground py-4 text-center">{t('booking.noServices')}</p>
              }

              return (
                <div className="space-y-2">
                  {tabFiltered.map((svc) => {
                    const isSelected = !!selectedServices.find(s => s.id === svc.id)
                    const imgUrl = svc.image
                      ? getFileUrl('services', svc.image)
                      : null
                    const priceZero = !svc.price || svc.price === 0
                    const priceMaxPositive = svc.price_max && Number(svc.price_max) > 0
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => toggleService(svc)}
                        className={`w-full text-left rounded-xl border-2 p-3.5 transition-all hover:border-primary/60 ${isSelected ? 'border-primary bg-primary/5' : 'border-border'}`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Чекбокс */}
                          <div className={`mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-border bg-background'}`}>
                            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          {/* Картинка услуги */}
                          {imgUrl && (
                            <img
                              src={imgUrl}
                              alt={svc.name}
                              className="h-14 w-14 object-cover rounded-lg border shrink-0"
                            />
                          )}
                          {/* Основная информация */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium leading-tight">{svc.name}</p>
                            {svc.description && (
                              <p className="text-sm text-muted-foreground mt-0.5 leading-snug line-clamp-2">{svc.description}</p>
                            )}
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Clock className="h-3.5 w-3.5" />{formatDuration(svc.duration_min, t)}
                            </p>
                          </div>
                          {/* Цена */}
                          <div className="text-right shrink-0 self-center">
                            {priceZero ? (
                              <p className="text-sm font-medium text-muted-foreground">{t('booking.priceNegotiable')}</p>
                            ) : (
                              <>
                                <p className="font-semibold text-base">{formatCurrency(svc.price, master.currency, i18n.language)}</p>
                                {priceMaxPositive && (
                                  <p className="text-xs text-muted-foreground">— {formatCurrency(Number(svc.price_max), master.currency, i18n.language)}</p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })()}

          </div>
        )}

        {/* ── Шаг 2: Дата + Время ── */}
        {step === 2 && (
          <div className={`space-y-3${selectedSlot ? ' pb-24' : ''}`}>
            <Button variant="ghost" size="icon" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* ── Мини-календарь ── */}
            {(() => {
              const availableSet = new Set(availableDates)
              const today = dayjs().format('YYYY-MM-DD')
              const lastAvailable = availableDates[availableDates.length - 1] ?? today
              // Первый день месяца и кол-во дней
              const firstDay = calendarMonth.startOf('month')
              // Сдвиг: пн=0, вт=1, ... вс=6
              const startOffset = (firstDay.day() + 6) % 7
              const daysInMonth = calendarMonth.daysInMonth()
              // Дни недели заголовок (Пн Вт Ср Чт Пт Сб Вс) — вычисляем от ближайшего понедельника
              const monday = dayjs().day(1) // текущая неделя, пн
              const dowLabels = Array.from({ length: 7 }, (_, i) =>
                monday.add(i, 'day').format('dd')
              )
              // Ячейки: null = пустые до 1-го
              const cells: (dayjs.Dayjs | null)[] = [
                ...Array(startOffset).fill(null),
                ...Array.from({ length: daysInMonth }, (_, i) => firstDay.add(i, 'day')),
              ]
              // Дополняем до кратного 7
              while (cells.length % 7 !== 0) cells.push(null)

              const canPrevMonth = calendarMonth.isAfter(dayjs().startOf('month'))
              const canNextMonth = calendarMonth.isBefore(dayjs(lastAvailable).startOf('month'))

              return (
                <div className="space-y-2">
                  {/* Заголовок с навигацией — только в раскрытом режиме */}
                  {calendarExpanded && (
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setCalendarMonth(m => m.subtract(1, 'month'))}
                      className={`p-1.5 rounded-lg hover:bg-muted transition-colors ${!canPrevMonth ? 'invisible' : ''}`}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-semibold capitalize">
                      {calendarMonth.format('MMMM YYYY')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCalendarMonth(m => m.add(1, 'month'))}
                      className={`p-1.5 rounded-lg hover:bg-muted transition-colors ${!canNextMonth ? 'invisible' : ''}`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  )}

                  {/* Дни недели */}
                  <div className="grid grid-cols-7 gap-0.5">
                    {dowLabels.map((label, i) => (
                      <div
                        key={i}
                        className={`text-center text-xs font-semibold py-1 select-none
                          ${i >= 5 ? 'text-rose-400' : 'text-muted-foreground'}`}
                      >
                        {label}
                      </div>
                    ))}
                  </div>

                  {/* Сетка дней */}
                  {(() => {
                    // В свёрнутом режиме показываем только строку с активной/текущей датой
                    let visibleCells = cells
                    if (!calendarExpanded) {
                      // Находим индекс активной даты или сегодняшней
                      const targetDate = selectedDate || today
                      const targetIdx = cells.findIndex(d => d && d.format('YYYY-MM-DD') === targetDate)
                      // Если нашли — берём строку (7 ячеек) с этой датой, иначе первую строку
                      const rowStart = targetIdx >= 0 ? Math.floor(targetIdx / 7) * 7 : 0
                      visibleCells = cells.slice(rowStart, rowStart + 7)
                    }
                    return (
                  <div className="grid grid-cols-7 gap-0.5">
                    {visibleCells.map((day, idx) => {
                      if (!day) return <div key={idx} />
                      const dateStr = day.format('YYYY-MM-DD')
                      const dow = day.day() // 0=вс, 6=сб
                      const isWeekend = dow === 0 || dow === 6
                      const isToday = dateStr === today
                      const isAvailable = availableSet.has(dateStr)
                      const isFullyBooked = fullyBookedDates.has(dateStr) && totalDuration > 0
                      const isActive = selectedDate === dateStr
                      // Кликабелен: дата доступна (рабочий день по расписанию) и не прошедшая и не сегодня
                      const isClickable = isAvailable && dateStr > today

                      // Определяем визуальный класс
                      let cellClass = ''
                      if (isActive) {
                        cellClass = 'bg-primary text-primary-foreground font-bold shadow-sm scale-105'
                      } else if (isFullyBooked && isClickable) {
                        cellClass = 'bg-muted/30 text-muted-foreground/40 cursor-not-allowed'
                      } else if (!isClickable) {
                        // Прошедшие, сегодня, нерабочие — серые
                        cellClass = isToday
                          ? 'text-muted-foreground/50 cursor-default ring-1 ring-border'
                          : 'text-muted-foreground/25 cursor-default'
                      } else if (isWeekend) {
                        // Рабочий выходной (мастер работает в сб/вс)
                        cellClass = 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-medium cursor-pointer'
                      } else {
                        cellClass = 'hover:bg-primary/10 text-foreground cursor-pointer font-medium'
                      }

                      return (
                        <button
                          key={dateStr}
                          type="button"
                          disabled={!isClickable}
                          onClick={() => isClickable ? onDateSelect(dateStr) : undefined}
                          title={isFullyBooked ? t('booking.fullyBooked') : undefined}
                          className={`relative h-9 flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-all select-none ${cellClass}`}
                        >
                          <span className="leading-none">{day.format('D')}</span>
                          {/* Диагональная линия для занятых дней */}
                          {isFullyBooked && isAvailable && !isActive && (
                            <svg viewBox="0 0 32 32" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                              <line x1="3" y1="29" x2="29" y2="3" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          )}
                        </button>
                      )
                    })}
                  </div>
                    )
                  })()}

                  {/* Кнопка раскрыть/свернуть месяц */}
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarExpanded(v => {
                        const expanding = !v
                        // При раскрытии — переходим к месяцу выбранной или текущей даты
                        if (expanding) {
                          const target = selectedDate || today
                          setCalendarMonth(dayjs(target).startOf('month'))
                        }
                        return expanding
                      })
                    }}
                    className="w-full flex items-center justify-center gap-1 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {calendarExpanded ? (
                      <>
                        <ChevronLeft className="h-3 w-3 rotate-90" />
                        {t('booking.collapseCalendar')}
                      </>
                    ) : (
                      <>
                        <ChevronRight className="h-3 w-3 rotate-90" />
                        {t('booking.expandCalendar')}
                      </>
                    )}
                  </button>

                  {/* Легенда */}
                  <div className="flex items-center gap-3 pt-0.5 text-[11px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm bg-primary inline-block" />
                      {t('booking.selected')}
                    </span>
                    <span className="flex items-center gap-1 text-rose-400">
                      <span className="h-2.5 w-2.5 rounded-sm bg-rose-200 dark:bg-rose-900 inline-block" />
                      {t('booking.weekends')}
                    </span>
                    {fullyBookedDates.size > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-sm bg-muted overflow-hidden">
                          <svg viewBox="0 0 10 10" className="absolute inset-0 w-full h-full">
                            <line x1="1" y1="9" x2="9" y2="1" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </span>
                        {t('booking.fullyBooked')}
                      </span>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Слоты времени */}
            <div className="space-y-3">
              {slotsLoading ? (
                <div className="flex items-center justify-center h-28">
                  <LoadingSpinner />
                </div>
              ) : !selectedDate || slots.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-28 text-sm text-muted-foreground border rounded-xl border-dashed gap-2">
                  <p>{slots.length === 0 && selectedDate ? t('booking.noSlots') : t('booking.pickDateFirst')}</p>
                  {slots.length === 0 && selectedDate && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => {
                        const next = availableDates.find(d => d > selectedDate)
                        if (next) onDateSelect(next)
                      }}
                    >
                      {t('booking.otherDate')} →
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Строка: выбранная дата + легенда */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium capitalize">
                      {dayjs(selectedDate).format('D MMMM, dddd')}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded border-2 border-primary bg-primary/10 inline-block" />
                        {t('booking.slotFree')}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded border border-border bg-muted inline-block" />
                        {t('booking.slotBusy')}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {slots.map((slot) => {
                      const isChosen = selectedSlot === slot.time
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => {
                            if (slot.busy) return
                            setSelectedSlot(slot.time)
                          }}
                          className={`
                            py-2 rounded-xl border text-sm font-medium transition-all
                            ${slot.busy
                              ? 'border-border bg-muted/50 text-muted-foreground/50 cursor-not-allowed line-through'
                              : isChosen
                                ? 'border-primary bg-primary text-primary-foreground shadow-md scale-105'
                                : 'border-border hover:border-primary hover:bg-primary/5 active:scale-95'
                            }
                          `}
                        >
                          {slot.time}
                        </button>
                      )
                    })}
                  </div>

                  {/* Ближайшее свободное или все занято */}
                  {(() => {
                    const allBusy = slots.every(s => s.busy)
                    if (allBusy) {
                      return (
                        <div className="flex flex-col items-center gap-2 py-2">
                          <p className="text-sm text-amber-600 dark:text-amber-400">{t('appointments.allSlotsBusy')}</p>
                          <button
                            type="button"
                            className="text-sm text-primary hover:underline font-medium"
                            onClick={() => {
                              const next = availableDates.find(d => d > selectedDate)
                              if (next) onDateSelect(next)
                            }}
                          >
                            {t('booking.otherDate')} →
                          </button>
                        </div>
                      )
                    }
                    const nextFree = selectedSlot
                      ? (slots.find(s => !s.busy && s.time > selectedSlot) ?? null)
                      : slots.find(s => !s.busy) ?? null
                    if (nextFree) {
                      return (
                        <div className="flex items-center gap-2 pt-1">
                          <p className="text-xs text-muted-foreground">
                            {selectedSlot ? t('appointments.nextFree') : t('appointments.nearestFree')}:
                          </p>
                          <button
                            type="button"
                            onClick={() => setSelectedSlot(nextFree.time)}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            {nextFree.time}
                          </button>
                        </div>
                      )
                    }
                    return null
                  })()}
                </>
              )}
            </div>

            {/* Подсказка выбрать время */}
            {!selectedSlot && selectedDate && slots.some(s => !s.busy) && (
              <p className="text-center text-xs text-muted-foreground">{t('booking.pickTime')}</p>
            )}
          </div>
        )}

        {/* ── Шаг 3: Данные клиента ── */}
        {step === 3 && (
          <div className={`space-y-4${step3Ready ? ' pb-24' : ''}`}>
            <Button variant="ghost" size="icon" onClick={() => setStep(2)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Summary */}
            <div className="p-4 rounded-xl bg-muted/50 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">{t('appointments.service')}</span>
                <span className="font-medium text-right">{selectedServices.map(s => s.name).join(', ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('appointments.date')}</span>
                <span className="font-medium">{dayjs(selectedDate).format('D MMMM')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('appointments.time')}</span>
                <span className="font-medium">{selectedSlot} · {formatDuration(totalDuration, t)}</span>
              </div>
              {promoApplied && promoApplied.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Промокод <strong>{promoApplied.code}</strong></span>
                  <span>-{formatCurrency(promoApplied.discountAmount, master.currency, i18n.language)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('appointments.price')}</span>
                <span className="font-bold">
                  {basePrice === 0 ? 'По договорённости' : formatCurrency(totalPrice, master.currency, i18n.language)}
                </span>
              </div>
            </div>

            {/* Промокод */}
            {!promoApplied && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  Промокод
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Введите код"
                    value={promoInput}
                    onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError('') }}
                    className={promoError ? 'border-destructive' : ''}
                  />
                  <Button type="button" variant="outline" onClick={handleApplyPromo} loading={promoLoading} disabled={!promoInput.trim()}>
                    Применить
                  </Button>
                </div>
                {promoError && <p className="text-xs text-destructive">{promoError}</p>}
              </div>
            )}
            {promoApplied && (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 px-3 py-2 text-sm">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <Check className="h-4 w-4" />
                  <span>Промокод <strong>{promoApplied.code}</strong> применён</span>
                </div>
                <button type="button" onClick={() => { setPromoApplied(null); setPromoInput('') }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <form id="booking-form" onSubmit={handleSubmit(onConfirm)} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('booking.yourName')} *</Label>
                <Input placeholder={t('auth.namePlaceholder')} {...register('client_name')} />
                {errors.client_name && <p className="text-xs text-destructive">{t('common.required')}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t('clients.phone')} *</Label>
                <Input placeholder="+998 90 000 00 00" {...register('client_phone')} />
                {errors.client_phone && <p className="text-xs text-destructive">{t('common.required')}</p>}
              </div>
            </form>
          </div>
        )}
      </div>}

      {/* Sticky Continue bar — step 1 */}
      {mainTab === 'booking' && step === 1 && selectedServices.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-background/95 backdrop-blur border-t shadow-lg">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {selectedServices.length === 1
                  ? selectedServices[0].name
                  : `${t('booking.selected')}: ${selectedServices.length}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDuration(totalDuration, t)}{basePrice > 0 ? ` · ${formatCurrency(basePrice, master.currency, i18n.language)}` : ''}
              </p>
            </div>
            <Button onClick={() => setStep(2)} className="shrink-0">
              {t('booking.next')} →
            </Button>
          </div>
        </div>
      )}

      {/* Sticky Continue bar — step 2 */}
      {mainTab === 'booking' && step === 2 && selectedSlot && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-background/95 backdrop-blur border-t shadow-lg">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {dayjs(selectedDate).format('D MMMM')} · {selectedSlot}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDuration(totalDuration, t)}{basePrice > 0 ? ` · ${formatCurrency(totalPrice, master.currency, i18n.language)}` : ''}
              </p>
            </div>
            <Button onClick={() => setStep(3)} className="shrink-0">
              {t('booking.next')} →
            </Button>
          </div>
        </div>
      )}

      {/* Sticky Confirm bar — step 3 */}
      {mainTab === 'booking' && step === 3 && step3Ready && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-background/95 backdrop-blur border-t shadow-lg">
          <div className="max-w-2xl mx-auto space-y-2">
            {bookingError && (
              <p className="text-xs text-destructive text-center">{bookingError}</p>
            )}
            <Button
              type="submit"
              form="booking-form"
              className="w-full"
              size="lg"
              loading={confirming}
            >
              {t('booking.confirm')}
            </Button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t mt-8 py-4 text-center">
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
          {t('booking.poweredBy')} <Zap className="h-3 w-3 text-primary" /> Ezze
        </p>
      </div>
    </div>
  )
}
