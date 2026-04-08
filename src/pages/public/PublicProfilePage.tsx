import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  Instagram, Send, Phone, Globe, Youtube, MapPin,
  Clock, ChevronRight, X, ShoppingBag, Star
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import { buildTheme } from '@/lib/pageTheme'
import { formatCurrency } from '@/lib/utils'
import type { MasterProfile, MasterProduct } from '@/types'

// -- Helpers ------------------------------------------------------------------

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

function storageUrl(bucket: string, path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`
}

// -- Data hooks ---------------------------------------------------------------

function usePublicMasterProfile(slug: string) {
  return useQuery({
    queryKey: ['public-profile', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('master_profiles')
        .select('*')
        .eq('booking_slug', slug)
        .eq('product', PRODUCT)
        .maybeSingle()
      if (error) throw error
      return data as MasterProfile | null
    },
    staleTime: 120_000,
  })
}

function usePublicServices(userId: string | undefined) {
  return useQuery({
    queryKey: ['public-services', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('services')
        .select('*')
        .eq('user_id', userId!)
        .eq('is_active', true)
        .order('order_index', { ascending: true })
        .limit(12)
      return data ?? []
    },
    enabled: !!userId,
    staleTime: 120_000,
  })
}

function usePublicProducts(userId: string | undefined) {
  return useQuery({
    queryKey: ['public-products', userId],
    queryFn: async (): Promise<MasterProduct[]> => {
      const { data } = await supabase
        .from('master_products')
        .select('*')
        .eq('user_id', userId!)
        .eq('is_available', true)
        .order('order_index', { ascending: true })
      return (data ?? []) as MasterProduct[]
    },
    enabled: !!userId,
    staleTime: 120_000,
  })
}

// -- Social links -------------------------------------------------------------

interface SocialLink { icon: React.ComponentType<{className?:string}>; href: string; label: string }

function getSocialLinks(profile: MasterProfile): SocialLink[] {
  const links: SocialLink[] = []
  if (profile.instagram) links.push({
    icon: Instagram,
    href: profile.instagram.startsWith('http') ? profile.instagram : `https://instagram.com/${profile.instagram.replace('@','')}`,
    label: 'Instagram',
  })
  if (profile.telegram) links.push({
    icon: Send,
    href: profile.telegram.startsWith('http') ? profile.telegram : `https://t.me/${profile.telegram.replace('@','')}`,
    label: 'Telegram',
  })
  if (profile.whatsapp) links.push({
    icon: Phone,
    href: `https://wa.me/${profile.whatsapp.replace(/\D/g,'')}`,
    label: 'WhatsApp',
  })
  if (profile.youtube) links.push({
    icon: Youtube,
    href: profile.youtube.startsWith('http') ? profile.youtube : `https://youtube.com/@${profile.youtube}`,
    label: 'YouTube',
  })
  if (profile.website) links.push({
    icon: Globe,
    href: profile.website.startsWith('http') ? profile.website : `https://${profile.website}`,
    label: 'Website',
  })
  return links
}

// TikTok SVG icon (not in lucide)
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
    </svg>
  )
}

// -- Lightbox -----------------------------------------------------------------

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/80 hover:text-white"
        onClick={onClose}
      >
        <X className="h-8 w-8" />
      </button>
      <img
        src={src}
        alt=""
        className="max-h-[90vh] max-w-full rounded-lg object-contain"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

// -- Section wrapper ----------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-4 py-6">
      <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--page-text)' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

// -- Main Page ----------------------------------------------------------------

