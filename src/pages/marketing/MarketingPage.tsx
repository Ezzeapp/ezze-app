import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Send, Bell, Tag, Gift, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { BroadcastsTab } from './tabs/BroadcastsTab'
import { AutoTab } from './tabs/AutoTab'
import { PromoTab } from './tabs/PromoTab'
import { LoyaltyTab } from './tabs/LoyaltyTab'
import { ReviewsTab } from './tabs/ReviewsTab'

type MarketingTab = 'broadcasts' | 'auto' | 'promo' | 'loyalty' | 'reviews'

const DEFAULT_TAB: MarketingTab = 'broadcasts'

export function MarketingPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()

  const rawTab = searchParams.get('tab') as MarketingTab | null
  const validTabs: MarketingTab[] = ['broadcasts', 'auto', 'promo', 'loyalty', 'reviews']
  const activeTab: MarketingTab = rawTab && validTabs.includes(rawTab) ? rawTab : DEFAULT_TAB

  // Если tab не задан — добавляем default
  useEffect(() => {
    if (!rawTab || !validTabs.includes(rawTab as MarketingTab)) {
      setSearchParams({ tab: DEFAULT_TAB }, { replace: true })
    }
  }, [rawTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const tabs: { id: MarketingTab; label: string; icon: React.ElementType }[] = [
    { id: 'broadcasts', label: t('marketing.tabBroadcasts'), icon: Send  },
    { id: 'auto',       label: t('marketing.tabAuto'),       icon: Bell  },
    { id: 'promo',      label: t('marketing.tabPromo'),      icon: Tag   },
    { id: 'loyalty',    label: t('marketing.tabLoyalty'),    icon: Gift  },
    { id: 'reviews',    label: t('marketing.tabReviews'),    icon: Star  },
  ]

  return (
    <div className="space-y-0">
      <PageHeader
        title={t('marketing.title')}
        description={t('marketing.subtitle')}
      />

      {/* Горизонтальные табы */}
      <div className="grid grid-cols-5 gap-1 mb-6">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSearchParams({ tab: id })}
            className={cn(
              'flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors',
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
      {activeTab === 'promo'      && <PromoTab />}
      {activeTab === 'loyalty'    && <LoyaltyTab />}
      {activeTab === 'reviews'    && <ReviewsTab />}
    </div>
  )
}
