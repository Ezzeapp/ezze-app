/**
 * ProductSelectionStep — Шаг 0 регистрации мастера.
 * Показывает сетку из 11 продуктов. Тап на карточку → сразу переход к следующему шагу.
 */

import { useState } from 'react'
import { PRODUCT_LIST } from '@/lib/products'

interface Props {
  onSelect: (product: string) => void
}

export function ProductSelectionStep({ onSelect }: Props) {
  const [selecting, setSelecting] = useState<string | null>(null)

  const handleSelect = (key: string) => {
    setSelecting(key)
    // Небольшая задержка для анимации нажатия
    setTimeout(() => onSelect(key), 150)
  }

  return (
    <div className="flex flex-col min-h-screen bg-background px-4 py-6">
      {/* Заголовок */}
      <div className="mb-6 text-center">
        <div className="text-3xl mb-2">👋</div>
        <h1 className="text-xl font-bold text-foreground">Добро пожаловать в Ezze!</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Выберите направление вашего бизнеса
        </p>
      </div>

      {/* Сетка продуктов */}
      <div className="grid grid-cols-2 gap-3 flex-1">
        {PRODUCT_LIST.map((product) => {
          const isSelecting = selecting === product.key
          return (
            <button
              key={product.key}
              onClick={() => handleSelect(product.key)}
              disabled={selecting !== null}
              className={[
                'flex flex-col items-start p-3 rounded-xl border-2 text-left',
                'transition-all duration-150 active:scale-95',
                'bg-card hover:bg-accent/50',
                isSelecting
                  ? 'border-primary bg-primary/10 scale-95'
                  : 'border-border hover:border-primary/50',
              ].join(' ')}
            >
              <span className="text-2xl mb-1.5">{product.emoji}</span>
              <span className="font-semibold text-sm text-foreground leading-tight">
                {product.name}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5 leading-tight">
                {product.desc}
              </span>
            </button>
          )
        })}
      </div>

      {/* Подсказка внизу */}
      <p className="text-xs text-center text-muted-foreground mt-4 pb-2">
        Это определяет список специальностей и настройки платформы
      </p>
    </div>
  )
}
