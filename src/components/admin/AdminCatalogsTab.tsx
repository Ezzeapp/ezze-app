import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Scissors, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminSpecialtiesDialog } from '@/components/admin/AdminSpecialtiesDialog'
import { AdminGlobalServicesDialog } from '@/components/admin/AdminGlobalServicesDialog'
import { AdminGlobalProductsDialog } from '@/components/admin/AdminGlobalProductsDialog'

export function AdminCatalogsTab() {
  const { t } = useTranslation()
  const [specialtiesOpen, setSpecialtiesOpen] = useState(false)
  const [servicesOpen, setServicesOpen] = useState(false)
  const [productsOpen, setProductsOpen] = useState(false)

  const catalogs = [
    {
      key: 'specialties',
      icon: BookOpen,
      titleKey: 'admin.specialtiesTitle',
      descKey: 'admin.specialtiesDesc',
      btnKey: 'admin.openSpecialties',
      onClick: () => setSpecialtiesOpen(true),
      available: true,
    },
    {
      key: 'services',
      icon: Scissors,
      titleKey: 'admin.globalServicesTitle',
      descKey: 'admin.globalServicesDesc',
      btnKey: 'admin.openGlobalServices',
      onClick: () => setServicesOpen(true),
      available: true,
    },
    {
      key: 'products',
      icon: Package,
      titleKey: 'admin.globalProductsTitle',
      descKey: 'admin.globalProductsDesc',
      btnKey: 'admin.openGlobalProducts',
      onClick: () => setProductsOpen(true),
      available: true,
    },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('admin.catalogsDesc')}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {catalogs.map(({ key, icon: Icon, titleKey, descKey, btnKey, onClick, available }) => (
          <Card key={key} className={!available ? 'opacity-60' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                {t(titleKey)}
              </CardTitle>
              <CardDescription className="text-xs">{t(descKey)}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                size="sm"
                variant="outline"
                onClick={onClick}
                disabled={!available}
                className="w-full"
              >
                <Icon className="h-3.5 w-3.5 mr-1.5" />
                {available ? t(btnKey) : t('admin.comingSoon')}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <AdminSpecialtiesDialog
        open={specialtiesOpen}
        onClose={() => setSpecialtiesOpen(false)}
      />
      <AdminGlobalServicesDialog
        open={servicesOpen}
        onClose={() => setServicesOpen(false)}
      />
      <AdminGlobalProductsDialog
        open={productsOpen}
        onClose={() => setProductsOpen(false)}
      />
    </div>
  )
}
