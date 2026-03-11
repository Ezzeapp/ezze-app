import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-8xl font-bold text-muted-foreground/30">404</h1>
        <h2 className="text-2xl font-semibold mt-4">{t('errors.notFound')}</h2>
        <p className="text-muted-foreground mt-2 mb-6">{t('errors.notFoundDesc')}</p>
        <Button onClick={() => navigate('/dashboard')}>
          <Home className="mr-2 h-4 w-4" />
          {t('common.home')}
        </Button>
      </div>
    </div>
  )
}
