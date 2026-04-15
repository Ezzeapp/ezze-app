import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import {
  isTelegramMiniApp,
  initMiniApp,
  getTelegramUserId,
  getTelegramStartParam,
} from '@/lib/telegramWebApp'

/** Дефолтный путь после входа — зависит от продукта */
function getDefaultPath(): string {
  if (PRODUCT === 'cleaning') return '/orders'
  if (PRODUCT === 'farm')     return '/farm'
  return window.innerWidth < 1024 ? '/calendar' : '/dashboard'
}
import { TelegramSplash } from '@/components/shared/TelegramSplash'
import { Button } from '@/components/ui/button'

/**
 * Точка входа Telegram Mini App — /tg
 *
 * Логика маршрутизации:
 *  1. startapp=book_{slug}  → /book/{slug}      (клиент записывается)
 *  2. startapp=master       → tg-auth → /dashboard  (мастер — полный кабинет)
 *     При ошибке/удалении — экран "аккаунт не найден" (НЕ в клиентский кабинет)
 *  3. (auto-detect по tg_id):
 *       tg_id найден в master_profiles → tg-auth → /dashboard
 *       иначе → /my  (клиентский кабинет)
 */
export function TelegramEntryPage() {
  const navigate = useNavigate()
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (isTelegramMiniApp()) {
      initMiniApp()
    }

    const startParam = getTelegramStartParam()
      || new URLSearchParams(window.location.search).get('start')
      || ''

    // ── 1. Явный параметр: запись к мастеру ──
    if (startParam.startsWith('book_')) {
      const slug = startParam.slice(5)
      navigate(`/book/${slug}`, { replace: true })
      return
    }

    // ── 2. Явный параметр: кабинет мастера → авторизуем ──
    // Если авторизация не удалась (аккаунт удалён, initData отсутствует,
    // любая ошибка) — показываем экран "аккаунт не найден", а НЕ клиентский кабинет.
    if (startParam === 'master') {
      // После регистрации на другом домене токены передаются прямо в URL
      const urlParams = new URLSearchParams(window.location.search)
      const at = urlParams.get('at')
      const rt = urlParams.get('rt')
      if (at && rt) {
        supabase.auth.setSession({ access_token: at, refresh_token: rt })
          .then(({ error }) => {
            if (!error) {
              // Полная перезагрузка страницы — к этому моменту setSession уже записал
              // сессию в localStorage, поэтому при новой загрузке getSession() вернёт
              // сессию и AuthContext инициализируется корректно (нет race condition).
              const target = getDefaultPath()
              window.location.replace(target)
            } else {
              doTgAuth(navigate, setNotFound, true)
            }
          })
          .catch(() => doTgAuth(navigate, setNotFound, true))
        return
      }
      doTgAuth(navigate, setNotFound, /* masterOnly */ true)
      return
    }

    // ── 3. Auto-detect по telegram_id ──
    const tgId = getTelegramUserId()

    if (!tgId) {
      navigate('/my', { replace: true })
      return
    }

    // Ищем профиль мастера с этим tg_chat_id
    supabase
      .from('master_profiles')
      .select('id')
      .eq('tg_chat_id', tgId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          // Нашли — это мастер, авторизуем
          doTgAuth(navigate, setNotFound, false)
        } else {
          // Не нашли — это клиент
          navigate('/my', { replace: true })
        }
      })
  }, [navigate])

  // Экран: аккаунт не найден / удалён
  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 gap-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
          <Zap className="h-7 w-7 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold">Аккаунт не найден</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ваш аккаунт мастера не найден в системе.<br />
            Возможно, он был удалён. Для уточнения обратитесь к администратору.<br />
            Вы можете зарегистрироваться снова.
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Button onClick={() => navigate('/register', { replace: true })}>
            Зарегистрироваться
          </Button>
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => window.Telegram?.WebApp?.close?.()}
          >
            Закрыть
          </Button>
        </div>
      </div>
    )
  }

  return <TelegramSplash />
}

/**
 * @param masterOnly  true  → все ошибки показывают notFound (не /my)
 *                   false → при ошибке не-404 → /my (авто-детект поток)
 */
async function doTgAuth(
  navigate: ReturnType<typeof useNavigate>,
  setNotFound: (v: boolean) => void,
  masterOnly: boolean,
) {
  const initData = window.Telegram?.WebApp?.initData

  if (!initData) {
    // Нет initData — в браузере или Telegram не передал данные
    if (masterOnly) {
      setNotFound(true)
    } else {
      navigate('/my', { replace: true })
    }
    return
  }

  try {
    const { data, error } = await supabase.functions.invoke('tg-auth', {
      body: { initData, product: import.meta.env.VITE_PRODUCT || 'beauty' },
    })
    const status = (error as any)?.status ?? 0

    if (error || !data) {
      if (status === 404 || masterOnly) {
        // 404 = аккаунт не найден / удалён
        // masterOnly = любая ошибка при явном start=master → тот же экран
        setNotFound(true)
        return
      }
      navigate('/my', { replace: true })
      return
    }

    if (data?.access_token && data?.refresh_token) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })
      if (!sessionError) {
        const { data: { user: sbUser } } = await supabase.auth.getUser()
        if (sbUser?.id) {
          // Проверяем онбординг
          const lsKey = `ezze_onboarded_${sbUser.id}`
          const locallyDone = localStorage.getItem(lsKey) === '1'
          if (!locallyDone) {
            const { data: ud } = await supabase
              .from('users').select('onboarded').eq('id', sbUser.id).maybeSingle()
            if (!ud?.onboarded) {
              navigate('/register', { replace: true })
              return
            }
          }

          // Проверяем наличие master_profiles (мог быть удалён админом)
          const tgId = getTelegramUserId()
          const { data: profile, error: profileErr } = await supabase
            .from('master_profiles')
            .select('id, tg_chat_id')
            .eq('user_id', sbUser.id)
            .maybeSingle()
          if (!profile) {
            if (profileErr) {
              // Ошибка запроса — не сбрасываем онбординг, пускаем в приложение
              navigate(getDefaultPath(), { replace: true })
              return
            }
            // Профиль точно отсутствует — сбрасываем онбординг
            localStorage.removeItem(lsKey)
            await supabase.from('users').update({ onboarded: false }).eq('id', sbUser.id)
            navigate('/register', { replace: true })
            return
          }

          // Обновляем tg_chat_id если не привязан
          if (tgId && !profile.tg_chat_id) {
            supabase.from('master_profiles').update({ tg_chat_id: tgId }).eq('id', profile.id)
          }
        }
        navigate(getDefaultPath(), { replace: true })
        return
      }
    }
  } catch {
    // fall through
  }

  // Финальный фолбэк
  if (masterOnly) {
    setNotFound(true)
  } else {
    navigate('/my', { replace: true })
  }
}
