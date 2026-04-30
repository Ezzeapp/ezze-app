import { Component, lazy, Suspense, useMemo, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { LandingTemplate, MasterProfile } from '@/types'
import {
  usePublicWorkshopDevices,
  usePublicWorkshopServices,
  resolveWorkshopContent,
} from './landingShared'

const WorkshopLandingProTech  = lazy(() => import('./WorkshopLandingProTech').then(m => ({ default: m.WorkshopLandingProTech })))
const WorkshopLandingMinimal  = lazy(() => import('./WorkshopLandingMinimal').then(m => ({ default: m.WorkshopLandingMinimal })))
const WorkshopLandingFriendly = lazy(() => import('./WorkshopLandingFriendly').then(m => ({ default: m.WorkshopLandingFriendly })))

interface Props {
  profile: MasterProfile
  avatarUrl: string | null
  coverUrl: string | null
}

function buildBookingUrl(slug: string): string {
  return `${window.location.origin}/book/${slug}`
}

class LandingErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[WorkshopLanding] render error', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-zinc-50 px-4 text-center">
          <p className="text-2xl">😔</p>
          <p className="text-zinc-700 font-semibold">Не удалось загрузить страницу</p>
          <p className="text-zinc-500 text-sm max-w-md">Попробуйте обновить страницу.</p>
          <pre className="mt-4 text-[11px] text-zinc-400 max-w-lg overflow-x-auto">
            {String(this.state.error.message ?? this.state.error)}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

function LandingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="flex gap-2">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="h-3 w-3 rounded-full bg-zinc-300 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

export function WorkshopLanding({ profile, avatarUrl, coverUrl }: Props) {
  const { user } = useAuth()
  const { data: devices = [] } = usePublicWorkshopDevices()
  const { data: services = [] } = usePublicWorkshopServices(profile.user ?? user?.id)

  const template: LandingTemplate = profile.page_settings?.landing_template ?? 'pro_tech'
  const bookingUrl = buildBookingUrl(profile.booking_slug)
  const content = useMemo(
    () => resolveWorkshopContent(profile.page_settings?.landing_content),
    [profile.page_settings?.landing_content],
  )
  const props = { profile, devices, services, avatarUrl, coverUrl, bookingUrl, content }

  return (
    <LandingErrorBoundary>
      <Suspense fallback={<LandingFallback />}>
        {template === 'minimal_clean'  && <WorkshopLandingMinimal {...props} />}
        {template === 'local_friendly' && <WorkshopLandingFriendly {...props} />}
        {(template === 'pro_tech' || !['minimal_clean','local_friendly'].includes(template)) && <WorkshopLandingProTech {...props} />}
      </Suspense>
    </LandingErrorBoundary>
  )
}