export function PublicProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const { t, i18n } = useTranslation()
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [showAllServices, setShowAllServices] = useState(false)

  const { data: profile, isLoading } = usePublicMasterProfile(slug ?? '')
  const { data: services = [] } = usePublicServices(profile?.user)
  const { data: products = [] } = usePublicProducts(profile?.user)

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="flex gap-2">
          {[0,1,2].map(i => (
            <span key={i} className="h-3 w-3 rounded-full bg-zinc-300 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    )
  }

  // Not found / disabled
  if (!profile || profile.page_enabled === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-50 px-4">
        <p className="text-2xl">😔</p>
        <p className="text-zinc-600 text-center">
          {t('publicPage.pageDisabled', 'Страница временно недоступна')}
        </p>
      </div>
    )
  }

  const theme = buildTheme(profile.page_settings)
  const socialLinks = getSocialLinks(profile)
  const visibleServices = showAllServices ? services : services.slice(0, 6)
  const avatarUrl = profile.avatar ? storageUrl('avatars', profile.avatar) : null
  const coverUrl  = profile.cover_url ? storageUrl('covers', profile.cover_url) : null
  const portfolioUrls = (profile.portfolio ?? []).slice(0, 12).map(f => storageUrl('portfolio', f))

  return (
    <div
      style={{ ...(theme as React.CSSProperties), fontFamily: `var(--page-font, Inter), sans-serif` }}
      className="min-h-screen"
    >
      {/* -- Hero -- */}
      <div className="relative">
        {/* Cover */}
        <div
          className="w-full h-44 sm:h-56"
          style={{
            background: coverUrl
              ? undefined
              : `linear-gradient(135deg, var(--page-accent), color-mix(in srgb, var(--page-accent) 60%, #000))`,
            backgroundColor: 'var(--page-bg)',
          }}
        >
          {coverUrl && (
            <img src={coverUrl} alt="" className="w-full h-full object-cover" />
          )}
        </div>

        {/* Avatar */}
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-12">
          <div className="h-24 w-24 rounded-full overflow-hidden ring-4 ring-white dark:ring-zinc-900"
            style={{ backgroundColor: 'var(--page-card)' }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              : <div className="h-full w-full flex items-center justify-center text-3xl font-bold"
                  style={{ color: 'var(--page-accent)' }}>
                  {(profile.display_name ?? profile.profession ?? '?')[0].toUpperCase()}
                </div>
            }
          </div>
        </div>
      </div>

      {/* -- Profile info -- */}
      <div className="pt-16 pb-4 px-4 text-center">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--page-text)' }}>
          {profile.display_name ?? profile.profession}
        </h1>
        {profile.display_name && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--page-subtext)' }}>
            {profile.profession}
          </p>
        )}
        {profile.bio && (
          <p className="text-sm mt-3 max-w-sm mx-auto leading-relaxed"
            style={{ color: 'var(--page-subtext)' }}>
            {profile.bio}
          </p>
        )}

        {/* Social links */}
        {(socialLinks.length > 0 || profile.tiktok) && (
          <div className="flex justify-center gap-3 mt-4 flex-wrap">
            {socialLinks.map(({ icon: Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 w-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--page-card)', color: 'var(--page-accent)' }}
                title={label}
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
            {profile.tiktok && (
              <a
                href={profile.tiktok.startsWith('http') ? profile.tiktok : `https://tiktok.com/@${profile.tiktok}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 w-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--page-card)', color: 'var(--page-accent)' }}
                title="TikTok"
              >
                <TikTokIcon className="h-5 w-5" />
              </a>
            )}
          </div>
        )}

        {/* Book CTA */}
        <Link
          to={`/book/${profile.booking_slug}`}
          className="inline-flex items-center gap-2 mt-5 px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{
            backgroundColor: 'var(--page-accent)',
            borderRadius: 'var(--btn-radius)',
          }}
        >
          {t('publicPage.bookOnline', 'Записаться онлайн')}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div style={{ backgroundColor: 'var(--page-border)', height: 1, margin: '00 16px' }} />

      {/* -- Services -- */}
      {services.length > 0 && (
        <Section title={t('nav.services', 'Услуги')}>
          <div className="space-y-2">
            {visibleServices.map(service => (
              <div
                key={service.id}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ backgroundColor: 'var(--page-card)', borderRadius: 'var(--btn-radius)' }}
              >
                <div className="flex items-center gap-3">
                  {service.image && (
                    <img
                      src={storageUrl('services', service.image)}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--page-text)' }}>
                      {service.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="h-3 w-3" style={{ color: 'var(--page-subtext)' }} />
                      <span className="text-xs" style={{ color: 'var(--page-subtext)' }}>
                        {service.duration} {t('common.min', 'мин')}
                      </span>
                    </div>
                  </div>
                </div>
                {service.price != null && service.price > 0 && (
                  <p className="text-sm font-bold flex-shrink-0" style={{ color: 'var(--page-accent)' }}>
                    {formatCurrency(service.price, 'UZS', i18n.language)}
                  </p>
                )}
              </div>
            ))}
          </div>

          {services.length > 6 && (
            <button
              onClick={() => setShowAllServices(v => !v)}
              className="mt-3 w-full py-2.5 text-sm font-medium border transition-opacity hover:opacity-80"
              style={{
                color: 'var(--page-accent)',
                borderColor: 'var(--page-accent)',
                borderRadius: 'var(--btn-radius)',
              }}
            >
              {showAllServices
                ? t('common.showLess', 'Свернуть')
                : t('publicPage.allServices', `Все услуги (${services.length})`)}
            </button>
          )}

          <Link
            to={`/book/${profile.booking_slug}`}
            className="mt-3 flex items-center justify-center gap-2 w-full py-3 text-sm font-semibold text-white"
            style={{
              backgroundColor: 'var(--page-accent)',
              borderRadius: 'var(--btn-radius)',
            }}
          >
            {t('publicPage.bookOnline', 'Записаться онлайн')}
          </Link>
        </Section>
      )}

      {/* -- Portfolio -- */}
      {portfolioUrls.length > 0 && (
        <Section title={t('profile.portfolio', 'Портфолио')}>
          <div className="grid grid-cols-3 gap-1.5">
            {portfolioUrls.map((url, i) => (
              <button
                key={i}
                onClick={() => setLightboxSrc(url)}
                className="aspect-square overflow-hidden rounded-xl hover:opacity-90 transition-opacity"
                style={{ borderRadius: 'calc(var(--btn-radius) / 1.5)' }}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* -- Products -- */}
      {products.length > 0 && (
        <Section title={t('publicPage.products', 'Товары')}>
          <div className="grid grid-cols-2 gap-3">
            {products.map(product => (
              <div
                key={product.id}
                className="rounded-xl overflow-hidden"
                style={{ backgroundColor: 'var(--page-card)' }}
              >
                {product.photo_url ? (
                  <img src={product.photo_url} alt="" className="w-full aspect-square object-cover" />
                ) : (
                  <div className="w-full aspect-square flex items-center justify-center"
                    style={{ backgroundColor: 'var(--page-border)' }}>
                    <ShoppingBag className="h-8 w-8" style={{ color: 'var(--page-subtext)' }} />
                  </div>
                )}
                <div className="p-3">
                  <p className="text-sm font-medium leading-tight" style={{ color: 'var(--page-text)' }}>
                    {product.name}
                  </p>
                  {product.description && (
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--page-subtext)' }}>
                      {product.description}
                    </p>
                  )}
                  <p className="text-sm font-bold mt-2" style={{ color: 'var(--page-accent)' }}>
                    {formatCurrency(product.price, 'UZS', i18n.language)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* -- Location -- */}
      {(profile.city || profile.address) && (
        <Section title={t('publicPage.location', 'Местоположение')}>
          <div
            className="p-4 rounded-xl flex items-start gap-3"
            style={{ backgroundColor: 'var(--page-card)' }}
          >
            <MapPin className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--page-accent)' }} />
            <div className="flex-1">
              {profile.city && (
                <p className="text-sm font-medium" style={{ color: 'var(--page-text)' }}>
                  {profile.city}
                </p>
              )}
              {profile.address && (
                <p className="text-sm" style={{ color: 'var(--page-subtext)' }}>
                  {profile.address}
                </p>
              )}
              {profile.address && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent([profile.city, profile.address].filter(Boolean).join(', '))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs font-medium hover:underline"
                  style={{ color: 'var(--page-accent)' }}
                >
                  {t('publicPage.openInMaps', 'Открыть в картах')}
                  <ChevronRight className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          {/* OSM embed if lat/lng available */}
          {profile.lat && profile.lng && (
            <div className="mt-3 rounded-xl overflow-hidden h-48">
              <iframe
                title="map"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${profile.lng - 0.01},${profile.lat - 0.01},${profile.lng + 0.01},${profile.lat + 0.01}&layer=mapnik&marker=${profile.lat},${profile.lng}`}
                className="w-full h-full border-0"
                loading="lazy"
              />
            </div>
          )}
        </Section>
      )}

      {/* -- Footer -- */}
      <div className="py-6 text-center">
        <a
          href="https://ezze.site"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs opacity-50 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--page-subtext)' }}
        >
          <Star className="h-3 w-3" />
          {t('publicPage.poweredBy', 'Работает на Ezze')}
        </a>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  )
}
