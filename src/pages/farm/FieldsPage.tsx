import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { Plus, Pencil, Trash2, MapPin, Loader2 } from 'lucide-react'
import { useCurrentFarm, useFields, useDeleteField } from '@/hooks/farm/useFarmData'
import { FieldDialog } from '@/components/farm/SimpleDialogs'
import { FarmOnboarding } from '@/components/farm/FarmOnboarding'
import type { Field } from '@/types/farm'

export function FieldsPage() {
  const { t } = useTranslation()
  const { data: farm, isLoading } = useCurrentFarm()
  const { data: fields } = useFields(farm?.id)
  const del = useDeleteField()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Field | null>(null)

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!farm) return <FarmOnboarding />

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <PageHeader title={t('farm.fields.title')}>
        <Button onClick={() => { setEditing(null); setOpen(true) }}><Plus className="h-4 w-4 mr-1" /> {t('farm.fields.add')}</Button>
      </PageHeader>

      {(fields ?? []).length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('farm.fields.empty')}</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(fields ?? []).map(f => (
            <Card key={f.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-semibold truncate">{f.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(f); setOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={async () => { if (confirm(t('farm.common.confirmDelete'))) await del.mutateAsync(f.id) }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">{t(`farm.fields.status.${f.status}`)}</Badge>
                  <span className="text-muted-foreground">{f.area_ha} {t('farm.common.ha')}</span>
                </div>
                {f.current_crop && <p className="text-xs text-muted-foreground">{f.current_crop}</p>}
                {f.soil_type && <p className="text-xs text-muted-foreground">{f.soil_type}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <FieldDialog open={open} onOpenChange={setOpen} farmId={farm.id} initial={editing} />
    </div>
  )
}
