import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/PageHeader'
import { ArrowLeft, Camera, AlertTriangle, Keyboard } from 'lucide-react'

declare global {
  interface Window { BarcodeDetector?: any }
}

export function QrScannerPage() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [supported, setSupported] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')

  useEffect(() => {
    if (!('BarcodeDetector' in window)) {
      setSupported(false)
      return
    }
    setSupported(true)

    let stop = false
    let detector: any
    ;(async () => {
      try {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] })
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        const loop = async () => {
          if (stop || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) {
              const raw = codes[0].rawValue as string
              stop = true
              handleResult(raw)
              return
            }
          } catch { /* ignore */ }
          requestAnimationFrame(loop)
        }
        loop()
      } catch (e: any) {
        setError(e?.message ?? String(e))
      }
    })()

    return () => {
      stop = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    }
  }, [])

  function handleResult(raw: string) {
    // Если QR содержит URL нашей фермы → извлекаем animalId
    try {
      const url = new URL(raw)
      const m = url.pathname.match(/\/farm\/animals\/([a-f0-9-]+)/i)
      if (m) { nav(`/farm/animals/${m[1]}`); return }
    } catch { /* not a url */ }
    // Иначе считаем это биркой (tag) — на Animals со search
    nav(`/farm/animals?search=${encodeURIComponent(raw)}`)
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <PageHeader title={t('farm.qr.scan')}>
        <Button variant="ghost" size="sm" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4 mr-1" /> {t('farm.common.back')}</Button>
      </PageHeader>

      {supported === false ? (
        <Card className="border-amber-400">
          <CardContent className="pt-5 pb-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{t('farm.qr.noSupport')}</p>
              <p className="text-sm text-muted-foreground">{t('farm.qr.noSupportDetail')}</p>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-rose-400">
          <CardContent className="pt-5 pb-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-500 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{t('farm.qr.cameraError')}</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-hidden rounded-lg">
            <div className="aspect-video bg-black relative flex items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-56 h-56 border-2 border-white/70 rounded-lg" />
              </div>
              <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                <Camera className="h-3 w-3" /> {t('farm.qr.scanning')}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">{t('farm.qr.manual')}</p>
          </div>
          <div className="flex gap-2">
            <Input placeholder={t('farm.qr.enterTag')} value={manual} onChange={e => setManual(e.target.value)} onKeyDown={e => e.key === 'Enter' && manual && handleResult(manual)} />
            <Button disabled={!manual} onClick={() => handleResult(manual)}>{t('farm.common.save')}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
