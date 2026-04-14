import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tractor } from 'lucide-react'
import { useUpsertFarm } from '@/hooks/farm/useFarmData'

export function FarmOnboarding() {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [area, setArea] = useState<string>('')
  const upsert = useUpsertFarm()

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Tractor className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t('farm.dashboard.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('farm.onboarding.subtitle')}</p>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">{t('farm.onboarding.name')}</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('farm.onboarding.namePlaceholder')} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('farm.onboarding.location')}</Label>
            <Input value={location} onChange={e => setLocation(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('farm.onboarding.area')}</Label>
            <Input type="number" step="0.01" value={area} onChange={e => setArea(e.target.value)} />
          </div>

          <Button
            className="w-full"
            disabled={!name.trim() || upsert.isPending}
            onClick={() => upsert.mutate({ name: name.trim(), location: location || null, area_ha: area ? Number(area) : null, currency: 'UZS' })}
          >
            {t('farm.onboarding.create')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
