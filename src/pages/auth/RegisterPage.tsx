import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Zap, Phone, Globe } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
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
  getTelegramLanguageCode,
} from '@/lib/telegramWebApp'
import {
  completeOnboarding,
  saveProfession,
} from '@/lib/onboarding-utils'
import { autoImportCleaningCatalog } from '@/lib/cleaningAutoImport'
import { autoImportBeautyCatalog } from '@/lib/beautyAutoImport'
import { autoImportWorkshopCatalog } from '@/lib/workshopAutoImport'
import { PRODUCT_URL_MAP } from '@/lib/products'
import { ProductSelectionStep } from '@/components/onboarding/ProductSelectionStep'

// Поддерживаемые языки
const SUPPORTED_LANGS = [
  { code: 'ru', label: 'Русский' },
  { code: 'uz', label: "O'zbekcha" },
  { code: 'en', label: 'English' },
  { code: 'tg', label: 'Тоҷикӣ' },
  { code: 'kz', label: 'Қазақша' },
  { code: 'ky', label: 'Кыргызча' },
]

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

  const isTg   = isTelegramMiniApp()
  const tgUser = isTg ? getTelegramUser() : null
  const tgId   = isTg ? getTelegramUserId() : null

  const { data: appSettings } = useAppSettings()
  const platformName = appSettings?.platform_name ?? 'Ezze'
  const logoUrl      = appSettings?.logo_url

  // ── Состояние формы ──────────────────────────────────────────────────────

  const [formLang, setFormLang] = useState(
    langParam || (isTg ? getTelegramLanguageCode() : 'ru')
  )
  const [formName, setFormName] = useState(
    nameParam || (isTg ? getTelegramDisplayName() : '') || ''
  )
  const [formPhone, setFormPhone] = useState(phoneParam || '')
  const [saving, setSaving] = useState(false)

  // Шаг 0: выбор продукта — всегда показываем новым мастерам в боте.
  // Намеренно НЕ используем VITE_PRODUCT как дефолт: иначе на pro.ezze.site (beauty)
  // шаг 0 пропускается и карточки не видны.
  const [selectedProduct, setSelectedProduct] = useState('')

  // Для уже зарегистрированных, но не онбордeнных
  const [existingUserId, setExistingUserId] = useState('')
  const alreadyRegistered = !!existingUserId

  // ── Init ──────────────────────────────────────────────────────────────────

  // Применяем язык
  useEffect(() => {
    const lang = SUPPORTED_LANGS.find(l => l.code === formLang) ? formLang : 'ru'
    if (i18n.language !== lang) i18n.changeLanguage(lang)
  }, [formLang, i18n])

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

    supabase.functions.invoke('tg-auth', {
      body: { initData, silent: true, product: import.meta.env.VITE_PRODUCT || 'beauty' },
    }).then(async ({ data, error }) => {
        if (!error && data?.access_token) {
          const { error: sessionErr } = await supabase.auth.setSession({
            access_token:  data.access_token,
            refresh_token: data.refresh_token,
          })
          if (sessionErr) { setTgChecking(false); return }

          const { data: { user: sbUser } } = await supabase.auth.getUser()
          if (sbUser?.id) {
            const lsKey = `ezze_onboarded_${sbUser.id}`
            const locallyDone = localStorage.getItem(lsKey) === '1'

            // Проверяем наличие master_profiles для текущего продукта (мог быть удалён админом)
            const product = selectedProduct || import.meta.env.VITE_PRODUCT || 'beauty'
            const { data: profile, error: profileErr } = await supabase
              .from('master_profiles')
              .select('display_name, phone, profession')
              .eq('user_id', sbUser.id)
              .eq('product', product)
              .maybeSingle()

            if (!profile) {
              if (profileErr) {
                // Ошибка запроса — не сбрасываем онбординг, отправляем в приложение
                navigate('/calendar', { replace: true })
                return
              }
              // Профиль точно отсутствует — сбрасываем онбординг
              localStorage.removeItem(lsKey)
              await supabase.from('users').update({ onboarded: false }).eq('id', sbUser.id)
              setExistingUserId(sbUser.id)
              setTgChecking(false)
              return
            }

            if (!locallyDone) {
              const { data: ud } = await supabase
                .from('users').select('onboarded').eq('id', sbUser.id).maybeSingle()
              if (!ud?.onboarded) {
                // Зарегистрирован, но не онбордeн — показываем форму с предзаполненными данными
                if (profile.display_name) setFormName(profile.display_name)
                if (profile.phone) setFormPhone(profile.phone)
                setExistingUserId(sbUser.id)
                setTgChecking(false)
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
  const saveTgProfile = useCallback(async (userId: string, displayName: string, phone: string) => {
    if (!tgId || !userId) return
    try {
      const product = selectedProduct || import.meta.env.VITE_PRODUCT || 'beauty'
      const { data: existing } = await supabase
        .from('master_profiles').select('id')
        .eq('user_id', userId)
        .eq('product', product)
        .maybeSingle()
      if (existing) {
        await supabase.from('master_profiles').update({
          tg_chat_id: tgId,
          ...(tgUser?.username  ? { telegram:     '@' + tgUser.username } : {}),
          ...(displayName       ? { display_name: displayName }           : {}),
          ...(phone             ? { phone }                               : {}),
        }).eq('id', existing.id)
      } else {
        await supabase.from('master_profiles').insert({
          user_id:      userId,
          tg_chat_id:   tgId,
          telegram:     tgUser?.username ? '@' + tgUser.username : '',
          product,
          ...(displayName ? { display_name: displayName } : {}),
          ...(phone       ? { phone }                     : {}),
        })
      }
    } catch { /* non-critical */ }
  }, [tgId, tgUser, selectedProduct])

  // ── Телефон из initData (если уже делился ранее) ─────────────────────────
  useEffect(() => {
    if (!formPhone && isTg) {
      const phone = window.Telegram?.WebApp?.initDataUnsafe?.user?.phone_number
      if (phone) setFormPhone(phone)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTg])

  // ── Поделиться телефоном из Telegram ──────────────────────────────────────
  const [contactRequested, setContactRequested] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Polling — забираем телефон из tg_phone_cache (fallback если callback не сработал)
  const startPhonePolling = useCallback(() => {
    if (!tgId) return
    // Останавливаем предыдущий polling
    if (pollRef.current) clearInterval(pollRef.current)

    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts++
      if (attempts > 15) { // 30 секунд (15 × 2с)
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = null
        return
      }
      try {
        const { data } = await supabase
          .from('tg_phone_cache')
          .select('phone')
          .eq('tg_chat_id', tgId)
          .maybeSingle()
        if (data?.phone) {
          setFormPhone(data.phone)
          setContactRequested(false)
          // Удаляем из кеша
          await supabase.from('tg_phone_cache').delete().eq('tg_chat_id', tgId)
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
        }
      } catch { /* ignore */ }
    }, 2000)
  }, [tgId])

  // Cleanup polling при размонтировании
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const requestTgContact = useCallback(() => {
    const wa = window.Telegram?.WebApp
    if (!wa?.requestContact) return
    setContactRequested(true)

    const timer = setTimeout(() => setContactRequested(false), 30000)

    // Запускаем polling как fallback — если контакт уйдёт в чат бота
    startPhonePolling()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok = wa.requestContact((shared: boolean, res: any) => {
      clearTimeout(timer)
      setContactRequested(false)
      // Разные версии Telegram возвращают разные форматы:
      // { contact: { phone_number } } | { responseUnsafe: { contact: { phone_number } } } | { phone_number }
      const phone: string =
        res?.responseUnsafe?.contact?.phone_number ??
        res?.contact?.phone_number ??
        res?.phone_number ?? ''
      if (shared && phone) {
        setFormPhone(phone)
        // Останавливаем polling — телефон получен через callback
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      }
    })

    // Desktop / Web возвращают false — не поддерживается
    if (ok === false) { clearTimeout(timer); setContactRequested(false) }
  }, [startPhonePolling])

  // ── Валидация формы ───────────────────────────────────────────────────────
  const canSubmit = formName.trim().length >= 2
    && formPhone.replace(/\D/g, '').length >= 7
    && !saving

  // ── Сабмит — регистрация + онбординг за один раз ──────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit || !tgId) return
    setSaving(true)
    try {
      let userId = existingUserId

      if (!alreadyRegistered) {
        // 1. Создаём аккаунт
        const email    = `tg_${tgId}@ezze.site`
        const password = crypto.randomUUID()
        await registerUser(email, password, formName.trim())

        const { data: { user: sbUser } } = await supabase.auth.getUser()
        if (!sbUser?.id) throw new Error('No user after signup')
        userId = sbUser.id

        // 2. Сохраняем продукт (для универсальной регистрации через единый бот)
        if (selectedProduct) {
          await supabase.from('users').update({ product: selectedProduct }).eq('id', userId)
        }

        // 3. Сохраняем TG профиль
        await saveTgProfile(userId, formName.trim(), formPhone)
      }

      if (!userId) throw new Error('No userId')

      // 4. Сохраняем slug (профессию мастер выберет сам через справочник)
      await saveProfession(userId, '', formName.trim())

      // 5. Завершаем онбординг + tg-master-welcome (с product и app_url)
      const finalProduct = selectedProduct || import.meta.env.VITE_PRODUCT || 'beauty'
      const finalAppUrl  = PRODUCT_URL_MAP[finalProduct] || import.meta.env.VITE_APP_URL || 'https://pro.ezze.site'

      // 5a. Автозагрузка прайса для cleaning (только при первой регистрации,
      // а не при повторном вызове onboarding для уже существующего юзера).
      if (!alreadyRegistered && finalProduct === 'cleaning') {
        await autoImportCleaningCatalog().catch(() => { /* non-critical */ })
      }
      if (!alreadyRegistered && finalProduct === 'beauty') {
        await autoImportBeautyCatalog(userId).catch(() => { /* non-critical */ })
      }
      if (!alreadyRegistered && finalProduct === 'workshop') {
        await autoImportWorkshopCatalog(userId).catch(() => { /* non-critical */ })
      }

      await completeOnboarding(userId, String(tgId), formName.trim(), formLang, finalProduct, finalAppUrl)

      // Редирект на правильный продукт — передаём токены сессии напрямую,
      // т.к. localStorage у каждого домена свой и tg-auth может не сработать
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      const at = currentSession?.access_token
      const rt = currentSession?.refresh_token
      const sessionParams = at && rt
        ? `&at=${encodeURIComponent(at)}&rt=${encodeURIComponent(rt)}`
        : ''
      window.location.replace(`${finalAppUrl}/tg?start=master${sessionParams}`)
    } catch (e: any) {
      const errMsg = (e as Error)?.message || ''
      const alreadyExists =
        errMsg.toLowerCase().includes('already registered') ||
        errMsg.toLowerCase().includes('already exists') ||
        errMsg.toLowerCase().includes('email address is already')

      if (alreadyExists) {
        // Пробуем войти через tg-auth
        const initData = window.Telegram?.WebApp?.initData
        if (initData) {
          try {
            const { data: authData, error: authErr } = await supabase.functions.invoke('tg-auth', {
              body: { initData, product: import.meta.env.VITE_PRODUCT || 'beauty' },
            })
            if (!authErr && authData?.access_token) {
              await supabase.auth.setSession({
                access_token:  authData.access_token,
                refresh_token: authData.refresh_token,
              })
              // Получаем userId и завершаем онбординг
              const { data: { user: sbUser } } = await supabase.auth.getUser()
              if (sbUser?.id) {
                await saveTgProfile(sbUser.id, formName.trim(), formPhone)
                await saveProfession(sbUser.id, '', formName.trim())
                const fallbackProduct = selectedProduct || import.meta.env.VITE_PRODUCT || 'beauty'
                const fallbackAppUrl  = PRODUCT_URL_MAP[fallbackProduct] || import.meta.env.VITE_APP_URL || 'https://pro.ezze.site'

                // Автозагрузка прайса для cleaning (idempotent upsert).
                if (fallbackProduct === 'cleaning') {
                  await autoImportCleaningCatalog().catch(() => { /* non-critical */ })
                }
                if (fallbackProduct === 'beauty') {
                  await autoImportBeautyCatalog(sbUser.id).catch(() => { /* non-critical */ })
                }
                if (fallbackProduct === 'workshop') {
                  await autoImportWorkshopCatalog(sbUser.id).catch(() => { /* non-critical */ })
                }

                await completeOnboarding(sbUser.id, String(tgId), formName.trim(), formLang, fallbackProduct, fallbackAppUrl)
                window.location.replace(`${fallbackAppUrl}/tg?start=master`)
                return
              }
            }
          } catch { /* fallthrough */ }
        }
      }

      if (!alreadyExists) toast.error('Ошибка регистрации')
      setSaving(false)
    }
  }

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

  // ── Проверка TG — брендовый сплэш ─────────────────────────────────────────
  if (tgChecking) return <TelegramSplash />

  // ── Шаг 0: выбор продукта (только для универсальной регистрации через @ezzemaster_bot)
  if (isTg && tgId && !selectedProduct) {
    return <ProductSelectionStep onSelect={setSelectedProduct} initialLang={formLang} />
  }

  // ── TG: единая форма регистрации ──────────────────────────────────────────
  if (isTg && tgId) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex flex-col max-w-md mx-auto w-full p-4">

          {/* Заголовок */}
          <div className="mb-4 pt-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{t('auth.register')}</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {platformName}
              </p>
            </div>
            {/* Выбор языка */}
            <div className="relative">
              <Globe className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={formLang}
                onChange={e => setFormLang(e.target.value)}
                className="h-8 pl-7 pr-2 rounded-md border border-input bg-background text-xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {SUPPORTED_LANGS.map(l => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Имя */}
          <label className="text-sm font-medium mb-1">{t('auth.name')}</label>
          <input
            type="text"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder={t('auth.namePlaceholder')}
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
          <label className="text-sm font-medium mb-1">{t('profile.phone')}</label>
          <div className="flex gap-2 mb-3">
            <input
              type="tel"
              value={formPhone}
              onChange={e => setFormPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
              autoComplete="tel"
              className={[
                'flex h-10 flex-1 rounded-md border border-input bg-background',
                'px-3 py-2 text-sm ring-offset-background',
                'placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              ].join(' ')}
            />
            {window.Telegram?.WebApp && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                disabled={contactRequested}
                onClick={requestTgContact}
                title="Поделиться номером"
              >
                <Phone className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Кнопка */}
          <div className="mt-4 pb-safe-bottom pb-4">
            <Button
              className="w-full"
              size="lg"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {saving ? <LoadingSpinner /> : t('onboarding.finish')}
            </Button>
          </div>

        </div>
      </div>
    )
  }

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
            {t('auth.registerViaTelegram')}
          </p>
        </div>

        <a href={`https://t.me/${import.meta.env.VITE_MASTER_BOT || 'ezzepro_bot'}`} target="_blank" rel="noreferrer">
          <Button size="lg" className="w-full">
            {t('auth.openBot')}
          </Button>
        </a>

        <p className="text-sm text-muted-foreground">
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t('auth.login')}
          </Link>
        </p>

      </div>
    </div>
  )
}
