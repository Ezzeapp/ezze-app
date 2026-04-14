import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/PageHeader'
import { ArrowLeft, Plus, Loader2, Pencil, Trash2 } from 'lucide-react'
import { useAnimal, useAnimalEvents, useDeleteAnimal, useAnimalCosts, useCurrentFarm } from '@/hooks/farm/useFarmData'
import { SpeciesIcon } from '@/components/farm/SpeciesIcon'
import { AnimalDialog } from '@/components/farm/AnimalDialog'
import { AnimalEventDialog } from '@/components/farm/SimpleDialogs'
import { OffspringTree } from '@/components/farm/OffspringTree'
import { formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import dayjs from 'dayjs'

export function AnimalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const nav = useNavigate()
  const symbol = useCurrencySymbol()
  const { data: farm } = useCurrentFarm()
  const { data: animal, isLoading } = useAnimal(id)
  const { data: events } = useAnimalEvents({ animalId: id })
  const { data: costs } = useAnimalCosts(farm?.id)
  const del = useDeleteAnimal()
  const [editOpen, setEditOpen] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!animal || !farm) return <div className="p-6 text-muted-foreground">—</div>

  const costRow = (costs ?? []).find(c => c.animal_id === animal.id)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <PageHeader
        title={`${animal.tag}${animal.name ? ` · ${animal.name}` : ''}`}
        description={t(`farm.species.${animal.species}`)}
      >
        <Button variant="ghost" size="sm" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4 mr-1" /> {t('farm.common.back')}</Button>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={async () => {
          if (confirm(t('farm.common.confirmDelete'))) { await del.mutateAsync(animal.id); nav(-1) }
        }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-5 flex items-center gap-4">
          <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center">
            <SpeciesIcon species={animal.species} className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge>{t(`farm.status.${animal.status}`)}</Badge>
              {animal.sex !== 'unknown' && <Badge variant="outline">{t(`farm.sex.${animal.sex}`)}</Badge>}
              {animal.breed && <span className="text-sm text-muted-foreground">{animal.breed}</span>}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {animal.birth_date && <>{t('farm.animals.fields.birthDate')}: {dayjs(animal.birth_date).format('DD.MM.YYYY')} · </>}
              {animal.current_weight_kg && <>{animal.current_weight_kg} {t('farm.common.kg')}</>}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">{t('farm.animals.tabs.events')}</TabsTrigger>
          <TabsTrigger value="costs">{t('farm.animals.tabs.costs')}</TabsTrigger>
          <TabsTrigger value="offspring">{t('farm.animals.tabs.offspring')}</TabsTrigger>
          <TabsTrigger value="info">{t('farm.animals.tabs.info')}</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setEventOpen(true)}><Plus className="h-4 w-4 mr-1" /> {t('farm.animals.addEvent')}</Button>
          </div>
          {(events ?? []).length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('farm.animals.noEvents')}</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {(events ?? []).map(e => (
                <Card key={e.id}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{t(`farm.eventType.${e.event_type}`)}</Badge>
                        <span className="text-xs text-muted-foreground">{dayjs(e.event_date).format('DD.MM.YYYY HH:mm')}</span>
                      </div>
                      {e.weight_kg && <p className="text-sm mt-1">{e.weight_kg} {t('farm.common.kg')}</p>}
                      {e.notes && <p className="text-sm text-muted-foreground mt-1">{e.notes}</p>}
                    </div>
                    {e.cost != null && <span className="text-sm font-medium">{formatCurrency(e.cost)} {symbol}</span>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="costs">
          <Card>
            <CardHeader><CardTitle className="text-base">{t('farm.reports.costBreakdown')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {costRow ? (
                <>
                  <CostRow label={t('farm.reports.columns.acquisitionCost')} value={costRow.acquisition_cost} symbol={symbol} />
                  <CostRow label={t('farm.reports.columns.feedCost')}        value={costRow.feed_cost}        symbol={symbol} />
                  <CostRow label={t('farm.reports.columns.vetCost')}         value={costRow.veterinary_cost} symbol={symbol} />
                  <CostRow label={t('farm.reports.columns.overhead')}        value={costRow.allocated_overhead} symbol={symbol} />
                  <div className="border-t pt-2 mt-2">
                    <CostRow label={t('farm.reports.columns.totalCost')} value={costRow.total_cost} symbol={symbol} bold />
                  </div>
                </>
              ) : <p className="text-sm text-muted-foreground">{t('farm.common.noData')}</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offspring">
          <Card>
            <CardHeader><CardTitle className="text-base">{t('farm.animals.tabs.offspring')}</CardTitle></CardHeader>
            <CardContent>
              <OffspringTree animalId={animal.id} sex={animal.sex} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info">
          <Card>
            <CardContent className="pt-5 space-y-2 text-sm">
              {animal.notes && <p>{animal.notes}</p>}
              <InfoRow label={t('farm.animals.fields.acquisitionDate')} value={animal.acquisition_date ? dayjs(animal.acquisition_date).format('DD.MM.YYYY') : '—'} />
              <InfoRow label={t('farm.animals.fields.acquisitionCost')} value={animal.acquisition_cost != null ? `${formatCurrency(animal.acquisition_cost)} ${symbol}` : '—'} />
              <InfoRow label={t('farm.animals.purpose')} value={animal.purpose ? t(`farm.purpose.${animal.purpose}`) : '—'} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AnimalDialog open={editOpen} onOpenChange={setEditOpen} farmId={farm.id} initial={animal} />
      <AnimalEventDialog open={eventOpen} onOpenChange={setEventOpen} farmId={farm.id} animalId={animal.id} />
    </div>
  )
}

function CostRow({ label, value, symbol, bold }: { label: string; value: number; symbol: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className={bold ? '' : 'text-muted-foreground'}>{label}</span>
      <span>{formatCurrency(value)} {symbol}</span>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}
