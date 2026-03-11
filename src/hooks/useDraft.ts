import { useCallback } from 'react'

export function useDraft<T>(key: string) {
  const save = useCallback((data: T) => {
    try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* ignore */ }
  }, [key])

  const load = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : null
    } catch { return null }
  }, [key])

  const clear = useCallback(() => {
    try { localStorage.removeItem(key) } catch { /* ignore */ }
  }, [key])

  const exists = useCallback((): boolean => {
    try { return localStorage.getItem(key) !== null } catch { return false }
  }, [key])

  return { save, load, clear, exists }
}
