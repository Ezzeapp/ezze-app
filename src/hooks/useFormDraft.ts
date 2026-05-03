import { useEffect, useRef, useState } from 'react'

const VERSION = 1

interface DraftWrapper<T> {
  v: number
  ts: number
  data: T
}

/**
 * Локальный черновик многошаговой формы. Сохраняет state в localStorage с дебаунсом.
 * Возвращает `restored` — это null если черновика нет, иначе сохранённый объект (для UX-баннера «Восстановить?»).
 *
 * Использование:
 *   const { restored, save, clear } = useFormDraft<MyDraft>('cleaning_wizard_draft')
 *   useEffect(() => { save({ cart, clientId, ... }) }, [cart, clientId, ...])
 *   // показать баннер если restored != null, по клику применить restored и вызвать clear()
 */
export function useFormDraft<T>(key: string, opts: { maxAgeHours?: number; debounceMs?: number } = {}) {
  const { maxAgeHours = 24, debounceMs = 500 } = opts
  const [restored, setRestored] = useState<T | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Чтение черновика при mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return
      const wrap = JSON.parse(raw) as DraftWrapper<T>
      if (wrap.v !== VERSION) {
        localStorage.removeItem(key)
        return
      }
      const ageMs = Date.now() - (wrap.ts || 0)
      if (ageMs > maxAgeHours * 3600_000) {
        localStorage.removeItem(key)
        return
      }
      setRestored(wrap.data)
    } catch {
      try { localStorage.removeItem(key) } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function save(data: T) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      try {
        const wrap: DraftWrapper<T> = { v: VERSION, ts: Date.now(), data }
        localStorage.setItem(key, JSON.stringify(wrap))
      } catch { /* ignore quota */ }
    }, debounceMs)
  }

  function clear() {
    if (timerRef.current) clearTimeout(timerRef.current)
    try { localStorage.removeItem(key) } catch { /* ignore */ }
    setRestored(null)
  }

  // dismiss — пользователь нажал «Начать заново» в баннере восстановления.
  // Раньше удалялся только UI-баннер, а localStorage оставался — баннер
  // появлялся снова после F5. Теперь чистим хранилище тоже.
  function dismiss() {
    if (timerRef.current) clearTimeout(timerRef.current)
    try { localStorage.removeItem(key) } catch { /* ignore */ }
    setRestored(null)
  }

  return { restored, save, clear, dismiss }
}
