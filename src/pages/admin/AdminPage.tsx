import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Shield, Palette, LayoutGrid } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/shared/PageHeader'
import { cn } from '@/lib/utils'
import { AdminAppearanceTab } from '@/components/admin/AdminAppearanceTab'
import { AdminHomeScreenTab } from '@/components/admin/AdminHomeScreenTab'

type Tab = 'appearance' | 'home_screen'

export function AdminPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('appearance')

  // Защита — только is_admin
  if (!user?.is_admin) {
    return <Navigate to="/dashboard" replace />
  }

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'appearance',  label: t('admin.tabAppearance'),     icon: Palette },
    { id: 'home_screen', label: t('admin.homeScreen.title'),  icon: LayoutGrid },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.pageTitle')}
        description={t('admin.pageDesc')}
      >
        <Shield className="h-5 w-5 text-amber-600" />
      </PageHeader>

      {/* Mobile: сетка 2 колонки */}
      <div className="sm:hidden grid grid-cols-2 gap-1.5 mb-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 text-xs font-medium rounded-lg transition-colors w-full',
              tab === id
                ? 'bg-primary/10 text-primary'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate flex-1 text-left">{label}</span>
          </button>
        ))}
      </div>

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
              <span className="flex-1">{label}</span>
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className="flex-1 min-w-0">
          {tab === 'appearance'  && <AdminAppearanceTab />}
          {tab === 'home_screen' && <AdminHomeScreenTab />}
        </div>
      </div>
    </div>
  )
}
