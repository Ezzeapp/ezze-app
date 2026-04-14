/**
 * Rule-based AI-советник для фермы — локальный анализ без LLM.
 * Даёт рекомендации на основе данных: отстающие в привесе, нерентабельные группы,
 * заканчивающиеся корма, просроченные прививки, пустующие мощности и т.п.
 */
import type {
  Animal, AnimalEvent, FeedStockItem, FeedConsumption,
  ProductionRecord, AnimalCostBreakdown, AnimalGroup, Pasture, Field as FieldRec,
} from '@/types/farm'

export type AdvicePriority = 'critical' | 'warning' | 'info' | 'success'

export interface Advice {
  id: string
  priority: AdvicePriority
  title: string
  detail: string
  action?: { label: string; path: string }
  metric?: string
}

export interface AdvisorInput {
  animals: Animal[]
  events: AnimalEvent[]
  feedStock: FeedStockItem[]
  feedConsumption: FeedConsumption[]
  production: ProductionRecord[]
  costs: AnimalCostBreakdown[]
  groups: AnimalGroup[]
  pastures: Pasture[]
  fields: FieldRec[]
  vetOverdueCount: number
}

export function analyzeFarm(input: AdvisorInput): Advice[] {
  const advices: Advice[] = []

  // 1. Животные отстают в привесе от группы
  const weighings = input.events.filter(e => e.event_type === 'weighing' && e.animal_id && e.weight_kg)
  const byAnimalWeighings = new Map<string, typeof weighings>()
  for (const w of weighings) {
    const list = byAnimalWeighings.get(w.animal_id!) ?? []
    list.push(w)
    byAnimalWeighings.set(w.animal_id!, list)
  }

  // Средний привес по группам (кг/день за последние 60 дней)
  const avgDailyGainByGroup = new Map<string, number>()
  for (const group of input.groups) {
    const gAnimals = input.animals.filter(a => a.group_id === group.id)
    const gains: number[] = []
    for (const a of gAnimals) {
      const ws = (byAnimalWeighings.get(a.id) ?? []).sort((x, y) => x.event_date < y.event_date ? -1 : 1)
      if (ws.length < 2) continue
      const first = ws[0], last = ws[ws.length - 1]
      const days = (new Date(last.event_date).getTime() - new Date(first.event_date).getTime()) / (24 * 3600 * 1000)
      if (days < 7) continue
      const gain = (Number(last.weight_kg) - Number(first.weight_kg)) / days
      gains.push(gain)
    }
    if (gains.length > 0) avgDailyGainByGroup.set(group.id, gains.reduce((s, x) => s + x, 0) / gains.length)
  }

  for (const a of input.animals) {
    if (!a.group_id) continue
    const ws = (byAnimalWeighings.get(a.id) ?? []).sort((x, y) => x.event_date < y.event_date ? -1 : 1)
    if (ws.length < 2) continue
    const first = ws[0], last = ws[ws.length - 1]
    const days = (new Date(last.event_date).getTime() - new Date(first.event_date).getTime()) / (24 * 3600 * 1000)
    if (days < 7) continue
    const gain = (Number(last.weight_kg) - Number(first.weight_kg)) / days
    const groupAvg = avgDailyGainByGroup.get(a.group_id)
    if (groupAvg && groupAvg > 0 && gain < groupAvg * 0.8) {
      const diff = Math.round((1 - gain / groupAvg) * 100)
      advices.push({
        id: `weight-lag-${a.id}`,
        priority: 'warning',
        title: `${a.tag}${a.name ? ` (${a.name})` : ''}: отстаёт в привесе на ${diff}%`,
        detail: `Среднесут. привес ${gain.toFixed(2)} кг/день против ${groupAvg.toFixed(2)} кг/день по группе. Проверьте рацион, здоровье, паразитов.`,
        action: { label: 'Открыть карточку', path: `/farm/animals/${a.id}` },
        metric: `${gain.toFixed(2)} / ${groupAvg.toFixed(2)} кг/день`,
      })
    }
  }

  // 2. Убыточные животные
  const losers = input.costs.filter(c => c.margin < 0 && c.revenue > 0)
  if (losers.length > 0) {
    const worst = losers.sort((a, b) => a.margin - b.margin).slice(0, 3)
    advices.push({
      id: 'losers',
      priority: 'critical',
      title: `${losers.length} животных работают в убыток`,
      detail: `Худшие: ${worst.map(x => `${x.tag} (${Math.round(x.margin).toLocaleString()})`).join(', ')}. Проверьте себестоимость и цены продаж.`,
      action: { label: 'Отчёт', path: '/farm' },
    })
  }

  // 3. Заканчивающиеся корма
  const lowStock = input.feedStock.filter(s => s.low_stock_threshold != null && s.quantity <= Number(s.low_stock_threshold))
  if (lowStock.length > 0) {
    advices.push({
      id: 'low-feed',
      priority: 'warning',
      title: `Заканчиваются корма: ${lowStock.length} позиций`,
      detail: `${lowStock.slice(0, 3).map(s => `${s.name} (${s.quantity} ${s.unit})`).join(', ')}${lowStock.length > 3 ? ' и др.' : ''}. Пора закупать.`,
      action: { label: 'Склад кормов', path: '/farm/feed' },
    })
  }

  // 4. Просроченные прививки
  if (input.vetOverdueCount > 0) {
    advices.push({
      id: 'vet-overdue',
      priority: input.vetOverdueCount >= 5 ? 'critical' : 'warning',
      title: `Просрочено ${input.vetOverdueCount} процедур ветеринарии`,
      detail: 'Несделанные вакцинации повышают риск падежа и инфекций.',
      action: { label: 'Вет-календарь', path: '/farm/vet' },
    })
  }

  // 5. Пастбища с перегрузкой
  for (const p of input.pastures) {
    if (p.capacity_heads == null || !p.current_group_id) continue
    const heads = input.animals.filter(a => a.group_id === p.current_group_id).length
    if (heads > p.capacity_heads) {
      advices.push({
        id: `pasture-overload-${p.id}`,
        priority: 'warning',
        title: `Пастбище «${p.name}» перегружено`,
        detail: `${heads} голов при рекомендуемых ${p.capacity_heads}. Риск деградации травостоя и недокорма.`,
        action: { label: 'Пастбища', path: '/farm/pastures' },
      })
    }
  }

  // 6. Животные без группы
  const noGroup = input.animals.filter(a => !a.group_id && ['growing','dairy','meat','breeding'].includes(a.status))
  if (noGroup.length >= 3) {
    advices.push({
      id: 'no-group',
      priority: 'info',
      title: `${noGroup.length} животных без группы`,
      detail: 'Сгруппируйте их для корректной аллокации затрат на корма и учёт рационов.',
      action: { label: 'Группы', path: '/farm/groups' },
    })
  }

  // 7. Продуктивность молока — резкое падение
  const milkDaily = new Map<string, number>()
  for (const p of input.production) {
    if (p.type !== 'milk') continue
    milkDaily.set(p.date, (milkDaily.get(p.date) ?? 0) + Number(p.quantity))
  }
  const milkDays = [...milkDaily.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)
  if (milkDays.length >= 14) {
    const recent7 = milkDays.slice(-7).reduce((s, [, v]) => s + v, 0) / 7
    const prev7 = milkDays.slice(-14, -7).reduce((s, [, v]) => s + v, 0) / 7
    if (prev7 > 0 && recent7 < prev7 * 0.85) {
      const drop = Math.round((1 - recent7 / prev7) * 100)
      advices.push({
        id: 'milk-drop',
        priority: 'warning',
        title: `Удои упали на ${drop}% за неделю`,
        detail: `Средний удой ${recent7.toFixed(1)} л/день против ${prev7.toFixed(1)} л/день неделей ранее. Проверьте рацион, стресс-факторы, мастит.`,
        action: { label: 'Продукция', path: '/farm/production' },
      })
    }
  }

  // 8. Хороший знак — маржа положительная по всем
  if (input.costs.length >= 3 && input.costs.every(c => c.margin >= 0 || c.revenue === 0)) {
    const withRevenue = input.costs.filter(c => c.revenue > 0)
    if (withRevenue.length >= 3) {
      advices.push({
        id: 'all-profitable',
        priority: 'success',
        title: 'Все животные с продажами прибыльны',
        detail: 'Отличная работа! Рассмотрите масштабирование успешных групп.',
      })
    }
  }

  return advices
}
