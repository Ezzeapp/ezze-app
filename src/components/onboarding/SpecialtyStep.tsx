/**
 * SpecialtyStep — экран выбора специальности после TG авто-регистрации.
 * Backward compat: для пользователей, начавших старый поток и не завершивших онбординг.
 * Новые пользователи проходят через единую форму в RegisterPage.
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import {
  FALLBACK_SPECIALTIES,
  autoImportServices,
  completeOnboarding,
  saveProfession,
} from '@/lib/onboarding-utils'

interface SpecialtyStepProps {
  userId:   string
  tgChatId: string
  name:     string
  lang:     string
}

export function SpecialtyStep({ userId, tgChatId, name, lang }: SpecialtyStepProps) {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()

  useEffect(() => {
    if (lang && i18n.language !== lang) {
      i18n.changeLanguage(lang)
    }
  }, [lang, i18n])

  const [search,      setSearch]      = useState('')
  const [specialties, setSpecialties] = useState<string[]>([])
  const [selected,    setSelected]    = useState('')
  const [saving,      setSaving]      = useState(false)

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
      await saveProfession(userId, selected, name)
      await autoImportServices(userId, selected)
      await completeOnboarding(userId, tgChatId, name, lang)
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
          <h1 className="text-xl font-bold">{t('specialty.select')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('specialty.hint')}
          </p>
        </div>

        {/* Поиск — нативный input для надёжности в TG Mini App webview */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
          <input
            type="text"
            placeholder={t('specialty.search')}
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
              {t('specialty.notFound')}
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
            {saving ? <LoadingSpinner /> : t('onboarding.finish')}
          </Button>
        </div>

      </div>
    </div>
  )
}
