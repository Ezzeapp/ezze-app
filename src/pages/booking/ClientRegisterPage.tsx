import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Globe, Loader2, CheckCircle2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAppSettings } from '@/hooks/useAppSettings'
import { TelegramSplash } from '@/components/shared/TelegramSplash'
import {
  isTelegramMiniApp,
  initMiniApp,
  getTelegramUserId,
  getTelegramUser,
  getTelegramDisplayName,
  getTelegramLanguageCode,
} from '@/lib/telegramWebApp'

const SUPPORTED_LANGS = [
  { code: 'ru', label: 'Русский' },
  { code: 'uz', label: "O'zbekcha" },
  { code: 'en', label: 'English' },
  { code: 'tg', label: 'Тоҷикӣ' },
  { code: 'kz', label: 'Қазақша' },
  { code: 'ky', label: 'Кыргызча' },
]

export function ClientRegisterPage() {
  const navigate  = useNavigate()
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  const isTg   = isTelegramMiniApp()
  const tgUser = isTg ? getTelegramUser() : null
  const tgId   = isTg ? getTelegramUserId() : null

  const { data: appSettings } = useAppSettings()
  const platformName = appSettings?.platform_name ?? 'Ezze'
  const logoUrl      = appSettings?.logo_url

  const [lang,             setLang]             = useState(isTg ? getTelegramLanguageCode() : 'ru')
  const [name,             setName]             = useState(isTg ? getTelegramDisplayName() : '')
  const [phone,            setPhone]            = useState('')
  const [contactRequested, setContactRequested] = useState(false)
  const [submitting,       setSubmitting]       = useState(false)
  const [done,             setDone]             = useState(false)
  const [error,            setError]            = useState('')
  const [checking,         setChecking]         = useState(isTg)

  // Инициализация Mini App + проверка — вдруг уже зарегистрирован
  useEffect(() => {
    if (!isTg || !tgId) { setChecking(false); return }
    initMiniApp()

    ;(async () => {
      try {
        // anon не может читать tg_clients напрямую (RLS закрыт в 015),
        // поэтому используем SECURITY DEFINER RPC
        const { data } = await supabase
          .rpc('get_tg_client_safe', { p_tg_chat_id: String(tgId) })
          .maybeSingle() as { data: { phone: string | null; name: string | null } | null }
        if (data) {
          // Уже зарегистрирован — переходим сразу в кабинет
          const params = new URLSearchParams({ tg_id: String(tgId) })
          if (data.phone) params.set('tg_phone', data.phone)
          if (data.name)  params.set('tg_name', data.name)
          navigate(`/my?${params.toString()}`, { replace: true })
        } else {
          setChecking(false)
        }
      } catch {
        setChecking(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Очистка polling при unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // Polling tg_phone_cache (fallback когда requestContact идёт через бот)
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
      setTimeout(() => {
        navigate(`/my?tg_id=${tgId}&tg_name=${encodeURIComponent(name.trim())}`, { replace: true })
      }, 1500)
    } catch (e: any) {
      setError(e.message || 'Ошибка регистрации')
    } finally {
      setSubmitting(false)
    }
  }

  // Проверка — показываем сплэш пока грузим
  if (checking) return <TelegramSplash />

  // Если не в Telegram — заглушка
  if (!isTg || !tgId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary overflow-hidden">
          {logoUrl
            ? <img src={logoUrl} alt="" className="h-14 w-14 object-cover" />
            : <Zap className="h-7 w-7 text-primary-foreground" />}
        </div>
        <h1 className="text-lg font-bold">{platformName}</h1>
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
        <h1 className="text-xl font-bold">Готово, {name}! 🎉</h1>
        <p className="text-sm text-muted-foreground">Переходим в личный кабинет...</p>
      </div>
    )
  }

  const canSubmit = name.trim().length >= 2
    && phone.replace(/\D/g, '').length >= 7
    && !submitting

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full p-4">

        {/* Заголовок с логотипом + выбор языка */}
        <div className="mb-4 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary overflow-hidden shrink-0">
              {logoUrl
                ? <img src={logoUrl} alt="" className="h-10 w-10 object-cover" />
                : <Zap className="h-5 w-5 text-primary-foreground" />}
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Регистрация</h1>
              <p className="text-muted-foreground text-xs">{platformName}</p>
            </div>
          </div>

          {/* Выбор языка */}
          <div className="relative">
            <Globe className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <select
              value={lang}
              onChange={e => setLang(e.target.value)}
              className="h-8 pl-7 pr-2 rounded-md border border-input bg-background text-xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {SUPPORTED_LANGS.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Имя */}
        <label className="text-sm font-medium mb-1">Ваше имя</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Как вас зовут?"
          autoComplete="name"
          className={[
            'flex h-10 w-full rounded-md border border-input bg-background',
            'px-3 py-2 text-sm ring-offset-background',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'mb-3',
          ].join(' ')}
        />

        {/* Телефон */}
        <label className="text-sm font-medium mb-1">Номер телефона</label>
        <div className="flex gap-2 mb-2">
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
            autoComplete="tel"
            className={[
              'flex h-10 flex-1 rounded-md border border-input bg-background',
              'px-3 py-2 text-sm ring-offset-background',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            ].join(' ')}
          />
          {(window as any).Telegram?.WebApp && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              disabled={contactRequested}
              onClick={requestTgContact}
              title="Поделиться номером из Telegram"
            >
              {contactRequested
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Phone className="h-4 w-4" />}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground mb-6">
          Нажмите <Phone className="inline h-3 w-3 mx-0.5" /> чтобы автоматически подставить номер из Telegram
        </p>

        {/* Ошибка */}
        {error && (
          <p className="text-sm text-destructive text-center mb-4">{error}</p>
        )}

        {/* Кнопка */}
        <div className="mt-auto pb-safe-bottom pb-4">
          <Button
            className="w-full"
            size="lg"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : 'Зарегистрироваться'}
          </Button>
        </div>

      </div>
    </div>
  )
}
