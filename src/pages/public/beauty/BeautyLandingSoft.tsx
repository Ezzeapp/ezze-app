import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Instagram, Send, Phone, MapPin, Clock, ArrowRight, Star, Sparkles } from 'lucide-react'
import type { BeautyLandingProps } from './BeautyLanding'
import { formatCurrency } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'

export function BeautyLandingSoft({ profile, services, avatarUrl, coverUrl, portfolioUrls, bookingUrl }: BeautyLandingProps) {
  const currency = useCurrency()

  const grouped = useMemo(() => {
    const map = new Map<string, typeof services>()
    for (const s of services) {
      const cat = s.expand?.category?.name ?? 'Услуги'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(s)
    }
    return Array.from(map.entries())
  }, [services])

  const fallbackInitial = (profile.display_name || profile.profession || '?')[0].toUpperCase()

  return (
    <div className="min-h-screen bg-[#fdf9f3] text-[#2b1d18]" style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com"/>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>

      {/* HERO */}
      <section className="relative overflow-hidden pt-10 pb-16 lg:pt-16 lg:pb-24 px-4 lg:px-10">
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-[#e8927c]/30 blur-3xl pointer-events-none" />
        <div className="absolute top-32 -right-32 w-96 h-96 rounded-full bg-[#e8d8c5] blur-3xl pointer-events-none" />

        <div className="relative max-w-[1200px] mx-auto grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6">
            <span className="inline-flex items-center gap-2 bg-[#fef0eb] text-[#d77a63] text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e8927c]"></span>
              Принимаю записи онлайн
            </span>
            <h1 style={{ fontFamily: 'Fraunces, serif' }} className="text-5xl md:text-6xl lg:text-7xl leading-[1.05] mb-6 font-medium tracking-tight">
              {profile.display_name || profile.profession || 'Beauty studio'}
            </h1>
            {profile.bio && (
              <p className="text-[#8a716a] text-lg leading-relaxed max-w-md mb-8">{profile.bio}</p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Link to={`/book/${profile.booking_slug}`} className="inline-flex items-center gap-2 bg-[#e8927c] hover:bg-[#d77a63] text-white font-semibold px-7 py-4 rounded-full transition">
                Записаться онлайн
                <ArrowRight className="w-4 h-4" />
              </Link>
              {profile.phone && (
                <a href={`tel:${profile.phone}`} className="inline-flex items-center gap-2 bg-white hover:bg-[#fef0eb] text-[#2b1d18] font-semibold px-7 py-4 rounded-full transition">
                  {profile.phone}
                </a>
              )}
            </div>
          </div>

          <div className="lg:col-span-6 relative">
            <div className="aspect-[4/5] rounded-[40px] overflow-hidden bg-[#fef0eb] relative">
              {coverUrl ? (
                <img src={coverUrl} alt="" className="w-full h-full object-cover"/>
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover"/>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[180px] font-medium text-[#e8927c]/40" style={{ fontFamily: 'Fraunces, serif' }}>
                  {fallbackInitial}
                </div>
              )}
              {avatarUrl && coverUrl && (
                <img src={avatarUrl} alt="" className="absolute bottom-6 left-6 w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"/>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      {services.length > 0 && (
        <section className="py-20 px-4 lg:px-10">
          <div className="max-w-[1200px] mx-auto">
            <div className="text-center mb-12">
              <span className="inline-block bg-[#fef0eb] text-[#d77a63] text-xs font-semibold px-3 py-1.5 rounded-full mb-4">Прайс-лист</span>
              <h2 style={{ fontFamily: 'Fraunces, serif' }} className="text-4xl md:text-5xl font-medium">Услуги и цены</h2>
            </div>

            <div className="space-y-10">
              {grouped.map(([cat, items]) => (
                <div key={cat}>
                  <h3 className="text-xs uppercase tracking-widest font-semibold text-[#d77a63] mb-4 pl-1">{cat}</h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map(s => (
                      <Link
                        key={s.id}
                        to={`/book/${profile.booking_slug}?service=${s.id}`}
                        className="bg-white rounded-3xl p-6 hover:-translate-y-1 transition shadow-sm hover:shadow-xl group"
                      >
                        <div className="flex items-baseline justify-between gap-3 mb-3">
                          <h4 style={{ fontFamily: 'Fraunces, serif' }} className="text-xl font-medium leading-tight flex-1">{s.name}</h4>
                          <span className="text-xs text-[#8a716a] flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3" />{s.duration_min} мин
                          </span>
                        </div>
                        {s.description && (
                          <p className="text-sm text-[#8a716a] mb-4 line-clamp-2">{s.description}</p>
                        )}
                        <div className="flex items-center justify-between pt-4 border-t border-[#e8d8c5]/50">
                          <span style={{ fontFamily: 'Fraunces, serif' }} className="text-2xl font-medium">
                            {formatCurrency(s.price, currency)}{s.price_max ? ` – ${formatCurrency(s.price_max, currency)}` : ''}
                          </span>
                          <span className="text-xs text-[#d77a63] font-semibold opacity-0 group-hover:opacity-100 transition">Записаться →</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PORTFOLIO */}
      {portfolioUrls.length > 0 && (
        <section className="py-20 px-4 lg:px-10 bg-[#fef0eb]/40">
          <div className="max-w-[1200px] mx-auto">
            <div className="text-center mb-10">
              <span className="inline-block bg-white text-[#d77a63] text-xs font-semibold px-3 py-1.5 rounded-full mb-4">Работы</span>
              <h2 style={{ fontFamily: 'Fraunces, serif' }} className="text-4xl md:text-5xl font-medium">Портфолио</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {portfolioUrls.map((url, i) => (
                <div key={i} className="aspect-square rounded-3xl overflow-hidden">
                  <img src={url} alt="" loading="lazy" className="w-full h-full object-cover hover:scale-105 transition duration-700"/>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CONTACTS */}
      <section className="py-20 px-4 lg:px-10">
        <div className="max-w-[1100px] mx-auto bg-white rounded-[40px] p-8 md:p-14 grid md:grid-cols-2 gap-8 shadow-sm">
          <div>
            <span className="inline-block bg-[#fef0eb] text-[#d77a63] text-xs font-semibold px-3 py-1.5 rounded-full mb-4">Контакты</span>
            <h2 style={{ fontFamily: 'Fraunces, serif' }} className="text-3xl md:text-4xl font-medium mb-6">Как добраться</h2>
            <div className="space-y-3 text-sm">
              {(profile.city || profile.address) && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#d77a63] shrink-0 mt-0.5" />
                  <div>
                    {profile.city && <p className="font-semibold">{profile.city}</p>}
                    {profile.address && <p className="text-[#8a716a]">{profile.address}</p>}
                  </div>
                </div>
              )}
              {profile.phone && (
                <a href={`tel:${profile.phone}`} className="flex items-center gap-3 hover:text-[#d77a63]">
                  <Phone className="w-5 h-5 text-[#d77a63] shrink-0" />
                  <span className="font-semibold">{profile.phone}</span>
                </a>
              )}
              <div className="flex items-center gap-3 pt-2">
                {profile.instagram && (
                  <a href={profile.instagram.startsWith('http') ? profile.instagram : `https://instagram.com/${profile.instagram.replace('@','')}`} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-[#fef0eb] flex items-center justify-center text-[#d77a63] hover:bg-[#e8927c] hover:text-white transition">
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {profile.telegram && (
                  <a href={profile.telegram.startsWith('http') ? profile.telegram : `https://t.me/${profile.telegram.replace('@','')}`} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-[#fef0eb] flex items-center justify-center text-[#d77a63] hover:bg-[#e8927c] hover:text-white transition">
                    <Send className="w-5 h-5" />
                  </a>
                )}
                {profile.whatsapp && (
                  <a href={`https://wa.me/${profile.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-[#fef0eb] flex items-center justify-center text-[#d77a63] hover:bg-[#e8927c] hover:text-white transition">
                    <Phone className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-[#e8927c] to-[#d77a63] rounded-3xl p-8 text-white flex flex-col justify-between min-h-[260px]">
            <div>
              <Sparkles className="w-8 h-8 mb-4 opacity-80" />
              <h3 style={{ fontFamily: 'Fraunces, serif' }} className="text-3xl font-medium mb-2 leading-tight">Запишемся?</h3>
              <p className="text-white/80 text-sm">Подтверждение в Telegram сразу после выбора времени.</p>
            </div>
            <Link to={`/book/${profile.booking_slug}`} className="inline-flex items-center justify-center gap-2 bg-white text-[#d77a63] font-bold px-6 py-3.5 rounded-full hover:bg-[#fef0eb] transition mt-6">
              Открыть запись
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-sm text-[#8a716a]">
        <p>© 2026 {profile.display_name || profile.profession} · Powered by Ezze</p>
      </footer>
    </div>
  )
}
