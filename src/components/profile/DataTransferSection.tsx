import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Share2, Download, Copy, RefreshCw, CheckCircle2,
  XCircle, Loader2, Package, Scissors, ArrowRight,
} from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ru'
dayjs.extend(relativeTime)
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/shared/Toaster'
import {
  useMyCopySnapshot,
  useCreateCopySnapshot,
  useRevokeCopySnapshot,
  useFetchSnapshotByToken,
  useImportFromSnapshot,
} from '@/hooks/useCopySnapshot'
import { useServices } from '@/hooks/useServices'
import { useInventory } from '@/hooks/useInventory'
import type { CopySnapshot, ImportResult } from '@/types'
import type { ImportStrategy } from '@/hooks/useCopySnapshot'

// ── Блок "Поделиться" ─────────────────────────────────────────────────────────

function ShareBlock() {
  const { t, i18n } = useTranslation()
  const { data: snapshot, isLoading: snapshotLoading } = useMyCopySnapshot()
  const { data: services = [] } = useServices()
  const { data: inventory = [] } = useInventory()
  const createSnapshot = useCreateCopySnapshot()
  const revokeSnapshot = useRevokeCopySnapshot()

  // Настраиваем locale dayjs
  const dayjsLocale = i18n.language === 'en' ? 'en' : 'ru'

  const handleCreate = async () => {
    try {
      await createSnapshot.mutateAsync()
      toast.success(t('profile.transferActiveCode'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  const handleRevoke = async () => {
    if (!snapshot) return
    try {
      await revokeSnapshot.mutateAsync(snapshot.id)
      toast.success(t('common.done'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  const handleCopy = () => {
    if (!snapshot) return
    navigator.clipboard.writeText(snapshot.token)
    toast.success(t('profile.transferCodeCopied'))
  }

  const hasData = services.length > 0 || inventory.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Share2 className="h-4 w-4 text-primary" />
          {t('profile.transferShare')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('profile.transferShareDesc')}
        </p>

        {/* Статистика */}
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5 text-sm">
            <Scissors className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">{services.length}</span>
            <span className="text-muted-foreground">{t('profile.transferServices').toLowerCase()}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Package className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">{inventory.length}</span>
            <span className="text-muted-foreground">{t('profile.transferInventory').toLowerCase()}</span>
          </div>
        </div>

        {snapshotLoading ? (
          <div className="flex justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : snapshot ? (
          /* Активный код */
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {t('profile.transferActiveCode')}
            </p>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <code className="flex-1 font-mono text-lg font-bold tracking-[0.3em] text-primary select-all">
                {snapshot.token}
              </code>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={handleCopy}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('profile.transferExpires', {
                time: dayjs(snapshot.expires_at).locale(dayjsLocale).fromNow(),
              })}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/5"
              onClick={handleRevoke}
              loading={revokeSnapshot.isPending}
            >
              {revokeSnapshot.isPending ? t('profile.transferRevoking') : t('profile.transferRevoke')}
            </Button>
          </div>
        ) : (
          /* Нет кода */
          <Button
            type="button"
            className="w-full"
            onClick={handleCreate}
            loading={createSnapshot.isPending}
            disabled={!hasData}
          >
            {createSnapshot.isPending
              ? t('profile.transferCreating')
              : t('profile.transferCreateCode')}
          </Button>
        )}

        {!hasData && !snapshotLoading && (
          <p className="text-xs text-muted-foreground text-center">
            {t('profile.transferNoData')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Блок "Импорт" ─────────────────────────────────────────────────────────────

function ImportBlock() {
  const { t } = useTranslation()
  const [token, setToken] = useState('')
  const [foundSnapshot, setFoundSnapshot] = useState<CopySnapshot | null>(null)
  const [tokenError, setTokenError] = useState(false)
  const [includeServices, setIncludeServices] = useState(true)
  const [includeInventory, setIncludeInventory] = useState(true)
  const [strategy, setStrategy] = useState<ImportStrategy>('skip')
  const [importStep, setImportStep] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const fetchSnapshot = useFetchSnapshotByToken()
  const importMutation = useImportFromSnapshot()

  const handleCheck = async () => {
    if (token.trim().length !== 12) return
    setTokenError(false)
    setFoundSnapshot(null)
    setResult(null)

    const snap = await fetchSnapshot.mutateAsync(token.trim())
    if (!snap) {
      setTokenError(true)
    } else {
      setFoundSnapshot(snap)
    }
  }

  const handleImport = async () => {
    if (!foundSnapshot) return
    setResult(null)

    try {
      const res = await importMutation.mutateAsync({
        snapshot: foundSnapshot,
        options: { includeServices, includeInventory, strategy },
        onProgress: setImportStep,
      })
      setResult(res)
      setFoundSnapshot(null)
      setToken('')
      setImportStep(null)
      toast.success(t('profile.transferDone'))
    } catch {
      toast.error(t('common.error'))
      setImportStep(null)
    }
  }

  const stepLabel: Record<string, string> = {
    inventory: t('profile.transferStepInventory'),
    categories: t('profile.transferStepCategories'),
    services: t('profile.transferStepServices'),
    materials: t('profile.transferStepMaterials'),
    done: t('profile.transferStepDone'),
  }

  const snapData = foundSnapshot?.data
  const servicesCount = (snapData?.services?.length ?? 0)
  const inventoryCount = (snapData?.inventory_items?.length ?? 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          {t('profile.transferImport')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('profile.transferImportDesc')}
        </p>

        {/* Ввод токена */}
        <div className="flex gap-2">
          <Input
            placeholder={t('profile.transferTokenPlaceholder')}
            value={token}
            onChange={e => {
              setToken(e.target.value)
              setTokenError(false)
              setFoundSnapshot(null)
              setResult(null)
            }}
            onKeyDown={e => e.key === 'Enter' && handleCheck()}
            maxLength={12}
            className="font-mono tracking-wider"
            disabled={importMutation.isPending}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleCheck}
            loading={fetchSnapshot.isPending}
            disabled={token.trim().length !== 12 || importMutation.isPending}
          >
            {fetchSnapshot.isPending
              ? t('profile.transferChecking')
              : t('profile.transferCheck')}
          </Button>
        </div>

        {/* Ошибка */}
        {tokenError && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <XCircle className="h-4 w-4 shrink-0" />
            {t('profile.transferNotFound')}
          </div>
        )}

        {/* Превью + настройки */}
        {foundSnapshot && !result && (
          <div className="space-y-4 pt-1">
            {/* Что найдено */}
            <div className="rounded-lg bg-muted/50 border p-3 space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {t('profile.transferFound')}
              </p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeServices}
                    onChange={e => setIncludeServices(e.target.checked)}
                    className="rounded"
                  />
                  <Scissors className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm">
                    {t('profile.transferServices')}
                    <span className="ml-1 text-muted-foreground">({servicesCount})</span>
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeInventory}
                    onChange={e => setIncludeInventory(e.target.checked)}
                    className="rounded"
                  />
                  <Package className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm">
                    {t('profile.transferInventory')}
                    <span className="ml-1 text-muted-foreground">({inventoryCount})</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Стратегия */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">
                {t('profile.transferStrategy')}:
              </p>
              <div className="space-y-1.5">
                {(['skip', 'replace'] as ImportStrategy[]).map(s => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="strategy"
                      value={s}
                      checked={strategy === s}
                      onChange={() => setStrategy(s)}
                    />
                    <span className="text-sm">
                      {s === 'skip'
                        ? t('profile.transferStrategySkip')
                        : t('profile.transferStrategyReplace')}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Кнопка импорта */}
            <Button
              type="button"
              className="w-full"
              onClick={handleImport}
              loading={importMutation.isPending}
              disabled={!includeServices && !includeInventory}
            >
              {importMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {importStep ? stepLabel[importStep] : t('profile.transferImporting')}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  {t('profile.transferImportBtn')}
                </span>
              )}
            </Button>
          </div>
        )}

        {/* Результат */}
        {result && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                {t('profile.transferDone')}
              </p>
            </div>
            <div className="text-xs text-emerald-700 dark:text-emerald-400 space-y-0.5 pl-6">
              {(result.servicesAdded + result.servicesReplaced + result.servicesSkipped) > 0 && (
                <p>
                  {t('profile.transferResultServices', {
                    added: result.servicesAdded,
                    replaced: result.servicesReplaced,
                    skipped: result.servicesSkipped,
                  })}
                </p>
              )}
              {(result.inventoryAdded + result.inventoryReplaced + result.inventorySkipped) > 0 && (
                <p>
                  {t('profile.transferResultInventory', {
                    added: result.inventoryAdded,
                    replaced: result.inventoryReplaced,
                    skipped: result.inventorySkipped,
                  })}
                </p>
              )}
              {result.materialsAdded > 0 && (
                <p>{t('profile.transferResultMaterials', { added: result.materialsAdded })}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Основной компонент ────────────────────────────────────────────────────────

export function DataTransferSection() {
  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
      <ShareBlock />
      <ImportBlock />
    </div>
  )
}
