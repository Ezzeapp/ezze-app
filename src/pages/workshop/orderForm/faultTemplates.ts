export const FAULT_TEMPLATES: Record<string, string[]> = {
  Smartphone: ['Не включается', 'Разбит экран', 'Не заряжается', 'Не работает динамик', 'Не работает камера', 'Не ловит сеть', 'Попадание влаги', 'Замена аккумулятора'],
  Tablet: ['Не включается', 'Разбит экран', 'Не заряжается', 'Не реагирует на касания'],
  Laptop: ['Не включается', 'Перегрев', 'Не работает клавиатура', 'Медленно работает', 'Не держит заряд', 'Шумит кулер'],
  Monitor: ['Нет изображения', 'Полосы на экране', 'Не включается'],
  Tv: ['Нет изображения', 'Нет звука', 'Полосы на экране', 'Не включается'],
  Headphones: ['Не заряжаются', 'Не подключаются по Bluetooth', 'Работает один наушник'],
  Watch: ['Не включаются', 'Разбит экран', 'Не заряжаются'],
  WashingMachine: ['Не сливает воду', 'Не набирает воду', 'Не отжимает', 'Течёт', 'Шумит при стирке'],
  Refrigerator: ['Не морозит', 'Не работает', 'Образуется наледь', 'Шумит'],
  Microwave: ['Не греет', 'Не включается', 'Искрит'],
  Wind: ['Не работает', 'Шумит', 'Плохая тяга'],
  AirVent: ['Не охлаждает', 'Не греет', 'Течёт', 'Шумит'],
  default: ['Не включается', 'Не работает как должно', 'Механическое повреждение'],
}

export function faultTemplatesFor(iconName: string | null | undefined): string[] {
  if (!iconName) return FAULT_TEMPLATES.default
  return FAULT_TEMPLATES[iconName] ?? FAULT_TEMPLATES.default
}

export function hasImeiField(iconName: string | null | undefined): boolean {
  return iconName === 'Smartphone' || iconName === 'Tablet' || iconName === 'Watch'
}
