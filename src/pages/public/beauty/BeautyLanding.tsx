import { lazy, Suspense } from 'react'
import type { LandingTemplate, MasterProfile, Service } from '@/types'

const BeautyLandingSoft      = lazy(() => import('./BeautyLandingSoft').then(m => ({ default: m.BeautyLandingSoft })))
const BeautyLandingGlamour   = lazy(() => import('./BeautyLandingGlamour').then(m => ({ default: m.BeautyLandingGlamour })))
const BeautyLandingEditorial = lazy(() => import('./BeautyLandingEditorial').then(m => ({ default: m.BeautyLandingEditorial })))

export interface BeautyLandingProps {
  profile: MasterProfile
  services: Service[]
  avatarUrl: string | null
  coverUrl: string | null
  portfolioUrls: string[]
  bookingUrl: string
}

interface Props {
  profile: MasterProfile
  services: Service[]
  avatarUrl: string | null
  coverUrl: string | null
  portfolioUrls: string[]
}

function buildBookingUrl(slug: string): string {
  return `${window.location.origin}/book/${slug}`
}

export function BeautyLanding({ profile, services, avatarUrl, coverUrl, portfolioUrls }: Props) {
  const template: LandingTemplate = profile.page_settings?.landing_template ?? 'soft'
  const bookingUrl = buildBookingUrl(profile.booking_slug)
  const props: BeautyLandingProps = { profile, services, avatarUrl, coverUrl, portfolioUrls, bookingUrl }

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      {template === 'glamour'   && <BeautyLandingGlamour   {...props} />}
      {template === 'editorial' && <BeautyLandingEditorial {...props} />}
      {(template === 'soft' || (template !== 'glamour' && template !== 'editorial')) && (
        <BeautyLandingSoft {...props} />
      )}
    </Suspense>
  )
}
