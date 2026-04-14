import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { Plus, Pencil, Trash2, Loader2, Users } from 'lucide-react'
import { useCurrentFarm, useAnimalGroups, useDeleteAnimalGroup, useAnimals } from '@/hooks/farm/useFarmData'
import { AnimalGroupDialog } from '@/components/farm/SimpleDialogs'
import { SpeciesIcon } from '@/components/farm/SpeciesIcon'
import { FarmOnboarding } from '@/components/farm/FarmOnboarding'
import type { AnimalGroup } from '@/types/farm'

export function GroupsPage() {
  const { t } = useTranslation()
  const { data: farm, isLoading } = useCurrentFarm()
  const { data: groups } = useAnimalGroups(farm?.id)
  const { data: animals } = useAnimals(farm?.id)
  const del = useDeleteAnimalGroup()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AnimalGroup | null>(null)

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!farm) return <FarmOnboarding />

  const countPerGroup = new Map<string, number>()
  ;(animals ?? []).forEach(a => { if (a.group_id) countPerGroup.set(a.group_id, (countPerGroup.get(a.group_id) ?? 0) + 1) })

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <PageHeader title={t('farm.groups.title')}>
        <Button onClick={() => { setEditing(null); setOpen(true) }}><Plus className="h-4 w-4 mr-1" /> {t('farm.common.add')}</Button>
      </PageHeader>

      {(groups ?? []).length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('farm.groups.empty')}</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(groups ?? []).map(g => (
            <Card key={g.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <SpeciesIcon species={g.species} className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-semibold truncate">{g.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(g); setOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={async () => { if (confirm(t('farm.common.confirmDelete'))) await del.mutateAsync(g.id) }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary">{t(`farm.species.${g.species}`)}</Badge>
                  <span className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> {countPerGroup.get(g.id) ?? 0}</span>
                </div>
                {g.location && <p className="text-xs text-muted-foreground">{g.location}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AnimalGroupDialog open={open} onOpenChange={setOpen} farmId={farm.id} initial={editing} />
    </div>
  )
}
