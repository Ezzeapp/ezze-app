import { useTranslation } from 'react-i18next'
import {
  Wrench, Phone, MapPin, Clock, ShieldCheck, ArrowRight, CheckCircle2,
  Smartphone, Laptop, Tv, WashingMachine, Watch, Headphones,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  buildPhoneHref, buildWhatsappHref, buildTelegramHref, buildMapsHref,
  buildDeviceGroups, getDeviceIconName, interpolateStep,
  type WorkshopLandingProps, type DeviceGroup,
} from './landingShared'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Smartphone, Laptop, Tv, WashingMachine, Watch, Headphones, Wrench,
  Monitor: Tv, Plane: Wrench,
}

function DeviceIcon({ name, className }: { name: string; className?: string }) {
  const C = ICON_MAP[name] ?? Wrench
  return <C className={className} />
}

export function WorkshopLandingProTech({
  profile, devices, services, avatarUrl, coverUrl, bookingUrl, content,
}: WorkshopLandingProps) {
  const { i18n } = useTranslation()
  const fmt = (n: number) => formatCurrency(n, profile.currency || 'UZS', i18n.language)
  const groups: DeviceGroup[] = buildDeviceGroups(devices)
  const phoneHref = buildPhoneHref(profile.phone)
  const tgHref = buildTelegramHref(profile.telegram)
  const waHref = buildWhatsappHref(profile.whatsapp || profile.phone)
  const mapsHref = buildMapsHref(profile)

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-200">
      {/* ── Nav ── */}
      <nav className="flex items-center justify-between px-6 lg:px-12 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3 font-bold text-lg">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Wrench className="h-5 w-5 text-white" />
          </div>
          <span>{profile.display_name || profile.profession || 'RemontPRO'}</span>
        </div>
        <a
          href={bookingUrl}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Сдать в ремонт
        </a>
      </nav>

      {/* ── Hero ── */}
      <section className="px-6 lg:px-12 py-16 lg:py-24 max-w-7xl mx-auto grid lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
        <div>
          <div className="inline-block px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-6">
            {content.heroBadge}
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight">
            {content.businessSubtitle}{' '}
            <span className="bg-gradient-to-br from-blue-400 to-purple-400 bg-clip-text text-transparent">
              с гарантией {content.warrantyMonths} месяцев
            </span>
          </h1>
          {profile.bio && (
            <p className="text-slate-400 text-base lg:text-lg mt-6 max-w-xl">{profile.bio}</p>
          )}
          <div className="flex flex-wrap gap-3 mt-8">
            <a
              href={bookingUrl}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold hover:opacity-90"
            >
              Оставить заявку <ArrowRight className="h-4 w-4" />
            </a>
            {phoneHref && (
              <a
                href={phoneHref}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-slate-700 text-white font-medium hover:bg-slate-800/50"
              >
                <Phone className="h-4 w-4" /> {profile.phone}
              </a>
            )}
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-10 mt-12 pt-8 border-t border-slate-800">
            {content.totalRepairs > 0 && (
              <div>
                <div className="text-3xl font-black text-white">{content.totalRepairs.toLocaleString()}+</div>
                <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Ремонтов</div>
              </div>
            )}
            <div>
              <div className="text-3xl font-black text-white">{content.successRatePercent}%</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Успешных</div>
            </div>
            <div>
              <div className="text-3xl font-black text-white">{content.warrantyMonths} мес</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Гарантия</div>
            </div>
            {content.yearsInBusiness > 0 && (
              <div>
                <div className="text-3xl font-black text-white">{content.yearsInBusiness} лет</div>
                <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Опыт</div>
              </div>
            )}
          </div>
        </div>

        {/* Visual */}
        <div className="aspect-square relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 flex items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.2),transparent_60%),radial-gradient(circle_at_70%_70%,rgba(139,92,246,0.2),transparent_60%)]" />
          {coverUrl ? (
            <img src={coverUrl} alt="" className="relative w-full h-full object-cover opacity-90" />
          ) : avatarUrl ? (
            <img src={avatarUrl} alt="" className="relative w-3/4 h-3/4 object-cover rounded-2xl border-4 border-slate-800" />
          ) : (
            <div className="relative w-3/4 aspect-square bg-[#0a0e1a] border border-slate-800 rounded-2xl p-6 shadow-2xl">
              {[
                { id: 'PM-0142', dev: 'iPhone 14', status: 'Готов', cls: 'bg-emerald-500/15 text-emerald-300' },
                { id: 'PM-0143', dev: 'MacBook Pro', status: 'В ремонте', cls: 'bg-purple-500/15 text-purple-300' },
                { id: 'PM-0144', dev: 'LG OLED 65"', status: 'Диагностика', cls: 'bg-amber-500/15 text-amber-300' },
                { id: 'PM-0145', dev: 'Bosch SMV', status: 'Готов', cls: 'bg-emerald-500/15 text-emerald-300' },
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-800 text-sm">
                  <span className="font-mono text-blue-400">{r.id} · {r.dev}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${r.cls}`}>{r.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Devices ── */}
      {groups.length > 0 && (
        <section className="px-6 lg:px-12 py-16 max-w-7xl mx-auto">
          <div className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3">Что чиним</div>
          <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight max-w-2xl">
            Любая техника — от смартфонов до промышленного оборудования
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
            {groups.flatMap(g => g.devices).slice(0, 8).map(d => (
              <div key={d.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 hover:border-blue-500/50 transition-all">
                <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
                  <DeviceIcon name={getDeviceIconName(d)} className="h-5 w-5" />
                </div>
                <div className="font-semibold text-white">{d.name}</div>
                {d.default_diagnostic_price > 0 && (
                  <div className="text-xs text-blue-400 mt-3 font-mono">от {fmt(d.default_diagnostic_price)}</div>
                )}
                {d.default_days > 0 && (
                  <div className="text-xs text-slate-500 mt-1">≈ {d.default_days} дн.</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Process ── */}
      <section className="px-6 lg:px-12 py-16 max-w-7xl mx-auto">
        <div className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3">Как это работает</div>
        <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight">
          От заявки до возврата — {content.howSteps.length} шага
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-10">
          {content.howSteps.map((step, i) => (
            <div key={i} className="p-6 border-l border-slate-800 lg:border-l-0 lg:border-r last:border-r-0 lg:pl-6">
              <div className="text-5xl font-black text-slate-800 font-mono">{String(i + 1).padStart(2, '0')}</div>
              <div className="text-lg font-bold text-white mt-3">{step.title}</div>
              <p className="text-sm text-slate-400 mt-2">{interpolateStep(step.description, content)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Prices (services) ── */}
      {services.length > 0 && (
        <section className="px-6 lg:px-12 py-16 max-w-7xl mx-auto">
          <div className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3">Прайс</div>
          <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight">Популярные услуги</h2>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 mt-10 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-6 px-6 py-3 bg-slate-900 text-xs uppercase tracking-wider text-slate-500 font-medium">
              <div>Услуга</div><div>Срок</div><div className="text-right min-w-[100px]">Цена</div>
            </div>
            {services.slice(0, 12).map(s => (
              <div key={s.id} className="grid grid-cols-[1fr_auto_auto] gap-6 px-6 py-4 border-t border-slate-800 items-center">
                <div className="text-white font-medium">{s.name}</div>
                <div className="text-slate-500 text-sm font-mono">{s.duration} мин</div>
                <div className="text-blue-400 font-semibold font-mono min-w-[100px] text-right">{fmt(s.price)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Reviews ── */}
      {content.reviews.length > 0 && (
        <section className="px-6 lg:px-12 py-16 max-w-7xl mx-auto">
          <div className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3">Отзывы</div>
          <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight">Что говорят клиенты</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-10">
            {content.reviews.slice(0, 6).map((r, i) => (
              <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                <div className="text-amber-400 mb-3">{'★'.repeat(r.rating ?? 5)}</div>
                <p className="text-slate-300 text-sm leading-relaxed">«{r.text}»</p>
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-800">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs">
                    {r.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium">{r.name}</div>
                    {r.date && <div className="text-xs text-slate-500">{r.date}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── CTA + Contacts ── */}
      <section className="px-6 lg:px-12 pb-16 max-w-7xl mx-auto">
        <div className="rounded-3xl bg-gradient-to-br from-blue-700 to-purple-800 p-10 lg:p-16 text-center">
          <h3 className="text-3xl lg:text-4xl font-black text-white">Готовы починить вашу технику?</h3>
          <p className="text-blue-100 text-base mt-3">
            {content.diagnosticsFree && 'Бесплатная диагностика · '}
            Гарантия {content.warrantyMonths} мес · {content.workingHours}
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <a
              href={bookingUrl}
              className="px-8 py-3.5 rounded-lg bg-white text-blue-700 font-bold hover:bg-blue-50 transition-colors"
            >
              Оставить заявку
            </a>
            {phoneHref && (
              <a href={phoneHref} className="px-8 py-3.5 rounded-lg bg-black/30 text-white font-medium hover:bg-black/50 inline-flex items-center gap-2">
                <Phone className="h-4 w-4" /> {profile.phone}
              </a>
            )}
            {tgHref && (
              <a href={tgHref} target="_blank" rel="noreferrer" className="px-8 py-3.5 rounded-lg bg-black/30 text-white font-medium hover:bg-black/50">
                Telegram
              </a>
            )}
            {waHref && (
              <a href={waHref} target="_blank" rel="noreferrer" className="px-8 py-3.5 rounded-lg bg-black/30 text-white font-medium hover:bg-black/50">
                WhatsApp
              </a>
            )}
          </div>
        </div>

        {(profile.address || profile.city) && (
          <div className="mt-8 grid lg:grid-cols-[auto_1fr] gap-6 items-center text-slate-400 text-sm">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-blue-400" />
              <div>
                {[profile.city, profile.address].filter(Boolean).join(', ')}
                {mapsHref && (
                  <a href={mapsHref} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline ml-3 text-xs">
                    Открыть на карте →
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-400" />
              <span>{content.workingHours}</span>
            </div>
          </div>
        )}
      </section>

      <footer className="px-6 lg:px-12 py-8 border-t border-slate-800 text-center text-slate-500 text-xs">
        © {new Date().getFullYear()} {profile.display_name || profile.profession || 'Workshop'} ·
        {' '}<a href="https://ezze.site" className="hover:text-blue-400" target="_blank" rel="noreferrer">Powered by Ezze</a>
      </footer>
      {void [CheckCircle2, ShieldCheck]}
    </div>
  )
}
