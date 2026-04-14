import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/shared/PageHeader'
import { Printer, Loader2, Search, Camera } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCurrentFarm, useAnimals } from '@/hooks/farm/useFarmData'
import { FarmOnboarding } from '@/components/farm/FarmOnboarding'
import type { AnimalSpecies } from '@/types/farm'
import { ANIMAL_SPECIES_LIST } from '@/types/farm'

type Size = 'small' | 'medium' | 'large'
const PX: Record<Size, number> = { small: 80, medium: 128, large: 180 }

export function QrTagsPage() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const { data: farm, isLoading } = useCurrentFarm()
  const [species, setSpecies] = useState<AnimalSpecies | ''>('')
  const [search, setSearch] = useState('')
  const [size, setSize] = useState<Size>('medium')
  const { data: animals } = useAnimals(farm?.id, { species: species || undefined, search: search || undefined })
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => animals ?? [], [animals])
  const selectedAnimals = filtered.filter(a => selected.has(a.id))

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(a => a.id)))
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function qrPayload(animalId: string): string {
    return `${window.location.origin}/farm/animals/${animalId}`
  }

  function handlePrint() {
    window.print()
  }

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!farm) return <FarmOnboarding />

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4 print:p-0 print:space-y-0">
      <div className="print:hidden">
        <PageHeader title={t('farm.qr.title')} description={t('farm.qr.subtitle')}>
          <Button variant="outline" onClick={() => nav('/farm/qr/scan')}><Camera className="h-4 w-4 mr-1" /> {t('farm.qr.scan')}</Button>
          <Button onClick={handlePrint} disabled={selectedAnimals.length === 0}>
            <Printer className="h-4 w-4 mr-1" /> {t('farm.qr.print')} ({selectedAnimals.length})
          </Button>
        </PageHeader>

        <div className="flex gap-2 flex-wrap mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder={t('farm.animals.search')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={species || '__all'} onValueChange={v => setSpecies(v === '__all' ? '' : v as AnimalSpecies)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">{t('farm.common.all')}</SelectItem>
              {ANIMAL_SPECIES_LIST.map(s => <SelectItem key={s.value} value={s.value}>{t(s.labelKey)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={size} onValueChange={v => setSize(v as Size)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="small">{t('farm.qr.small')}</SelectItem>
              <SelectItem value="medium">{t('farm.qr.medium')}</SelectItem>
              <SelectItem value="large">{t('farm.qr.large')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={toggleAll}>{selected.size === filtered.length && filtered.length > 0 ? t('farm.qr.deselectAll') : t('farm.qr.selectAll')}</Button>
        </div>

        {filtered.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('farm.animals.empty')}</CardContent></Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filtered.map(a => (
              <label key={a.id} className={`border rounded-lg p-2 cursor-pointer transition-colors ${selected.has(a.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
                <div className="flex items-start gap-2 mb-2">
                  <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggle(a.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{a.tag}</p>
                    {a.name && <p className="text-xs text-muted-foreground truncate">{a.name}</p>}
                  </div>
                </div>
                <div className="flex justify-center bg-white p-1 rounded">
                  <QRCodeSVG value={qrPayload(a.id)} size={64} level="M" />
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Для печати — сетка бирок */}
      <div className="hidden print:block">
        <div className="grid grid-cols-3 gap-4 p-4">
          {selectedAnimals.map(a => (
            <div key={a.id} className="border rounded-lg p-3 flex flex-col items-center break-inside-avoid text-center">
              <QRCodeSVG value={qrPayload(a.id)} size={PX[size]} level="M" includeMargin />
              <p className="text-sm font-bold mt-2">{a.tag}</p>
              {a.name && <p className="text-xs">{a.name}</p>}
              <p className="text-xs text-gray-500">{a.breed ?? ''}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
