import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClinicDentalChart, useUpdateTooth, useResetDentalChart } from '@/hooks/useClinicDentalChart'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { RotateCcw } from 'lucide-react'
import { toast } from '@/components/shared/Toaster'
import type { ToothStatus } from '@/types'

// FDI нумерация: верхний правый 18-11, верхний левый 21-28, нижний левый 38-31, нижний правый 41-48
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]
const UPPER_LEFT  = [21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_LEFT  = [38, 37, 36, 35, 34, 33, 32, 31]
const LOWER_RIGHT = [41, 42, 43, 44, 45, 46, 47, 48]

const STATUSES: ToothStatus[] = ['healthy', 'caries', 'filling', 'crown', 'missing', 'implant', 'bridge', 'root_canal']

const STATUS_COLORS: Record<ToothStatus, string> = {
  healthy:    'bg-white border-gray-300 text-gray-700',
  caries:     'bg-yellow-100 border-yellow-500 text-yellow-800',
  filling:    'bg-blue-100 border-blue-500 text-blue-800',
  crown:      'bg-amber-100 border-amber-500 text-amber-800',
  missing:    'bg-gray-100 border-gray-400 text-gray-400 line-through',
  implant:    'bg-purple-100 border-purple-500 text-purple-800',
  bridge:     'bg-orange-100 border-orange-500 text-orange-800',
  root_canal: 'bg-red-100 border-red-500 text-red-800',
}

const STATUS_DOT_COLORS: Record<ToothStatus, string> = {
  healthy:    'bg-green-500',
  caries:     'bg-yellow-500',
  filling:    'bg-blue-500',
  crown:      'bg-amber-500',
  missing:    'bg-gray-400',
  implant:    'bg-purple-500',
  bridge:     'bg-orange-500',
  root_canal: 'bg-red-500',
}

function ToothButton({
  number,
  teeth,
  onSelect,
}: {
  number: number
  teeth: Record<number, { status: ToothStatus; notes?: string }>
  onSelect: (toothNumber: number, status: ToothStatus, notes?: string) => void
}) {
  const { t } = useTranslation()
  const tooth = teeth[number]
  const status: ToothStatus = tooth?.status ?? 'healthy'
  const [notes, setNotes] = useState(tooth?.notes ?? '')
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={`w-9 h-10 rounded-md border-2 text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-colors hover:ring-2 hover:ring-primary/30 ${STATUS_COLORS[status]}`}
        >
          <span>{number}</span>
          {status !== 'healthy' && (
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT_COLORS[status]}`} />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48 p-2" align="center">
        <p className="text-xs font-semibold mb-1.5">{t('clinic.dental.selectStatus')}</p>
        <div className="grid grid-cols-2 gap-1">
          {STATUSES.map(s => (
            <button
              key={s}
              className={`text-xs px-2 py-1.5 rounded-md text-left transition-colors ${
                s === status ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
              onClick={() => {
                onSelect(number, s, notes || undefined)
                setOpen(false)
              }}
            >
              <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${STATUS_DOT_COLORS[s]}`} />
              {t(`clinic.dental.${s}`)}
            </button>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t">
          <Input
            className="h-7 text-xs"
            placeholder={t('clinic.dental.toothNotes')}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== (tooth?.notes ?? '')) {
                onSelect(number, status, notes || undefined)
              }
            }}
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function DentalChart({ clientId }: { clientId: string }) {
  const { t } = useTranslation()
  const { data: chart, isLoading } = useClinicDentalChart(clientId)
  const updateTooth = useUpdateTooth()
  const resetChart = useResetDentalChart()

  const teeth = (chart?.teeth ?? {}) as Record<number, { status: ToothStatus; notes?: string }>

  const handleSelect = (toothNumber: number, status: ToothStatus, notes?: string) => {
    updateTooth.mutate({ clientId, toothNumber, status, notes })
  }

  const handleReset = async () => {
    if (!chart) return
    try {
      await resetChart.mutateAsync(clientId)
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  if (isLoading) {
    return <Skeleton className="h-40 rounded-lg" />
  }

  const renderRow = (leftTeeth: number[], rightTeeth: number[]) => (
    <div className="flex items-center justify-center gap-0.5">
      <div className="flex gap-0.5">
        {leftTeeth.map(n => (
          <ToothButton key={n} number={n} teeth={teeth} onSelect={handleSelect} />
        ))}
      </div>
      <div className="w-px h-8 bg-border mx-1" />
      <div className="flex gap-0.5">
        {rightTeeth.map(n => (
          <ToothButton key={n} number={n} teeth={teeth} onSelect={handleSelect} />
        ))}
      </div>
    </div>
  )

  // Подсчёт статусов
  const statusCounts = Object.values(teeth).reduce((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{t('clinic.dental.upperJaw')}</p>
        {chart && (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleReset}>
            <RotateCcw className="h-3 w-3" />
            {t('clinic.dental.resetChart')}
          </Button>
        )}
      </div>

      {renderRow(UPPER_RIGHT, UPPER_LEFT)}

      <div className="border-t border-dashed" />

      {renderRow(LOWER_LEFT, LOWER_RIGHT)}

      <p className="text-xs font-medium text-muted-foreground">{t('clinic.dental.lowerJaw')}</p>

      {/* Легенда */}
      {Object.keys(statusCounts).length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {STATUSES.filter(s => statusCounts[s]).map(s => (
            <span key={s} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT_COLORS[s]}`} />
              {t(`clinic.dental.${s}`)} ({statusCounts[s]})
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
