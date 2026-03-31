/**
 * SpecialtyStep — экран выбора специальности после TG авто-регистрации.
 * Заменяет полный OnboardingWizard: показывает только поиск + список специальностей.
 * После выбора: сохраняет profession в master_profiles, ставит onboarded=true в users,
 * обновляет TG кнопку меню, отправляет приветственное сообщение и редиректит в /calendar.
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

// Маппинг специальностей на категории global_services / global_products
const SPECIALTY_TO_CATEGORY: Record<string, string> = {
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

const FALLBACK_SPECIALTIES = [
  'Парикмахер', 'Косметолог', 'Мастер ногтей', 'Массажист',
  'Визажист', 'Бровист', 'Лэшмейкер', 'Барбер', 'Стилист',
  'Маникюрист', 'Педикюрист', 'Нутрициолог', 'Другое',
]

interface SpecialtyStepProps {
  userId:   string
  tgChatId: string
  name:     string
  lang:     string
}

export function SpecialtyStep({ userId, tgChatId, name, lang }: SpecialtyStepProps) {
  const navigate = useNavigate()
  const [search,      setSearch]      = useState('')
  const [specialties, setSpecialties] = useState<string[]>([])
  const [selected,    setSelected]    = useState('')
  const [saving,      setSaving]      = useState(false)

  // Загружаем специальности из БД (дедупликация на случай дублей)
  useEffect(() => {
    supabase
      .from('specialties')
      .select('name')
      .order('name')
      .then(({ data }) => {
        if (data?.length) {
          const unique = [...new Set(data.map((s: { name: string }) => s.name))]
          setSpecialties(unique)
        } else {
          setSpecialties(FALLBACK_SPECIALTIES)
        }
      }, () => setSpecialties(FALLBACK_SPECIALTIES))
  }, [])

  const filtered = useMemo(
    () => specialties.filter(s => s.toLowerCase().includes(search.toLowerCase())),
    [specialties, search]
  )

  const handleSave = async () => {
    if (!selected || saving) return
    setSaving(true)
    try {
      // 1. Сохраняем специальность в master_profiles
      await supabase
        .from('master_profiles')
        .update({ profession: selected })
        .eq('user_id', userId)

      // 2. Помечаем onboarding как завершённый
      await supabase
        .from('users')
        .update({ onboarded: true })
        .eq('id', userId)

      localStorage.setItem(`ezze_onboarded_${userId}`, '1')

      // 3. Авто-импорт услуг и товаров из global_* по категории специальности
      const globalCategory = SPECIALTY_TO_CATEGORY[selected]
      if (globalCategory && userId) {
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

      // 5. Обновляем кнопку меню в боте + отправляем приветствие
      if (tgChatId) {
        await supabase.functions.invoke('tg-master-welcome', {
          body: { tg_chat_id: tgChatId, name, lang },
        })
      }

      navigate('/calendar', { replace: true })
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full p-4">

        {/* Заголовок */}
        <div className="mb-5 pt-4">
          <h1 className="text-xl font-bold">Выберите специальность</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Это поможет клиентам найти вас
          </p>
        </div>

        {/* Поиск — нативный input для надёжности в TG Mini App webview */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
          <input
            type="text"
            placeholder="Поиск..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onInput={e => setSearch((e.target as HTMLInputElement).value)}
            className={[
              'flex h-10 w-full rounded-md border border-input bg-background',
              'px-3 py-2 pl-9 text-sm ring-offset-background',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            ].join(' ')}
          />
        </div>

        {/* Список специальностей */}
        <div className="flex-1 overflow-y-auto rounded-xl border bg-card divide-y" style={{ maxHeight: '55vh' }}>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              Ничего не найдено
            </p>
          ) : (
            filtered.map(spec => (
              <button
                key={spec}
                onClick={() => setSelected(spec)}
                className={[
                  'w-full text-left px-4 py-3 text-sm transition-colors',
                  selected === spec
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-muted',
                ].join(' ')}
              >
                {spec}
              </button>
            ))
          )}
        </div>

        {/* Кнопка */}
        <div className="mt-4 pb-safe-bottom pb-4">
          <Button
            className="w-full"
            size="lg"
            disabled={!selected || saving}
            onClick={handleSave}
          >
            {saving ? <LoadingSpinner /> : 'Начать работу →'}
          </Button>
        </div>

      </div>
    </div>
  )
}
