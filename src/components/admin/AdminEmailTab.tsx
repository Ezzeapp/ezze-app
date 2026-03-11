import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, Eye, EyeOff, Save, Info } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/shared/Toaster'
import { useEmailConfig, useUpdateEmailConfig, type EmailConfig } from '@/hooks/useAppSettings'

export function AdminEmailTab() {
  const { t } = useTranslation()
  const { data: config, isLoading } = useEmailConfig()
  const update = useUpdateEmailConfig()
  const [form, setForm] = useState<EmailConfig | null>(null)
  const [showPass, setShowPass] = useState(false)

  const current = form ?? config
  const set = (patch: Partial<EmailConfig>) =>
    setForm(prev => ({ ...(prev ?? config!), ...patch }))

  const handleSave = async () => {
    if (!current) return
    try {
      await update.mutateAsync(current)
      setForm(null)
      toast.success(t('admin.smtpSaved'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    )
  }

  const isDirty = form !== null

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{t('admin.emailDesc')}</p>

      {/* Global toggle */}
      <div className={`flex items-center justify-between gap-3 p-4 rounded-xl border transition-all ${
        current?.enabled ? 'bg-background' : 'bg-muted/30 opacity-75'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            current?.enabled ? 'bg-primary/10' : 'bg-muted'
          }`}>
            <Mail className={`h-4 w-4 ${current?.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <p className="text-sm font-semibold">{t('admin.emailGlobalEnabled')}</p>
            <p className="text-xs text-muted-foreground">{t('admin.emailGlobalEnabledDesc')}</p>
          </div>
        </div>
        <Switch
          checked={current?.enabled ?? false}
          disabled={update.isPending}
          onCheckedChange={(v) => set({ enabled: v })}
        />
      </div>

      {/* SMTP Settings */}
      <div className="rounded-xl border space-y-4 p-4">
        <h3 className="text-sm font-semibold">{t('admin.smtpTitle')}</h3>

        {/* Resend hint */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300">{t('admin.smtpHint')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Host */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('admin.smtpHost')}</label>
            <Input
              value={current?.smtp_host ?? ''}
              onChange={e => set({ smtp_host: e.target.value })}
              placeholder="smtp.resend.com"
              className="h-8 text-sm"
            />
          </div>

          {/* Port */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('admin.smtpPort')}</label>
            <Input
              type="number"
              value={current?.smtp_port ?? 587}
              onChange={e => set({ smtp_port: Number(e.target.value) })}
              placeholder="587"
              className="h-8 text-sm"
            />
          </div>

          {/* User */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('admin.smtpUser')}</label>
            <Input
              value={current?.smtp_user ?? ''}
              onChange={e => set({ smtp_user: e.target.value })}
              placeholder="resend"
              className="h-8 text-sm"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('admin.smtpPass')}</label>
            <div className="relative">
              <Input
                type={showPass ? 'text' : 'password'}
                value={current?.smtp_pass ?? ''}
                onChange={e => set({ smtp_pass: e.target.value })}
                placeholder="re_xxxxxxxxxxxx"
                className="h-8 text-sm pr-8"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* From address */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('admin.fromAddress')}</label>
            <Input
              type="email"
              value={current?.from_address ?? ''}
              onChange={e => set({ from_address: e.target.value })}
              placeholder="noreply@yourdomain.com"
              className="h-8 text-sm"
            />
          </div>

          {/* From name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('admin.fromName')}</label>
            <Input
              value={current?.from_name ?? ''}
              onChange={e => set({ from_name: e.target.value })}
              placeholder="Ezze"
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button
            onClick={handleSave}
            disabled={!isDirty || update.isPending}
            size="sm"
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {t('common.save')}
          </Button>
        </div>
      </div>

      {/* Per-master settings info */}
      <div className="flex items-start gap-3 p-4 rounded-xl border bg-muted/20">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{t('admin.notifyPerMasterTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('admin.notifyPerMasterDesc')}</p>
        </div>
      </div>

    </div>
  )
}
