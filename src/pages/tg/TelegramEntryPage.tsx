import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  isTelegramMiniApp,
  initMiniApp,
  getTelegramUserId,
  getTelegramStartParam,
} from '@/lib/telegramWebApp'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'

/**
 * Точка входа Telegram Mini App — /tg
 *
 * Логика маршрутизации:
 *  1. startapp=book_{slug}  → /book/{slug}      (клиент записывается)
 *  2. startapp=master       → tg-auth → /dashboard  (мастер — полный кабинет)
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
    if (startParam === 'master') {
      doTgAuth(navigate, setNotFound)
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
          doTgAuth(navigate, setNotFound)
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
            Ваш Telegram не привязан ни к одному аккаунту в системе.<br />
            Пожалуйста, зарегистрируйтесь, чтобы начать работу.
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

  return <LoadingSpinner fullScreen />
}

async function doTgAuth(
  navigate: ReturnType<typeof useNavigate>,
  setNotFound: (v: boolean) => void,
) {
  const initData = window.Telegram?.WebApp?.initData
  if (!initData) {
    navigate('/my', { replace: true })
    return
  }

  try {
    const { data, error } = await supabase.functions.invoke('tg-auth', {
      body: { initData },
    })
    const status = (error as any)?.status ?? 0
    if (error || !data) {
      if (status === 404) {
        // Аккаунт удалён / не существует — показываем экран
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
        navigate(window.innerWidth < 1024 ? '/calendar' : '/dashboard', { replace: true })
        return
      }
    }
  } catch {
    // fall through
  }

  navigate('/my', { replace: true })
}
