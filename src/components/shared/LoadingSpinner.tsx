import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  className?: string
  fullScreen?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function LoadingSpinner({ className, fullScreen, size = 'md' }: LoadingSpinnerProps) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
        <Loader2 className={cn('animate-spin text-primary', sizes[size], className)} />
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-center p-8', className)}>
      <Loader2 className={cn('animate-spin text-primary', sizes[size])} />
    </div>
  )
}
