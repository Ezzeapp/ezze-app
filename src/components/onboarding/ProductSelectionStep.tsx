/**
 * ProductSelectionStep — Шаг 0 регистрации мастера.
 * Показывает сетку продуктов из platform_products (Supabase).
 * Поддерживает переключение языка прямо на экране.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import {
  Scissors, Stethoscope, Wrench, GraduationCap,
  BedDouble, UtensilsCrossed, PartyPopper, Wheat,
  Car, HardHat, ShoppingCart, WashingMachine, KeyRound, type LucideIcon,
} from 'lucide-react'
import { usePlatformProducts, getProductName, getProductDesc } from '@/hooks/usePlatformProducts'

interface Props {
  onSelect: (product: string) => void
  initialLang?: string
}

const PRODUCT_ICONS: Record<string, LucideIcon> = {
  beauty:    Scissors,
  clinic:    Stethoscope,
  workshop:  Wrench,
  edu:       GraduationCap,
  hotel:     BedDouble,
  food:      UtensilsCrossed,
  event:     PartyPopper,
  farm:      Wheat,
  transport: Car,
  build:     HardHat,
  trade:     ShoppingCart,
  cleaning:  WashingMachine,
  rental:    KeyRound,
}

const LANGS = [
  { code: 'ru', label: 'RU' },
  { code: 'uz', label: 'UZ' },
  { code: 'en', label: 'EN' },
  { code: 'kz', label: 'KZ' },
  { code: 'ky', label: 'KY' },
  { code: 'tg', label: 'TG' },
]

export function ProductSelectionStep({ onSelect, initialLang }: Props) {
  const { i18n } = useTranslation()
  const { data: products, isLoading } = usePlatformProducts()
  const [selecting, setSelecting] = useState<string | null>(null)

  // Текущий язык: из пропса → из i18n → 'ru'
  const [lang, setLang] = useState(
    initialLang || (LANGS.find(l => l.code === i18n.language) ? i18n.language : 'ru')
  )

  const handleLangChange = (code: string) => {
    setLang(code)
    i18n.changeLanguage(code)
  }

  const handleSelect = (key: string) => {
    setSelecting(key)
    setTimeout(() => onSelect(key), 150)
  }

  return (
    <div className="flex flex-col min-h-screen bg-background px-4 py-6 items-center">

      {/* Заголовок + переключатель языка */}
      <div className="mb-5 w-full max-w-xs">
        {/* Переключатель языка */}
        <div className="flex items-center gap-1 justify-end mb-4">
          <Globe size={13} className="text-muted-foreground" />
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => handleLangChange(l.code)}
              className={[
                'text-[11px] font-medium px-1.5 py-0.5 rounded transition-colors',
                lang === l.code
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="text-center">
          <div className="text-3xl mb-2">👋</div>
          <h1 className="text-xl font-bold text-foreground">Добро пожаловать в Ezze!</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Выберите направление вашего бизнеса
          </p>
        </div>
      </div>

      {/* Сетка продуктов */}
      <div className="grid grid-cols-3 gap-2 w-full max-w-xs">
        {isLoading
          ? Array.from({ length: 13 }).map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-xl border-2 border-border bg-card animate-pulse"
              />
            ))
          : products.map((product) => {
              const isSelecting = selecting === product.key
              const Icon = PRODUCT_ICONS[product.key] ?? Wrench
              return (
                <button
                  key={product.key}
                  onClick={() => handleSelect(product.key)}
                  disabled={selecting !== null}
                  className={[
                    'flex flex-col items-start p-2.5 rounded-xl border-2 text-left',
                    'transition-all duration-150 active:scale-95',
                    'bg-card hover:bg-accent/50',
                    isSelecting
                      ? 'border-primary bg-primary/10 scale-95'
                      : 'border-border hover:border-primary/50',
                  ].join(' ')}
                >
                  <Icon
                    size={18}
                    className={isSelecting ? 'text-primary' : 'text-muted-foreground'}
                    strokeWidth={1.75}
                  />
                  <span className="font-semibold text-xs text-foreground leading-tight mt-1.5">
                    {getProductName(product, lang)}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                    {getProductDesc(product, lang)}
                  </span>
                </button>
              )
            })
        }
      </div>

      <p className="text-xs text-center text-muted-foreground mt-4 pb-2 max-w-xs">
        Это определяет список специальностей и настройки платформы
      </p>
    </div>
  )
}
