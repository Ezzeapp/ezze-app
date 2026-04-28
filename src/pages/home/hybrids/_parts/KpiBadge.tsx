import { cn } from '@/lib/utils'

interface KpiBadgeProps {
  value: string | number
  tone?: 'rose' | 'emerald' | 'amber' | 'blue' | 'slate'
  className?: string
}

const TONE_CLASSES: Record<NonNullable<KpiBadgeProps['tone']>, string> = {
  rose: 'bg-rose-500 text-white',
  emerald: 'bg-emerald-500 text-white',
  amber: 'bg-amber-500 text-white',
  blue: 'bg-blue-500 text-white',
  slate: 'bg-slate-500 text-white',
}

export function KpiBadge({ value, tone = 'rose', className }: KpiBadgeProps) {
  return (
    <span
      className={cn(
        'absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full',
        'text-[10px] font-bold flex items-center justify-center shadow',
        TONE_CLASSES[tone],
        className
      )}
    >
      {value}
    </span>
  )
}
