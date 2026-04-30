import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Phone, Mail, MapPin, ArrowRight, ArrowUpRight, Star, Clock,
  Instagram, Send, MessageCircle, Globe, Leaf,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  buildPriceGroups, yearsInBusiness, buildPhoneHref, buildWhatsappHref, buildMapsHref,
  type CleaningLandingProps,
} from './landingShared'

export function CleaningLandingMinimal({
  profile, prices, orderTypes, promoCodes, avatarUrl, coverUrl, bookingUrl,
}: CleaningLandingProps) {
  const { i18n } = useTranslation()
  const groups = useMemo(() => buildPriceGroups(prices, orderTypes), [prices, orderTypes])
  const years = yearsInBusiness(profile.created)
  const phoneHref = buildPhoneHref(profile.phone)
  const whatsappHref = buildWhatsappHref(profile.whatsapp || profile.phone)
  const mapsHref = buildMapsHref(profile)
  const businessName = (profile.display_name || profile.profession || 'cleaning').toLowerCase()
  const tagline = profile.bio || 'Без очередей. Курьер заберёт у двери и привезёт идеальную чистоту.'
  const topPromo = promoCodes[0]
  const accent = profile.page_settings?.accent || '#059669'

  return (
    <div className="min-h-screen bg-white text-slate-900" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <header className="px-5 lg:px-12 py-5 lg:py-6 flex items-center justify-between border-b border-slate-100 sticky top-0 z-30 bg-white/85 backdrop-blur">
        <div className="flex items-center gap-2.5 min-w-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
          ) : null}
          <div className="text-xl lg:text-2xl font-black tracking-tight" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}>
            {businessName}<span style={{ color: accent }}>.</span>
          </div>
        </div>
        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#services" className="hover:text-slate-900">Услуги</a>
          <a href="#prices" className="hover:text-slate-900">Цены</a>
          <a href="#how" className="hover:text-slate-900">Как работает</a>
          {mapsHref && <a href="#contacts" className="hover:text-slate-900">Контакты</a>}
        </nav>
        <div className="flex items-center gap-3">
          {phoneHref && (
            <a href={phoneHref} className="hidden sm:inline text-sm font-semibold text-slate-700 hover:text-slate-900">
              {profile.phone}
            </a>
          )}
          <a
            href={bookingUrl}
            className="h-10 px-4 lg:px-5 rounded-full bg-slate-900 text-white font-semibold text-xs lg:text-sm flex items-center gap-2"
          >
            Заказать <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </header>

      {/* Hero — large typographic */}
      <section className="px-5 lg:px-12 pt-12 lg:pt-24 pb-12 lg:pb-20" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}>
        <div className="text-[11px] uppercase tracking-[0.25em] text-slate-400 font-semibold mb-3 lg:mb-6">
          Химчистка · Стирка · Доставка
        </div>
        <h1 className="text-[44px] sm:text-[80px] lg:text-[160px] leading-[0.85] font-black tracking-tighter">
          Свежесть<br />
          <span className="italic font-extralight" style={{ color: accent }}>за 48 часов.</span>
        </h1>
        <div className="mt-8 lg:mt-12 grid lg:grid-cols-12 gap-6 lg:gap-10 items-end">
          <div className="lg:col-span-7">
            <p className="text-[15px] lg:text-[20px] leading-relaxed text-slate-600 max-w-[560px]" style={{ fontFamily: 'Inter', letterSpacing: '0' }}>
              {tagline}
            </p>
          </div>
          <div className="lg:col-span-5 flex flex-wrap lg:justify-end gap-3" style={{ fontFamily: 'Inter' }}>
            <a
              href={bookingUrl}
              className="h-12 lg:h-14 px-6 lg:px-8 rounded-full bg-slate-900 text-white font-semibold text-sm lg:text-[15px] flex items-center gap-2.5"
            >
              Оформить заказ <ArrowRight className="w-4 h-4" />
            </a>
            {phoneHref && (
              <a
                href={phoneHref}
                className="h-12 lg:h-14 px-5 lg:px-6 rounded-full border border-slate-200 font-semibold text-sm lg:text-[15px] flex items-center gap-2"
              >
                <Phone className="w-4 h-4" /> {profile.phone}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Cover image (if exists) — full width */}
      {coverUrl && (
        <div className="mx-5 lg:mx-12 mb-12 lg:mb-20">
          <div className="relative aspect-[16/7] rounded-3xl overflow-hidden">
            <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute bottom-3 left-3 right-3 lg:bottom-5 lg:left-5 lg:right-auto lg:max-w-sm bg-white/95 backdrop-blur rounded-2xl p-3 lg:p-4 flex items-center gap-3">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl text-white grid place-items-center shrink-0" style={{ backgroundColor: accent }}>
                <Leaf className="w-4 h-4 lg:w-5 lg:h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] lg:text-sm font-semibold leading-tight">Эко-химчистка</div>
                <div className="text-[10px] lg:text-xs text-slate-500 leading-tight">Безопасно для семьи и природы</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats line */}
      <section className="px-5 lg:px-12 py-8 lg:py-16 border-y border-slate-100" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}>
        <div className="grid grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-3xl lg:text-7xl font-black tracking-tighter">{groups.length}<span style={{ color: accent }}>+</span></div>
            <div className="text-[10px] lg:text-[12px] text-slate-400 font-semibold uppercase tracking-widest mt-1 lg:mt-3" style={{ fontFamily: 'Inter' }}>Категорий</div>
          </div>
          <div className="lg:border-l border-slate-100 lg:pl-8">
            <div className="text-3xl lg:text-7xl font-black tracking-tighter">{prices.length}</div>
            <div className="text-[10px] lg:text-[12px] text-slate-400 font-semibold uppercase tracking-widest mt-1 lg:mt-3" style={{ fontFamily: 'Inter' }}>Позиций</div>
          </div>
          <div className="lg:border-l border-slate-100 lg:pl-8 mt-5 lg:mt-0">
            <div className="text-3xl lg:text-7xl font-black tracking-tighter">48<span style={{ color: accent }}>ч</span></div>
            <div className="text-[10px] lg:text-[12px] text-slate-400 font-semibold uppercase tracking-widest mt-1 lg:mt-3" style={{ fontFamily: 'Inter' }}>Срок</div>
          </div>
          <div className="lg:border-l border-slate-100 lg:pl-8 mt-5 lg:mt-0">
            <div className="text-3xl lg:text-7xl font-black tracking-tighter">{years ? `${years}+` : '7/7'}</div>
            <div className="text-[10px] lg:text-[12px] text-slate-400 font-semibold uppercase tracking-widest mt-1 lg:mt-3" style={{ fontFamily: 'Inter' }}>{years ? 'Лет работы' : 'Без выходных'}</div>
          </div>
        </div>
      </section>

      {/* Categories — list rows full-width */}
      {groups.length > 0 && (
        <section id="services" className="px-5 lg:px-12 py-12 lg:py-20">
          <div className="flex items-end justify-between mb-8 lg:mb-12">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400 font-semibold mb-2 lg:mb-3">Услуги и цены</div>
              <h2 className="text-3xl lg:text-7xl font-black tracking-tighter" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}>Что мы чистим</h2>
            </div>
            <a href="#prices" className="text-xs lg:text-sm font-semibold flex items-center gap-1.5 lg:gap-2 hover:gap-2 lg:hover:gap-3 transition-all" style={{ color: accent }}>
              <span className="hidden sm:inline">весь прайс</span><span className="sm:hidden">прайс</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <div className="divide-y divide-slate-100 border-y border-slate-100">
            {groups.map((g, i) => {
              const Icon = g.icon
              return (
                <a key={g.slug} href={`#cat-${g.slug}`} className="grid grid-cols-12 items-center gap-3 lg:gap-6 py-5 lg:py-8 group cursor-pointer">
                  <div className="hidden lg:block col-span-1 text-[11px] text-slate-400 font-semibold uppercase tracking-wider" style={{ fontFamily: 'Inter' }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl grid place-items-center transition" style={{ backgroundColor: `${accent}15` }}>
                      <Icon className="w-5 h-5 lg:w-7 lg:h-7" style={{ color: accent }} />
                    </div>
                  </div>
                  <div className="col-span-6 lg:col-span-5">
                    <div className="text-lg lg:text-3xl font-black tracking-tight" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}>{g.label}</div>
                    {g.description && (
                      <div className="text-[12px] lg:text-[13px] text-slate-500 mt-0.5 lg:mt-1.5 line-clamp-1" style={{ fontFamily: 'Inter' }}>{g.description}</div>
                    )}
                  </div>
                  <div className="hidden lg:block col-span-3 text-[12px] text-slate-500 leading-relaxed" style={{ fontFamily: 'Inter' }}>
                    {g.items.length} {g.items.length === 1 ? 'позиция' : g.items.length < 5 ? 'позиции' : 'позиций'} в прайсе
                  </div>
                  <div className="col-span-3 lg:col-span-1 text-right" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}>
                    {g.minPrice != null && (
                      <>
                        <div className="text-[10px] lg:text-[11px] text-slate-400 font-semibold uppercase" style={{ fontFamily: 'Inter' }}>от</div>
                        <div className="text-base lg:text-2xl font-black">
                          {formatCurrency(g.minPrice, profile.currency || 'UZS', i18n.language).replace(/\s?сум/i, 'K').replace(/000K/, 'K')}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="col-span-1 text-right">
                    <ArrowUpRight className="w-5 h-5 lg:w-6 lg:h-6 text-slate-300 group-hover:text-slate-900 transition ml-auto" />
                  </div>
                </a>
              )
            })}
          </div>
        </section>
      )}

      {/* Detailed prices */}
      {groups.length > 0 && (
        <section id="prices" className="px-5 lg:px-12 py-12 lg:py-20 bg-slate-50">
          <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400 font-semibold mb-2 lg:mb-3">Полный прайс</div>
          <h2 className="text-3xl lg:text-7xl font-black tracking-tighter mb-8 lg:mb-12" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}>Цены</h2>
          <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
            {groups.map(g => {
              const Icon = g.icon
              return (
                <div key={g.slug} id={`cat-${g.slug}`} className="bg-white rounded-3xl p-6 lg:p-7">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl grid place-items-center" style={{ backgroundColor: `${accent}15` }}>
                      <Icon className="w-5 h-5" style={{ color: accent }} />
                    </div>
                    <div className="text-xl font-black tracking-tight" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}>{g.label}</div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {g.items.slice(0, 12).map(it => (
                      <div key={it.id} className="flex items-center justify-between py-2.5">
                        <span className="text-sm text-slate-700 truncate">{it.name}</span>
                        <span className="text-sm font-bold shrink-0 ml-2" style={{ color: accent }}>
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
      <section id="how" className="px-5 lg:px-12 py-12 lg:py-20">
        <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400 font-semibold mb-2 lg:mb-3">Процесс</div>
        <h2 className="text-3xl lg:text-7xl font-black tracking-tighter mb-8 lg:mb-16" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}>Как это работает</h2>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          {[
            { n: '01', t: 'Заявка', d: 'Сайт, Telegram-бот или звонок. 2 минуты вашего времени.' },
            { n: '02', t: 'Вывоз', d: 'Курьер приезжает в удобное окно. Бесплатно от 200K сум.' },
            { n: '03', t: 'Чистка', d: 'Эко-средства, индивидуальная программа под каждый материал.' },
            { n: '04', t: 'Доставка', d: 'Через 48 часов, в фирменной упаковке прямо к двери.' },
          ].map(s => (
            <div key={s.n}>
              <div className="text-5xl lg:text-7xl font-black tracking-tighter" style={{ color: accent, fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}>{s.n}</div>
              <div className="mt-3 lg:mt-6 text-xl lg:text-2xl font-black tracking-tight" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}>{s.t}</div>
              <div className="text-[13px] text-slate-500 mt-2 leading-relaxed" style={{ fontFamily: 'Inter' }}>{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Promo */}
      {topPromo && (
        <section className="px-5 lg:px-12 pb-16 lg:pb-20">
          <div className="rounded-3xl text-white p-8 lg:p-16 relative overflow-hidden" style={{ backgroundColor: accent }}>
            <div className="absolute -bottom-12 -right-12 w-72 h-72 rounded-full bg-white/15"></div>
            <div className="relative grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div>
                <div className="text-[11px] uppercase tracking-[0.3em] font-semibold text-white/70 mb-2 lg:mb-3">Промокод {topPromo.code}</div>
                <div className="text-[80px] lg:text-[120px] font-black leading-none tracking-tighter" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}>
                  {topPromo.discount_type === 'percent' ? `−${topPromo.discount_value}%` : `−${formatCurrency(topPromo.discount_value, profile.currency || 'UZS', i18n.language).replace(/\s?сум/i, 'K').replace(/000K/, 'K')}`}
                </div>
                <div className="text-xl lg:text-2xl font-bold mt-3 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}>на первый заказ</div>
              </div>
              <div className="flex flex-col items-start lg:items-end gap-4">
                <div className="text-[14px] lg:text-[15px] text-white/85 max-w-md lg:text-right">
                  Введите промокод <span className="font-bold bg-white/20 px-2 py-0.5 rounded">{topPromo.code}</span> при оформлении и получите скидку.
                </div>
                <a href={bookingUrl} className="h-12 lg:h-14 px-6 lg:px-8 rounded-full bg-white font-bold text-sm lg:text-[15px] flex items-center gap-2.5" style={{ color: accent, fontFamily: 'Inter' }}>
                  Оформить заказ <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer id="contacts" className="px-5 lg:px-12 py-10 lg:py-12 border-t border-slate-100 grid grid-cols-2 lg:grid-cols-12 gap-6 lg:gap-8 text-sm">
        <div className="col-span-2 lg:col-span-4">
          <div className="text-2xl font-black tracking-tight mb-4" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}>
            {businessName}<span style={{ color: accent }}>.</span>
          </div>
          <p className="text-[13px] text-slate-500 leading-relaxed max-w-xs">{tagline}</p>
        </div>

        <div className="col-span-1 lg:col-span-2">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-3">Услуги</div>
          <div className="space-y-2 text-[13px] text-slate-700">
            {groups.slice(0, 5).map(g => (
              <a key={g.slug} href={`#cat-${g.slug}`} className="block hover:text-slate-900">{g.label}</a>
            ))}
          </div>
        </div>

        <div className="col-span-2 lg:col-span-3">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-3">Контакты</div>
          <div className="space-y-2 text-[13px] text-slate-700">
            {phoneHref && (
              <a href={phoneHref} className="flex items-center gap-2 hover:text-slate-900"><Phone className="w-3.5 h-3.5" style={{ color: accent }} /> {profile.phone}</a>
            )}
            {profile.notification_email && (
              <a href={`mailto:${profile.notification_email}`} className="flex items-center gap-2 hover:text-slate-900"><Mail className="w-3.5 h-3.5" style={{ color: accent }} /> {profile.notification_email}</a>
            )}
            {mapsHref && (
              <a href={mapsHref} target="_blank" rel="noreferrer" className="flex items-start gap-2 hover:text-slate-900">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: accent }} />
                <span>{[profile.address, profile.city].filter(Boolean).join(', ')}</span>
              </a>
            )}
            <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" style={{ color: accent }} /> 9:00 — 21:00, без выходных</div>
          </div>
        </div>

        <div className="col-span-1 lg:col-span-3">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-3">Соцсети</div>
          <div className="flex gap-2 flex-wrap">
            {profile.instagram && (
              <a href={profile.instagram.startsWith('http') ? profile.instagram : `https://instagram.com/${profile.instagram.replace('@','')}`} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-slate-100 grid place-items-center text-slate-700 hover:bg-slate-200 transition"><Instagram className="w-4 h-4" /></a>
            )}
            {profile.telegram && (
              <a href={profile.telegram.startsWith('http') ? profile.telegram : `https://t.me/${profile.telegram.replace('@','')}`} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-slate-100 grid place-items-center text-slate-700"><Send className="w-4 h-4" /></a>
            )}
            {whatsappHref && (
              <a href={whatsappHref} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-slate-100 grid place-items-center text-slate-700"><MessageCircle className="w-4 h-4" /></a>
            )}
            {profile.website && (
              <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-slate-100 grid place-items-center text-slate-700"><Globe className="w-4 h-4" /></a>
            )}
          </div>
        </div>
      </footer>

      <div className="text-center pb-8">
        <a href="https://ezze.site" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700">
          <Star className="w-3 h-3" /> Работает на Ezze
        </a>
      </div>

      {/* Sticky mobile CTA */}
      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
        <a
          href={bookingUrl}
          className="w-full h-14 rounded-full bg-slate-900 text-white font-semibold flex items-center justify-center gap-2 shadow-xl"
        >
          <span>Заказать</span><ArrowRight className="w-4 h-4" />
        </a>
      </div>
      <div className="lg:hidden h-20"></div>
    </div>
  )
}
