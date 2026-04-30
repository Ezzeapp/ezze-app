import { useTranslation } from 'react-i18next'
import {
  Wrench, Phone, MapPin, Clock, ArrowRight, Zap, Shield, Info,
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

export function WorkshopLandingMinimal({
  profile, devices, services, bookingUrl, content,
}: WorkshopLandingProps) {
  const { i18n } = useTranslation()
  const fmt = (n: number) => formatCurrency(n, profile.currency || 'UZS', i18n.language)
  const groups: DeviceGroup[] = buildDeviceGroups(devices)
  const phoneHref = buildPhoneHref(profile.phone)
  const tgHref = buildTelegramHref(profile.telegram)
  const waHref = buildWhatsappHref(profile.whatsapp || profile.phone)
  const mapsHref = buildMapsHref(profile)

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* ── Nav ── */}
      <nav className="flex items-center justify-between px-5 lg:px-12 py-4 border-b border-zinc-200 bg-white sticky top-0 z-30">
        <div className="flex items-center gap-2.5 font-bold text-base">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center">
            <Wrench className="h-4 w-4 text-white" />
          </div>
          <span>{profile.display_name || profile.profession || 'Mendme'}</span>
        </div>
        <a
          href={bookingUrl}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition-colors"
        >
          {content.businessSubtitle ? 'Сдать в ремонт' : 'Сдать в ремонт'} <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </nav>

      {/* ── Hero ── */}
      <section className="px-5 lg:px-12 py-16 lg:py-24 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium mb-6">
          <Zap className="h-3.5 w-3.5" />
          {content.diagnosticsFree && 'Бесплатная диагностика · '}
          Гарантия {content.warrantyMonths} мес.
        </div>
        <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
          {content.businessSubtitle || 'Ремонт техники'}{' '}
          <em className="not-italic text-amber-600 italic">быстро</em>
          <br />и без сюрпризов
        </h1>
        {profile.bio && (
          <p className="text-zinc-600 text-base lg:text-lg mt-6 max-w-xl mx-auto">{profile.bio}</p>
        )}
        <div className="flex flex-wrap gap-3 mt-8 justify-center">
          <a
            href={bookingUrl}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-900 text-white font-semibold hover:bg-zinc-800"
          >
            Получить расчёт <ArrowRight className="h-4 w-4" />
          </a>
          {phoneHref && (
            <a
              href={phoneHref}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-zinc-300 bg-white text-zinc-900 font-medium hover:bg-zinc-100"
            >
              <Phone className="h-4 w-4" /> {profile.phone}
            </a>
          )}
        </div>
      </section>

      {/* ── Values ── */}
      <section className="px-5 lg:px-12 pb-12 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mb-4">
              <Clock className="h-5 w-5 text-zinc-700" />
            </div>
            <div className="font-bold text-base">≈ {Math.max(1, Math.round((content.diagnosticsMinutes || 30) / 30))} дн. в среднем</div>
            <p className="text-sm text-zinc-500 mt-1.5 leading-relaxed">
              Большинство ремонтов выполняем за 1–3 рабочих дня. Срочные — за пару часов.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mb-4">
              <Shield className="h-5 w-5 text-zinc-700" />
            </div>
            <div className="font-bold text-base">Гарантия {content.warrantyMonths} мес.</div>
            <p className="text-sm text-zinc-500 mt-1.5 leading-relaxed">
              Не понравится результат — переделаем бесплатно. Талон с QR-кодом для проверки.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mb-4">
              <Info className="h-5 w-5 text-zinc-700" />
            </div>
            <div className="font-bold text-base">Прозрачная цена</div>
            <p className="text-sm text-zinc-500 mt-1.5 leading-relaxed">
              Цену согласуем после диагностики — до начала работ. Не подходит — ничего не платите.
            </p>
          </div>
        </div>
      </section>

      {/* ── Devices ── */}
      {groups.length > 0 && (
        <section className="px-5 lg:px-12 py-12 max-w-5xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight">Что мы чиним</h2>
          <p className="text-zinc-500 mt-2 max-w-xl">
            Любую современную электронику и бытовую технику. Если не нашли свою — спросите.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-8">
            {groups.flatMap(g => g.devices).slice(0, 9).map(d => (
              <a
                key={d.id}
                href={bookingUrl}
                className="group flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 hover:border-zinc-900 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
                  <DeviceIcon name={getDeviceIconName(d)} className="h-5 w-5 text-zinc-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{d.name}</div>
                  {d.default_diagnostic_price > 0 && (
                    <div className="text-xs text-zinc-500 mt-0.5">от {fmt(d.default_diagnostic_price)}</div>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-900 transition-colors" />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── How it works ── */}
      <section className="px-5 lg:px-12 py-12 max-w-5xl mx-auto">
        <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight">Как это работает</h2>
        <p className="text-zinc-500 mt-2 max-w-xl">
          {content.howSteps.length === 3 ? 'Три простых шага' : `${content.howSteps.length} простых шагов`} от заявки до получения готового устройства.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-8">
          {content.howSteps.slice(0, 3).map((step, i) => (
            <div key={i} className="rounded-2xl bg-white border border-zinc-200 p-6">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">ШАГ {String(i + 1).padStart(2, '0')}</div>
              <div className="text-lg font-bold mt-2">{step.title}</div>
              <p className="text-sm text-zinc-600 mt-2 leading-relaxed">{interpolateStep(step.description, content)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Prices (services from DB) ── */}
      {services.length > 0 && (
        <section className="px-5 lg:px-12 py-12 max-w-5xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight">Прайс</h2>
          <p className="text-zinc-500 mt-2 max-w-xl">
            Указана средняя стоимость. Точную цену сообщим после диагностики.
          </p>
          <div className="rounded-2xl bg-white border border-zinc-200 mt-8 overflow-hidden">
            {services.slice(0, 12).map((s, i) => (
              <div
                key={s.id}
                className={`grid grid-cols-[1fr_auto_auto] gap-6 px-5 py-4 items-center ${i > 0 ? 'border-t border-zinc-100' : ''}`}
              >
                <div className="font-medium text-sm">{s.name}</div>
                <div className="text-zinc-500 text-xs whitespace-nowrap">{s.duration} мин</div>
                <div className="font-bold text-zinc-900 text-sm whitespace-nowrap min-w-[100px] text-right">{fmt(s.price)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Stats ── */}
      <section className="px-5 lg:px-12 py-12 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 rounded-3xl bg-zinc-900 text-white p-8 lg:p-12 text-center">
          {content.totalRepairs > 0 && (
            <div>
              <div className="text-3xl lg:text-4xl font-extrabold">{content.totalRepairs.toLocaleString()}</div>
              <div className="text-xs text-zinc-400 mt-1.5 uppercase tracking-wider">Ремонтов</div>
            </div>
          )}
          <div>
            <div className="text-3xl lg:text-4xl font-extrabold">{content.warrantyMonths} мес</div>
            <div className="text-xs text-zinc-400 mt-1.5 uppercase tracking-wider">Гарантия</div>
          </div>
          <div>
            <div className="text-3xl lg:text-4xl font-extrabold">{content.successRatePercent}%</div>
            <div className="text-xs text-zinc-400 mt-1.5 uppercase tracking-wider">Успешных</div>
          </div>
          {content.yearsInBusiness > 0 && (
            <div>
              <div className="text-3xl lg:text-4xl font-extrabold">{content.yearsInBusiness} лет</div>
              <div className="text-xs text-zinc-400 mt-1.5 uppercase tracking-wider">Опыт</div>
            </div>
          )}
        </div>
      </section>

      {/* ── Reviews ── */}
      {content.reviews.length > 0 && (
        <section className="px-5 lg:px-12 py-12 max-w-5xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight">Что говорят клиенты</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-8">
            {content.reviews.slice(0, 4).map((r, i) => (
              <div key={i} className="rounded-2xl bg-white border border-zinc-200 p-6">
                <div className="text-amber-500 text-sm">{'★'.repeat(r.rating ?? 5)}</div>
                <p className="text-zinc-700 text-sm leading-relaxed mt-3">«{r.text}»</p>
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-zinc-100">
                  <div className="w-9 h-9 rounded-full bg-zinc-200 flex items-center justify-center font-bold text-zinc-700 text-xs">
                    {r.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{r.name}</div>
                    {r.date && <div className="text-xs text-zinc-500">{r.date}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="px-5 lg:px-12 py-8 border-t border-zinc-200 bg-white">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-500">
          <div>© {new Date().getFullYear()} {profile.display_name || 'Workshop'}</div>
          <div className="flex flex-wrap items-center gap-4">
            {profile.address && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3" />
                {[profile.city, profile.address].filter(Boolean).join(', ')}
                {mapsHref && (
                  <a href={mapsHref} target="_blank" rel="noreferrer" className="underline ml-1">карта</a>
                )}
              </div>
            )}
            {tgHref && <a href={tgHref} target="_blank" rel="noreferrer" className="hover:text-zinc-900">Telegram</a>}
            {waHref && <a href={waHref} target="_blank" rel="noreferrer" className="hover:text-zinc-900">WhatsApp</a>}
          </div>
        </div>
      </footer>
    </div>
  )
}
