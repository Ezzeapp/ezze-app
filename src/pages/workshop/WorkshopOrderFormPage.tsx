import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Columns, ListOrdered } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'
import { cn } from '@/lib/utils'
import { useOrderFormState } from './orderForm/useOrderFormState'
import { SplitLayout } from './orderForm/SplitLayout'
import { WizardLayout } from './orderForm/WizardLayout'

type Layout = 'split' | 'wizard'
const LAYOUT_KEY = 'workshop.form.layout'
const DESKTOP_MQ = '(min-width: 1024px)'

function useIsDesktop(): boolean {
  const [is, set] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(DESKTOP_MQ).matches : true,
  )
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_MQ)
    const handler = (e: MediaQueryListEvent) => set(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return is
}

export function WorkshopOrderFormPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const f = useOrderFormState()
  const isDesktop = useIsDesktop()

  const [desktopLayout, setDesktopLayout] = useState<Layout>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(LAYOUT_KEY) : null
    return saved === 'wizard' ? 'wizard' : 'split'
  })

  useEffect(() => {
    localStorage.setItem(LAYOUT_KEY, desktopLayout)
  }, [desktopLayout])

  const layout: Layout = isDesktop ? desktopLayout : 'wizard'

  const onCancel = () => navigate('/orders')

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-1" /> {t('workshop.detail.back')}
        </Button>
        {f.nextNumber && (
          <div className="text-xs text-muted-foreground">
            {t('workshop.form.nextNumber')}:{' '}
            <span className="font-mono font-semibold text-foreground">{f.nextNumber}</span>
          </div>
        )}
      </div>

      <div className="mb-5 flex items-end justify-between gap-3 flex-wrap">
        <PageHeader title={t('workshop.form.title')} description={t('workshop.form.subtitle')} />
        {isDesktop && (
          <div className="inline-flex rounded-lg border bg-muted p-0.5 shrink-0">
            <LayoutTab
              active={desktopLayout === 'split'}
              onClick={() => setDesktopLayout('split')}
              icon={<Columns className="h-3.5 w-3.5" />}
              label={t('workshop.form.layoutSplit')}
            />
            <LayoutTab
              active={desktopLayout === 'wizard'}
              onClick={() => setDesktopLayout('wizard')}
              icon={<ListOrdered className="h-3.5 w-3.5" />}
              label={t('workshop.form.layoutWizard')}
            />
          </div>
        )}
      </div>

      {layout === 'split' ? (
        <SplitLayout f={f} onCancel={onCancel} />
      ) : (
        <WizardLayout f={f} onCancel={onCancel} />
      )}
    </div>
  )
}

function LayoutTab({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-all',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
