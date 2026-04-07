import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Phone, Globe, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import {
  isTelegramMiniApp,
  getTelegramUserId,
  getTelegramUser,
  getTelegramDisplayName,
  getTelegramLanguageCode,
} from '@/lib/telegramWebApp'

const SUPPORTED_LANGS = [
  { code: 'ru', label: '🇷🇺 Русский' },
  { code: 'uz', label: '🇺🇿 O\'zbek' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'kz', label: '🇰🇿 Қазақша' },
]

export function ClientRegisterPage() {
  const navigate  = useNavigate()
  const { t }     = useTranslation()
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  const isTg   = isTelegramMiniApp()
  const tgUser = isTg ? getTelegramUser() : null
  const tgId   = isTg ? getTelegramUserId() : null

  const [lang,             setLang]             = useState(isTg ? getTelegramLanguageCode() : 'ru')
  const [name,             setName]             = useState(isTg ? getTelegramDisplayName() : '')
  const [phone,            setPhone]            = useState('')
  const [contactRequested, setContactRequested] = useState(false)
  const [submitting,       setSubmitting]       = useState(false)
  const [done,             setDone]             = useState(false)
  const [error,            setError]            = useState('')

  // Очистка polling при unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // Polling tg_phone_cache (fallback когда requestContact идёт через бот, а не callback)
  const startPhonePolling = useCallback(() => {
    if (!tgId) return
    if (pollRef.current) clearInterval(pollRef.current)
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts++
      if (attempts > 15) {
        clearInterval(pollRef.current!); pollRef.current = null
        return
      }
      const { data } = await supabase
        .from('tg_phone_cache')
        .select('phone')
        .eq('tg_chat_id', tgId)
        .maybeSingle()
      if (data?.phone) {
        setPhone(data.phone)
        setContactRequested(false)
        await supabase.from('tg_phone_cache').delete().eq('tg_chat_id', tgId)
        clearInterval(pollRef.current!); pollRef.current = null
      }
    }, 2000)
  }, [tgId])

  const requestTgContact = useCallback(() => {
    const wa = (window as any).Telegram?.WebApp
    if (!wa?.requestContact) return
    setContactRequested(true)
    const timer = setTimeout(() => setContactRequested(false), 30000)
    startPhonePolling()
    const ok = wa.requestContact((shared: boolean, res: any) => {
      clearTimeout(timer)
      setContactRequested(false)
      const p: string =
        res?.responseUnsafe?.contact?.phone_number ??
        res?.contact?.phone_number ??
        res?.phone_number ?? ''
      if (shared && p) {
        setPhone(p)
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      }
    })
    if (ok === false) { clearTimeout(timer); setContactRequested(false) }
  }, [startPhonePolling])

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim() || !tgId) return
    setSubmitting(true)
    setError('')
    try {
      const { error: fnError } = await supabase.functions.invoke('register-tg-client', {
        body: {
          tg_chat_id:  tgId,
          phone:       phone.trim(),
          name:        name.trim(),
          lang,
          tg_username: tgUser?.username || null,
          tg_name:     getTelegramDisplayName() || null,
        },
      })
      if (fnError) throw new Error(fnError.message)
      setDone(true)
      // Небольшая пауза, чтобы пользователь увидел успех
      setTimeout(() => {
        navigate(`/my?tg_id=${tgId}&tg_name=${encodeURIComponent(name.trim())}`)
      }, 1500)
    } catch (e: any) {
      setError(e.message || 'Ошибка регистрации')
    } finally {
      setSubmitting(false)
    }
  }

  // Если не в Telegram — показываем заглушку
  if (!isTg || !tgId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
          <Phone className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-bold">Откройте через Telegram</h1>
        <p className="text-sm text-muted-foreground">
          Регистрация доступна только через Telegram Mini App.
        </p>
      </div>
    )
  }

  // Экран успеха
  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="h-9 w-9 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Готово, {name}!</h1>
        <p className="text-sm text-muted-foreground">Переходим в личный кабинет...</p>
      </div>
    )
  }

  const canSubmit = name.trim().length > 0 && phone.trim().length > 0 && !submitting

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full p-5 pt-6">

        {/* Заголовок + выбор языка */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">👋 Привет!</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Быстрая регистрация — 1 минута
            </p>
          </div>
          <div className="relative mt-1">
            <Globe className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <select
              value={lang}
              onChange={e => setLang(e.target.value)}
              className="h-8 pl-7 pr-2 rounded-lg border border-input bg-background text-xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {SUPPORTED_LANGS.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Имя */}
        <label className="text-sm font-medium mb-1.5">Ваше имя</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Как вас зовут?"
          autoComplete="name"
          className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring mb-4"
        />

        {/* Телефон */}
        <label className="text-sm font-medium mb-1.5">Номер телефона</label>
        <div className="flex gap-2 mb-6">
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
            autoComplete="tel"
            className="flex-1 h-11 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl"
            disabled={contactRequested}
            onClick={requestTgContact}
            title="Поделиться номером из Telegram"
          >
            {contactRequested
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Phone className="h-4 w-4" />}
          </Button>
        </div>

        {/* Подсказка */}
        <p className="text-xs text-muted-foreground text-center mb-6">
          Нажмите <Phone className="inline h-3 w-3" /> чтобы автоматически подставить номер из Telegram
        </p>

        {/* Ошибка */}
        {error && (
          <p className="text-sm text-destructive text-center mb-4">{error}</p>
        )}

        {/* Кнопка */}
        <Button
          className="w-full h-12 text-base rounded-xl"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {submitting
            ? <Loader2 className="h-5 w-5 animate-spin" />
            : 'Зарегистрироваться'}
        </Button>

      </div>
    </div>
  )
}
