import { useEffect, useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Send, Bell, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { BroadcastsTab } from './tabs/BroadcastsTab'
import { AutoTab } from './tabs/AutoTab'
import { ReviewsTab } from './tabs/ReviewsTab'
import { PRODUCT } from '@/lib/config'

type MarketingTab = 'broadcasts' | 'auto' | 'reviews'

const DEFAULT_TAB: MarketingTab = 'broadcasts'

export function MarketingPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()

  // Для workshop Auto-уведомления привязаны к appointment-флоу — не показываем,
  // для workshop есть отдельная страница настроек шаблонов уведомлений.
  const validTabs: MarketingTab[] = useMemo(() => (
    PRODUCT === 'workshop'
      ? ['broadcasts', 'reviews']
      : ['broadcasts', 'auto', 'reviews']
  ), [])

  // Старые ссылки ?tab=promo / ?tab=loyalty переезжают на отдельные страницы
  const rawTabParam = searchParams.get('tab')

  const rawTab = rawTabParam as MarketingTab | null
  const activeTab: MarketingTab = rawTab && validTabs.includes(rawTab) ? rawTab : DEFAULT_TAB

  // Если tab не задан — добавляем default
  useEffect(() => {
    if (!rawTab || !validTabs.includes(rawTab as MarketingTab)) {
      setSearchParams({ tab: DEFAULT_TAB }, { replace: true })
    }
  }, [rawTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Условные return — ПОСЛЕ всех хуков (Rules of Hooks). Раньше проверка
  // promo/loyalty стояла до useEffect, и при смене tab между значениями
  // React паниковал «Rendered fewer hooks than during the previous render».
  if (rawTabParam === 'promo')   return <Navigate to="/promo" replace />
  if (rawTabParam === 'loyalty') return <Navigate to="/loyalty" replace />

  const allTabs: { id: MarketingTab; label: string; icon: React.ElementType }[] = [
    { id: 'broadcasts', label: t('marketing.tabBroadcasts'), icon: Send  },
    { id: 'auto',       label: t('marketing.tabAuto'),       icon: Bell  },
    { id: 'reviews',    label: t('marketing.tabReviews'),    icon: Star  },
  ]
  const tabs = allTabs.filter(x => validTabs.includes(x.id))

  return (
    <div className="space-y-0">
      <PageHeader
        title={t('marketing.title')}
        description={t('marketing.subtitle')}
      />

      {/* Горизонтальные табы */}
      <div className="flex gap-1 mb-8 pb-2 border-b border-border overflow-x-auto scrollbar-none">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSearchParams({ tab: id })}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors shrink-0 min-w-[56px]',
              activeTab === id
                ? 'bg-primary/10 text-primary'
                : 'bg-muted/40 text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:block">{label}</span>
          </button>
        ))}
      </div>

      {/* Контент вкладки */}
      {activeTab === 'broadcasts' && <BroadcastsTab />}
      {activeTab === 'auto'       && <AutoTab />}
      {activeTab === 'reviews'    && <ReviewsTab />}
    </div>
  )
}
