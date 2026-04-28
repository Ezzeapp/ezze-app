import { supabase } from '@/lib/supabase'

/**
 * Автозагрузка справочника химчистки в личный каталог мастера.
 *
 * Копирует все позиции из global_services (product='cleaning') в cleaning_item_types
 * с дефолтной ценой 0 — мастер проставит свои тарифы через inline-edit.
 *
 * Маппинг: cleaning_item_types.category ← global_services.order_type,
 *          subcategory ← global_services.category.
 *
 * Идемпотентен: upsert по (product, name) — повторный вызов не дублирует, но
 * сбросит default_price=0 у существующих строк (см. memory/project_cleaning_auto_import.md).
 *
 * Возвращает количество записей в payload (не количество фактически вставленных,
 * т.к. PostgREST upsert не возвращает upsertedCount).
 */
export async function autoImportCleaningCatalog(): Promise<number> {
  const { data: globalServices, error: gErr } = await supabase
    .from('global_services')
    .select('name, category, order_type')
    .eq('product', 'cleaning')
    .order('order_type')
    .order('category')
    .order('name')

  if (gErr || !globalServices || globalServices.length === 0) return 0

  const records = globalServices.map((s, i) => ({
    product:       'cleaning',
    name:          s.name,
    category:      s.order_type || 'clothing',
    subcategory:   s.category || null,
    default_price: 0,
    default_days:  3,
    sort_order:    i + 1,
  }))

  const { error: iErr } = await supabase
    .from('cleaning_item_types')
    .upsert(records, { onConflict: 'product,name' })

  if (iErr) return 0
  return records.length
}
