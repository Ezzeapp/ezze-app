import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { Plus, Pencil, Trash2, Loader2, MapPin, Users, AlertTriangle } from 'lucide-react'
import { useCurrentFarm, usePastures, useDeletePasture, useAnimalGroups, useAnimals } from '@/hooks/farm/useFarmData'
import { PastureDialog } from '@/components/farm/ExtraDialogs'
import { FarmOnboarding } from '@/components/farm/FarmOnboarding'
import type { Pasture } from '@/types/farm'

export function PasturesPage() {
  const { t } = useTranslation()
  const { data: farm, isLoading } = useCurrentFarm()
  const { data: pastures } = usePastures(farm?.id)
  const { data: groups } = useAnimalGroups(farm?.id)
  const { data: animals } = useAnimals(farm?.id)
  const del = useDeletePasture()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Pasture | null>(null)

  const headsPerGroup = useMemo(() => {
    const m = new Map<string, number>()
    ;(animals ?? []).forEach(a => { if (a.group_id) m.set(a.group_id, (m.get(a.group_id) ?? 0) + 1) })
    return m
  }, [animals])

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!farm) return <FarmOnboarding />

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <PageHeader title={t('farm.pastures.title')}>
        <Button onClick={() => { setEditing(null); setOpen(true) }}><Plus className="h-4 w-4 mr-1" /> {t('farm.pastures.add')}</Button>
      </PageHeader>

      {(pastures ?? []).length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('farm.pastures.empty')}</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(pastures ?? []).map(p => {
            const grp = (groups ?? []).find(g => g.id === p.current_group_id)
            const heads = p.current_group_id ? (headsPerGroup.get(p.current_group_id) ?? 0) : 0
            const loadPerHa = p.area_ha > 0 ? heads / p.area_ha : 0
            const overloaded = p.capacity_heads != null && heads > p.capacity_heads
            return (
              <Card key={p.id} className={overloaded ? 'border-amber-400' : ''}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-semibold truncate">{p.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={async () => { if (confirm(t('farm.common.confirmDelete'))) await del.mutateAsync(p.id) }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{p.area_ha} {t('farm.common.ha')}</Badge>
                    {p.capacity_heads != null && <Badge variant="outline">{t('farm.pastures.fields.capacityHeads')}: {p.capacity_heads}</Badge>}
                    {overloaded && <Badge variant="outline" className="text-amber-600 border-amber-400"><AlertTriangle className="h-3 w-3 mr-1" />{t('farm.pastures.overloaded')}</Badge>}
                  </div>
                  {grp && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" /> {grp.name} · {heads} {t('farm.pastures.heads')}
                      {loadPerHa > 0 && <span>· {loadPerHa.toFixed(1)}/{t('farm.common.ha')}</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <PastureDialog open={open} onOpenChange={setOpen} farmId={farm.id} initial={editing} />
    </div>
  )
}
