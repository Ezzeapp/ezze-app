import { CheckSquare, Square, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface BulkActionBarProps {
  count: number
  isAllSelected: boolean
  onToggleAll: () => void
  onCancel: () => void
  onDelete: () => void
}

export function BulkActionBar({ count, isAllSelected, onToggleAll, onCancel, onDelete }: BulkActionBarProps) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-primary/5 border border-primary/20">
      {/* Toggle all */}
      <button
        type="button"
        onClick={onToggleAll}
        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors shrink-0"
      >
        {isAllSelected
          ? <CheckSquare className="h-4 w-4" />
          : <Square className="h-4 w-4" />}
        <span className="hidden sm:inline">
          {isAllSelected ? t('common.deselectAll') : t('common.selectAll')}
        </span>
      </button>

      {/* Count */}
      <span className="text-xs sm:text-sm font-medium text-foreground sm:font-normal sm:text-muted-foreground">
        {t('common.selectedCount', { n: count })}
      </span>

      {/* Actions */}
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {/* Cancel — icon on mobile, button on desktop */}
        <button
          type="button"
          onClick={onCancel}
          className="sm:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          aria-label={t('common.cancel')}
        >
          <X className="h-4 w-4" />
        </button>
        <Button variant="outline" size="sm" onClick={onCancel} className="hidden sm:flex">
          {t('common.cancel')}
        </Button>

        {/* Delete — compact on mobile, full button on desktop */}
        <button
          type="button"
          onClick={onDelete}
          className="sm:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors text-xs font-medium"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t('common.delete')}
        </button>
        <Button variant="destructive" size="sm" onClick={onDelete} className="hidden sm:flex">
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          {t('common.delete')}
        </Button>
      </div>
    </div>
  )
}
