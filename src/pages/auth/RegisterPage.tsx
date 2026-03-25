import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Send, Zap } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
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
  const [showWizard, setShowWizard] = useState(false)
  const [wizardName, setWizardName] = useState('')

  const isTg   = isTelegramMiniApp()

  // Redirect when auth state becomes valid (not in TG context — tg-auth handles it there)
  useEffect(() => {
    if (isTg) return
    if (!authLoading && isAuthenticated) {
      navigate(inviteCode ? `/join/${inviteCode}` : '/dashboard', { replace: true })
    }
  }, [isAuthenticated, authLoading, navigate, inviteCode, isTg])

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

  const saveTgProfile = useCallback(async (userId: string, displayName?: string) => {
    if (!tgId || !userId) return
    try {
      const { data: existing } = await supabase
        .from('master_profiles').select('id').eq('user_id', userId).maybeSingle()
      if (existing) {
        await supabase.from('master_profiles').update({
          tg_chat_id: tgId,
          ...(tgUser?.username ? { telegram: '@' + tgUser.username } : {}),
          ...(displayName ? { display_name: displayName } : {}),
        }).eq('id', existing.id)
      } else {
        await supabase.from('master_profiles').insert({
          user_id: userId,
          tg_chat_id: tgId,
          telegram: tgUser?.username ? '@' + tgUser.username : '',
          ...(displayName ? { display_name: displayName } : {}),
        })
      }
    } catch { /* non-critical */ }
  }, [tgId, tgUser])

  useEffect(() => {
    if (tgChecking || !isTg || !tgId) return

    // Используем любое доступное имя, fallback — 'Мастер'
    const rawName = getTelegramDisplayName() || tgUser?.username || ''
    const name = rawName.trim().length >= 2 ? rawName.trim() : (tgUser?.username || 'Новый пользователь')

    sessionStorage.setItem('ezze_prefill_name', name)
    sessionStorage.setItem('ezze_tg_notify_id', String(tgId))
    if (phoneParam) sessionStorage.setItem('ezze_prefill_phone', phoneParam)
    if (langParam)  sessionStorage.setItem('ezze_prefill_lang',  langParam)

    setAutoRegistering(true)
    ;(async () => {
      try {
        setLoading(true)
        const email    = `tg_${tgId}@ezze.site`
        const password = crypto.randomUUID()
        await registerUser(email, password, name)

        const { data: { user: sbUser } } = await supabase.auth.getUser()
        if (sbUser?.id) await saveTgProfile(sbUser.id, name)

        setWizardName(name)
        setAutoRegistering(false)
        setShowWizard(true)
      } catch (e: any) {
        // Проверяем — аккаунт уже существует (Supabase или PocketBase формат)
        const errMsg    = (e as Error)?.message || ''
        const emailCode = e?.response?.data?.email?.code || ''
        const alreadyExists =
          emailCode === 'validation_not_unique' ||          // PocketBase (legacy)
          errMsg.toLowerCase().includes('already registered') || // Supabase
          errMsg.toLowerCase().includes('already exists') ||
          errMsg.toLowerCase().includes('email address is already')

        if (alreadyExists || isTg) {
          // В Telegram-контексте ВСЕГДА пробуем войти через tg-auth
          const initData = window.Telegram?.WebApp?.initData
          if (initData) {
            try {
              const { data: authData, error: authErr } = await supabase.functions.invoke('tg-auth', {
                body: { initData },
              })
              if (!authErr && authData?.access_token) {
                await supabase.auth.setSession({
                  access_token: authData.access_token,
                  refresh_token: authData.refresh_token,
                })
                navigate('/dashboard', { replace: true })
                return
              }
            } catch {}
          }
        }

        if (!alreadyExists) toast.error('Ошибка регистрации')
        setAutoRegistering(false)
      } finally {
        setLoading(false)
      }
    })()
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

  // ── Регистрация закрыта (только для веб, не для Telegram Mini App) ────────
  if (appSettings && !appSettings.registration_open && !isTg) {
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

  // ── Онбординг сразу после регистрации ──────────────────────────────────────
  if (showWizard) {
    return (
      <OnboardingWizard
        open={true}
        onComplete={() => navigate('/dashboard', { replace: true })}
        prefill={{ name: '', phone: phoneParam || '' }}
      />
    )
  }

  // ── В Telegram-контексте никогда не показываем стандартную форму ──────────
  if (isTg) return <LoadingSpinner fullScreen />

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
