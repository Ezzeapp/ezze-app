import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Zap, Phone } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAppSettings } from '@/hooks/useAppSettings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/shared/Toaster'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { isTelegramMiniApp, initMiniApp } from '@/lib/telegramWebApp'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})
type FormValues = z.infer<typeof schema>

// ── Telegram Login Widget (официальный виджет Telegram для web) ──────────────
function TelegramLoginWidget({ onAuth }: { onAuth: (user: Record<string, unknown>) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onAuthRef = useRef(onAuth)
  useEffect(() => { onAuthRef.current = onAuth }, [onAuth])

  useEffect(() => {
    if (!containerRef.current) return
    ;(window as any).onTelegramAuth = (user: Record<string, unknown>) => {
      onAuthRef.current(user)
    }

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', 'ezzepro_bot')
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '8')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    script.async = true
    containerRef.current.appendChild(script)

    return () => {
      delete (window as any).onTelegramAuth
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [])

  return <div ref={containerRef} className="flex justify-center" />
}

export function LoginPage() {
  const { t } = useTranslation()
  const { login, isAuthenticated, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const { data: appSettings } = useAppSettings()

  // Redirect when auth state becomes valid (handles race condition after login)
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(window.innerWidth < 1024 ? '/calendar' : '/dashboard', { replace: true })
    }
  }, [isAuthenticated, authLoading, navigate])
  const [tgAuthLoading, setTgAuthLoading] = useState(false)
  const [tgNotFound, setTgNotFound] = useState(false)

  // ── Phone login state ────────────────────────────────────────────────────
  const [loginMode, setLoginMode] = useState<'email' | 'phone'>('email')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneStep, setPhoneStep] = useState<'phone' | 'code'>('phone')
  const [phoneSending, setPhoneSending] = useState(false)
  const [phoneVerifying, setPhoneVerifying] = useState(false)
  const [phoneCodeError, setPhoneCodeError] = useState('')
  const [phoneCooldown, setPhoneCooldown] = useState(0)
  const [phoneNotFound, setPhoneNotFound] = useState(false)

  const isTg = isTelegramMiniApp()
  const [tgLoading, setTgLoading] = useState(isTg)
  const [tgError, setTgError] = useState('')

  // ── Telegram Mini App: авто-вход ──────────────────────────────────────────
  useEffect(() => {
    if (!isTg) return
    initMiniApp()

    const initData = window.Telegram?.WebApp?.initData
    if (!initData) {
      setTgLoading(false)
      return
    }

    supabase.functions.invoke('tg-auth', { body: { initData } })
      .then(async ({ data, error }) => {
        if (error || !data) {
          const status = (error as any)?.status ?? 0
          if (status === 404) {
            navigate('/register', { replace: true })
          } else {
            setTgError('Не удалось войти через Telegram')
            setTgLoading(false)
          }
          return
        }
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })
        if (sessionError) {
          setTgError('Не удалось войти через Telegram')
          setTgLoading(false)
        } else {
          navigate('/dashboard', { replace: true })
        }
      })
      .catch(() => {
        setTgError('Не удалось войти через Telegram')
        setTgLoading(false)
      })
  }, [isTg, navigate])

  // ── Стандартная форма ─────────────────────────────────────────────────────
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    try {
      setLoading(true)
      await login(values.email, values.password)
      // Navigation handled by useEffect above when isAuthenticated becomes true
    } catch (e: any) {
      if (e?.message === 'ACCOUNT_DISABLED') {
        toast.error(t('auth.accountDisabled'))
      } else {
        toast.error(t('auth.loginError'))
      }
      setLoading(false)
    }
  }

  // ── Telegram Widget: обработчик данных ───────────────────────────────────
  const handleTelegramWidgetAuth = async (user: Record<string, unknown>) => {
    setTgAuthLoading(true)
    setTgNotFound(false)
    try {
      const { data, error } = await supabase.functions.invoke('tg-widget-login', { body: user })
      const status = (error as any)?.status ?? 0
      if (error || !data) {
        if (status === 404) {
          setTgNotFound(true)
        } else if (status === 401) {
          toast.error('Данные Telegram устарели, попробуйте снова')
        } else {
          toast.error('Ошибка входа через Telegram')
        }
        return
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })
      if (sessionError) {
        toast.error('Ошибка входа через Telegram')
      } else {
        navigate(window.innerWidth < 1024 ? '/calendar' : '/dashboard', { replace: true })
      }
    } finally {
      setTgAuthLoading(false)
    }
  }

  // ── Phone login: cooldown timer ─────────────────────────────────────────
  useEffect(() => {
    if (phoneCooldown <= 0) return
    const timer = setTimeout(() => setPhoneCooldown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [phoneCooldown])

  const handlePhoneSendCode = async () => {
    if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 7 || phoneSending || phoneCooldown > 0) return
    setPhoneSending(true)
    setPhoneNotFound(false)
    try {
      const { data, error } = await supabase.functions.invoke('phone-auth', {
        body: { action: 'send_code', phone: phoneNumber },
      })
      if (error || !data?.ok) {
        const msg = data?.message || ''
        if (msg === 'not_found') {
          setPhoneNotFound(true)
        } else if (msg === 'telegram_send_failed') {
          toast.error(t('auth.codeSendError'))
        } else {
          toast.error(t('auth.codeSendError'))
        }
        return
      }
      setPhoneStep('code')
      setPhoneCooldown(60)
    } catch {
      toast.error(t('auth.codeSendError'))
    } finally {
      setPhoneSending(false)
    }
  }

  const handlePhoneVerifyCode = async () => {
    if (!phoneCode || phoneCode.length < 4 || phoneVerifying) return
    setPhoneVerifying(true)
    setPhoneCodeError('')
    setPhoneNotFound(false)
    try {
      const { data, error } = await supabase.functions.invoke('phone-auth', {
        body: {
          action: 'verify_code',
          phone: phoneNumber,
          code: phoneCode,
        },
      })

      if (error || !data?.access_token) {
        const msg = data?.message || ''
        if (msg === 'not_found') {
          setPhoneNotFound(true)
        } else if (msg === 'invalid_code' || msg === 'verification_failed') {
          setPhoneCodeError(t('auth.invalidCode'))
        } else {
          toast.error(t('auth.verifyError'))
        }
        return
      }

      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })
      if (sessionErr) {
        toast.error(t('auth.verifyError'))
      } else {
        navigate(window.innerWidth < 1024 ? '/calendar' : '/dashboard', { replace: true })
      }
    } catch {
      toast.error(t('auth.verifyError'))
    } finally {
      setPhoneVerifying(false)
    }
  }

  // ── Telegram Mini App: спиннер ────────────────────────────────────────────
  if (tgLoading) return <LoadingSpinner fullScreen />

  // ── Telegram Mini App: ошибка ─────────────────────────────────────────────
  if (isTg && tgError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 gap-4 text-center">
        <Zap className="h-10 w-10 text-primary" />
        <p className="text-muted-foreground text-sm">{tgError}</p>
        <Button onClick={() => navigate('/register')}>Зарегистрироваться</Button>
      </div>
    )
  }

  // ── Обычная форма (браузер) ───────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">Ezze</span>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle>{t('auth.welcomeBack')}</CardTitle>
            <CardDescription>{t('auth.loginSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Telegram Login Widget */}
            {tgAuthLoading ? (
              <div className="flex justify-center py-2">
                <LoadingSpinner />
              </div>
            ) : (
              <TelegramLoginWidget onAuth={handleTelegramWidgetAuth} />
            )}

            {tgNotFound && (
              <p className="text-center text-xs text-destructive">
                Telegram не привязан к аккаунту.{' '}
                <Link to="/register" className="underline">Зарегистрируйтесь</Link>
              </p>
            )}

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">{t('auth.loginSubtitle')}</span>
              </div>
            </div>

            {/* Mode tabs */}
            <div className="flex rounded-lg border border-input p-0.5 bg-muted/50">
              <button
                type="button"
                onClick={() => setLoginMode('phone')}
                className={[
                  'flex-1 flex items-center justify-center gap-1.5 text-sm py-1.5 rounded-md transition-colors',
                  loginMode === 'phone' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                <Phone className="h-3.5 w-3.5" />
                {t('auth.phoneLogin')}
              </button>
              <button
                type="button"
                onClick={() => setLoginMode('email')}
                className={[
                  'flex-1 text-sm py-1.5 rounded-md transition-colors',
                  loginMode === 'email' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {t('auth.emailLogin')}
              </button>
            </div>

            {loginMode === 'phone' ? (
              /* Phone login form */
              <div className="space-y-4">
                {phoneStep === 'phone' ? (
                  <>
                    <div className="space-y-2">
                      <Label>{t('auth.phone')}</Label>
                      <Input
                        type="tel"
                        placeholder="+998 90 123 45 67"
                        autoComplete="tel"
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      className="w-full"
                      disabled={phoneNumber.replace(/\D/g, '').length < 7 || phoneSending || phoneCooldown > 0}
                      onClick={handlePhoneSendCode}
                    >
                      {phoneSending ? <LoadingSpinner /> : t('auth.sendCode')}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">{t('auth.codeViaTelegram')}</p>
                  </>
                ) : (
                  <>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">
                        {t('auth.codeSentTo')} <span className="font-medium text-foreground">{phoneNumber}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('auth.checkTelegram')}</p>
                    </div>
                    <Input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={phoneCode}
                      onChange={e => {
                        setPhoneCode(e.target.value.replace(/\D/g, ''))
                        setPhoneCodeError('')
                      }}
                      placeholder="000000"
                      className="text-center text-xl tracking-[0.4em] font-mono"
                      autoFocus
                    />
                    {phoneCodeError && (
                      <p className="text-xs text-destructive text-center">{phoneCodeError}</p>
                    )}
                    {phoneNotFound && (
                      <p className="text-xs text-destructive text-center">
                        {t('auth.noAccount')}{' '}
                        <Link to="/register" className="underline">{t('auth.register')}</Link>
                      </p>
                    )}
                    <Button
                      type="button"
                      className="w-full"
                      disabled={phoneCode.length < 4 || phoneVerifying}
                      onClick={handlePhoneVerifyCode}
                    >
                      {phoneVerifying ? <LoadingSpinner /> : t('auth.login')}
                    </Button>
                    <div className="text-center">
                      {phoneCooldown > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {t('auth.resendIn')}{phoneCooldown}{t('auth.seconds')}
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={handlePhoneSendCode}
                          disabled={phoneSending}
                          className="text-xs text-primary hover:underline"
                        >
                          {t('auth.resendCode')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setPhoneStep('phone'); setPhoneCode(''); setPhoneCodeError(''); setPhoneNotFound(false) }}
                        className="block mx-auto mt-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {t('common.back')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* Email / password form */
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">{t('auth.invalidEmail')}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    {...register('password')}
                  />
                  {errors.password && (
                    <p className="text-xs text-destructive">{t('auth.passwordMin')}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" loading={loading}>
                  {t('auth.login')}
                </Button>
              </form>
            )}

            <p className="text-center text-sm text-muted-foreground">
              {t('auth.noAccount')}{' '}
              <Link to="/register" className="font-medium text-primary hover:underline">
                {t('auth.register')}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
