import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Plus, Trash2, BanIcon } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { useSchedule, useUpsertSchedule, useScheduleBreaks, useCreateBreak, useDeleteBreak } from '@/hooks/useSchedule'
import { useDateBlocks, useCreateDateBlock, useDeleteDateBlock } from '@/hooks/useDateBlocks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/shared/Toaster'
import type { Schedule } from '@/types'

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
const DAYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const SLOT_DURATIONS = [15, 30, 45, 60]
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

/**
 * Содержимое страницы расписания — без <form> враппера.
 * Используется как вкладка в ProfilePage и как standalone SchedulePage.
 */
export function ScheduleTab() {
  const { t } = useTranslation()
  const { data: schedule, isLoading } = useSchedule()
  const upsert = useUpsertSchedule()
  const { data: breaks } = useScheduleBreaks()
  const createBreak = useCreateBreak()
  const deleteBreak = useDeleteBreak()

  const { data: dateBlocks } = useDateBlocks()
  const createBlock = useCreateDateBlock()
  const deleteBlock = useDeleteDateBlock()
  const [blockForm, setBlockForm] = useState({ date_from: '', date_to: '', label: '' })

  const handleAddBlock = async () => {
    if (!blockForm.date_from || !blockForm.date_to) return
    if (blockForm.date_to < blockForm.date_from) {
      toast.error('Дата окончания не может быть раньше начала')
      return
    }
    try {
      await createBlock.mutateAsync({ ...blockForm, all_day: true } as any)
      setBlockForm({ date_from: '', date_to: '', label: '' })
      toast.success('Период заблокирован')
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const { control, handleSubmit, reset, watch } = useForm<Partial<Schedule>>({
    defaultValues: {
      mon_enabled: true, mon_start: '09:00', mon_end: '18:00',
      tue_enabled: true, tue_start: '09:00', tue_end: '18:00',
      wed_enabled: true, wed_start: '09:00', wed_end: '18:00',
      thu_enabled: true, thu_start: '09:00', thu_end: '18:00',
      fri_enabled: true, fri_start: '09:00', fri_end: '18:00',
      sat_enabled: false, sat_start: '10:00', sat_end: '16:00',
      sun_enabled: false, sun_start: '10:00', sun_end: '16:00',
      slot_duration: 30,
      advance_days: 30,
    },
  })

  useEffect(() => {
    if (schedule) reset(schedule as Partial<Schedule>)
  }, [schedule, reset])

  const onSubmit = async (values: Partial<Schedule>) => {
    try {
      await upsert.mutateAsync({ id: schedule?.id, data: values })
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const addBreak = async (dow: number) => {
    await createBreak.mutateAsync({ day_of_week: dow, start_time: '13:00', end_time: '14:00', is_recurring: true })
    toast.success(t('schedule.breakAdded'))
  }

  if (isLoading) return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Working Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {t('schedule.workingHours')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map((day, idx) => {
            const enabled = watch(`${day}_enabled` as keyof Schedule) as boolean
            return (
              <div key={day} className="flex items-center gap-3 py-2 border-b last:border-0">
                <Controller
                  name={`${day}_enabled` as keyof Schedule}
                  control={control}
                  render={({ field }) => (
                    <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                  )}
                />
                <span className={`w-10 text-sm font-medium capitalize ${!enabled ? 'text-muted-foreground' : ''}`}>
                  {t(`schedule.days.${day}`)}
                </span>
                {enabled ? (
                  <>
                    <Controller
                      name={`${day}_start` as keyof Schedule}
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value as string} onValueChange={field.onChange}>
                          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <span className="text-muted-foreground">—</span>
                    <Controller
                      name={`${day}_end` as keyof Schedule}
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value as string} onValueChange={field.onChange}>
                          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 ml-auto"
                      onClick={() => addBreak(idx === 6 ? 0 : idx + 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">{t('schedule.dayOff')}</span>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Breaks */}
      {breaks && breaks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('schedule.breaks')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {breaks.map((b) => (
              <div key={b.id} className="flex items-center gap-3 p-2 border rounded-lg">
                <span className="text-sm text-muted-foreground w-8">
                  {t(`schedule.days.${DAYS[b.day_of_week === 0 ? 6 : b.day_of_week - 1]}`)}
                </span>
                <span className="text-sm font-mono">{b.start_time} — {b.end_time}</span>
                {b.label && <span className="text-xs text-muted-foreground">{b.label}</span>}
                <Button
                  type="button" variant="ghost" size="icon" className="h-7 w-7 ml-auto text-destructive"
                  onClick={() => deleteBreak.mutateAsync(b.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Date Blocks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BanIcon className="h-4 w-4" />
            Блокировка дат
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Заблокируйте даты, когда вы недоступны (отпуск, болезнь и т.д.).</p>
          {dateBlocks && dateBlocks.length > 0 && (
            <div className="space-y-2">
              {dateBlocks.map((block) => (
                <div key={block.id} className="flex items-center gap-3 p-2 border rounded-lg">
                  <BanIcon className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-sm font-mono">{block.date_from} — {block.date_to}</span>
                  {block.label && <span className="text-xs text-muted-foreground">{block.label}</span>}
                  <Button
                    type="button" variant="ghost" size="icon" className="h-7 w-7 ml-auto text-destructive"
                    onClick={() => deleteBlock.mutateAsync(block.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-3 border rounded-lg p-3">
            <p className="text-sm font-medium">Добавить период блокировки</p>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">С даты</Label>
                <Input
                  type="date"
                  className="w-38"
                  value={blockForm.date_from}
                  onChange={(e) => setBlockForm(f => ({ ...f, date_from: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">По дату</Label>
                <Input
                  type="date"
                  className="w-38"
                  value={blockForm.date_to}
                  onChange={(e) => setBlockForm(f => ({ ...f, date_to: e.target.value }))}
                />
              </div>
              <div className="space-y-1 flex-1 min-w-32">
                <Label className="text-xs">Причина (необязательно)</Label>
                <Input
                  placeholder="Отпуск, болезнь..."
                  value={blockForm.label}
                  onChange={(e) => setBlockForm(f => ({ ...f, label: e.target.value }))}
                />
              </div>
              <Button
                type="button"
                onClick={handleAddBlock}
                loading={createBlock.isPending}
                disabled={!blockForm.date_from || !blockForm.date_to}
              >
                <Plus className="h-4 w-4 mr-1" />
                Добавить
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Slot & Advance Settings */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t('schedule.bookingSettings')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label className="w-48">{t('schedule.slotDuration')}</Label>
            <Controller
              name="slot_duration"
              control={control}
              render={({ field }) => (
                <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SLOT_DURATIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>{d} {t('services.minutes')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex items-center gap-4">
            <Label className="w-48">{t('schedule.advanceDays')}</Label>
            <Controller
              name="advance_days"
              control={control}
              render={({ field }) => (
                <Input
                  type="number"
                  className="w-24"
                  value={field.value as number}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button
          type="button"
          loading={upsert.isPending}
          onClick={handleSubmit(onSubmit)}
        >
          {t('common.save')}
        </Button>
      </div>
    </div>
  )
}
