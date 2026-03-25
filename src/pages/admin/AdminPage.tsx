import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Shield, Zap, Users, BookOpen, Palette, CreditCard, Mail, Bot, UserCheck, BarChart2 } from 'lucide-react'
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
import { AdminReportsTab } from '@/components/admin/AdminReportsTab'

type Tab = 'features' | 'users' | 'catalogs' | 'appearance' | 'billing' | 'email' | 'ai' | 'tg_clients' | 'reports'

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
    { id: 'reports',    label: 'Отчёты',                 icon: BarChart2  },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.pageTitle')}
        description={t('admin.pageDesc')}
      >
        <Shield className="h-5 w-5 text-amber-600" />
      </PageHeader>

      <div className="flex gap-6 items-start">
        {/* Vertical sidebar — sm+ */}
        <nav className="hidden sm:flex flex-col w-44 shrink-0 gap-0.5">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-left transition-colors w-full',
                tab === id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Mobile: grid tabs */}
        <div className="sm:hidden grid grid-cols-3 gap-1 w-full">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex flex-col items-center gap-1 px-2 py-2.5 text-xs font-medium rounded-lg transition-colors',
                tab === id
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate w-full text-center">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 min-w-0">
          {tab === 'features'   && <AdminFeaturesTab />}
          {tab === 'users'      && <AdminUsersTab />}
          {tab === 'catalogs'   && <AdminCatalogsTab />}
          {tab === 'appearance' && <AdminAppearanceTab />}
          {tab === 'billing'    && <AdminBillingTab />}
          {tab === 'email'      && <AdminEmailTab />}
          {tab === 'ai'         && <AdminAITab />}
          {tab === 'tg_clients' && <AdminTgClientsTab />}
          {tab === 'reports'    && <AdminReportsTab />}
        </div>
      </div>
    </div>
  )
}
