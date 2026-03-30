import { useEffect } from 'react'
import { useAppSettings } from './useAppSettings'

function hslToHex(hsl: string): string {
  const parts = hsl.match(/(\d+\.?\d*)/g)
  if (!parts || parts.length < 3) return '#6366f1'
  const h = parseFloat(parts[0]) / 360
  const s = parseFloat(parts[1]) / 100
  const l = parseFloat(parts[2]) / 100
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  let r: number, g: number, b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return '#' + [r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
}

function setFaviconHref(href: string) {
  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach(l => l.parentNode?.removeChild(l))
  const link = document.createElement('link')
  link.rel = 'icon'
  link.type = href.startsWith('data:image/png') ? 'image/png' : 'image/svg+xml'
  link.href = href
  document.head.appendChild(link)
}

export function useDynamicFavicon() {
  const { data: settings } = useAppSettings()

  useEffect(() => {
    if (!settings) return

    const primaryHex = settings.primary_color
      ? hslToHex(settings.primary_color)
      : '#6366f1'

    if (settings.logo_url) {
      // Кастомный логотип — рендерим через canvas → PNG data URL
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 64
        canvas.height = 64
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, 64, 64)
        setFaviconHref(canvas.toDataURL('image/png'))
      }
      img.onerror = () => {/* fallback to svg */}
      img.src = settings.logo_url
    } else {
      // Дефолтный — правильный 32x32 SVG без скруглений (как у admin.ezze.site)
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${primaryHex}"/><polygon points="17.3,2.7 4,18.7 16,18.7 14.7,29.3 28,13.3 16,13.3" fill="white"/></svg>`
      setFaviconHref('data:image/svg+xml,' + encodeURIComponent(svg))
    }
  }, [settings?.primary_color, settings?.logo_url])
}
