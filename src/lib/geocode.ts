/**
 * Геокодирование адреса через Nominatim (OpenStreetMap).
 * Бесплатно, без API-ключа. Лимит ~1 запрос/сек.
 *
 * Возвращает { lat, lon } или null если адрес не найден.
 *
 * Кешируем результат в localStorage чтобы не дёргать API повторно
 * для одного и того же адреса.
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  if (!address || address.trim().length < 4) return null

  const cacheKey = `geocode:${address.trim().toLowerCase()}`
  try {
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      if (cached === 'null') return null
      const parsed = JSON.parse(cached)
      if (parsed && typeof parsed.lat === 'number' && typeof parsed.lon === 'number') return parsed
    }
  } catch { /* ignore */ }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
    const res = await fetch(url, {
      headers: {
        // Nominatim требует валидный User-Agent
        'Accept': 'application/json',
      },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) {
      try { localStorage.setItem(cacheKey, 'null') } catch { /* ignore */ }
      return null
    }
    const result = {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    }
    if (!Number.isFinite(result.lat) || !Number.isFinite(result.lon)) return null
    try { localStorage.setItem(cacheKey, JSON.stringify(result)) } catch { /* ignore */ }
    return result
  } catch {
    return null
  }
}

/**
 * Открыть маршрут в Яндекс.Картах через URL-схему (без API).
 * Точки передаются через `~` в `rtext`.
 */
export function buildYandexRouteUrl(points: Array<{ lat: number; lon: number }>): string {
  if (points.length === 0) return ''
  const rtext = points.map(p => `${p.lat},${p.lon}`).join('~')
  return `https://yandex.com/maps/?rtext=${rtext}&rtt=auto`
}
