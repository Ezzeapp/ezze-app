import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle, XCircle, Loader2, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function CancelBookingPage() {
  const { token } = useParams<{ token: string }>()
  const { t } = useTranslation()
  const [status, setStatus] = useState<'loading' | 'confirm' | 'cancelled' | 'error' | 'already'>('loading')
  const [apptInfo, setApptInfo] = useState<{ date: string; time: string; service: string } | null>(null)

  useEffect(() => {
    if (!token) { setStatus('error'); return }
    loadAppointment()
  }, [token])

  const loadAppointment = async () => {
    try {
      // Find a scheduled appointment with this cancel token
      const { data: appt, error } = await supabase
        .from('appointments')
        .select('id, date, start_time, status, services(name)')
        .eq('cancel_token', token)
        .eq('status', 'scheduled')
        .maybeSingle()

      if (error || !appt) {
        // Either not found or already cancelled — check if it exists at all
        const { data: anyAppt } = await supabase
          .from('appointments')
          .select('id')
          .eq('cancel_token', token)
          .maybeSingle()
        if (anyAppt) {
          setStatus('already')
        } else {
          setStatus('error')
        }
        return
      }

      setApptInfo({
        date: appt.date,
        time: appt.start_time,
        service: (appt as any).services?.name || '-',
      })
      setStatus('confirm')
    } catch {
      setStatus('error')
    }
  }

  const handleCancel = async () => {
    setStatus('loading')
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('cancel_token', token)
      if (error) {
        setStatus('error')
      } else {
        setStatus('cancelled')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            {status === 'loading' && (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">{t('common.loading')}</p>
              </div>
            )}

            {status === 'confirm' && apptInfo && (
              <div className="space-y-6">
                <div>
                  <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                  <h2 className="text-2xl font-bold mb-2">{t('booking.cancelTitle')}</h2>
                  <p className="text-muted-foreground">{t('booking.cancelConfirmDesc')}</p>
                </div>
                <div className="space-y-2 text-left bg-muted/50 rounded-xl p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('appointments.service')}</span>
                    <span className="font-medium">{apptInfo.service}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('appointments.date')}</span>
                    <span className="font-medium">{apptInfo.date}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('appointments.time')}</span>
                    <span className="font-medium">{apptInfo.time}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.history.back()}
                  >
                    {t('booking.keepBooking')}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleCancel}
                  >
                    {t('booking.confirmCancel')}
                  </Button>
                </div>
              </div>
            )}

            {status === 'cancelled' && (
              <div className="space-y-4">
                <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto" />
                <h2 className="text-2xl font-bold">{t('booking.cancelledTitle')}</h2>
                <p className="text-muted-foreground">{t('booking.cancelledDesc')}</p>
              </div>
            )}

            {status === 'already' && (
              <div className="space-y-4">
                <XCircle className="h-16 w-16 text-muted-foreground mx-auto" />
                <h2 className="text-xl font-bold">{t('booking.alreadyCancelled')}</h2>
                <p className="text-muted-foreground">{t('booking.alreadyCancelledDesc')}</p>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <XCircle className="h-16 w-16 text-destructive mx-auto" />
                <h2 className="text-xl font-bold">{t('booking.cancelError')}</h2>
                <p className="text-muted-foreground">{t('booking.cancelErrorDesc')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="border-t py-4 text-center">
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
          {t('booking.poweredBy')} <Zap className="h-3 w-3 text-primary" /> Ezze
        </p>
      </div>
    </div>
  )
}
