import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/shared/PageHeader'
import { ScheduleTab } from './ScheduleTab'

export function SchedulePage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <PageHeader title={t('nav.schedule')} description={t('schedule.subtitle')} />
      <ScheduleTab />
    </div>
  )
}
