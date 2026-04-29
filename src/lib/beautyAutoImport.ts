import { supabase } from '@/lib/supabase'

const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#64748b', '#78716c',
]

const DEFAULT_DURATION_MIN = 30

/**
 * Автоимпорт глобального справочника услуг beauty в личный каталог мастера.
 *
 * Берёт всё из global_services (product='beauty'), создаёт у мастера
 * service_categories по уникальным category и сами services со ссылкой
 * на категорию. Цена 0, длительность 30 мин — мастер настроит сам.
 *
 * Идемпотентен: пропускает услуги/категории, уже существующие у мастера
 * (сравнение по name, регистронезависимо).
 *
 * Возвращает количество созданных услуг.
 */
export async function autoImportBeautyCatalog(userId: string): Promise<number> {
  if (!userId) return 0

  const { data: globalServices, error: gErr } = await supabase
    .from('global_services')
    .select('name, description, category, duration_min, price')
    .eq('product', 'beauty')
    .order('category')
    .order('name')

  if (gErr || !globalServices || globalServices.length === 0) return 0

  const { data: existingServices } = await supabase
    .from('services')
    .select('name')
    .eq('master_id', userId)

  const existingServiceNames = new Set(
    (existingServices ?? []).map(s => s.name.toLowerCase())
  )

  const toImport = globalServices.filter(
    s => !existingServiceNames.has(s.name.toLowerCase())
  )
  if (toImport.length === 0) return 0

  const { data: existingCats } = await supabase
    .from('service_categories')
    .select('id, name')
    .eq('master_id', userId)

  const catMap: Record<string, string> = {}
  for (const cat of existingCats ?? []) {
    catMap[cat.name.toLowerCase()] = cat.id
  }

  const uniqueCatNames = [...new Set(
    toImport.map(s => s.category).filter(Boolean) as string[]
  )]
  const missingCats = uniqueCatNames.filter(name => !catMap[name.toLowerCase()])

  if (missingCats.length > 0) {
    const { data: newCats } = await supabase
      .from('service_categories')
      .insert(missingCats.map((name, i) => ({
        name,
        master_id: userId,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      })))
      .select()
    for (const cat of newCats ?? []) {
      catMap[cat.name.toLowerCase()] = cat.id
    }
  }

  const rows = toImport.map(s => ({
    name: s.name,
    description: s.description || null,
    duration_min: s.duration_min || DEFAULT_DURATION_MIN,
    price: s.price || 0,
    is_active: true,
    is_bookable: true,
    master_id: userId,
    category_id: s.category ? (catMap[s.category.toLowerCase()] ?? null) : null,
  }))

  const { error: iErr } = await supabase.from('services').insert(rows)
  if (iErr) return 0
  return rows.length
}
