import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Instagram, Send, Phone, MapPin, ArrowRight } from 'lucide-react'
import type { BeautyLandingProps } from './BeautyLanding'
import { formatCurrency } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'

const PAPER = '#f5f1ea'
const INK = '#0a0a0a'
const ACCENT = '#ff5b3a'

export function BeautyLandingEditorial({ profile, services, avatarUrl, coverUrl, portfolioUrls, bookingUrl }: BeautyLandingProps) {
  const currency = useCurrency()
  const fallbackInitial = (profile.display_name || profile.profession || '?')[0].toUpperCase()

  const grouped = useMemo(() => {
    const map = new Map<string, typeof services>()
    for (const s of services) {
      const cat = s.expand?.category?.name ?? 'INDEX'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(s)
    }
    return Array.from(map.entries())
  }, [services])

  return (
    <div className="min-h-screen" style={{ background: PAPER, color: INK, fontFamily: 'Inter, sans-serif' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com"/>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>

      {/* TOP MARQUEE */}
      <div className="overflow-hidden whitespace-nowrap border-b-[1.5px] py-3 text-sm" style={{ borderColor: INK, background: INK, color: PAPER }}>
        <div className="inline-flex gap-12 px-4">
          <span className="font-medium tracking-wide">{profile.display_name?.toUpperCase() || 'BEAUTY STUDIO'}</span>
          <span>★</span>
          <span>BOOK YOUR SLOT</span>
          <span>★</span>
          {profile.city && <><span>{profile.city.toUpperCase()}</span><span>★</span></>}
          <span>{profile.profession?.toUpperCase()}</span>
          <span>★</span>
          <span className="font-medium tracking-wide">{profile.display_name?.toUpperCase() || 'BEAUTY STUDIO'}</span>
          <span>★</span>
          <span>BOOK YOUR SLOT</span>
          <span>★</span>
        </div>
      </div>

      {/* HEADER */}
      <header className="border-b-[1.5px]" style={{ borderColor: INK }}>
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }} className="text-2xl font-bold tracking-tight">
            {(profile.display_name || profile.profession || 'STUDIO').toUpperCase()}
          </div>
          <Link to={`/book/${profile.booking_slug}`}
            className="border-[1.5px] text-sm font-semibold px-5 py-2 transition"
            style={{ borderColor: INK, background: INK, color: PAPER }}
          >
            BOOK NOW
          </Link>
        </div>
      </header>

      {/* HERO MASTHEAD */}
      <section className="border-b-[1.5px]" style={{ borderColor: INK }}>
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12">
          <div className="flex items-baseline justify-between flex-wrap gap-4 mb-2">
            <div className="text-sm font-bold tracking-widest">№ 014 / SPRING 2026</div>
            <div className="text-sm tracking-wider">{profile.city?.toUpperCase() || 'TASHKENT'}, UZ</div>
          </div>
          <div className="border-t-[1.5px] border-b-[1.5px] py-8 my-2" style={{ borderColor: INK }}>
            <h1
              style={{ fontFamily: 'Bricolage Grotesque, sans-serif', letterSpacing: '-0.04em', lineHeight: 0.9 }}
              className="text-[clamp(56px,12vw,180px)] font-bold uppercase"
            >
              {(profile.display_name || profile.profession || 'BEAUTY').split(' ').map((w, i) => (
                <span key={i} className={i === 1 ? 'block' : 'block'} style={i === 1 ? { color: ACCENT } : undefined}>
                  {w}{i === 0 ? '.' : ''}
                </span>
              ))}
            </h1>
          </div>
          <div className="grid md:grid-cols-3 gap-6 pt-6">
            {profile.bio && <p className="md:col-span-2 leading-relaxed text-sm">{profile.bio}</p>}
            <div className="flex items-end justify-end">
              <Link to={`/book/${profile.booking_slug}`}
                className="border-[1.5px] inline-flex items-center gap-2 px-6 py-3 font-bold hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
                style={{ borderColor: INK, background: ACCENT, color: INK }}
              >
                ЗАПИСАТЬСЯ <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* IMAGE BLOCK */}
      {(coverUrl || avatarUrl) && (
        <section className="border-b-[1.5px]" style={{ borderColor: INK }}>
          <div className="grid grid-cols-12 gap-0">
            <div className="col-span-12 md:col-span-7 border-r-[1.5px]" style={{ borderColor: INK }}>
              <div className="aspect-[16/10] overflow-hidden">
                <img src={coverUrl || avatarUrl!} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="col-span-12 md:col-span-5 grid grid-rows-2">
              {avatarUrl && coverUrl ? (
                <div className="aspect-[16/9] md:aspect-auto border-b-[1.5px] overflow-hidden" style={{ borderColor: INK }}>
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-[16/9] md:aspect-auto border-b-[1.5px] flex items-center justify-center"
                  style={{ borderColor: INK, background: ACCENT }}>
                  <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }} className="text-[120px] font-bold">{fallbackInitial}</span>
                </div>
              )}
              <div className="p-8 lg:p-10 flex flex-col justify-between" style={{ background: INK, color: PAPER }}>
                <div className="text-xs uppercase tracking-widest opacity-70 mb-4">FEATURED</div>
                <div>
                  <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }} className="text-3xl lg:text-5xl mb-3">
                    {profile.profession || 'Beauty studio'}
                  </p>
                  <Link to={`/book/${profile.booking_slug}`} className="text-xs font-bold tracking-widest border-b pb-1" style={{ borderColor: ACCENT, color: ACCENT }}>
                    → ЗАПИСАТЬСЯ
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SERVICES INDEX */}
      {services.length > 0 && (
        <section className="border-b-[1.5px]" style={{ borderColor: INK }}>
          <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
            <div className="flex items-baseline justify-between flex-wrap gap-4 mb-8">
              <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }} className="text-5xl md:text-7xl font-bold">
                SERVICES <span style={{ color: ACCENT }}>/ INDEX</span>
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-px" style={{ background: INK }}>
              {grouped.flatMap(([cat, items], catI) =>
                items.map((s, i) => (
                  <Link key={s.id} to={`/book/${profile.booking_slug}?service=${s.id}`}
                    className="p-8 md:p-10 group transition cursor-pointer hover:bg-[#ff5b3a]"
                    style={{ background: PAPER }}
                  >
                    <div className="flex items-center justify-between text-xs font-bold tracking-widest mb-4">
                      <span>{cat.toUpperCase()}</span>
                      <span className="opacity-50">{String(catI * 10 + i + 1).padStart(3, '0')}</span>
                    </div>
                    <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }} className="text-3xl md:text-5xl font-bold mb-6 leading-none">
                      {s.name}
                    </h3>
                    <div className="flex items-end justify-between">
                      <p className="text-sm max-w-xs">{s.description || `${s.duration_min} мин`}</p>
                      <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }} className="text-2xl md:text-3xl font-bold">
                        {formatCurrency(s.price, currency)}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* PORTFOLIO */}
      {portfolioUrls.length > 0 && (
        <section className="border-b-[1.5px]" style={{ borderColor: INK }}>
          <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
            <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }} className="text-5xl md:text-7xl font-bold mb-12">
              PORTFOLIO
            </h2>
            <div className="grid md:grid-cols-3 gap-px border-[1.5px]" style={{ background: INK, borderColor: INK }}>
              {portfolioUrls.map((url, i) => (
                <div key={i} className="aspect-square overflow-hidden" style={{ background: PAPER }}>
                  <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* RESERVE CTA */}
      <section className="border-b-[1.5px]" style={{ borderColor: INK, background: ACCENT }}>
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-24 text-center">
          <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', lineHeight: 0.85 }} className="text-7xl md:text-[140px] font-bold">
            RESERVE.
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm mt-8 mb-10">
            {(profile.city || profile.address) && (
              <span className="inline-flex items-center gap-2"><MapPin className="w-4 h-4" />{profile.city} {profile.address}</span>
            )}
            {profile.phone && (
              <a href={`tel:${profile.phone}`} className="inline-flex items-center gap-2 font-bold"><Phone className="w-4 h-4" />{profile.phone}</a>
            )}
          </div>
          <Link to={`/book/${profile.booking_slug}`}
            className="inline-flex items-center gap-3 border-[1.5px] px-10 py-5 font-bold hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
            style={{ borderColor: INK, background: INK, color: PAPER }}
          >
            OPEN BOOKING <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: INK, color: PAPER }}>
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12 grid md:grid-cols-3 gap-8 text-sm">
          <div className="md:col-span-2">
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }} className="text-3xl font-bold mb-3">
              {(profile.display_name || profile.profession || 'STUDIO').toUpperCase()}
            </div>
            {profile.bio && <p className="opacity-70 max-w-sm">{profile.bio}</p>}
          </div>
          <div className="space-y-3">
            {(profile.city || profile.address) && (
              <p className="opacity-70">{profile.city}{profile.address ? `, ${profile.address}` : ''}</p>
            )}
            {profile.phone && <p className="opacity-70">{profile.phone}</p>}
            <div className="flex items-center gap-3 pt-2">
              {profile.instagram && (
                <a href={profile.instagram.startsWith('http') ? profile.instagram : `https://instagram.com/${profile.instagram.replace('@','')}`} target="_blank" rel="noreferrer" className="hover:opacity-100 opacity-70"><Instagram className="w-5 h-5" /></a>
              )}
              {profile.telegram && (
                <a href={profile.telegram.startsWith('http') ? profile.telegram : `https://t.me/${profile.telegram.replace('@','')}`} target="_blank" rel="noreferrer" className="hover:opacity-100 opacity-70"><Send className="w-5 h-5" /></a>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-white/20 px-6 lg:px-10 py-4 text-xs flex items-center justify-between">
          <span>© 2026 {profile.display_name}</span>
          <span>POWERED BY EZZE</span>
        </div>
      </footer>
    </div>
  )
}
