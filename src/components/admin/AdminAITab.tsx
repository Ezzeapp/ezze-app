import { useState } from 'react'
import { Bot, Eye, EyeOff, ExternalLink, Sparkles, MessageSquare, BarChart2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/shared/Toaster'
import { useAIConfig, useUpdateAIConfig, type AIConfig } from '@/hooks/useAppSettings'

const MODELS = [
  { value: 'claude-haiku-4-5',          label: 'Claude Haiku 4.5',   desc: 'Быстрая · дешёвая · рекомендуется' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku',   desc: 'Быстрая' },
  { value: 'claude-sonnet-4-5',          label: 'Claude Sonnet 4.5',  desc: 'Сбалансированная' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', desc: 'Умная' },
  { value: 'claude-opus-4-5',            label: 'Claude Opus 4.5',    desc: 'Самая умная · дорогая' },
]

export function AdminAITab() {
  const { data: config, isLoading } = useAIConfig()
  const update = useUpdateAIConfig()
  const [form, setForm] = useState<AIConfig | null>(null)
  const [showKey, setShowKey] = useState(false)

  const current = form ?? config
  const set = (patch: Partial<AIConfig>) =>
    setForm(prev => ({ ...(prev ?? config!), ...patch }))

  const handleSave = async () => {
    if (!current) return
    try {
      await update.mutateAsync(current)
      setForm(null)
      toast.success('Настройки ИИ сохранены')
    } catch {
      toast.error('Ошибка сохранения')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    )
  }

  const isDirty = form !== null
  const keyPreview = current?.api_key
    ? `sk-ant-...${current.api_key.slice(-4)}`
    : null

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Настройки интеграции с Claude API (Anthropic). Ключ и модель применяются ко всем ИИ-функциям платформы.
      </p>

      {/* Глобальный тоггл */}
      <div className={`flex items-center justify-between gap-3 p-4 rounded-xl border transition-all ${
        current?.enabled ? 'bg-background' : 'bg-muted/30 opacity-75'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            current?.enabled ? 'bg-purple-100 dark:bg-purple-950' : 'bg-muted'
          }`}>
            <Bot className={`h-4 w-4 ${current?.enabled ? 'text-purple-600' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <p className="text-sm font-semibold">ИИ-функции включены</p>
            <p className="text-xs text-muted-foreground">Генерация текстов, анализ клиентов, Telegram-бот</p>
          </div>
        </div>
        <Switch
          checked={current?.enabled ?? false}
          onCheckedChange={v => set({ enabled: v })}
        />
      </div>

      {/* Настройки */}
      <div className="rounded-xl border bg-card p-5 space-y-5">

        {/* API ключ */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">API-ключ Anthropic</Label>
          <div className="flex gap-2">
            <Input
              type={showKey ? 'text' : 'password'}
              value={current?.api_key ?? ''}
              onChange={e => set({ api_key: e.target.value })}
              placeholder="sk-ant-api03-..."
              className="font-mono text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowKey(v => !v)}
              className="shrink-0"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            Получить на&nbsp;
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5"
            >
              console.anthropic.com
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>

        {/* Модель */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Модель</Label>
          <Select
            value={current?.model ?? 'claude-haiku-4-5'}
            onValueChange={v => set({ model: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map(m => (
                <SelectItem key={m.value} value={m.value}>
                  <div>
                    <span className="font-medium">{m.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">— {m.desc}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Haiku — самая экономичная, подходит для большинства задач
          </p>
        </div>

        {/* Макс. токенов */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Макс. токенов ответа</Label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={128}
              max={4096}
              step={128}
              value={current?.max_tokens ?? 1024}
              onChange={e => {
                const v = Math.max(128, Math.min(4096, parseInt(e.target.value) || 1024))
                set({ max_tokens: v })
              }}
              className="w-32"
            />
            <span className="text-xs text-muted-foreground">токенов (128 – 4096)</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Больше токенов = длиннее ответы + выше стоимость. 1024 — хороший баланс.
          </p>
        </div>

        {/* Кнопка сохранить */}
        <div className="flex justify-end pt-1">
          <Button
            onClick={handleSave}
            disabled={!isDirty || update.isPending}
            loading={update.isPending}
            className="gap-2"
          >
            Сохранить настройки
          </Button>
        </div>
      </div>

      {/* Статус */}
      <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
        <p className="text-sm font-medium">Статус</p>

        <div className="space-y-1.5">
          {keyPreview ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-emerald-700 dark:text-emerald-400">API-ключ задан ({keyPreview})</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span className="text-amber-700 dark:text-amber-400">API-ключ не задан — ИИ-функции недоступны</span>
            </div>
          )}

          {current?.enabled && keyPreview ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>ИИ активен · модель: <span className="font-mono text-xs">{current.model}</span> · токенов: {current.max_tokens}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />
              <span>ИИ-функции выключены</span>
            </div>
          )}
        </div>

        <div className="border-t pt-3">
          <p className="text-xs text-muted-foreground mb-2">Использует ИИ:</p>
          <div className="flex flex-wrap gap-2">
            {[
              { icon: Sparkles, label: 'Генератор bio и описаний' },
              { icon: BarChart2, label: 'Анализ клиентской базы' },
              { icon: MessageSquare, label: 'Telegram-бот (ИИ-ответы)' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-xs bg-background border rounded-full px-2.5 py-1">
                <Icon className="h-3 w-3 text-purple-500" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
