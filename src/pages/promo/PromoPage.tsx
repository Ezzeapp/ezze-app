import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/shared/PageHeader'
import { PromoTab } from '@/pages/marketing/tabs/PromoTab'

export function PromoPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-0">
      <PageHeader
        title={t('marketing.tabPromo')}
        description={t('promo.subtitle')}
      />
      <PromoTab />
    </div>
  )
}
