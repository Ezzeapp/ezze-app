import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BellRing, MessageSquare, Info, Mail, Send,
  Bell, AlarmClock, Gift, CheckCircle, XCircle, CalendarDays, Star, Heart,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/shared/Toaster'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  useNotificationSettings,
  useUpsertNotificationSetting,
  NOTIF_DEFAULT_TEMPLATES,
  NOTIF_DEFAULTS,
  type NotifType,
  type NotificationSetting,
} from '@/hooks/useNotificationSettings'

// ─── Config ──────────────────────────────────────────────────────────────────

const TIMING_HOURS_OPTIONS = [
  { value: 1,  labelKey: 'notifications.timing1h' },
  { value: 2,  labelKey: 'notifications.timing2h' },
  { value: 24, labelKey: 'notifications.timing24h' },
  { value: 48, labelKey: 'notifications.timing48h' },
]

const TIMING_DAYS_OPTIONS = [
  { value: 7,  labelKey: 'notifications.timingDays7' },
  { value: 14, labelKey: 'notifications.timingDays14' },
  { value: 30, labelKey: 'notifications.timingDays30' },
  { value: 60, labelKey: 'notifications.timingDays60' },
]

// Типы, для которых поддерживается email-канал
const EMAIL_SUPPORTED_TYPES = new Set<NotifType>([
  'new_appointment',
  'appointment_confirmed',
  'appointment_cancelled',
  'appointment_rescheduled',
  'reminder_master',
  'reminder_client',
])

interface NotifRowConfig {
  type: NotifType
  icon: LucideIcon
  color: string
  when: string  // i18n key for "when" label
  hasTiming?: 'hours' | 'days'
}

const MASTER_ROWS: NotifRowConfig[] = [
  { type: 'new_appointment', icon: Bell,       color: 'text-primary',    when: 'notifications.whenCreate' },
  { type: 'reminder_master', icon: AlarmClock, color: 'text-amber-500',  when: '', hasTiming: 'hours' },
  { type: 'birthday_notify', icon: Gift,       color: 'text-pink-500',   when: 'notifications.whenCron9' },
]

const CLIENT_ROWS: NotifRowConfig[] = [
  { type: 'appointment_confirmed',         icon: CheckCircle,  color: 'text-green-500',  when: 'notifications.whenCreate' },
  { type: 'appointment_master_confirmed',  icon: CheckCircle,  color: 'text-emerald-600', when: '' },
  { type: 'reminder_client',               icon: AlarmClock,   color: 'text-amber-500',  when: '', hasTiming: 'hours' },
  { type: 'appointment_cancelled',         icon: XCircle,      color: 'text-red-500',    when: '' },
  { type: 'appointment_rescheduled',       icon: CalendarDays, color: 'text-blue-500',   when: '' },
  { type: 'post_visit_review',             icon: Star,         color: 'text-yellow-500', when: 'notifications.when2hAfter' },
  { type: 'birthday_greeting',             icon: Gift,         color: 'text-pink-500',   when: 'notifications.whenCron9' },
  { type: 'win_back',                      icon: Heart,        color: 'text-purple-500', when: '', hasTiming: 'days' },
]

// ─── Template Dialog ──────────────────────────────────────────────────────────

interface TemplateDialogProps {
  open: boolean
  onClose: () => void
  type: NotifType
  setting: NotificationSetting
  channel: 'telegram' | 'email'
  onSave: (template: string) => void
}

