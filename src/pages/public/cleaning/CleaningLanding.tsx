import { lazy, Suspense, useMemo } from 'react'
import type { LandingTemplate, MasterProfile } from '@/types'
import {
  usePublicCleaningPrices, usePublicCleaningOrderTypes, resolveLandingContent,
  type PublicPromoCode,
} from './landingShared'

const CleaningLandingPremium = lazy(() => import('./CleaningLandingPremium').then(m => ({ default: m.CleaningLandingPremium })))
const CleaningLandingMinimal = lazy(() => import('./CleaningLandingMinimal').then(m => ({ default: m.CleaningLandingMinimal })))
const CleaningLandingBold    = lazy(() => import('./CleaningLandingBold').then(m => ({ default: m.CleaningLandingBold })))

interface Props {
  profile: MasterProfile
  promoCodes: PublicPromoCode[]
  avatarUrl: string | null
  coverUrl: string | null
}

function buildBookingUrl(slug: string): string {
  return `${window.location.origin}/book/${slug}`
}

export function CleaningLanding({ profile, promoCodes, avatarUrl, coverUrl }: Props) {
  const { data: prices = [] } = usePublicCleaningPrices()
  const { data: orderTypes = [] } = usePublicCleaningOrderTypes()

  const template: LandingTemplate = profile.page_settings?.landing_template ?? 'premium'
  const bookingUrl = buildBookingUrl(profile.booking_slug)
  const content = useMemo(
    () => resolveLandingContent(profile.page_settings?.landing_content),
    [profile.page_settings?.landing_content],
  )
  const props = { profile, prices, orderTypes, promoCodes, avatarUrl, coverUrl, bookingUrl, content }

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      {template === 'minimal' && <CleaningLandingMinimal {...props} />}
      {template === 'bold'    && <CleaningLandingBold    {...props} />}
      {template === 'premium' && <CleaningLandingPremium {...props} />}
    </Suspense>
  )
}
