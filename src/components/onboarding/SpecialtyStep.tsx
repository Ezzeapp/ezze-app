/**
 * SpecialtyStep — экран выбора специальности после TG авто-регистрации.
 * Заменяет полный OnboardingWizard: показывает только поиск + список специальностей.
 * После выбора: сохраняет profession в master_profiles, обновляет TG кнопку меню,
 * отправляет приветственное сообщение в бот и редиректит в /calendar.
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

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

  // Загружаем специальности из БД
  useEffect(() => {
    supabase
      .from('specialties')
      .select('name')
      .order('name')
      .then(({ data }) => {
        if (data?.length) setSpecialties(data.map((s: { name: string }) => s.name))
        else              setSpecialties(FALLBACK_SPECIALTIES)
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
      // Сохраняем специальность в master_profiles
      await supabase
        .from('master_profiles')
        .update({ profession: selected })
        .eq('user_id', userId)

      // Обновляем кнопку меню в боте + отправляем приветствие
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

        {/* Поиск */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
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
