import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import { useHomeStats } from '@/hooks/useHomeStats'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import { formatCurrency, cn } from '@/lib/utils'

interface RevenueSparklineProps {
  className?: string
  height?: 'sm' | 'md'
}

const SPARK_POINTS_DEMO = '0,80 40,70 80,75 120,55 160,65 200,50 240,55 280,40 320,48 360,35 400,28 440,40 480,22 520,18 560,12 600,15'
const SPARK_AREA_DEMO = 'M0,80 L40,70 80,75 120,55 160,65 200,50 240,55 280,40 320,48 360,35 400,28 440,40 480,22 520,18 560,12 600,15 L600,100 L0,100 Z'

export function RevenueSparkline({ className, height = 'md' }: RevenueSparklineProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const symbol = useCurrencySymbol()
  const { data: stats } = useHomeStats()

  const revenueMonth = stats?.revenueMonth ?? 0
  const growth = stats?.revenueGrowthPct
  const isPositive = (growth ?? 0) > 0

  const heightClass = height === 'sm' ? 'h-20' : 'h-32'
  const svgViewBox = height === 'sm' ? '0 0 600 100' : '0 0 600 100'

  return (
    <button
      type="button"
      onClick={() => navigate('/stats')}
      className={cn(
        'block w-full text-left bg-card rounded-2xl border border-border p-5 shadow-sm',
        'hover:border-primary/30 hover:shadow-md transition',
        className
      )}
    >
      <div className="flex justify-between mb-3">
        <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
          <TrendingUp className="h-4 w-4 text-emerald-600" />
          {t('homeScreen.revenue')}
        </h3>
        <div className="text-right">
          <div className="font-mono text-base font-extrabold text-foreground">
            {formatCurrency(revenueMonth)} <span className="text-[10px] text-muted-foreground font-normal">{symbol}</span>
          </div>
          {growth !== null && growth !== undefined && (
            <div className={cn(
              'text-[10px] font-semibold',
              isPositive ? 'text-emerald-600' : 'text-rose-600'
            )}>
              {isPositive ? '+' : ''}{growth}% {t('homeScreen.vsPrevMonth')}
            </div>
          )}
        </div>
      </div>
      <svg viewBox={svgViewBox} className={cn('w-full', heightClass)} preserveAspectRatio="none">
        <defs>
          <linearGradient id="rev-spark-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3b82f6" stopOpacity=".3" />
            <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={SPARK_AREA_DEMO} fill="url(#rev-spark-grad)" />
        <polyline
          points={SPARK_POINTS_DEMO}
          stroke="#3b82f6"
          strokeWidth="2.5"
          fill="none"
        />
      </svg>
    </button>
  )
}