function TemplateDialog({ open, onClose, type, setting, channel, onSave }: TemplateDialogProps) {
  const { t } = useTranslation()
  const defaultTemplate = NOTIF_DEFAULT_TEMPLATES[type]
  const currentTemplate = channel === 'email' ? (setting.email_template || '') : (setting.template || '')
  const [value, setValue] = useState(currentTemplate)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(value)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg max-sm:max-w-full">
        <DialogHeader>
          <DialogTitle>
            {channel === 'email'
              ? t('notifications.emailTemplateDialogTitle')
              : t('notifications.templateDialogTitle')}
          </DialogTitle>
          <DialogDescription>{t('notifications.templateDialogDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-1">
          <div className="space-y-1.5">
            <Label>{t(`notifications.${type}_title`)}</Label>
            <Textarea
              rows={7}
              placeholder={channel === 'email' ? t('notifications.emailTemplatePlaceholder') : defaultTemplate}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="font-mono text-xs resize-none"
            />
          </div>
          {/* Variable hints */}
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">{t('notifications.templateDialogDesc').split(':')[0]}:</span>{' '}
              <code className="text-primary">{'{client_name}'}</code>{' '}
              <code className="text-primary">{'{master_name}'}</code>{' '}
              <code className="text-primary">{'{service}'}</code>{' '}
              <code className="text-primary">{'{date}'}</code>{' '}
              <code className="text-primary">{'{time}'}</code>{' '}
              <code className="text-primary">{'{cancel_link}'}</code>{' '}
              <code className="text-primary">{'{booking_link}'}</code>{' '}
              <code className="text-primary">{'{review_link}'}</code>
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setValue('')}
            >
              {t('notifications.templateReset')}
            </Button>
            <Button
              size="sm"
              loading={saving}
              onClick={handleSave}
            >
              {t('notifications.templateSave')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Notification Row ─────────────────────────────────────────────────────────

interface NotifRowProps {
  config: NotifRowConfig
  setting: NotificationSetting
  onToggle: (enabled: boolean) => void
  onEmailToggle: (enabled: boolean) => void
  onTimingChange: (value: number) => void
  onTemplateChange: (template: string) => void
  onEmailTemplateChange: (template: string) => void
  toggling: boolean
}

function NotifRow({
  config, setting, onToggle, onEmailToggle,
  onTimingChange, onTemplateChange, onEmailTemplateChange, toggling,
}: NotifRowProps) {
  const { t } = useTranslation()
  const [tgTemplateOpen, setTgTemplateOpen]   = useState(false)
  const [emlTemplateOpen, setEmlTemplateOpen] = useState(false)

  const hasCustomTgTemplate  = !!setting.template?.trim()
  const hasCustomEmlTemplate = !!setting.email_template?.trim()
  const supportsEmail        = EMAIL_SUPPORTED_TYPES.has(config.type)

  const isAnyEnabled = setting.enabled || (supportsEmail && (setting.enable_email ?? false))

  return (
    <div className={cn(
      'flex items-start gap-3 py-3 px-0 transition-opacity',
      !isAnyEnabled && 'opacity-50'
    )}>
      <div className={cn('shrink-0 mt-0.5 p-1.5 rounded-lg bg-muted/60', config.color)}>
        <config.icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          {/* Title + desc */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-tight">
              {t(`notifications.${config.type}_title`)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              {t(`notifications.${config.type}_desc`)}
            </p>
          </div>

          {/* Channel toggles */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {/* Telegram toggle */}
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Send className="h-2.5 w-2.5" />
                TG
              </span>
              <Switch
                checked={setting.enabled}
                onCheckedChange={onToggle}
                disabled={toggling}
              />
            </div>
            {/* Email toggle (только для поддерживаемых типов) */}
            {supportsEmail && (
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Mail className="h-2.5 w-2.5" />
                  Email
                </span>
                <Switch
                  checked={setting.enable_email ?? false}
                  onCheckedChange={onEmailToggle}
                  disabled={toggling}
                />
              </div>
            )}
          </div>
        </div>

        {/* Controls: timing + template buttons */}
        {isAnyEnabled && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Timing selector */}
            {config.hasTiming === 'hours' && (
              <Select
                value={String(setting.timing_hours ?? 24)}
                onValueChange={(v) => onTimingChange(Number(v))}
              >
                <SelectTrigger className="h-7 text-xs w-auto gap-1 border-dashed">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMING_HOURS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {t(o.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {config.hasTiming === 'days' && (
              <Select
                value={String(setting.timing_days ?? 30)}
                onValueChange={(v) => onTimingChange(Number(v))}
              >
                <SelectTrigger className="h-7 text-xs w-auto gap-1 border-dashed">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMING_DAYS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {t(o.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* When badge */}
            {config.when && (
              <span className="text-xs text-muted-foreground border border-dashed rounded px-1.5 py-0.5">
                {t(config.when)}
              </span>
            )}

            {/* Telegram template button */}
            {setting.enabled && (
              <button
                type="button"
                onClick={() => setTgTemplateOpen(true)}
                className={cn(
                  'flex items-center gap-1 text-xs rounded px-1.5 py-0.5 border transition-colors',
                  hasCustomTgTemplate
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-dashed text-muted-foreground hover:text-foreground'
                )}
              >
                <Send className="h-3 w-3" />
                TG
                {hasCustomTgTemplate && <span className="h-1.5 w-1.5 rounded-full bg-primary ml-0.5" />}
              </button>
            )}

            {/* Email template button */}
            {supportsEmail && (setting.enable_email ?? false) && (
              <button
                type="button"
                onClick={() => setEmlTemplateOpen(true)}
                className={cn(
                  'flex items-center gap-1 text-xs rounded px-1.5 py-0.5 border transition-colors',
                  hasCustomEmlTemplate
                    ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950'
                    : 'border-dashed text-muted-foreground hover:text-foreground'
                )}
              >
                <Mail className="h-3 w-3" />
                Email
                {hasCustomEmlTemplate && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 ml-0.5" />}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Telegram template dialog */}
      {tgTemplateOpen && (
        <TemplateDialog
          open={tgTemplateOpen}
          onClose={() => setTgTemplateOpen(false)}
          type={config.type}
          setting={setting}
          channel="telegram"
          onSave={onTemplateChange}
        />
      )}

      {/* Email template dialog */}
      {emlTemplateOpen && (
        <TemplateDialog
          open={emlTemplateOpen}
          onClose={() => setEmlTemplateOpen(false)}
          type={config.type}
          setting={setting}
          channel="email"
          onSave={onEmailTemplateChange}
        />
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NotificationsTab() {
  const { t } = useTranslation()
  const { data: settingsMap, isLoading } = useNotificationSettings()
  const upsert = useUpsertNotificationSetting()
  const [togglingTypes, setTogglingTypes] = useState<Set<string>>(new Set())

  const { user } = useAuth()

  const getSetting = (type: NotifType): NotificationSetting => {
    return settingsMap?.[type] ?? { ...NOTIF_DEFAULTS[type], master_id: user?.id ?? '' }
  }

  const handleToggle = async (type: NotifType, enabled: boolean) => {
    setTogglingTypes((prev) => new Set(prev).add(type))
    try {
      await upsert.mutateAsync({ type, enabled })
    } catch {
      toast.error(t('notifications.saveError'))
    } finally {
      setTogglingTypes((prev) => {
        const next = new Set(prev)
        next.delete(type)
        return next
      })
    }
  }

  const handleEmailToggle = async (type: NotifType, enable_email: boolean) => {
    setTogglingTypes((prev) => new Set(prev).add(type + '_email'))
    try {
      await upsert.mutateAsync({ type, enable_email })
    } catch {
      toast.error(t('notifications.saveError'))
    } finally {
      setTogglingTypes((prev) => {
        const next = new Set(prev)
        next.delete(type + '_email')
        return next
      })
    }
  }

  const handleTimingChange = async (type: NotifType, value: number, field: 'timing_hours' | 'timing_days') => {
    try {
      await upsert.mutateAsync({ type, [field]: value })
      toast.success(t('notifications.saved'))
    } catch {
      toast.error(t('notifications.saveError'))
    }
  }

  const handleTemplateChange = async (type: NotifType, template: string) => {
    await upsert.mutateAsync({ type, template })
    toast.success(t('notifications.saved'))
  }

  const handleEmailTemplateChange = async (type: NotifType, email_template: string) => {
    await upsert.mutateAsync({ type, email_template })
    toast.success(t('notifications.saved'))
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    )
  }

  const renderRows = (rows: NotifRowConfig[]) =>
    rows.map((config, idx) => {
      const setting = getSetting(config.type)
      return (
        <div key={config.type}>
          {idx > 0 && <div className="border-t" />}
          <NotifRow
            config={config}
            setting={setting}
            toggling={togglingTypes.has(config.type) || togglingTypes.has(config.type + '_email')}
            onToggle={(enabled) => handleToggle(config.type, enabled)}
            onEmailToggle={(enabled) => handleEmailToggle(config.type, enabled)}
            onTimingChange={(value) =>
              handleTimingChange(
                config.type,
                value,
                config.hasTiming === 'days' ? 'timing_days' : 'timing_hours'
              )
            }
            onTemplateChange={(template) => handleTemplateChange(config.type, template)}
            onEmailTemplateChange={(template) => handleEmailTemplateChange(config.type, template)}
          />
        </div>
      )
    })

  return (
    <div className="space-y-4">
      {/* Master notifications */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BellRing className="h-4 w-4" />
            {t('notifications.sectionMaster')}
          </CardTitle>
          <CardDescription>{t('notifications.sectionMasterDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 divide-y-0">
          {renderRows(MASTER_ROWS)}
        </CardContent>
      </Card>

      {/* Client notifications */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BellRing className="h-4 w-4" />
            {t('notifications.sectionClient')}
          </CardTitle>
          <CardDescription>{t('notifications.sectionClientDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {renderRows(CLIENT_ROWS)}
        </CardContent>
      </Card>

      {/* Info hint */}
      <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
        <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Telegram:</span>{' '}
          {t('notifications.infoTelegram')}
          <br />
          <span className="font-medium text-foreground">Email:</span>{' '}
          {t('notifications.infoEmail')}
        </p>
      </div>
    </div>
  )
}
