import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getFileUrl(
  bucket: string,
  path: string,
): string {
  const base = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:8001'
  return `${base}/storage/v1/object/public/${bucket}/${path}`
}

/**
 * Нормализует телефонный номер: убирает +, пробелы, дефисы, скобки.
 * +998 99 403-87-64 → 998994038764
 * Позволяет хранить и сравнивать номера в едином формате.
 */
export function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s\-().]/g, '').replace(/^\+/, '')
}

export function formatCurrency(amount: number, currency = 'RUB', locale = 'ru'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

// Map of language codes to default currencies
export const LANG_TO_CURRENCY: Record<string, string> = {
  ru: 'RUB',
  by: 'BYN',
  uk: 'UAH',
  kz: 'KZT',
  uz: 'UZS',
  tg: 'TJS',
  ky: 'KGS',
  en: 'USD',
}

export const CURRENCIES = [
  { code: 'RUB', label: 'RUB — Российский рубль', symbol: '₽' },
  { code: 'USD', label: 'USD — Доллар США', symbol: '$' },
  { code: 'EUR', label: 'EUR — Евро', symbol: '€' },
  { code: 'KZT', label: 'KZT — Казахстанский тенге', symbol: '₸' },
  { code: 'UZS', label: "UZS — Узбекский сум", symbol: "so'm" },
  { code: 'UAH', label: 'UAH — Украинская гривна', symbol: '₴' },
  { code: 'BYN', label: 'BYN — Белорусский рубль', symbol: 'Br' },
  { code: 'TJS', label: 'TJS — Таджикский сомони', symbol: 'SM' },
  { code: 'KGS', label: 'KGS — Кыргызский сом', symbol: 'с' },
  { code: 'GEL', label: 'GEL — Грузинский лари', symbol: '₾' },
  { code: 'AMD', label: 'AMD — Армянский драм', symbol: '֏' },
  { code: 'AZN', label: 'AZN — Азербайджанский манат', symbol: '₼' },
]

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find(c => c.code === code)?.symbol ?? code
}

export function formatDuration(minutes: number, t?: (key: string) => string): string {
  const min = t ? t('common.min') : 'мин'
  const h_unit = t ? t('common.h') : 'ч'
  if (minutes < 60) return `${minutes} ${min}`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} ${h_unit} ${m} ${min}` : `${h} ${h_unit}`
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[а-яёА-ЯЁ]/g, (c) => {
      const map: Record<string, string> = {
        а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',
        й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',
        у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',
        э:'e',ю:'yu',я:'ya'
      }
      return map[c] || c
    })
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function generateInviteCode(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map(b => chars[b % chars.length])
    .join('')
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  let timeout: ReturnType<typeof setTimeout>
  return ((...args: any[]) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), delay)
  }) as T
}
