import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Shield, Zap, Users, BookOpen, Palette, CreditCard, Mail, Bot, UserCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/shared/PageHeader'
import { cn } from '@/lib/utils'
import { AdminFeaturesTab } from '@/components/admin/AdminFeaturesTab'
import { AdminUsersTab } from '@/components/admin/AdminUsersTab'
import { AdminCatalogsTab } from '@/components/admin/AdminCatalogsTab'
import { AdminAppearanceTab } from '@/components/admin/AdminAppearanceTab'
import { AdminBillingTab } from '@/components/admin/AdminBillingTab'
import { AdminEmailTab } from '@/components/admin/AdminEmailTab'
import { AdminAITab } from '@/components/admin/AdminAITab'
import { AdminTgClientsTab } from '@/components/admin/AdminTgClientsTab'

type Tab = 'features' | 'users' | 'catalogs' | 'appearance' | 'billing' | 'email' | 'ai' | 'tg_clients'

export function AdminPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('features')

  // Защита — только is_admin
  if (!user?.is_admin) {
    return <Navigate to="/dashboard" replace />
  }

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'features',   label: t('admin.tabFeatures'),   icon: Zap },
    { id: 'users',      label: t('admin.tabUsers'),      icon: Users },
    { id: 'catalogs',   label: t('admin.tabCatalogs'),   icon: BookOpen },
    { id: 'appearance', label: t('admin.tabAppearance'), icon: Palette },
    { id: 'billing',    label: t('admin.tabBilling'),    icon: CreditCard },
    { id: 'email',      label: t('admin.tabEmail'),      icon: Mail },
    { id: 'ai',         label: t('admin.tabAI'),         icon: Bot },
    { id: 'tg_clients', label: 'Клиенты',                icon: UserCheck },
  ]

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={t('admin.pageTitle')}
        description={t('admin.pageDesc')}
      >
        <Shield className="h-5 w-5 text-amber-600" />
      </PageHeader>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 sm:flex sm:gap-0 sm:border-b">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium rounded-lg transition-colors',
              'sm:rounded-none sm:px-4 sm:py-2.5 sm:text-sm sm:border-b-2 sm:-mb-px sm:justify-start',
              tab === id
                ? 'bg-primary/10 text-primary sm:bg-transparent sm:border-primary sm:text-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted sm:bg-transparent sm:border-transparent sm:hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'features'   && <AdminFeaturesTab />}
        {tab === 'users'      && <AdminUsersTab />}
        {tab === 'catalogs'   && <AdminCatalogsTab />}
        {tab === 'appearance' && <AdminAppearanceTab />}
        {tab === 'billing'    && <AdminBillingTab />}
        {tab === 'email'      && <AdminEmailTab />}
        {tab === 'ai'         && <AdminAITab />}
        {tab === 'tg_clients' && <AdminTgClientsTab />}
      </div>
    </div>
  )
}
