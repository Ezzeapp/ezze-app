import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Sparkles, Phone, ShoppingBag, ShieldCheck, Leaf, Zap, ArrowRight, ArrowUpRight,
  Clock, MapPin, Star, Send, Instagram, MessageCircle, Globe, Quote,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  buildPriceGroups, yearsInBusiness, buildPhoneHref, buildWhatsappHref, buildMapsHref,
  interpolateStep,
  type CleaningLandingProps,
} from './landingShared'

export function CleaningLandingPremium({
  profile, prices, orderTypes, promoCodes, avatarUrl, coverUrl, bookingUrl, content,
}: CleaningLandingProps) {
  const { i18n } = useTranslation()
  const groups = useMemo(() => buildPriceGroups(prices, orderTypes), [prices, orderTypes])
  const years = yearsInBusiness(profile.created)
  const phoneHref = buildPhoneHref(profile.phone)
  const whatsappHref = buildWhatsappHref(profile.whatsapp || profile.phone)
  const mapsHref = buildMapsHref(profile)
  const businessName = profile.display_name || profile.profession || 'Cleaning'
  const tagline = profile.bio || `Заберём, постираем, погладим и привезём обратно за ${content.turnaroundHours} часов.`
  const topPromo = promoCodes[0]
  const formatPrice = (n: number) => `${formatCurrency(n, profile.currency || 'UZS', i18n.language)}`

  return (
    <div
      className="min-h-screen text-white relative"
      style={{
        background: `radial-gradient(circle at 20% 0%, rgba(56,189,248,0.30) 0%, transparent 45%),
          radial-gradient(circle at 80% 30%, rgba(168,85,247,0.22) 0%, transparent 50%),
          radial-gradient(circle at 50% 100%, rgba(34,211,238,0.25) 0%, transparent 50%),
          linear-gradient(180deg, #0b1226 0%, #0f1d3a 60%, #0b1226 100%)`,
      }}
    >
      {/* Header */}
      <header className="px-5 lg:px-12 py-4 lg:py-5 flex items-center justify-between border-b border-white/10 sticky top-0 z-30 backdrop-blur-md bg-[#0b1226]/60">
        <div className="flex items-center gap-2.5 min-w-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl object-cover shrink-0" />
          ) : (
            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-white/15 grid place-items-center backdrop-blur shrink-0">
              <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-cyan-200" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm lg:text-base font-bold leading-tight truncate">{businessName}</div>
            <div className="text-[10px] lg:text-[11px] text-white/60 leading-tight">{content.businessSubtitle}</div>
          </div>
        </div>
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-white/70">
          <a href="#services" className="hover:text-white">Услуги</a>
          <a href="#prices" className="hover:text-white">Цены</a>
          <a href="#how" className="hover:text-white">Как работает</a>
          {mapsHref && <a href="#contacts" className="hover:text-white">Контакты</a>}
        </nav>
        <div className="flex items-center gap-2 lg:gap-3">
          {phoneHref && (
            <a href={phoneHref} className="hidden sm:inline text-xs lg:text-sm font-medium text-white/80 hover:text-white">
              {profile.phone}
            </a>
          )}
          <a
            href={bookingUrl}
            className="h-10 px-4 lg:px-5 rounded-xl bg-white text-slate-900 font-bold text-xs lg:text-sm flex items-center gap-2"
          >
            <ShoppingBag className="w-4 h-4" /> Заказать
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="px-5 lg:px-12 pt-10 lg:pt-16 pb-12 lg:pb-20 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7">
          {content.heroBadge && (
            <div className="text-[11px] tracking-[0.3em] uppercase text-cyan-300 font-semibold mb-3 lg:mb-4">
              · {content.heroBadge} ·
            </div>
          )}
          <h1 className="text-[42px] sm:text-[56px] lg:text-[80px] leading-[0.95] font-black tracking-tight">
            Чистота<br />
            как <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-300 bg-clip-text text-transparent">премиум</span>
          </h1>
          <p className="mt-4 lg:mt-7 text-[14px] lg:text-[18px] text-white/70 leading-relaxed max-w-[480px]">{tagline}</p>
          <div className="mt-6 lg:mt-9 flex flex-wrap items-center gap-3">
            <a
              href={bookingUrl}
              className="h-12 lg:h-14 px-6 lg:px-8 rounded-2xl bg-white text-slate-900 font-bold text-sm lg:text-[15px] flex items-center gap-2 hover:scale-[1.02] transition"
            >
              <ShoppingBag className="w-4 h-4 lg:w-5 lg:h-5" /> Оформить заказ
            </a>
            {phoneHref && (
              <a
                href={phoneHref}
                className="h-12 lg:h-14 px-5 lg:px-6 rounded-2xl border border-white/20 bg-white/5 backdrop-blur font-bold text-sm lg:text-[15px] flex items-center gap-2"
              >
                <Phone className="w-4 h-4" /> {profile.phone}
              </a>
            )}
          </div>
          <div className="mt-7 lg:mt-10 flex flex-wrap items-center gap-4 lg:gap-7 text-[12px] lg:text-[13px] text-white/70">
            {content.showQualityBadge && (
              <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-300" /> Гарантия качества</div>
            )}
            {content.showEcoBadge && (
              <div className="flex items-center gap-2"><Leaf className="w-4 h-4 text-emerald-300" /> Эко-средства</div>
            )}
            <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-300" /> {content.turnaroundHours} часов</div>
          </div>
        </div>

        {/* Hero collage — на десктопе */}
        <div className="hidden lg:block lg:col-span-5 relative h-[480px]">
          {groups.slice(0, 3).map((g, i) => {
            const pos = [
              'top-8 right-0 w-72 h-72 rotate-3',
              'top-44 left-0 w-64 h-64 -rotate-6',
              'bottom-0 right-12 w-56 h-56 rotate-2',
            ][i]
            const grad = [
              'from-cyan-400 to-blue-600',
              'from-purple-400 to-fuchsia-600',
              'from-emerald-400 to-teal-600',
            ][i]
            const Icon = g.icon
            return (
              <div
                key={g.slug}
                className={`absolute ${pos} rounded-3xl p-6 hover:rotate-0 transition`}
                style={{
                  background: 'rgba(255,255,255,0.10)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${grad} grid place-items-center mb-4`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="text-2xl font-black">{g.label}</div>
                {g.description && <div className="text-xs text-white/60 mt-1 line-clamp-2">{g.description}</div>}
                {g.minPrice != null && (
                  <div className="mt-4 text-2xl font-black bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                    от {Math.round(g.minPrice / 1000)}K
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Cover or top promo for mobile */}
        {coverUrl && (
          <div className="lg:hidden mt-2">
            <div className="rounded-3xl overflow-hidden aspect-[4/3] border border-white/10">
              <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            </div>
          </div>
        )}
      </section>

      {/* Stats */}
      <section className="px-5 lg:px-12 pb-12 lg:pb-20">
        <div
          className="rounded-3xl p-6 lg:p-10 grid grid-cols-2 lg:grid-cols-4 gap-y-5 lg:gap-0 lg:divide-x lg:divide-white/10"
          style={{
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.14)',
          }}
        >
          <div className="text-center">
            <div className="text-3xl lg:text-5xl font-black">{groups.length}<span className="text-cyan-300">+</span></div>
            <div className="text-[10px] lg:text-[12px] text-white/50 mt-1 lg:mt-2 uppercase tracking-wider">Категорий</div>
          </div>
          <div className="text-center">
            <div className="text-3xl lg:text-5xl font-black">{prices.length}</div>
            <div className="text-[10px] lg:text-[12px] text-white/50 mt-1 lg:mt-2 uppercase tracking-wider">Позиций в прайсе</div>
          </div>
          <div className="text-center">
            <div className="text-3xl lg:text-5xl font-black">{content.turnaroundHours}<span className="text-cyan-300">ч</span></div>
            <div className="text-[10px] lg:text-[12px] text-white/50 mt-1 lg:mt-2 uppercase tracking-wider">Среднее время</div>
          </div>
          <div className="text-center">
            <div className="text-3xl lg:text-5xl font-black">{years ? `${years}+` : '7/7'}</div>
            <div className="text-[10px] lg:text-[12px] text-white/50 mt-1 lg:mt-2 uppercase tracking-wider">{years ? 'Лет на рынке' : 'Без выходных'}</div>
          </div>
        </div>
      </section>

      {/* Categories overview */}
      <section id="services" className="px-5 lg:px-12 pb-12 lg:pb-20">
        <div className="flex items-end justify-between mb-6 lg:mb-8">
          <div>
            <div className="text-[11px] tracking-[0.3em] uppercase text-cyan-300 font-semibold mb-2">Услуги</div>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight">Что мы чистим</h2>
          </div>
          <a href="#prices" className="text-[11px] lg:text-sm font-semibold text-cyan-300 flex items-center gap-1.5">
            <span className="hidden sm:inline">смотреть весь прайс</span><span className="sm:hidden">прайс</span>
            <ArrowRight className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
          </a>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
          {groups.map(g => {
            const Icon = g.icon
            return (
              <a
                key={g.slug}
                href={`#cat-${g.slug}`}
                className="rounded-2xl lg:rounded-3xl p-4 lg:p-6 hover:bg-white/12 transition cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.14)',
                }}
              >
                <div className="w-11 h-11 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 grid place-items-center mb-3 lg:mb-5">
                  <Icon className="w-5 h-5 lg:w-6 lg:h-6" />
                </div>
                <div className="text-base lg:text-xl font-black">{g.label}</div>
                <div className="text-[11px] lg:text-[12px] text-white/60 mt-0.5 lg:mt-1 line-clamp-2">{g.description}</div>
                <div className="mt-3 lg:mt-5 lg:pt-5 lg:border-t lg:border-white/10 flex items-end justify-between">
                  <div>
                    {g.minPrice != null && <>
                      <div className="text-[10px] lg:text-[11px] text-white/50">от</div>
                      <div className="text-base lg:text-2xl font-black">
                        {formatCurrency(g.minPrice, profile.currency || 'UZS', i18n.language)}
                        {g.unitPerSquareMeter && <span className="text-[10px] lg:text-xs">/м²</span>}
                      </div>
                    </>}
                  </div>
                  <ArrowUpRight className="w-4 h-4 lg:w-5 lg:h-5 text-cyan-300" />
                </div>
              </a>
            )
          })}
        </div>
      </section>

      {/* Detailed price list */}
      {groups.length > 0 && (
        <section id="prices" className="px-5 lg:px-12 pb-12 lg:pb-20">
          <div className="text-[11px] tracking-[0.3em] uppercase text-cyan-300 font-semibold mb-2">Полный прайс</div>
          <h2 className="text-3xl lg:text-5xl font-black tracking-tight mb-6 lg:mb-10">Цены</h2>
          <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
            {groups.map(g => {
              const Icon = g.icon
              return (
                <div
                  key={g.slug}
                  id={`cat-${g.slug}`}
                  className="rounded-2xl lg:rounded-3xl p-5 lg:p-7"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 grid place-items-center"><Icon className="w-5 h-5" /></div>
                    <div className="text-lg lg:text-xl font-black">{g.label}</div>
                  </div>
                  <div className="divide-y divide-white/10">
                    {g.items.slice(0, 12).map(it => (
                      <div key={it.id} className="flex items-center justify-between py-2.5">
                        <span className="text-[13px] lg:text-sm text-white/85 truncate">{it.name}</span>
                        <span className="text-[13px] lg:text-sm font-bold text-cyan-300 shrink-0 ml-2">
                          {formatCurrency(it.default_price, profile.currency || 'UZS', i18n.language)}
                          {g.unitPerSquareMeter && <span className="text-[10px] opacity-70">/м²</span>}
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

      {/* How it works */}
      <section id="how" className="px-5 lg:px-12 pb-12 lg:pb-20">
        <div className="text-[11px] tracking-[0.3em] uppercase text-cyan-300 font-semibold mb-2">Процесс</div>
        <h2 className="text-3xl lg:text-5xl font-black tracking-tight mb-6 lg:mb-12">Как это работает</h2>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 lg:gap-5">
          {content.howSteps.map((step, i) => {
            const palette = [
              'bg-cyan-400/20 border-cyan-300/40 text-cyan-200',
              'bg-purple-400/20 border-purple-300/40 text-purple-200',
              'bg-amber-400/20 border-amber-300/40 text-amber-200',
              'bg-emerald-400/20 border-emerald-300/40 text-emerald-200',
            ]
            return (
              <div
                key={i}
                className="rounded-2xl lg:rounded-3xl p-5 lg:p-6 flex lg:block items-center gap-4"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl grid place-items-center border shrink-0 ${palette[i % palette.length]}`}>
                  <span className="text-base lg:text-xl font-black">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <div>
                  <div className="text-base lg:text-lg font-black text-white">{step.title}</div>
                  <div className="text-[12px] lg:text-[13px] text-white/60 mt-0.5 lg:mt-2 leading-relaxed">{interpolateStep(step.description, content, formatPrice)}</div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Reviews */}
      {content.reviews.length > 0 && (
        <section className="px-5 lg:px-12 pb-12 lg:pb-20">
          <div className="text-[11px] tracking-[0.3em] uppercase text-cyan-300 font-semibold mb-2">Отзывы</div>
          <h2 className="text-3xl lg:text-5xl font-black tracking-tight mb-6 lg:mb-10">Любят клиенты</h2>
          <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
            {content.reviews.slice(0, 6).map((r, i) => (
              <div
                key={i}
                className="rounded-2xl lg:rounded-3xl p-5 lg:p-7"
                style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <Quote className="w-7 h-7 text-cyan-300" />
                <div className="flex gap-0.5 mt-2">
                  {Array.from({ length: r.rating ?? 5 }).map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  ))}
                </div>
                <p className="mt-3 text-[13px] lg:text-[14px] text-white/85 leading-relaxed">{r.text}</p>
                <div className="mt-4 lg:mt-5 pt-4 lg:pt-5 border-t border-white/10 flex items-center justify-between">
                  <div className="text-sm font-semibold">{r.name}</div>
                  {r.date && <div className="text-[11px] text-white/50">{r.date}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Promo */}
      {topPromo && (
        <section className="px-5 lg:px-12 pb-10 lg:pb-12">
          <div className="rounded-3xl p-6 lg:p-12 bg-gradient-to-br from-cyan-500 to-indigo-700 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-white/10"></div>
            <div className="relative grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">
              <div>
                <div className="text-[11px] tracking-[0.3em] uppercase font-semibold text-white/80 mb-2 lg:mb-3">Промокод {topPromo.code}</div>
                <div className="text-3xl lg:text-5xl font-black tracking-tight">
                  {topPromo.discount_type === 'percent'
                    ? `Скидка ${topPromo.discount_value}%`
                    : `Скидка ${formatCurrency(topPromo.discount_value, profile.currency || 'UZS', i18n.language)}`}
                </div>
                <div className="mt-3 lg:mt-4 text-[14px] lg:text-[15px] text-white/85">
                  Введите промокод <span className="font-bold bg-white/20 px-2 py-0.5 rounded">{topPromo.code}</span> при оформлении.
                </div>
              </div>
              <div className="flex justify-start lg:justify-end">
                <a
                  href={bookingUrl}
                  className="h-12 lg:h-14 px-6 lg:px-8 rounded-2xl bg-white text-slate-900 font-bold text-sm lg:text-[15px] flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 lg:w-5 lg:h-5" /> Оформить со скидкой
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer with contacts */}
      <footer id="contacts" className="px-5 lg:px-12 py-10 border-t border-white/10 grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 text-sm">
        <div className="col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2.5 mb-4">
            {avatarUrl ? (
              <img src={avatarUrl} className="w-9 h-9 rounded-xl object-cover" alt="" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-white/15 grid place-items-center"><Sparkles className="w-4 h-4 text-cyan-200" /></div>
            )}
            <div className="text-base font-bold">{businessName}</div>
          </div>
          <p className="text-[12px] text-white/60 leading-relaxed">{tagline}</p>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-white/50 mb-3">Категории</div>
          <div className="space-y-2 text-[13px] text-white/80">
            {groups.slice(0, 6).map(g => (
              <a key={g.slug} href={`#cat-${g.slug}`} className="block hover:text-white">{g.label}</a>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-white/50 mb-3">Контакты</div>
          <div className="space-y-2 text-[13px] text-white/80">
            {phoneHref && (
              <a href={phoneHref} className="flex items-center gap-2 hover:text-white"><Phone className="w-3.5 h-3.5 text-cyan-300" /> {profile.phone}</a>
            )}
            {mapsHref && (
              <a href={mapsHref} target="_blank" rel="noreferrer" className="flex items-start gap-2 hover:text-white">
                <MapPin className="w-3.5 h-3.5 text-cyan-300 mt-0.5 shrink-0" />
                <span>{[profile.address, profile.city].filter(Boolean).join(', ')}</span>
              </a>
            )}
            <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-cyan-300" /> {content.workingHours}</div>
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-white/50 mb-3">Соцсети</div>
          <div className="flex gap-2">
            {profile.instagram && (
              <a href={profile.instagram.startsWith('http') ? profile.instagram : `https://instagram.com/${profile.instagram.replace('@','')}`} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-xl bg-white/10 grid place-items-center hover:bg-white/20 transition"><Instagram className="w-4 h-4" /></a>
            )}
            {profile.telegram && (
              <a href={profile.telegram.startsWith('http') ? profile.telegram : `https://t.me/${profile.telegram.replace('@','')}`} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-xl bg-white/10 grid place-items-center hover:bg-white/20 transition"><Send className="w-4 h-4" /></a>
            )}
            {whatsappHref && (
              <a href={whatsappHref} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-xl bg-white/10 grid place-items-center hover:bg-white/20 transition"><MessageCircle className="w-4 h-4" /></a>
            )}
            {profile.website && (
              <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-xl bg-white/10 grid place-items-center hover:bg-white/20 transition"><Globe className="w-4 h-4" /></a>
            )}
          </div>
        </div>
      </footer>

      <div className="text-center pb-6 pt-2">
        <a href="https://ezze.site" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70">
          <Star className="w-3 h-3" /> Работает на Ezze
        </a>
      </div>

      {/* Sticky mobile CTA */}
      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
        <a
          href={bookingUrl}
          className="w-full h-14 rounded-2xl bg-white text-slate-900 font-bold flex items-center justify-center gap-2 shadow-2xl"
        >
          <Sparkles className="w-4 h-4" /> Заказать сейчас
          {topPromo && (
            <span className="ml-auto bg-slate-900 text-white text-[10px] font-semibold px-2 py-1 rounded-full">
              {topPromo.discount_type === 'percent' ? `−${topPromo.discount_value}%` : 'Скидка'}
            </span>
          )}
        </a>
      </div>
      <div className="lg:hidden h-20"></div>
    </div>
  )
}
