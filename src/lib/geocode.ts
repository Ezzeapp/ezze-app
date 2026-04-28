/**
 * Геокодирование адреса через Nominatim (OpenStreetMap).
 * Бесплатно, без API-ключа. Лимит ~1 запрос/сек.
 *
 * Двухступенчатый поиск:
 *  1) В viewbox Узбекистана с bounded=1 + countrycodes=uz → точные результаты в стране.
 *  2) Если ничего — fallback без bounded (на случай если viewbox слишком жёсткий).
 *
 * Кешируем результат в localStorage чтобы не дёргать API повторно.
 */

// Bbox Узбекистана: left,top,right,bottom (по WGS84 lon,lat,lon,lat)
const UZ_VIEWBOX = '55.9,45.6,73.2,37.2'

async function fetchNominatim(params: Record<string, string>): Promise<Array<{ lat: string; lon: string }> | null> {
  const qs = new URLSearchParams({ format: 'json', limit: '1', ...params })
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs.toString()}`, {
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data) ? data : null
  } catch {
    return null
  }
}

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

  const q = address.trim()

  // Шаг 1 — поиск в Узбекистане с привязкой к viewbox
  let data = await fetchNominatim({
    q,
    countrycodes: 'uz',
    viewbox: UZ_VIEWBOX,
    bounded: '1',
  })

  // Шаг 2 — fallback без bounded если первый шаг ничего не нашёл
  if (!data || data.length === 0) {
    data = await fetchNominatim({ q, countrycodes: 'uz' })
  }

  if (!data || data.length === 0) {
    try { localStorage.setItem(cacheKey, 'null') } catch { /* ignore */ }
    return null
  }

  const result = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
  if (!Number.isFinite(result.lat) || !Number.isFinite(result.lon)) return null
  try { localStorage.setItem(cacheKey, JSON.stringify(result)) } catch { /* ignore */ }
  return result
}

/**
 * Очистить кеш геокодирования по адресу — нужно после ручной коррекции пина,
 * чтобы при следующем геокодировании не подтянулись старые координаты.
 */
export function clearGeocodeCache(address: string): void {
  try { localStorage.removeItem(`geocode:${address.trim().toLowerCase()}`) } catch { /* ignore */ }
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
