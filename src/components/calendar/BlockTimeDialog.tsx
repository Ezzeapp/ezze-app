import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BanIcon, Loader2 } from 'lucide-react'
import dayjs from 'dayjs'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/shared/Toaster'
import { APPOINTMENTS_KEY } from '@/hooks/useAppointments'

interface BlockTimeDialogProps {
  open: boolean
  date: string              // YYYY-MM-DD
  onClose: () => void
  onCreated?: () => void
}

export function BlockTimeDialog({ open, date, onClose, onCreated }: BlockTimeDialogProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [startTime, setStartTime] = useState('09:00')
  const [endTime,   setEndTime]   = useState('10:00')
  const [note,      setNote]      = useState('')
  const [loading,   setLoading]   = useState(false)

  const handleSave = async () => {
    if (!user) return

    if (startTime >= endTime) {
      toast.error('Время окончания должно быть позже начала')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.from('appointments').insert({
        master_id:   user.id,
        date,
        start_time:  startTime,
        end_time:    endTime,
        status:      'scheduled',
        client_name: '🚫 Занято',
        notes:       note.trim() || 'Заблокировано',
        booked_via:  'manual',
      })

      if (error) throw error

      toast.success('Время заблокировано')
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] })
      onCreated?.()
      onClose()
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка при блокировке времени')
    } finally {
      setLoading(false)
    }
  }

  const displayDate = dayjs(date).format('D MMMM YYYY')

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BanIcon className="h-4 w-4 text-muted-foreground" />
            Заблокировать время
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Дата — только читаем */}
          <div>
            <Label className="text-xs text-muted-foreground">Дата</Label>
            <p className="text-sm font-medium mt-0.5">{displayDate}</p>
          </div>

          {/* Время */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bt-start" className="text-xs">Начало</Label>
              <Input
                id="bt-start"
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bt-end" className="text-xs">Конец</Label>
              <Input
                id="bt-end"
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Причина (опционально) */}
          <div className="space-y-1.5">
            <Label htmlFor="bt-note" className="text-xs">Причина (необязательно)</Label>
            <Input
              id="bt-note"
              placeholder="Обед, личные дела, техперерыв…"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {/* Кнопки */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
              Отмена
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Заблокировать'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
