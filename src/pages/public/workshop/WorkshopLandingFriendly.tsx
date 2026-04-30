import { useTranslation } from 'react-i18next'
import {
  Wrench, Phone, MapPin, Clock, ArrowRight, Hand, Star, Send, MessageCircle,
  Smartphone, Laptop, Tv, WashingMachine, Watch, Headphones,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  buildPhoneHref, buildWhatsappHref, buildTelegramHref, buildMapsHref,
  buildDeviceGroups, getDeviceIconName,
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

const REVIEW_AVATAR_COLORS = ['bg-orange-500', 'bg-pink-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-purple-500', 'bg-rose-500']

export function WorkshopLandingFriendly({
  profile, devices, services, avatarUrl, bookingUrl, content,
}: WorkshopLandingProps) {
  const { i18n } = useTranslation()
  const fmt = (n: number) => formatCurrency(n, profile.currency || 'UZS', i18n.language)
  const groups: DeviceGroup[] = buildDeviceGroups(devices)
  const phoneHref = buildPhoneHref(profile.phone)
  const tgHref = buildTelegramHref(profile.telegram)
  const waHref = buildWhatsappHref(profile.whatsapp || profile.phone)
  const mapsHref = buildMapsHref(profile)
  const masterName = profile.display_name || profile.profession || 'Мастер'

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      {/* ── Nav ── */}
      <nav className="flex items-center justify-between gap-4 px-5 lg:px-12 py-4 border-b border-stone-200 bg-white sticky top-0 z-30">
        <div className="flex items-center gap-2.5 font-extrabold text-base min-w-0">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
            <Wrench className="h-5 w-5 text-white" />
          </div>
          <span className="truncate">{masterName}</span>
        </div>
        <div className="flex items-center gap-3">
          {profile.phone && (
            <div className="hidden sm:block text-right">
              <div className="font-semibold text-sm">{profile.phone}</div>
              <div className="text-xs text-stone-500">{content.workingHours}</div>
            </div>
          )}
          <a
            href={bookingUrl}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
          >
            Записаться
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="px-5 lg:px-12 py-12 lg:py-20 max-w-6xl mx-auto grid lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
        <div>
          <div className="inline-flex items-center gap-2 text-sm text-stone-700 font-medium mb-5">
            <Hand className="h-4 w-4 text-orange-500" />
            Привет, я ваш мастер
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
            {content.businessSubtitle?.toLowerCase().includes('по-соседски')
              ? content.businessSubtitle
              : <>Чиним технику <em className="not-italic italic text-orange-500">по-соседски</em> — честно, быстро, недорого</>}
          </h1>
          {profile.bio && (
            <p className="text-stone-600 text-base mt-5 max-w-xl leading-relaxed">{profile.bio}</p>
          )}
          <div className="flex flex-wrap gap-3 mt-7">
            <a
              href={bookingUrl}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-orange-500 text-white font-semibold hover:bg-orange-600"
            >
              Принести в ремонт <ArrowRight className="h-4 w-4" />
            </a>
            {phoneHref && (
              <a
                href={phoneHref}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-stone-300 text-stone-900 font-medium hover:bg-stone-100"
              >
                <Phone className="h-4 w-4" /> Позвонить
              </a>
            )}
          </div>
          <div className="mt-8 flex items-center gap-3">
            <div className="text-amber-500 text-sm">{'★'.repeat(5)}</div>
            <div className="text-sm">
              <span className="font-bold">5.0 на Yandex Картах</span>
              {content.totalRepairs > 0 && (
                <span className="text-stone-500"> · {content.totalRepairs.toLocaleString()}+ ремонтов</span>
              )}
            </div>
          </div>
        </div>

        <div className="relative aspect-square rounded-3xl bg-gradient-to-br from-orange-400 to-orange-600 overflow-hidden shadow-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.4),transparent_50%)]" />
          {avatarUrl && (
            <img src={avatarUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute bottom-5 left-5 right-5 bg-white rounded-2xl p-4 flex items-center gap-3 shadow-lg">
            <div className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-lg shrink-0">
              {masterName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">{masterName}</div>
              <div className="text-xs text-stone-500 truncate">
                Мастер{content.yearsInBusiness > 0 ? ` · ${content.yearsInBusiness} лет опыта` : ''}
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Онлайн
            </div>
          </div>
        </div>
      </section>

      {/* ── Counters ── */}
      <section className="px-5 lg:px-12 max-w-6xl mx-auto">
        <div className="rounded-3xl bg-stone-900 text-white px-6 py-10 lg:px-12 lg:py-14 grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          {content.totalRepairs > 0 && (
            <div>
              <div className="text-4xl lg:text-5xl font-extrabold text-orange-400 tracking-tight">
                {content.totalRepairs.toLocaleString()}
              </div>
              <div className="text-xs lg:text-sm text-stone-300 mt-1.5">Устройств починили</div>
            </div>
          )}
          <div>
            <div className="text-4xl lg:text-5xl font-extrabold text-orange-400 tracking-tight">
              {content.successRatePercent}%
            </div>
            <div className="text-xs lg:text-sm text-stone-300 mt-1.5">Успешных ремонтов</div>
          </div>
          <div>
            <div className="text-4xl lg:text-5xl font-extrabold text-orange-400 tracking-tight">
              {content.warrantyMonths} мес
            </div>
            <div className="text-xs lg:text-sm text-stone-300 mt-1.5">Гарантия</div>
          </div>
          {content.yearsInBusiness > 0 && (
            <div>
              <div className="text-4xl lg:text-5xl font-extrabold text-orange-400 tracking-tight">
                {content.yearsInBusiness} лет
              </div>
              <div className="text-xs lg:text-sm text-stone-300 mt-1.5">Работаем</div>
            </div>
          )}
        </div>
      </section>

      {/* ── Devices ── */}
      {groups.length > 0 && (
        <section className="px-5 lg:px-12 py-16 max-w-6xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
            Чиним <em className="not-italic italic text-orange-500">что угодно</em> для дома и работы
          </h2>
          <p className="text-stone-600 mt-3 max-w-xl">
            Если в списке нет вашей техники — позвоните, скорее всего тоже починим.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {groups.flatMap(g => g.devices).slice(0, 9).map(d => (
              <a
                key={d.id}
                href={bookingUrl}
                className="flex items-center gap-4 rounded-2xl bg-white p-5 border-2 border-transparent hover:border-orange-500 transition-colors"
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                  <DeviceIcon name={getDeviceIconName(d)} className="h-7 w-7 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base">{d.name}</div>
                  {d.default_diagnostic_price > 0 && (
                    <div className="text-orange-600 font-bold text-sm mt-1">от {fmt(d.default_diagnostic_price)}</div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── Prices (services from DB) ── */}
      {services.length > 0 && (
        <section className="px-5 lg:px-12 py-12 max-w-6xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight">Прайс на популярные услуги</h2>
          <div className="rounded-2xl bg-white border border-stone-200 mt-8 overflow-hidden">
            {services.slice(0, 12).map((s, i) => (
              <div
                key={s.id}
                className={`grid grid-cols-[1fr_auto_auto] gap-6 px-5 py-4 items-center ${i > 0 ? 'border-t border-stone-100' : ''}`}
              >
                <div className="font-medium text-sm">{s.name}</div>
                <div className="text-stone-500 text-xs whitespace-nowrap">{s.duration} мин</div>
                <div className="font-bold text-orange-600 text-sm whitespace-nowrap min-w-[100px] text-right">{fmt(s.price)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Contact + Map ── */}
      <section className="px-5 lg:px-12 py-12 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6">
          <div className="rounded-3xl bg-white p-8">
            <h3 className="text-2xl font-extrabold">Заходите в гости</h3>
            {(profile.address || profile.city) && (
              <div className="flex items-start gap-3 mt-6 pt-6 border-t border-stone-100">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-orange-600 flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-stone-500">Адрес</div>
                  <div className="font-semibold text-sm">{[profile.city, profile.address].filter(Boolean).join(', ')}</div>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3 mt-6 pt-6 border-t border-stone-100">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-orange-600 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-stone-500">График</div>
                <div className="font-semibold text-sm">{content.workingHours}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-6">
              {tgHref && (
                <a href={tgHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-sky-500 text-white text-sm font-semibold">
                  <Send className="h-3.5 w-3.5" /> Telegram
                </a>
              )}
              {waHref && (
                <a href={waHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 text-white text-sm font-semibold">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              )}
              {phoneHref && (
                <a href={phoneHref} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-stone-900 text-white text-sm font-semibold">
                  <Phone className="h-3.5 w-3.5" /> Позвонить
                </a>
              )}
            </div>
          </div>
          <a
            href={mapsHref ?? '#'}
            target="_blank"
            rel="noreferrer"
            className="rounded-3xl bg-gradient-to-br from-amber-100 to-orange-200 min-h-[300px] flex items-center justify-center relative overflow-hidden"
          >
            <div className="bg-white rounded-2xl px-5 py-4 shadow-lg flex items-center gap-3 max-w-xs">
              <div className="w-11 h-11 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-sm">{masterName}</div>
                {profile.address && <div className="text-xs text-stone-500">{profile.address}</div>}
              </div>
            </div>
          </a>
        </div>
      </section>

      {/* ── Reviews ── */}
      {content.reviews.length > 0 && (
        <section className="px-5 lg:px-12 py-12 max-w-6xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
            Реальные отзывы
          </h2>
          <p className="text-stone-600 mt-3 max-w-xl">
            Пишут на Yandex, Google и в Telegram. Ничего не редактируем — публикуем как есть.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-8">
            {content.reviews.slice(0, 6).map((r, i) => (
              <div key={i} className="rounded-2xl bg-white p-7">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-full text-white font-bold flex items-center justify-center ${REVIEW_AVATAR_COLORS[i % REVIEW_AVATAR_COLORS.length]}`}>
                    {r.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{r.name}</div>
                    <div className="text-amber-500 text-xs flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current" /> {r.rating ?? 5}.0{r.date && ` · ${r.date}`}
                    </div>
                  </div>
                </div>
                <p className="text-stone-700 text-sm leading-relaxed mt-4">«{r.text}»</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="px-5 lg:px-12 pb-16 max-w-6xl mx-auto">
        <div className="rounded-3xl bg-gradient-to-br from-orange-500 to-orange-700 text-white p-10 lg:p-16 text-center">
          <h3 className="text-3xl lg:text-4xl font-extrabold tracking-tight">Давайте познакомимся!</h3>
          <p className="text-orange-100 text-base lg:text-lg mt-3 max-w-xl mx-auto">
            Расскажите что сломалось — отвечу за 5 минут и скажу когда подходить.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {tgHref && (
              <a href={tgHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-orange-700 font-bold hover:bg-orange-50">
                <Send className="h-4 w-4" /> Написать в Telegram
              </a>
            )}
            {phoneHref && (
              <a href={phoneHref} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-black/20 text-white font-semibold hover:bg-black/30">
                <Phone className="h-4 w-4" /> Позвонить
              </a>
            )}
            <a
              href={bookingUrl}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-black/20 text-white font-semibold hover:bg-black/30"
            >
              Оставить заявку
            </a>
          </div>
        </div>
      </section>

      <footer className="px-5 lg:px-12 py-6 text-center text-stone-500 text-xs">
        © {new Date().getFullYear()} {masterName}
        {profile.address && ` · ${profile.address}`}
      </footer>
    </div>
  )
}
