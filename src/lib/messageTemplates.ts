/**
 * Готовые шаблоны для быстрой отправки сообщений клиенту из заказов.
 * Используются в MessageModal (компактный режим — карточки шаблонов).
 *
 * Поддерживаемые переменные:
 *  {{имя}}     — имя клиента
 *  {{номер}}   — номер заказа (КВ-XXXX)
 *  {{сумма}}   — общая сумма заказа
 *  {{остаток}} — остаток к оплате
 *  {{адрес}}   — адрес доставки/забора
 *  {{дата}}    — срок готовности
 *  {{ссылка}}  — ссылка на отслеживание заказа
 */

export interface MessageTemplate {
  id: string
  label: string
  iconName: string  // имя из lucide-react
  color: 'emerald' | 'orange' | 'blue' | 'violet' | 'amber'
  text: string
}

export const QUICK_TEMPLATES: MessageTemplate[] = [
  {
    id: 'ready',
    label: 'Готов к выдаче',
    iconName: 'CheckCircle',
    color: 'emerald',
    text: 'Здравствуйте, {{имя}}! Ваш заказ {{номер}} готов к выдаче. Сумма к оплате: {{остаток}} so\'m. Ждём вас!',
  },
  {
    id: 'overdue',
    label: 'Напомнить о просрочке',
    iconName: 'AlertTriangle',
    color: 'orange',
    text: 'Здравствуйте, {{имя}}. Ваш заказ {{номер}} ожидает выдачи. Просим забрать в ближайшее время.',
  },
  {
    id: 'courier',
    label: 'Курьер выехал',
    iconName: 'Truck',
    color: 'blue',
    text: 'Курьер выехал к вам с заказом {{номер}}. Адрес доставки: {{адрес}}. Ожидайте в течение 30-60 минут.',
  },
  {
    id: 'discount',
    label: 'Скидка для постоянных',
    iconName: 'Gift',
    color: 'violet',
    text: 'Спасибо что выбираете нас, {{имя}}! Дарим −10% на следующий заказ. Промокод: LOVE10. Действует 14 дней.',
  },
  {
    id: 'review',
    label: 'Попросить отзыв',
    iconName: 'Star',
    color: 'amber',
    text: 'Здравствуйте, {{имя}}! Спасибо за заказ {{номер}}. Будем благодарны за ваш отзыв — это помогает нам становиться лучше.',
  },
]

/** Доступные переменные для подсказок в редакторе. */
export const VARIABLES = [
  { key: '{{имя}}',     desc: 'Имя клиента' },
  { key: '{{номер}}',   desc: 'Номер заказа' },
  { key: '{{сумма}}',   desc: 'Общая сумма' },
  { key: '{{остаток}}', desc: 'К оплате' },
  { key: '{{адрес}}',   desc: 'Адрес' },
  { key: '{{дата}}',    desc: 'Срок готовности' },
] as const

/** Подставить переменные в шаблон. Значения, которых нет — заменяются на «—». */
export function substituteVars(template: string, vars: Partial<Record<string, string | number>>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    result = result.replace(re, value != null && value !== '' ? String(value) : '—')
  }
  // Заменим оставшиеся неподставленные переменные
  result = result.replace(/\{\{[^}]+\}\}/g, '—')
  return result
}

/** Цвета для карточек шаблонов в compact-режиме. */
export const COLOR_CLASSES: Record<MessageTemplate['color'], { border: string; iconBg: string; iconText: string; hoverBorder: string; hoverBg: string }> = {
  emerald: {
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-600',
    hoverBorder: 'hover:border-emerald-500',
    hoverBg: 'hover:bg-emerald-50',
  },
  orange: {
    border: 'border-orange-200',
    iconBg: 'bg-orange-100',
    iconText: 'text-orange-600',
    hoverBorder: 'hover:border-orange-500',
    hoverBg: 'hover:bg-orange-50',
  },
  blue: {
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    hoverBorder: 'hover:border-blue-500',
    hoverBg: 'hover:bg-blue-50',
  },
  violet: {
    border: 'border-violet-200',
    iconBg: 'bg-violet-100',
    iconText: 'text-violet-600',
    hoverBorder: 'hover:border-violet-500',
    hoverBg: 'hover:bg-violet-50',
  },
  amber: {
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    hoverBorder: 'hover:border-amber-500',
    hoverBg: 'hover:bg-amber-50',
  },
}
