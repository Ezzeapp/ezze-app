/**
 * Общие утилиты онбординга — маппинг специальностей, авто-импорт услуг, завершение онбординга.
 * Используется в RegisterPage (TG-регистрация) и SpecialtyStep (backward compat).
 */

import { supabase } from '@/lib/supabase'

// ── Маппинг специальностей на категории global_services / global_products ──

export const SPECIALTY_TO_CATEGORY: Record<string, string> = {
  // Волосы
  'Парикмахер':                        'Волосы',
  'Барбер':                            'Волосы',
  'Стилист':                           'Волосы',
  'Стилист-парикмахер':                'Волосы',
  'Мастер по окрашиванию':             'Волосы',
  'Мастер по наращиванию волос':       'Волосы',
  'Трихолог':                          'Волосы',
  // Ногти
  'Мастер ногтей':                     'Ногти',
  'Маникюрист':                        'Ногти',
  'Педикюрист':                        'Ногти',
  'Нейл-мастер':                       'Ногти',
  'Мастер маникюра и педикюра':        'Ногти',
  'Нейл-арт мастер':                   'Ногти',
  // Косметология
  'Косметолог':                        'Косметология',
  'Косметолог-эстетист':               'Косметология',
  'Дерматолог-косметолог':             'Косметология',
  'Специалист по уходу за лицом':      'Косметология',
  // Брови и ресницы
  'Бровист':                           'Брови и ресницы',
  'Лэшмейкер':                         'Брови и ресницы',
  'Визажист':                          'Брови и ресницы',
  'Мастер по бровям и ресницам':       'Брови и ресницы',
  'Мастер по наращиванию ресниц':      'Брови и ресницы',
  // Массаж
  'Массажист':                         'Массаж',
  'Массажист-реабилитолог':            'Массаж',
  'SPA-мастер':                        'Массаж',
  // Перманентный макияж
  'Мастер перманентного макияжа':      'Перманентный макияж',
  'Татуажист':                         'Перманентный макияж',
  'PMU-мастер':                        'Перманентный макияж',
  // Эпиляция
  'Специалист по депиляции':           'Эпиляция',
  'Мастер эпиляции':                   'Эпиляция',
  'Мастер шугаринга':                  'Эпиляция',
  'Шугаринг-мастер':                   'Эпиляция',
}

export const FALLBACK_SPECIALTIES = [
  'Парикмахер', 'Косметолог', 'Мастер ногтей', 'Массажист',
  'Визажист', 'Бровист', 'Лэшмейкер', 'Барбер', 'Стилист',
  'Маникюрист', 'Педикюрист', 'Нутрициолог', 'Другое',
]

// ── Авто-импорт услуг и товаров из global_* по категории специальности ──

export async function autoImportServices(userId: string, specialty: string): Promise<void> {
  const globalCategory = SPECIALTY_TO_CATEGORY[specialty]
  if (!globalCategory || !userId) return

  const [{ data: svcTemplates }, { data: prodTemplates }] = await Promise.all([
    supabase.from('global_services').select('name').eq('category', globalCategory).limit(15),
    supabase.from('global_products').select('name, unit').eq('category', globalCategory).limit(15),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inserts: PromiseLike<any>[] = []

  if (svcTemplates?.length) {
    inserts.push(
      supabase.from('services').insert(
        svcTemplates.map((t: { name: string }) => ({
          master_id:    userId,
          name:         t.name,
          duration_min: 30,
          price:        0,
          is_active:    true,
          is_bookable:  true,
        }))
      )
    )
  }

  if (prodTemplates?.length) {
    inserts.push(
      supabase.from('inventory_items').insert(
        prodTemplates.map((t: { name: string; unit: string }) => ({
          master_id: userId,
          name:      t.name,
          unit:      t.unit || 'шт',
          quantity:  0,
        }))
      )
    )
  }

  if (inserts.length) await Promise.all(inserts)
}

// ── Завершение онбординга: onboarded=true + tg-master-welcome ──

export async function completeOnboarding(
  userId: string,
  tgChatId: string | null,
  name: string,
  lang: string,
): Promise<void> {
  await supabase
    .from('users')
    .update({ onboarded: true })
    .eq('id', userId)

  localStorage.setItem(`ezze_onboarded_${userId}`, '1')

  if (tgChatId) {
    await supabase.functions.invoke('tg-master-welcome', {
      body: {
        tg_chat_id: tgChatId,
        name,
        lang,
        product: import.meta.env.VITE_PRODUCT || 'beauty',
        app_url:  import.meta.env.VITE_APP_URL  || 'https://pro.ezze.site',
      },
    })
  }
}

// ── Сохранение профессии + slug в master_profiles ──

export async function saveProfession(
  userId: string,
  profession: string,
  name: string,
): Promise<void> {
  const { data: existingProfile } = await supabase
    .from('master_profiles')
    .select('booking_slug')
    .eq('user_id', userId)
    .maybeSingle()

  const slugBase = (name || 'master').trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'master'
  const booking_slug = existingProfile?.booking_slug
    || `${slugBase}${Math.random().toString(36).slice(2, 7)}`

  await supabase
    .from('master_profiles')
    .upsert(
      { user_id: userId, profession, booking_slug, is_public: true },
      { onConflict: 'user_id' },
    )
}
