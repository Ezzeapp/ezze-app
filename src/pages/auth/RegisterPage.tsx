import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Zap } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { SpecialtyStep } from '@/components/onboarding/SpecialtyStep'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/shared/Toaster'
import { useAppSettings } from '@/hooks/useAppSettings'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { TelegramSplash } from '@/components/shared/TelegramSplash'
import { supabase } from '@/lib/supabase'
import {
  isTelegramMiniApp,
  initMiniApp,
  getTelegramUser,
  getTelegramUserId,
  getTelegramDisplayName,
} from '@/lib/telegramWebApp'

// ── Компонент ──────────────────────────────────────────────────────────────

export function RegisterPage() {
  const { t, i18n } = useTranslation()
  const { register: registerUser, isAuthenticated, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteCode = searchParams.get('invite')
  const langParam  = searchParams.get('lang')
  const phoneParam = searchParams.get('phone')
  const nameParam  = searchParams.get('name')

  const [loading,           setLoading]           = useState(false)
  const [showSpecialtyStep, setShowSpecialtyStep] = useState(false)
  const [registeredUserId,  setRegisteredUserId]  = useState('')
  const [registeredName,    setRegisteredName]    = useState('')

  // Флаг: tgChecking useEffect уже обработал пользователя (показал SpecialtyStep)
  // Предотвращает запуск авто-регистрации когда tgChecking → false
  const tgPreHandled = useRef(false)

  const isTg   = isTelegramMiniApp()
  const tgUser = isTg ? getTelegramUser() : null
  const tgId   = isTg ? getTelegramUserId() : null

  const { data: appSettings } = useAppSettings()
  const platformName = appSettings?.platform_name ?? 'Ezze'
  const logoUrl      = appSettings?.logo_url

  // Язык из бота — применяем сразу
  useEffect(() => {
    if (langParam) {
      i18n.changeLanguage(langParam)
      sessionStorage.setItem('ezze_prefill_lang', langParam)
    }
  }, [langParam, i18n])

  // Redirect браузерных пользователей после авторизации
  useEffect(() => {
    if (isTg) return
    if (!authLoading && isAuthenticated) {
      navigate(inviteCode ? `/join/${inviteCode}` : '/calendar', { replace: true })
    }
  }, [isAuthenticated, authLoading, navigate, inviteCode, isTg])

  // ── Telegram: проверяем — вдруг уже зарегистрирован ──────────────────────
  const [tgChecking, setTgChecking] = useState(isTg)

  useEffect(() => {
    if (!isTg) return
    initMiniApp()

    const initData = window.Telegram?.WebApp?.initData
    if (!initData) { setTgChecking(false); return }

    supabase.functions.invoke('tg-auth', { body: { initData, silent: true } })
      .then(async ({ data, error }) => {
        if (!error && data?.access_token) {
          const { error: sessionErr } = await supabase.auth.setSession({
            access_token:  data.access_token,
            refresh_token: data.refresh_token,
          })
          if (sessionErr) { setTgChecking(false); return }

          // Если онбординг не завершён — показываем SpecialtyStep, а не /calendar
          const { data: { user: sbUser } } = await supabase.auth.getUser()
          if (sbUser?.id) {
            const lsKey = `ezze_onboarded_${sbUser.id}`
            const locallyDone = localStorage.getItem(lsKey) === '1'
            if (!locallyDone) {
              const { data: ud } = await supabase
                .from('users').select('onboarded').eq('id', sbUser.id).maybeSingle()
              if (!ud?.onboarded) {
                const displayName = nameParam
                  || getTelegramDisplayName()
                  || (sbUser.user_metadata?.name as string)
                  || ''
                tgPreHandled.current = true   // блокируем авто-регистрацию
                setRegisteredUserId(sbUser.id)
                setRegisteredName(displayName)
                setTgChecking(false)
                setShowSpecialtyStep(true)
                return
              }
            }
          }
          navigate('/calendar', { replace: true })
        } else {
          setTgChecking(false)
        }
      })
      .catch(() => setTgChecking(false))
  }, [isTg, navigate])

  // ── Сохраняем TG профиль в master_profiles ────────────────────────────────
  const saveTgProfile = useCallback(async (userId: string, displayName?: string) => {
    if (!tgId || !userId) return
    try {
      const { data: existing } = await supabase
        .from('master_profiles').select('id').eq('user_id', userId).maybeSingle()
      if (existing) {
        await supabase.from('master_profiles').update({
          tg_chat_id: tgId,
          ...(tgUser?.username  ? { telegram:     '@' + tgUser.username } : {}),
          ...(displayName       ? { display_name: displayName }           : {}),
          ...(phoneParam        ? { phone:        phoneParam }            : {}),
        }).eq('id', existing.id)
      } else {
        await supabase.from('master_profiles').insert({
          user_id:      userId,
          tg_chat_id:   tgId,
          telegram:     tgUser?.username ? '@' + tgUser.username : '',
          ...(displayName ? { display_name: displayName } : {}),
          ...(phoneParam  ? { phone:        phoneParam }  : {}),
        })
      }
    } catch { /* non-critical */ }
  }, [tgId, tgUser, phoneParam])

  // ── Авто-регистрация через Telegram (без формы) ───────────────────────────
  const [autoRegistering, setAutoRegistering] = useState(false)
  const [tgRegError,      setTgRegError]      = useState(false)

  useEffect(() => {
    // tgPreHandled.current = true означает что tgChecking useEffect уже показал SpecialtyStep
    if (tgChecking || !isTg || !tgId || tgPreHandled.current) return

    const rawName = nameParam || getTelegramDisplayName() || tgUser?.username || ''
    const name    = rawName.trim().length >= 2 ? rawName.trim() : (tgUser?.username || 'Новый пользователь')

    sessionStorage.setItem('ezze_prefill_name',  name)
    sessionStorage.setItem('ezze_tg_notify_id',  String(tgId))
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
        if (sbUser?.id) {
          await saveTgProfile(sbUser.id, name)
          setRegisteredUserId(sbUser.id)
        }

        setRegisteredName(name)
        setAutoRegistering(false)
        // Показываем выбор специальности вместо полного OnboardingWizard
        setShowSpecialtyStep(true)

      } catch (e: any) {
        const errMsg    = (e as Error)?.message || ''
        const alreadyExists =
          errMsg.toLowerCase().includes('already registered') ||
          errMsg.toLowerCase().includes('already exists') ||
          errMsg.toLowerCase().includes('email address is already')

        if (alreadyExists || isTg) {
          // В TG-контексте — пробуем войти через tg-auth
          const initData = window.Telegram?.WebApp?.initData
          if (initData) {
            try {
              const { data: authData, error: authErr } = await supabase.functions.invoke('tg-auth', {
                body: { initData },
              })
              if (!authErr && authData?.access_token) {
                await supabase.auth.setSession({
                  access_token:  authData.access_token,
                  refresh_token: authData.refresh_token,
                })
                navigate('/calendar', { replace: true })
                return
              }
            } catch {}
          }
        }

        if (!alreadyExists) toast.error('Ошибка регистрации')
        if (isTg) setTgRegError(true)
        setAutoRegistering(false)
      } finally {
        setLoading(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tgChecking])

  // ── Регистрация закрыта (только для веб, не для TG) ───────────────────────
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

  // ── Проверка / авто-регистрация — брендовый сплэш ───────────────────────
  if (tgChecking || autoRegistering) return <TelegramSplash />

  // ── Выбор специальности (только TG, после авто-регистрации) ──────────────
  if (showSpecialtyStep && tgId) {
    return (
      <SpecialtyStep
        userId={registeredUserId}
        tgChatId={String(tgId)}
        name={registeredName}
        lang={langParam || sessionStorage.getItem('ezze_prefill_lang') || 'ru'}
      />
    )
  }

  // ── В Telegram-контексте без showSpecialtyStep — спиннер или ошибка ────────
  if (isTg && tgRegError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 gap-4 text-center">
        <p className="text-sm text-muted-foreground">
          Произошла ошибка при регистрации. Закройте это окно и попробуйте снова.
        </p>
        <Button variant="outline" onClick={() => window.Telegram?.WebApp?.close?.()}>
          Закрыть
        </Button>
      </div>
    )
  }
  if (isTg) return <TelegramSplash />

  // ── Браузер: направляем в Telegram бот ───────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm text-center space-y-6">

        {/* Логотип */}
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary overflow-hidden">
            {logoUrl
              ? <img src={logoUrl} alt="" className="h-14 w-14 object-cover" />
              : <Zap className="h-7 w-7 text-primary-foreground" />
            }
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold">{platformName}</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Для регистрации откройте Telegram бот —<br />
            это займёт меньше минуты
          </p>
        </div>

        <Button asChild size="lg" className="w-full">
          <a href="https://t.me/ezzepro_bot" target="_blank" rel="noreferrer">
            📱 Открыть @ezzepro_bot
          </a>
        </Button>

        <p className="text-sm text-muted-foreground">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Войти
          </Link>
        </p>

      </div>
    </div>
  )
}
