import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Zap } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/shared/Toaster'
import { useAppSettings } from '@/hooks/useAppSettings'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import pb from '@/lib/pocketbase'
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
  const { t } = useTranslation()
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteCode = searchParams.get('invite')
  const [loading, setLoading] = useState(false)
  const { data: appSettings } = useAppSettings()
  const platformName = appSettings?.platform_name ?? 'Ezze'
  const logoUrl = appSettings?.logo_url

  const isTg    = isTelegramMiniApp()
  const tgUser  = isTg ? getTelegramUser() : null
  const tgId    = isTg ? getTelegramUserId() : null

  // ── Telegram: проверяем — вдруг уже зарегистрирован ──────────────────────
  const [tgChecking, setTgChecking] = useState(isTg)

  useEffect(() => {
    if (!isTg) return
    initMiniApp()

    const initData = window.Telegram?.WebApp?.initData
    if (!initData) { setTgChecking(false); return }

    pb.send('/api/tg-auth', {
      method: 'POST',
      body: { initData } as any,
    })
      .then((data: any) => {
        pb.authStore.save(data.token, data.record)
        navigate('/dashboard', { replace: true })
      })
      .catch(() => {
        // Не найден — покажем форму регистрации
        setTgChecking(false)
      })
  }, [isTg, navigate])

  // ── Стандартная форма (email + password) ──────────────────────────────────
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    try {
      setLoading(true)
      await registerUser(values.email, values.password, values.name)
      navigate(inviteCode ? `/join/${inviteCode}` : '/dashboard')
      toast.success(t('auth.registerSuccess'))
    } catch (e: any) {
      const msg = e?.response?.data?.email?.message || t('auth.registerError')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Telegram-форма (только имя) ───────────────────────────────────────────
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
    try {
      setLoading(true)

      const email    = `tg_${tgId}@ezze.site`
      const password = crypto.randomUUID()

      await registerUser(email, password, values.name)

      // Прописываем tg_chat_id в master_profiles (создаём или обновляем)
      const userId = (pb.authStore as any).record?.id || (pb.authStore as any).model?.id
      if (userId && tgId) {
        try {
          // Ищем существующий профиль
          const existing = await pb.collection('master_profiles')
            .getFirstListItem(`user = "${userId}"`)
            .catch(() => null)

          if (existing) {
            // Обновляем tg_chat_id в существующем профиле
            await pb.collection('master_profiles').update(existing.id, {
              tg_chat_id: tgId,
              ...(tgUser?.username ? { telegram: '@' + tgUser.username } : {}),
            })
          } else {
            // Создаём новый профиль
            await pb.collection('master_profiles').create({
              user:       userId,
              tg_chat_id: tgId,
              telegram:   tgUser?.username ? '@' + tgUser.username : '',
            })
          }
        } catch { /* non-critical */ }
      }

      toast.success('Аккаунт создан!')
      navigate(inviteCode ? `/join/${inviteCode}` : '/dashboard')
    } catch (e: any) {
      // Если email уже занят — значит аккаунт есть, пробуем войти
      const emailErr = e?.response?.data?.email?.code
      if (emailErr === 'validation_not_unique') {
        const initData = window.Telegram?.WebApp?.initData
        if (initData) {
          try {
            const data: any = await pb.send('/api/tg-auth', {
              method: 'POST',
              body: { initData } as any,
            })
            pb.authStore.save(data.token, data.record)
            navigate('/dashboard', { replace: true })
            return
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

  // ── Проверяем Telegram ────────────────────────────────────────────────────
  if (tgChecking) return <LoadingSpinner fullScreen />

  // ── Telegram-форма ────────────────────────────────────────────────────────
  if (isTg && tgId) {
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
