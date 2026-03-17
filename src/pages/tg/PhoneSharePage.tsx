import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Phone, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { initMiniApp } from '@/lib/telegramWebApp'

// ── Локализация ────────────────────────────────────────────────────────────────

const TEXTS: Record<string, { title: string; desc: string; btn: string; errorNoSupport: string; errorDenied: string }> = {
  ru: {
    title: 'Поделитесь номером',
    desc: 'Нажмите кнопку ниже, чтобы поделиться номером телефона. Мы найдём ваш аккаунт мастера.',
    btn: 'Поделиться номером',
    errorNoSupport: 'Эта версия Telegram не поддерживает запрос номера. Обновите приложение.',
    errorDenied: 'Вы отказали в доступе к номеру. Попробуйте ещё раз.',
  },
  uz: {
    title: 'Raqamingizni ulashing',
    desc: 'Telefon raqamingizni ulashish uchun quyidagi tugmani bosing. Usta hisobingizni topamiz.',
    btn: 'Raqamni ulashish',
    errorNoSupport: 'Telegram versiyangiz raqam so\'rovini qo\'llab-quvvatlamaydi. Yangilang.',
    errorDenied: 'Siz raqamga kirishni rad etdingiz. Qaytadan urinib ko\'ring.',
  },
  en: {
    title: 'Share your number',
    desc: 'Press the button below to share your phone number. We\'ll find your master account.',
    btn: 'Share phone number',
    errorNoSupport: 'Your Telegram version does not support contact requests. Please update.',
    errorDenied: 'You denied access to your phone number. Please try again.',
  },
  tg: {
    title: 'Рақамро мубодила кунед',
    desc: 'Барои мубодилаи рақами телефон тугмаи зеринро пахш кунед.',
    btn: 'Мубодилаи рақам',
    errorNoSupport: 'Версияи Telegram-и шумо дархости рақамро дастгирӣ намекунад. Навсозӣ кунед.',
    errorDenied: 'Шумо дастрасиро рад кардед. Боз кӯшиш кунед.',
  },
  kz: {
    title: 'Нөміріңізді бөлісіңіз',
    desc: 'Телефон нөміріңізді бөлісу үшін төмендегі түймені басыңыз.',
    btn: 'Нөмірді бөлісу',
    errorNoSupport: 'Telegram нұсқаңыз нөмір сұрауды қолдамайды. Жаңартыңыз.',
    errorDenied: 'Сіз қолжетімділікті бас тарттыңыз. Қайталап көріңіз.',
  },
  ky: {
    title: 'Номериңизди бөлүшүңүз',
    desc: 'Телефон номериңизди бөлүшүү үчүн төмөндөгү баскычты басыңыз.',
    btn: 'Номерди бөлүшүү',
    errorNoSupport: 'Telegram версияңыз номер суроону колдобойт. Жаңыртыңыз.',
    errorDenied: 'Сиз уруксатты четке каккансыз. Кайра аракет кылыңыз.',
  },
}

// ── Компонент ──────────────────────────────────────────────────────────────────

export function PhoneSharePage() {
  const [searchParams] = useSearchParams()
  const lang = TEXTS[searchParams.get('lang') ?? ''] ? (searchParams.get('lang') ?? 'ru') : 'ru'
  const t = TEXTS[lang]

  const [status, setStatus] = useState<'idle' | 'loading' | 'error_support' | 'error_denied'>('idle')

  useEffect(() => {
    initMiniApp()
  }, [])

  const handleShare = () => {
    const tg = window.Telegram?.WebApp
    if (!tg?.requestContact) {
      setStatus('error_support')
      return
    }
    setStatus('loading')
    tg.requestContact((shared, response) => {
      if (shared && response?.contact?.phone_number) {
        tg.sendData(JSON.stringify({ phone: response.contact.phone_number, lang }))
        tg.close()
      } else {
        setStatus('error_denied')
      }
    })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 gap-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Phone className="h-8 w-8 text-primary" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold">{t.title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{t.desc}</p>
      </div>

      {status === 'error_support' && (
        <p className="text-sm text-destructive max-w-xs">{t.errorNoSupport}</p>
      )}
      {status === 'error_denied' && (
        <p className="text-sm text-destructive max-w-xs">{t.errorDenied}</p>
      )}

      <Button
        className="w-full max-w-xs"
        onClick={handleShare}
        disabled={status === 'loading'}
      >
        <Phone className="h-4 w-4 mr-2" />
        {t.btn}
      </Button>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        Работает на <Zap className="h-3 w-3 text-primary" /> Ezze
      </p>
    </div>
  )
}
