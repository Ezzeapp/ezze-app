import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Send, Zap } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/shared/Toaster'
import { useAppSettings } from '@/hooks/useAppSettings'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import {
  isTelegramMiniApp,
  initMiniApp,
  getTelegramUser,
  getTelegramUserId,
  getTelegramDisplayName,
} from '@/lib/telegramWebApp'

// ── Схемы ──────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})
type FormValues = z.infer<typeof schema>

const tgSchema = z.object({
  name: z.string().min(2),
})
type TgFormValues = z.infer<typeof tgSchema>

// ── Компонент ──────────────────────────────────────────────────────────────

export function RegisterPage() {
  const { t, i18n } = useTranslation()
  const { register: registerUser, isAuthenticated, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteCode  = searchParams.get('invite')
  const langParam   = searchParams.get('lang')   // язык выбранный в боте
  const phoneParam  = searchParams.get('phone')  // телефон из бота
  const [loading, setLoading] = useState(false)

  // Redirect when auth state becomes valid
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(inviteCode ? `/join/${inviteCode}` : '/dashboard', { replace: true })
    }
  }, [isAuthenticated, authLoading, navigate, inviteCode])

  // Применяем язык из бота немедленно
  useEffect(() => {
    if (langParam) {
      i18n.changeLanguage(langParam)
      // Сохраняем язык для визарда (AppLayout прочитает)
      sessionStorage.setItem('ezze_prefill_lang', langParam)
    }
  }, [langParam, i18n])

  const { data: appSettings } = useAppSettings()
  const platformName = appSettings?.platform_name ?? 'Ezze'
  const logoUrl = appSettings?.logo_url

  const isTg   = isTelegramMiniApp()
  const tgUser = isTg ? getTelegramUser() : null
  const tgId   = isTg ? getTelegramUserId() : null

  // ── Telegram: проверяем — вдруг уже зарегистрирован ──────────────────────
  const [tgChecking, setTgChecking] = useState(isTg)

  useEffect(() => {
    if (!isTg) return
    initMiniApp()

    const initData = window.Telegram?.WebApp?.initData
    if (!initData) { setTgChecking(false); return }

    fetch('/api/tg-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then((_data: any) => {
        navigate('/dashboard', { replace: true })
      })
      .catch(() => {
        // Не найден — продолжаем (авто-регистрация)
        setTgChecking(false)
      })
  }, [isTg, navigate])

  // ── Авто-регистрация через Telegram (без формы) ───────────────────────────
  const [autoRegistering, setAutoRegistering] = useState(false)
  const [showTgForm, setShowTgForm] = useState(false) // показать форму как fallback

  const saveTgProfile = useCallback(async (userId: string) => {
    if (!tgId || !userId) return
    try {
      const { data: existing } = await supabase
        .from('master_profiles').select('id').eq('user_id', userId).maybeSingle()
      if (existing) {
        await supabase.from('master_profiles').update({
          tg_chat_id: tgId,
          ...(tgUser?.username ? { telegram: '@' + tgUser.username } : {}),
        }).eq('id', existing.id)
      } else {
        await supabase.from('master_profiles').insert({
          user_id: userId,
          tg_chat_id: tgId,
          telegram: tgUser?.username ? '@' + tgUser.username : '',
        })
      }
    } catch { /* non-critical */ }
  }, [tgId, tgUser])

  useEffect(() => {
    if (tgChecking || !isTg || !tgId) return

    const name = getTelegramDisplayName() || tgUser?.username || ''

    if (name.trim().length >= 2) {
      // Сохраняем имя, телефон и язык для онбординг-визарда
      sessionStorage.setItem('ezze_prefill_name', name.trim())
      if (phoneParam) sessionStorage.setItem('ezze_prefill_phone', phoneParam)
      if (langParam)  sessionStorage.setItem('ezze_prefill_lang',  langParam)

      setAutoRegistering(true)
      ;(async () => {
        try {
          setLoading(true)
          const email    = `tg_${tgId}@ezze.site`
          const password = crypto.randomUUID()
          await registerUser(email, password, name.trim())

          const { data: { user: sbUser } } = await supabase.auth.getUser()
          if (sbUser?.id) await saveTgProfile(sbUser.id)

          // Уведомляем бот: отправить приветствие + установить кнопку меню
          if (tgId) {
            supabase.functions.invoke('tg-master-welcome', {
              body: { tg_chat_id: String(tgId), name: name.trim(), lang: langParam || 'ru' },
            }).catch(() => { /* non-critical */ })
          }

          // Редирект произойдёт через isAuthenticated useEffect
        } catch (e: any) {
          const emailErr = e?.response?.data?.email?.code
          if (emailErr === 'validation_not_unique') {
            // Аккаунт уже есть — пробуем войти
            const initData = window.Telegram?.WebApp?.initData
            if (initData) {
              try {
                const r = await fetch('/api/tg-auth', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ initData }),
                })
                if (r.ok) { navigate('/dashboard', { replace: true }); return }
              } catch {}
            }
          }
          // Авто-регистрация не удалась → показываем форму
          setAutoRegistering(false)
          setShowTgForm(true)
        } finally {
          setLoading(false)
        }
      })()
    } else {
      // Имя слишком короткое → показываем форму ввода
      setShowTgForm(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tgChecking])

  // ── Стандартная форма (email + password) ──────────────────────────────────
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    try {
      setLoading(true)
      await registerUser(values.email, values.password, values.name)
      toast.success(t('auth.registerSuccess'))
    } catch (e: any) {
      const msg = e?.response?.data?.email?.message || t('auth.registerError')
      toast.error(msg)
      setLoading(false)
    }
  }

  // ── Telegram-форма fallback (только имя) ──────────────────────────────────
  const {
    register: tgRegister,
    handleSubmit: tgHandleSubmit,
    formState: { errors: tgErrors },
  } = useForm<TgFormValues>({
    resolver: zodResolver(tgSchema),
    defaultValues: { name: getTelegramDisplayName() || tgUser?.username || '' },
  })

  const onSubmitTg = async (values: TgFormValues) => {
    if (!tgId) { toast.error('Telegram ID не найден'); return }
    // Сохраняем имя, телефон и язык для онбординг-визарда
    sessionStorage.setItem('ezze_prefill_name', values.name.trim())
    if (phoneParam) sessionStorage.setItem('ezze_prefill_phone', phoneParam)
    if (langParam)  sessionStorage.setItem('ezze_prefill_lang',  langParam)
    try {
      setLoading(true)
      const email    = `tg_${tgId}@ezze.site`
      const password = crypto.randomUUID()
      await registerUser(email, password, values.name)

      const { data: { user: sbUser } } = await supabase.auth.getUser()
      if (sbUser?.id) await saveTgProfile(sbUser.id)

      // Уведомляем бот: приветствие + кнопка меню
      supabase.functions.invoke('tg-master-welcome', {
        body: { tg_chat_id: String(tgId), name: values.name.trim(), lang: langParam || 'ru' },
      }).catch(() => { /* non-critical */ })

      toast.success('Аккаунт создан!')
    } catch (e: any) {
      const emailErr = e?.response?.data?.email?.code
      if (emailErr === 'validation_not_unique') {
        const initData = window.Telegram?.WebApp?.initData
        if (initData) {
          try {
            const r = await fetch('/api/tg-auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ initData }),
            })
            if (r.ok) { navigate('/dashboard', { replace: true }); return }
          } catch {}
        }
        toast.error('Аккаунт уже существует')
      } else {
        toast.error('Ошибка регистрации')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Регистрация закрыта ───────────────────────────────────────────────────
  if (appSettings && !appSettings.registration_open) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary overflow-hidden">
          {logoUrl
            ? <img src={logoUrl} alt="" className="h-14 w-14 object-cover" />
            : <Zap className="h-7 w-7 text-primary-foreground" />
          }
        </div>
        <h1 className="text-xl font-semibold">{t('auth.registrationClosed')}</h1>
        <p className="text-muted-foreground text-sm max-w-xs">{t('auth.registrationClosedDesc')}</p>
        <Button variant="outline" onClick={() => navigate('/login')}>
          {t('auth.login')}
        </Button>
      </div>
    )
  }

  // ── Веб-регистрация отключена — только через Telegram ─────────────────────
  if (appSettings && !isTg && appSettings.web_registration_enabled === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center gap-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary overflow-hidden">
          {logoUrl
            ? <img src={logoUrl} alt="" className="h-14 w-14 object-cover" />
            : <Zap className="h-7 w-7 text-primary-foreground" />
          }
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Регистрация только через Telegram</h1>
          <p className="text-muted-foreground text-sm max-w-xs">
            Для регистрации откройте бот <b>@ezzeapp_bot</b> в Telegram
          </p>
        </div>
        <a
          href="https://t.me/ezzeapp_bot"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2AABEE] hover:bg-[#2AABEE]/90 text-white text-sm font-medium transition-colors"
        >
          <Send className="h-4 w-4" />
          Открыть @ezzeapp_bot
        </a>
      </div>
    )
  }

  // ── Проверка / авто-регистрация — показываем спиннер ─────────────────────
  if (tgChecking || autoRegistering) return <LoadingSpinner fullScreen />

  // ── Telegram-форма (fallback: короткое имя или ошибка авто-регистрации) ───
  if (isTg && tgId && showTgForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm">
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary overflow-hidden">
                {logoUrl
                  ? <img src={logoUrl} alt="" className="h-10 w-10 object-cover" />
                  : <Zap className="h-5 w-5 text-primary-foreground" />
                }
              </div>
              <span className="text-2xl font-bold">{platformName}</span>
            </div>
          </div>

          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <CardTitle>
                {tgUser?.first_name
                  ? `Привет, ${tgUser.first_name}! 👋`
                  : 'Создать аккаунт'}
              </CardTitle>
              <CardDescription>Введите ваше имя для профиля мастера</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={tgHandleSubmit(onSubmitTg)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tg-name">Ваше имя</Label>
                  <Input
                    id="tg-name"
                    placeholder="Имя мастера"
                    {...tgRegister('name')}
                  />
                  {tgErrors.name && (
                    <p className="text-xs text-destructive">Минимум 2 символа</p>
                  )}
                </div>

                <Button type="submit" className="w-full" loading={loading}>
                  Создать аккаунт
                </Button>
              </form>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Email и пароль можно добавить позже в настройках профиля
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── Стандартная форма (браузер) ───────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary overflow-hidden">
              {logoUrl
                ? <img src={logoUrl} alt="" className="h-10 w-10 object-cover" />
                : <Zap className="h-5 w-5 text-primary-foreground" />
              }
            </div>
            <span className="text-2xl font-bold">{platformName}</span>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle>{t('auth.createAccount')}</CardTitle>
            <CardDescription>{t('auth.registerSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('auth.name')}</Label>
                <Input id="name" placeholder={t('auth.namePlaceholder')} {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{t('auth.nameMin')}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{t('auth.invalidEmail')}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
                {errors.password && <p className="text-xs text-destructive">{t('auth.passwordMin8')}</p>}
              </div>
              <Button type="submit" className="w-full" loading={loading}>
                {t('auth.createAccount')}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              {t('auth.hasAccount')}{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">
                {t('auth.login')}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
