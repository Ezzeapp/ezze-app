/**
 * ProductSelectionStep — Шаг 0 регистрации мастера.
 * Показывает сетку из 11 продуктов. Тап на карточку → сразу переход к следующему шагу.
 */

import { useState } from 'react'
import {
  Scissors, Stethoscope, Wrench, GraduationCap,
  BedDouble, UtensilsCrossed, PartyPopper, Wheat,
  Car, HardHat, ShoppingCart, WashingMachine, type LucideIcon,
} from 'lucide-react'
import { PRODUCT_LIST } from '@/lib/products'

interface Props {
  onSelect: (product: string) => void
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
}

export function ProductSelectionStep({ onSelect }: Props) {
  const [selecting, setSelecting] = useState<string | null>(null)

  const handleSelect = (key: string) => {
    setSelecting(key)
    // Небольшая задержка для анимации нажатия
    setTimeout(() => onSelect(key), 150)
  }

  return (
    <div className="flex flex-col min-h-screen bg-background px-4 py-6 items-center">
      {/* Заголовок */}
      <div className="mb-5 text-center">
        <div className="text-3xl mb-2">👋</div>
        <h1 className="text-xl font-bold text-foreground">Добро пожаловать в Ezze!</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Выберите направление вашего бизнеса
        </p>
      </div>

      {/* Сетка продуктов */}
      <div className="grid grid-cols-3 gap-2 w-full max-w-xs">
        {PRODUCT_LIST.map((product) => {
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
                {product.name}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                {product.desc}
              </span>
            </button>
          )
        })}
      </div>

      {/* Подсказка внизу */}
      <p className="text-xs text-center text-muted-foreground mt-4 pb-2 max-w-xs">
        Это определяет список специальностей и настройки платформы
      </p>
    </div>
  )
}
