import { useState, useCallback, useEffect } from 'react'

const KEY = 'cleaning_favourite_item_types'

function loadFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

export function useFavouriteItemTypes() {
  const [favs, setFavs] = useState<Set<string>>(() => loadFromStorage())

  const toggle = useCallback((id: string) => {
    setFavs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try { localStorage.setItem(KEY, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }, [])

  // Sync between tabs
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === KEY) setFavs(loadFromStorage())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return { favs, toggle, isFavourite: (id: string) => favs.has(id) }
}
