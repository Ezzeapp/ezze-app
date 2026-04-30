import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, KeyRound, RotateCcw, AlertTriangle, Coins } from 'lucide-react'
import type { RentalBooking, RentalItem } from '@/types/rental'
import { useCreateRentalHandover } from '@/hooks/useRentalHandovers'
import { useUpsertRentalBooking } from '@/hooks/useRentalBookings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { toast } from '@/components/shared/Toaster'

type HandoverType = 'pickup' | 'return'

interface Props {
  open: boolean
  onClose: () => void
  booking: RentalBooking
  item: RentalItem | undefined
  type: HandoverType
  onDone?: () => void
}

export function HandoverWizard({ open, onClose, booking, item, type, onDone }: Props) {
  const isPickup = type === 'pickup'
  const totalSteps = isPickup ? 2 : 3
  const [step, setStep] = useState(1)

  const create = useCreateRentalHandover()
  const upsertBooking = useUpsertRentalBooking()
  const currencySymbol = useCurrencySymbol()

  // Шаг 1 — состояние и specs snapshot
  const [conditionNotes, setConditionNotes] = useState('')
  const [odometerKm, setOdometerKm]         = useState('')
  const [engineHours, setEngineHours]       = useState('')
  const [fuelLevel, setFuelLevel]           = useState('')

  // Шаг 2 (только для return) — повреждения и расчёт удержаний
  const [damagesDescription, setDamagesDescription] = useState('')
  const [missingItems, setMissingItems]     = useState('')
  const [lateMinutes, setLateMinutes]       = useState('0')
  const [lateFee, setLateFee]               = useState('0')
  const [damagesAmount, setDamagesAmount]   = useState('0')
  const [cleaningFee, setCleaningFee]       = useState('0')
  const [fuelCharge, setFuelCharge]         = useState('0')
  const [otherCharges, setOtherCharges]     = useState('0')
  const [withholdReason, setWithholdReason] = useState('')

  // Сброс при открытии и предзаполнение
  useEffect(() => {
    if (!open) return
    setStep(1)
    setConditionNotes('')
    setOdometerKm(''); setEngineHours(''); setFuelLevel('')
    setDamagesDescription(''); setMissingItems('')
    setLateMinutes('0'); setLateFee('0'); setDamagesAmount('0')
    setCleaningFee('0'); setFuelCharge('0'); setOtherCharges('0')
    setWithholdReason('')

    // Авторасчёт просрочки для return
    if (!isPickup) {
      const now = Date.now()
      const endTs = new Date(booking.end_at).getTime()
      if (now > endTs) {
        const minutes = Math.round((now - endTs) / 60000)
        setLateMinutes(String(minutes))
      }
    }
  }, [open, isPickup, booking.end_at])

  const chargesTotal = useMemo(() => {
    return [lateFee, damagesAmount, cleaningFee, fuelCharge, otherCharges]
      .reduce((sum, v) => sum + (Number(v) || 0), 0)
  }, [lateFee, damagesAmount, cleaningFee, fuelCharge, otherCharges])

  const depositReturn = useMemo(() => {
    const deposit = booking.deposit_amount || 0
    const withheld = Math.min(deposit, chargesTotal)
    return {
      withheld,
      returned: Math.max(0, deposit - withheld),
    }
  }, [booking.deposit_amount, chargesTotal])

  const buildSpecsSnapshot = () => {
    const snap: Record<string, unknown> = {}
    if (odometerKm)  snap.odometer_km = Number(odometerKm)
    if (engineHours) snap.engine_hours = Number(engineHours)
    if (fuelLevel)   snap.fuel_level = fuelLevel
    return snap
  }

  const handleSubmit = async () => {
    try {
      // 1) Создать handover
      await create.mutateAsync({
        booking_id: booking.id,
        type,
        condition_notes: conditionNotes.trim() || null,
        damages_description: damagesDescription.trim() || null,
        missing_items: missingItems.trim() || null,
        specs_snapshot: buildSpecsSnapshot(),
        late_minutes: Number(lateMinutes) || 0,
        late_fee: Number(lateFee) || 0,
        damages_amount: Number(damagesAmount) || 0,
        cleaning_fee: Number(cleaningFee) || 0,
        fuel_charge: Number(fuelCharge) || 0,
        other_charges: Number(otherCharges) || 0,
        charges_total: chargesTotal,
        charges_breakdown: {
          late_fee: Number(lateFee) || 0,
          damages: Number(damagesAmount) || 0,
          cleaning: Number(cleaningFee) || 0,
          fuel: Number(fuelCharge) || 0,
          other: Number(otherCharges) || 0,
        },
        deposit_returned: isPickup ? 0 : depositReturn.returned,
        deposit_withheld: isPickup ? 0 : depositReturn.withheld,
        withhold_reason: !isPickup && depositReturn.withheld > 0 ? withholdReason.trim() || null : null,
        signed_at: new Date().toISOString(),
      })

      // 2) Обновить статус брони + поля депозита и просрочки
      const bookingPatch: Partial<RentalBooking> & { item_id: string; start_at: string; end_at: string } = {
        id: booking.id,
        item_id: booking.item_id,
        start_at: booking.start_at,
        end_at: booking.end_at,
      }
      if (isPickup) {
        bookingPatch.status = 'active'
      } else {
        bookingPatch.status = 'returned'
        bookingPatch.actual_returned_at = new Date().toISOString()
        bookingPatch.late_fee = Number(lateFee) || 0
        bookingPatch.damages_amount = (Number(damagesAmount) || 0) +
                                       (Number(cleaningFee) || 0) +
                                       (Number(fuelCharge) || 0) +
                                       (Number(otherCharges) || 0)
        bookingPatch.deposit_returned = depositReturn.returned
        bookingPatch.deposit_withheld = depositReturn.withheld
        bookingPatch.deposit_status = depositReturn.withheld === 0 ? 'returned'
                                    : depositReturn.returned === 0 ? 'withheld'
                                    : 'partial_returned'
        // Корректируем total_amount: к базе добавляем штрафы
        bookingPatch.total_amount = (booking.base_price || 0) + chargesTotal
      }
      await upsertBooking.mutateAsync(bookingPatch)

      toast.success(isPickup ? 'Объект выдан клиенту' : 'Объект возвращён, расчёт завершён')
      onDone?.()
      onClose()
    } catch (e) {
      console.error(e)
      toast.error('Ошибка сохранения')
    }
  }

  const next = () => setStep(s => Math.min(s + 1, totalSteps))
  const prev = () => setStep(s => Math.max(s - 1, 1))

  const isLastStep = step === totalSteps
  const submitting = create.isPending || upsertBooking.isPending

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPickup
              ? <><KeyRound className="h-5 w-5 text-primary" /> Выдача объекта клиенту</>
              : <><RotateCcw className="h-5 w-5 text-primary" /> Приём объекта от клиента</>}
          </DialogTitle>
        </DialogHeader>

        {/* Шаги индикатор */}
        <div className="flex items-center gap-1 my-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 h-1 rounded-full transition-colors',
                i + 1 <= step ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>

        {/* Контент брони */}
        <div className="rounded-md bg-muted/40 p-2.5 text-sm">
          <p className="font-medium">{item?.name ?? '—'} <span className="text-xs text-muted-foreground font-mono">· {booking.number}</span></p>
          <p className="text-xs text-muted-foreground">
            Период: {new Date(booking.start_at).toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            {' → '}
            {new Date(booking.end_at).toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* ── Шаг 1: Состояние ── */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Шаг 1 — Состояние объекта {isPickup ? 'при выдаче' : 'при возврате'}
            </p>

            {(item?.category === 'transport' || item?.category === 'tool') && (
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Пробег, км</Label>
                  <Input type="number" min={0} value={odometerKm} onChange={e => setOdometerKm(e.target.value)} placeholder="—" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Моточасы</Label>
                  <Input type="number" min={0} value={engineHours} onChange={e => setEngineHours(e.target.value)} placeholder="—" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Топливо</Label>
                  <Input value={fuelLevel} onChange={e => setFuelLevel(e.target.value)} placeholder="100%, 1/2…" />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label>Заметки о состоянии</Label>
              <textarea
                value={conditionNotes}
                onChange={e => setConditionNotes(e.target.value)}
                placeholder={isPickup
                  ? 'Например: царапина на правом бампере, комплект (зарядка, чехол)'
                  : 'Состояние при возврате, общие наблюдения'}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {!isPickup && (
              <>
                <div className="space-y-1">
                  <Label>Описание повреждений / новых дефектов</Label>
                  <textarea
                    value={damagesDescription}
                    onChange={e => setDamagesDescription(e.target.value)}
                    placeholder="Скол на лобовом, царапина на крыле, погнут ключ..."
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Отсутствующие комплектующие</Label>
                  <Input
                    value={missingItems}
                    onChange={e => setMissingItems(e.target.value)}
                    placeholder="Зарядка, второй ключ..."
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Шаг 2 (только return): Удержания ── */}
        {!isPickup && step === 2 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Coins className="h-3.5 w-3.5" /> Шаг 2 — Расчёт удержаний
            </p>

            {Number(lateMinutes) > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-2.5 text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-200">Просрочка возврата</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Объект сдан на {Math.floor(Number(lateMinutes) / 60)} ч {Number(lateMinutes) % 60} мин позже
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Штраф за просрочку</Label>
                <Input type="number" min={0} value={lateFee} onChange={e => setLateFee(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Сумма повреждений</Label>
                <Input type="number" min={0} value={damagesAmount} onChange={e => setDamagesAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Доп. чистка</Label>
                <Input type="number" min={0} value={cleaningFee} onChange={e => setCleaningFee(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Дозаправка</Label>
                <Input type="number" min={0} value={fuelCharge} onChange={e => setFuelCharge(e.target.value)} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Прочее</Label>
                <Input type="number" min={0} value={otherCharges} onChange={e => setOtherCharges(e.target.value)} />
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 p-2.5 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Всего удержаний</span>
                <span className="font-medium">{formatCurrency(chargesTotal)} {currencySymbol}</span>
              </div>
              {booking.deposit_required && booking.deposit_amount > 0 && (
                <>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Депозит</span>
                    <span>{formatCurrency(booking.deposit_amount)} {currencySymbol}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Из депозита</span>
                    <span>−{formatCurrency(depositReturn.withheld)} {currencySymbol}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                    <span>Возврат депозита</span>
                    <span className="text-green-700 dark:text-green-400">
                      {formatCurrency(depositReturn.returned)} {currencySymbol}
                    </span>
                  </div>
                  {chargesTotal > booking.deposit_amount && (
                    <p className="text-xs text-rose-600 dark:text-rose-400">
                      Удержания превышают депозит на{' '}
                      {formatCurrency(chargesTotal - booking.deposit_amount)} {currencySymbol}
                      {' '}— взыщите доплату с клиента
                    </p>
                  )}
                </>
              )}
            </div>

            {chargesTotal > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Причина удержаний (для договора)</Label>
                <textarea
                  value={withholdReason}
                  onChange={e => setWithholdReason(e.target.value)}
                  placeholder="Просрочка 3 часа, скол на крыле, недозаправка"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
          </div>
        )}

        {/* ── Финальный шаг: Подтверждение ── */}
        {step === totalSteps && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Шаг {totalSteps} — Подтверждение
            </p>
            <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
              <p className="font-medium">
                {isPickup
                  ? 'Подтвердите выдачу объекта клиенту'
                  : 'Подтвердите приёмку объекта от клиента'}
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Состояние зафиксировано в акте</li>
                {isPickup
                  ? <li>• Статус брони изменится на «В аренде»</li>
                  : <>
                      <li>• Статус брони изменится на «Возвращён»</li>
                      {chargesTotal > 0 && <li>• Удержано: {formatCurrency(chargesTotal)} {currencySymbol}</li>}
                      {booking.deposit_required && (
                        <li>• Возврат депозита: {formatCurrency(depositReturn.returned)} {currencySymbol}</li>
                      )}
                    </>
                }
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 ? (
            <Button variant="outline" onClick={prev} disabled={submitting}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Назад
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose}>Отмена</Button>
          )}
          {!isLastStep ? (
            <Button onClick={next}>
              Далее
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} loading={submitting}>
              <Check className="h-4 w-4 mr-1" />
              {isPickup ? 'Выдать объект' : 'Принять объект'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
