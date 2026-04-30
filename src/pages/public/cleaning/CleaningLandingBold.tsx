import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Sparkles, Phone, ArrowRight, ArrowUpRight, Zap, Leaf, ShieldCheck, Heart, Truck, Star,
  MapPin, Clock, Instagram, Send, MessageCircle, Globe,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  buildPriceGroups, buildPhoneHref, buildWhatsappHref, buildMapsHref,
  type CleaningLandingProps,
} from './landingShared'

const CARD_BG = ['#FCD34D', '#FDA4AF', '#7DD3FC', '#86EFAC', '#C4B5FD', '#FCA5A5']

export function CleaningLandingBold({
  profile, prices, orderTypes, promoCodes, avatarUrl, coverUrl, bookingUrl,
}: CleaningLandingProps) {
  const { i18n } = useTranslation()
  const groups = useMemo(() => buildPriceGroups(prices, orderTypes), [prices, orderTypes])
  const phoneHref = buildPhoneHref(profile.phone)
  const whatsappHref = buildWhatsappHref(profile.whatsapp || profile.phone)
  const mapsHref = buildMapsHref(profile)
  const businessName = profile.display_name || profile.profession || 'Cleaning'
  const tagline = profile.bio || 'Заберём, постираем, вернём в срок. Без очередей и нервов.'
  const topPromo = promoCodes[0]

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #FFF7E6 0%, #FFE9CF 50%, #FFD9E0 100%)',
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        letterSpacing: '-0.02em',
      }}
    >
      {/* Decorative blobs */}
      <div className="absolute pointer-events-none" style={{ top: 200, left: -100, width: 400, height: 400, borderRadius: '50%', background: '#FFB74A', opacity: 0.45, filter: 'blur(40px)' }} />
      <div className="absolute pointer-events-none" style={{ top: 600, right: -120, width: 380, height: 380, borderRadius: '50%', background: '#FF6B9E', opacity: 0.4, filter: 'blur(40px)' }} />

      {/* Header */}
      <header className="px-5 lg:px-12 py-4 lg:py-6 flex items-center justify-between relative sticky top-0 z-30 bg-amber-50/70 backdrop-blur">
        <div className="flex items-center gap-2.5 lg:gap-3 min-w-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl object-cover -rotate-6 shadow-lg shrink-0" />
          ) : (
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl bg-slate-900 grid place-items-center -rotate-6 shadow-lg shrink-0">
              <Sparkles className="w-5 h-5 lg:w-6 lg:h-6 text-amber-300" />
            </div>
          )}
          <div className="text-lg lg:text-2xl font-black tracking-tight truncate">{businessName}!</div>
        </div>
        <nav className="hidden lg:flex items-center gap-7 text-sm font-bold text-slate-700">
          <a href="#services" className="hover:text-slate-900">Услуги</a>
          <a href="#prices" className="hover:text-slate-900">Прайс</a>
          <a href="#how" className="hover:text-slate-900">Как работает</a>
          {mapsHref && <a href="#contacts" className="hover:text-slate-900">Контакты</a>}
        </nav>
        <div className="flex items-center gap-2 lg:gap-3">
          {phoneHref && (
            <a href={phoneHref} className="hidden sm:flex text-xs lg:text-sm font-bold text-slate-700 items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> {profile.phone}
            </a>
          )}
          <a
            href={bookingUrl}
            className="h-10 lg:h-11 px-4 lg:px-5 rounded-2xl bg-slate-900 text-white font-bold text-xs lg:text-sm flex items-center gap-2 shadow-lg"
          >
            Заказать
            <span className="w-5 h-5 rounded-full bg-amber-300 grid place-items-center">
              <ArrowRight className="w-3 h-3 text-slate-900" />
            </span>
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="px-5 lg:px-12 pt-8 lg:pt-12 pb-12 lg:pb-20 grid lg:grid-cols-12 gap-8 lg:gap-10 items-center relative">
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-1.5 px-3 lg:px-4 py-1 lg:py-2 rounded-full bg-slate-900 text-white text-[10px] lg:text-[11px] font-bold uppercase tracking-wider">
            <Zap className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-amber-300" /> Доставка 48 часов
          </div>
          <h1 className="mt-4 lg:mt-6 text-[44px] sm:text-[64px] lg:text-[88px] leading-[0.92] font-black tracking-tight">
            Чистая <br />
            одежда — <br />
            <span className="relative inline-block">
              без хлопот
              <svg className="absolute -bottom-1 lg:-bottom-2 left-0 w-full" height="14" viewBox="0 0 400 14" preserveAspectRatio="none">
                <path d="M2 10 Q 100 1, 200 7 T 398 6" fill="none" stroke="#FF4081" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="mt-5 lg:mt-7 text-[14px] lg:text-[18px] text-slate-700 max-w-[520px] leading-relaxed font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            {tagline}
          </p>
          <div className="mt-6 lg:mt-9 flex flex-wrap items-center gap-3">
            <a
              href={bookingUrl}
              className="h-13 lg:h-14 px-6 lg:px-7 py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm lg:text-[15px] shadow-xl flex items-center gap-3"
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              Заказать вывоз
              <span className="w-7 h-7 rounded-full bg-amber-300 grid place-items-center">
                <ArrowRight className="w-4 h-4 text-slate-900" />
              </span>
            </a>
            {phoneHref && (
              <a
                href={phoneHref}
                className="h-13 lg:h-14 px-5 lg:px-6 py-3 rounded-2xl bg-white shadow-md font-bold text-sm lg:text-[15px] flex items-center gap-2"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                <Phone className="w-4 h-4" /> Позвонить
              </a>
            )}
          </div>
        </div>

        {/* Hero collage */}
        <div className="hidden lg:block lg:col-span-5 relative h-[480px]">
          {groups.slice(0, 4).map((g, i) => {
            const pos = [
              'top-0 left-8 w-56 h-56 rotate-6',
              'top-12 right-0 w-52 h-52 -rotate-6',
              'bottom-16 left-0 w-48 h-48 -rotate-3',
              'bottom-4 right-12 w-44 h-44 rotate-3',
            ][i]
            const bg = CARD_BG[i % CARD_BG.length]
            const Icon = g.icon
            return (
              <div key={g.slug} className={`absolute ${pos} rounded-3xl shadow-xl p-5 hover:rotate-0 transition`} style={{ backgroundColor: bg }}>
                <Icon className="w-9 h-9 lg:w-10 lg:h-10" />
                <div className="mt-5 text-xl lg:text-2xl font-black">{g.label}</div>
                {g.minPrice != null && (
                  <div className="text-[11px] lg:text-[12px] font-bold text-slate-700 mt-1" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    от {formatCurrency(g.minPrice, profile.currency || 'UZS', i18n.language)}{g.unitPerSquareMeter && '/м²'}
                  </div>
                )}
                <div className="absolute bottom-3 right-3 w-7 h-7 rounded-full bg-slate-900 grid place-items-center">
                  <ArrowUpRight className="w-4 h-4 text-amber-300" />
                </div>
              </div>
            )
          })}
        </div>

        {/* Mobile cover */}
        {coverUrl && (
          <div className="lg:hidden">
            <div className="rounded-3xl overflow-hidden aspect-[4/3] shadow-md">
              <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            </div>
          </div>
        )}
      </section>

      {/* Marquee strip */}
      <section className="relative">
        <div
          className="bg-slate-900 text-white py-4 lg:py-5 overflow-hidden"
          style={{
            WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
            maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
          }}
        >
          <div className="flex gap-8 lg:gap-12 text-sm lg:text-[18px] font-black tracking-wide whitespace-nowrap" style={{ animation: 'marquee 28s linear infinite' }}>
            {[0, 1].map(rep => (
              <div key={rep} className="flex gap-8 lg:gap-12 shrink-0 items-center">
                <span className="flex items-center gap-2 lg:gap-3"><Leaf className="w-4 h-4 lg:w-5 lg:h-5 text-emerald-300" /> ЭКО-СРЕДСТВА</span>
                <span className="text-amber-300">★</span>
                <span className="flex items-center gap-2 lg:gap-3"><ShieldCheck className="w-4 h-4 lg:w-5 lg:h-5 text-sky-300" /> ГАРАНТИЯ</span>
                <span className="text-amber-300">★</span>
                <span className="flex items-center gap-2 lg:gap-3"><Zap className="w-4 h-4 lg:w-5 lg:h-5 text-amber-300" /> 48 ЧАСОВ</span>
                <span className="text-amber-300">★</span>
                <span className="flex items-center gap-2 lg:gap-3"><Heart className="w-4 h-4 lg:w-5 lg:h-5 text-rose-300" /> {prices.length}+ ПОЗИЦИЙ</span>
                <span className="text-amber-300">★</span>
                <span className="flex items-center gap-2 lg:gap-3"><Truck className="w-4 h-4 lg:w-5 lg:h-5 text-emerald-300" /> ДОСТАВКА</span>
                <span className="text-amber-300">★</span>
              </div>
            ))}
          </div>
          <style>{`@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
        </div>
      </section>

      {/* Categories */}
      {groups.length > 0 && (
        <section id="services" className="px-5 lg:px-12 py-12 lg:py-20 relative">
          <h2 className="text-3xl lg:text-7xl font-black tracking-tight">Что чистим</h2>
          <p className="text-[14px] lg:text-[16px] text-slate-700 font-semibold mt-2 lg:mt-3 max-w-md" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            Каждая категория — индивидуальная программа. Никакого универсального подхода.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mt-6 lg:mt-12">
            {groups.map((g, i) => {
              const bg = CARD_BG[i % CARD_BG.length]
              const Icon = g.icon
              return (
                <a
                  key={g.slug}
                  href={`#cat-${g.slug}`}
                  className="rounded-3xl p-4 lg:p-7 relative overflow-hidden shadow-md lg:shadow-xl hover:-translate-y-1 lg:hover:-translate-y-2 transition"
                  style={{ backgroundColor: bg }}
                >
                  <div className="absolute -bottom-4 -right-4 w-24 h-24 lg:w-32 lg:h-32 rounded-full" style={{ backgroundColor: bg, filter: 'brightness(0.92)', opacity: 0.6 }} />
                  <Icon className="w-9 h-9 lg:w-12 lg:h-12 relative" />
                  <div className="mt-4 lg:mt-8 text-lg lg:text-3xl font-black relative">{g.label}</div>
                  {g.description && (
                    <div className="text-[11px] lg:text-[12px] font-bold text-slate-700 mt-0.5 lg:mt-1 relative line-clamp-1" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>{g.description}</div>
                  )}
                  {g.minPrice != null && (
                    <div className="mt-3 lg:mt-6 lg:pt-5 lg:border-t-2 lg:border-white/40 relative">
                      <div className="text-[10px] lg:text-[11px] font-bold text-slate-700 uppercase tracking-wider" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>от</div>
                      <div className="text-base lg:text-3xl font-black mt-0.5">
                        {formatCurrency(g.minPrice, profile.currency || 'UZS', i18n.language)}{g.unitPerSquareMeter && <span className="text-xs">/м²</span>}
                      </div>
                    </div>
                  )}
                </a>
              )
            })}
          </div>
        </section>
      )}

      {/* Detailed prices */}
      {groups.length > 0 && (
        <section id="prices" className="px-5 lg:px-12 py-12 lg:py-20 relative">
          <h2 className="text-3xl lg:text-7xl font-black tracking-tight mb-8 lg:mb-12">Полный прайс</h2>
          <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
            {groups.map((g, i) => {
              const bg = CARD_BG[i % CARD_BG.length]
              const Icon = g.icon
              return (
                <div key={g.slug} id={`cat-${g.slug}`} className="bg-white rounded-3xl p-5 lg:p-7 shadow-md">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl grid place-items-center -rotate-6 shadow" style={{ backgroundColor: bg }}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="text-xl font-black">{g.label}</div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {g.items.slice(0, 12).map(it => (
                      <div key={it.id} className="flex items-center justify-between py-2.5">
                        <span className="text-sm text-slate-700 truncate" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>{it.name}</span>
                        <span className="text-sm font-black shrink-0 ml-2">
                          {formatCurrency(it.default_price, profile.currency || 'UZS', i18n.language)}
                          {g.unitPerSquareMeter && <span className="text-[10px] opacity-60">/м²</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* How */}
      <section id="how" className="px-5 lg:px-12 py-12 lg:py-20 relative">
        <h2 className="text-3xl lg:text-7xl font-black tracking-tight">Просто как 1·2·3</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mt-6 lg:mt-12">
          {[
            { n: '1', t: 'Оставь заявку', d: 'Через сайт, Telegram-бот или звонок. На всё — 2 минуты.', bg: '#FCD34D', rot: '-rotate-6' },
            { n: '2', t: 'Курьер забирает', d: 'Приедет в удобное окно. Бесплатно от 200К сум.', bg: '#FDA4AF', rot: 'rotate-3' },
            { n: '3', t: 'Получи чистое', d: 'Через 48 часов в фирменной упаковке прямо к двери.', bg: '#86EFAC', rot: '-rotate-3' },
          ].map(s => (
            <div key={s.n} className="bg-white rounded-3xl p-6 lg:p-8 shadow-md">
              <div className={`w-16 h-16 lg:w-20 lg:h-20 rounded-3xl grid place-items-center text-3xl lg:text-5xl font-black ${s.rot} shadow-lg`} style={{ backgroundColor: s.bg }}>
                {s.n}
              </div>
              <div className="mt-5 lg:mt-6 text-xl lg:text-2xl font-black">{s.t}</div>
              <div className="text-[13px] lg:text-[14px] text-slate-500 font-medium mt-2 leading-relaxed" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Promo */}
      {topPromo && (
        <section className="px-5 lg:px-12 pb-12 lg:pb-20 relative">
          <div className="rounded-3xl lg:rounded-[40px] p-6 lg:p-16 bg-amber-300 shadow-2xl relative overflow-hidden">
            <div className="absolute top-3 right-3 lg:top-6 lg:right-6 bg-rose-500 text-white text-xs lg:text-sm font-black px-3 lg:px-5 py-1 lg:py-2 rounded-full shadow-lg" style={{ transform: 'rotate(-3deg)' }}>NEW · ОГОНЬ</div>
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">
              <div>
                <div className="text-[80px] sm:text-[120px] lg:text-[180px] font-black leading-none tracking-tight">
                  {topPromo.discount_type === 'percent' ? `−${topPromo.discount_value}%` : `−${formatCurrency(topPromo.discount_value, profile.currency || 'UZS', i18n.language)}`}
                </div>
                <div className="text-xl lg:text-3xl font-black mt-3 lg:mt-4">на первый заказ</div>
                <div className="mt-3 lg:mt-5 inline-block bg-slate-900 text-white text-sm lg:text-[15px] font-bold px-4 lg:px-5 py-2 lg:py-3 rounded-2xl" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  Промокод {topPromo.code}
                </div>
              </div>
              <div className="flex flex-col items-start lg:items-end gap-4 lg:gap-5">
                <div className="text-[14px] lg:text-[16px] text-slate-800 font-semibold max-w-md lg:text-right" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  Введите промокод при оформлении и получите автоматическую скидку. Без подвоха — только чистота.
                </div>
                <a href={bookingUrl} className="h-13 lg:h-16 px-6 lg:px-10 py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm lg:text-base flex items-center gap-3 shadow-2xl" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  Использовать сейчас
                  <span className="w-7 h-7 rounded-full bg-amber-300 grid place-items-center">
                    <ArrowRight className="w-4 h-4 text-slate-900" />
                  </span>
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer id="contacts" className="px-5 lg:px-12 py-10 lg:py-12 bg-slate-900 text-white relative">
        <div className="grid grid-cols-2 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="col-span-2 lg:col-span-4">
            <div className="flex items-center gap-3 mb-4 lg:mb-5">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-12 h-12 rounded-2xl object-cover -rotate-6" />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-amber-300 grid place-items-center -rotate-6">
                  <Sparkles className="w-6 h-6 text-slate-900" />
                </div>
              )}
              <div className="text-xl lg:text-2xl font-black tracking-tight">{businessName}!</div>
            </div>
            <p className="text-[13px] text-white/70 leading-relaxed max-w-xs" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>{tagline}</p>
          </div>

          <div className="col-span-1 lg:col-span-2">
            <div className="text-[11px] uppercase tracking-wider font-black text-amber-300 mb-3">Услуги</div>
            <div className="space-y-2 text-[13px]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              {groups.slice(0, 5).map(g => (
                <a key={g.slug} href={`#cat-${g.slug}`} className="block hover:text-amber-300 transition">{g.label}</a>
              ))}
            </div>
          </div>

          <div className="col-span-2 lg:col-span-3">
            <div className="text-[11px] uppercase tracking-wider font-black text-amber-300 mb-3">Контакты</div>
            <div className="space-y-2 text-[13px]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              {phoneHref && (
                <a href={phoneHref} className="flex items-center gap-2 hover:text-amber-300 transition"><Phone className="w-3.5 h-3.5 text-amber-300" /> {profile.phone}</a>
              )}
              {mapsHref && (
                <a href={mapsHref} target="_blank" rel="noreferrer" className="flex items-start gap-2 hover:text-amber-300 transition">
                  <MapPin className="w-3.5 h-3.5 text-amber-300 mt-0.5 shrink-0" />
                  <span>{[profile.address, profile.city].filter(Boolean).join(', ')}</span>
                </a>
              )}
              <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-amber-300" /> 9:00 — 21:00, без выходных</div>
            </div>
          </div>

          <div className="col-span-1 lg:col-span-3">
            <div className="text-[11px] uppercase tracking-wider font-black text-amber-300 mb-3">Соцсети</div>
            <div className="flex gap-2 flex-wrap">
              {profile.instagram && (
                <a href={profile.instagram.startsWith('http') ? profile.instagram : `https://instagram.com/${profile.instagram.replace('@','')}`} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-amber-300 hover:text-slate-900 transition grid place-items-center"><Instagram className="w-4 h-4" /></a>
              )}
              {profile.telegram && (
                <a href={profile.telegram.startsWith('http') ? profile.telegram : `https://t.me/${profile.telegram.replace('@','')}`} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-amber-300 hover:text-slate-900 transition grid place-items-center"><Send className="w-4 h-4" /></a>
              )}
              {whatsappHref && (
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-amber-300 hover:text-slate-900 transition grid place-items-center"><MessageCircle className="w-4 h-4" /></a>
              )}
              {profile.website && (
                <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-amber-300 hover:text-slate-900 transition grid place-items-center"><Globe className="w-4 h-4" /></a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 text-center">
          <a href="https://ezze.site" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-amber-300 transition">
            <Star className="w-3 h-3" /> Работает на Ezze
          </a>
        </div>
      </footer>

      {/* Sticky mobile CTA */}
      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
        <a
          href={bookingUrl}
          className="w-full h-14 rounded-2xl bg-slate-900 text-white font-bold flex items-center justify-center gap-2 shadow-2xl"
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          <span className="w-6 h-6 rounded-full bg-amber-300 grid place-items-center">
            <Sparkles className="w-3.5 h-3.5 text-slate-900" />
          </span>
          Заказать сейчас
        </a>
      </div>
      <div className="lg:hidden h-20"></div>
    </div>
  )
}
