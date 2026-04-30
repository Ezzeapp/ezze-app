import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Instagram, Send, Phone, MapPin, ArrowRight } from 'lucide-react'
import type { BeautyLandingProps } from './BeautyLanding'
import { formatCurrency } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'

const GOLD = '#c9a14a'
const GOLD_LIGHT = '#e6c989'
const INK = '#0e0d0c'
const CREAM = '#f7f3ec'

export function BeautyLandingGlamour({ profile, services, avatarUrl, coverUrl, portfolioUrls, bookingUrl }: BeautyLandingProps) {
  const currency = useCurrency()
  const fallbackInitial = (profile.display_name || profile.profession || '?')[0].toUpperCase()

  const grouped = useMemo(() => {
    const map = new Map<string, typeof services>()
    for (const s of services) {
      const cat = s.expand?.category?.name ?? 'Услуги'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(s)
    }
    return Array.from(map.entries())
  }, [services])

  return (
    <div className="min-h-screen" style={{ background: INK, color: CREAM, fontFamily: 'Inter, sans-serif' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com"/>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>

      {/* HERO */}
      <section className="relative min-h-[100vh] overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="w-full h-full object-cover"/>
          ) : avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover"/>
          ) : (
            <div className="w-full h-full" style={{ background: `radial-gradient(at 30% 30%, ${GOLD}33, transparent 50%), ${INK}` }} />
          )}
          <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${INK}, ${INK}b3 40%, ${INK}66)` }} />
        </div>

        {/* Top nav */}
        <header className="absolute top-0 inset-x-0 z-20 px-6 lg:px-12 py-6 flex items-center justify-between">
          <div className="text-2xl tracking-wider" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
            {profile.display_name || profile.profession || 'Studio'}
          </div>
          <Link to={`/book/${profile.booking_slug}`}
            className="text-xs uppercase tracking-[0.18em] px-5 py-2.5 border hover:opacity-80 transition"
            style={{ borderColor: GOLD, color: GOLD }}
          >
            Записаться
          </Link>
        </header>

        {/* Hero content */}
        <div className="relative h-screen min-h-[720px] flex items-center px-6 lg:px-12">
          <div className="max-w-2xl pt-24">
            <p className="text-xs uppercase tracking-[0.4em] mb-6" style={{ color: GOLD }}>
              {profile.profession || 'Beauty studio'}
            </p>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif' }} className="text-6xl md:text-8xl leading-[0.95] mb-8 font-light">
              {profile.display_name || profile.profession || fallbackInitial}
            </h1>
            <div className="h-px w-24 mb-8" style={{ background: GOLD }} />
            {profile.bio && (
              <p className="text-lg font-light leading-relaxed mb-10 max-w-md text-white/80">{profile.bio}</p>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <Link to={`/book/${profile.booking_slug}`}
                className="inline-flex items-center gap-3 px-8 py-4 text-xs uppercase tracking-[0.2em] font-medium transition"
                style={{ background: GOLD, color: INK }}
              >
                Онлайн-запись
                <ArrowRight className="w-4 h-4" />
              </Link>
              {profile.phone && (
                <a href={`tel:${profile.phone}`} className="text-xs uppercase tracking-[0.2em] border-b pb-1" style={{ color: GOLD, borderColor: `${GOLD}55` }}>
                  {profile.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      {(profile.bio || avatarUrl) && (
        <section className="py-32 px-6 lg:px-12 max-w-[1280px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="aspect-[3/4] overflow-hidden" style={{ background: `linear-gradient(135deg, ${GOLD}33, transparent)` }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[200px] font-light"
                  style={{ fontFamily: 'Cormorant Garamond, serif', color: GOLD }}>
                  {fallbackInitial}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.4em] mb-6" style={{ color: GOLD }}>О мастере</p>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif' }} className="text-5xl md:text-6xl leading-tight mb-8 font-light">
                {profile.display_name}
              </h2>
              <div className="h-px w-16 mb-8" style={{ background: GOLD }} />
              {profile.bio && <p className="text-white/70 font-light leading-relaxed">{profile.bio}</p>}
            </div>
          </div>
        </section>
      )}

      <div className="h-px max-w-[1280px] mx-auto" style={{ background: `${GOLD}33` }} />

      {/* SERVICES */}
      {services.length > 0 && (
        <section className="py-32 px-6 lg:px-12 max-w-[1280px] mx-auto">
          <div className="text-center mb-20">
            <p className="text-xs uppercase tracking-[0.4em] mb-4" style={{ color: GOLD }}>Прейскурант</p>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif' }} className="text-5xl md:text-6xl font-light">Услуги</h2>
          </div>

          <div className="space-y-16">
            {grouped.map(([cat, items]) => (
              <div key={cat}>
                <h3 className="text-xs uppercase tracking-[0.3em] mb-6" style={{ color: GOLD }}>{cat}</h3>
                <div className="space-y-6">
                  {items.map(s => (
                    <Link key={s.id} to={`/book/${profile.booking_slug}?service=${s.id}`}
                      className="flex items-baseline justify-between gap-6 py-4 border-b group"
                      style={{ borderColor: `${GOLD}22` }}
                    >
                      <div className="flex-1 min-w-0">
                        <h4 style={{ fontFamily: 'Cormorant Garamond, serif' }} className="text-2xl md:text-3xl font-light leading-tight group-hover:translate-x-1 transition">
                          {s.name}
                        </h4>
                        {s.description && <p className="text-sm text-white/50 mt-1 line-clamp-1">{s.description}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-white/50">{s.duration_min} мин</p>
                        <p style={{ fontFamily: 'Cormorant Garamond, serif', color: GOLD }} className="text-xl md:text-2xl">
                          {formatCurrency(s.price, currency)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* GALLERY */}
      {portfolioUrls.length > 0 && (
        <section className="py-20">
          <div className="max-w-[1280px] mx-auto px-6 lg:px-12 mb-12">
            <p className="text-xs uppercase tracking-[0.4em] mb-4" style={{ color: GOLD }}>Работы</p>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif' }} className="text-5xl md:text-6xl font-light">Портфолио</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
            {portfolioUrls.map((url, i) => (
              <div key={i} className="aspect-square overflow-hidden">
                <img src={url} alt="" loading="lazy" className="w-full h-full object-cover hover:scale-105 transition duration-700"/>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CONTACTS / CTA */}
      <section className="py-32 px-6 lg:px-12 max-w-[1280px] mx-auto">
        <div className="border p-12 md:p-20 text-center" style={{ borderColor: `${GOLD}55`, background: `linear-gradient(135deg, ${GOLD}1a, transparent)` }}>
          <p className="text-xs uppercase tracking-[0.4em] mb-6" style={{ color: GOLD }}>Запись</p>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif' }} className="text-5xl md:text-7xl leading-tight mb-8 font-light">
            Готовы изменить<br/>
            <span className="italic" style={{ color: GOLD }}>образ?</span>
          </h2>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/70 mb-10">
            {(profile.city || profile.address) && (
              <span className="inline-flex items-center gap-2">
                <MapPin className="w-4 h-4" style={{ color: GOLD }} />
                {profile.city}{profile.city && profile.address ? ', ' : ''}{profile.address}
              </span>
            )}
            {profile.phone && (
              <a href={`tel:${profile.phone}`} className="inline-flex items-center gap-2 hover:text-white">
                <Phone className="w-4 h-4" style={{ color: GOLD }} />
                {profile.phone}
              </a>
            )}
          </div>

          <Link to={`/book/${profile.booking_slug}`}
            className="inline-flex items-center gap-3 px-12 py-5 text-xs uppercase tracking-[0.25em] font-medium transition"
            style={{ background: GOLD, color: INK }}
          >
            Записаться онлайн
            <ArrowRight className="w-4 h-4" />
          </Link>

          <div className="flex items-center justify-center gap-4 mt-10 text-white/60">
            {profile.instagram && (
              <a href={profile.instagram.startsWith('http') ? profile.instagram : `https://instagram.com/${profile.instagram.replace('@','')}`} target="_blank" rel="noreferrer" className="hover:text-white transition">
                <Instagram className="w-5 h-5" />
              </a>
            )}
            {profile.telegram && (
              <a href={profile.telegram.startsWith('http') ? profile.telegram : `https://t.me/${profile.telegram.replace('@','')}`} target="_blank" rel="noreferrer" className="hover:text-white transition">
                <Send className="w-5 h-5" />
              </a>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-[11px] uppercase tracking-[0.3em] text-white/40" style={{ borderColor: `${GOLD}22` }}>
        © 2026 {profile.display_name} · Powered by Ezze
      </footer>
    </div>
  )
}
