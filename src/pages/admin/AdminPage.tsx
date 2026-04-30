import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Shield } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/shared/PageHeader'
import { AdminHomeScreenTab } from '@/components/admin/AdminHomeScreenTab'

export function AdminPage() {
  const { t } = useTranslation()
  const { user } = useAuth()

  // Защита — только is_admin
  if (!user?.is_admin) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.homeScreen.title')}
        description={t('admin.homeScreen.desc')}
      >
        <Shield className="h-5 w-5 text-amber-600" />
      </PageHeader>

      <AdminHomeScreenTab />
    </div>
  )
}
