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

// ── Провайдеры ──────────────────────────────────────────────────────────────

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai',    label: 'OpenAI (GPT)' },
  { value: 'gemini',    label: 'Google Gemini' },
  { value: 'deepseek',  label: 'DeepSeek 🇨🇳' },
  { value: 'qwen',      label: 'Qwen / Alibaba 🇨🇳' },
  { value: 'custom',    label: 'Другой (OpenAI-совместимый)' },
]

const PROVIDER_MODELS: Record<string, Array<{ value: string; label: string; desc: string }>> = {
  anthropic: [
    { value: 'claude-haiku-4-5',          label: 'Claude Haiku 4.5',   desc: 'Быстрая · дешёвая (рекомендуется)' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku',   desc: 'Быстрая' },
    { value: 'claude-sonnet-4-5',          label: 'Claude Sonnet 4.5',  desc: 'Сбалансированная' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', desc: 'Умная' },
    { value: 'claude-opus-4-5',            label: 'Claude Opus 4.5',    desc: 'Самая умная · дорогая' },
  ],
  openai: [
    { value: 'gpt-4o-mini',   label: 'GPT-4o mini',   desc: 'Быстрая · дешёвая (рекомендуется)' },
    { value: 'gpt-4o',        label: 'GPT-4o',         desc: 'Умная · многофункциональная' },
    { value: 'gpt-4-turbo',   label: 'GPT-4 Turbo',    desc: 'Мощная' },
    { value: 'o3-mini',       label: 'o3-mini',         desc: 'Логика и рассуждения' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash',     label: 'Gemini 2.0 Flash',     desc: 'Быстрая (рекомендуется)' },
    { value: 'gemini-1.5-flash',     label: 'Gemini 1.5 Flash',     desc: 'Экономичная' },
    { value: 'gemini-1.5-pro',       label: 'Gemini 1.5 Pro',       desc: 'Умная · большой контекст' },
    { value: 'gemini-2.0-pro-exp',   label: 'Gemini 2.0 Pro (exp)', desc: 'Самая умная' },
  ],
  deepseek: [
    { value: 'deepseek-chat',     label: 'DeepSeek Chat',     desc: 'Общение · дешёвая (рекомендуется)' },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner', desc: 'Сложные задачи · reasoning' },
  ],
  qwen: [
    { value: 'qwen-plus',              label: 'Qwen Plus',         desc: 'Сбалансированная (рекомендуется)' },
    { value: 'qwen-turbo',             label: 'Qwen Turbo',        desc: 'Быстрая · дешёвая' },
    { value: 'qwen-max',               label: 'Qwen Max',          desc: 'Самая умная' },
    { value: 'qwen2.5-72b-instruct',   label: 'Qwen 2.5 72B',      desc: 'Open-source · мощная' },
  ],
  custom: [],
}

// Дефолтная модель при смене провайдера
const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  anthropic: 'claude-haiku-4-5',
  openai:    'gpt-4o-mini',
  gemini:    'gemini-2.0-flash',
  deepseek:  'deepseek-chat',
  qwen:      'qwen-plus',
  custom:    '',
}

// Ссылки на консоль провайдера
const KEY_LINKS: Record<string, { url: string; label: string }> = {
  anthropic: { url: 'https://console.anthropic.com/settings/keys',  label: 'console.anthropic.com' },
  openai:    { url: 'https://platform.openai.com/api-keys',          label: 'platform.openai.com' },
  gemini:    { url: 'https://aistudio.google.com/app/apikey',        label: 'aistudio.google.com' },
  deepseek:  { url: 'https://platform.deepseek.com/api_keys',        label: 'platform.deepseek.com' },
  qwen:      { url: 'https://dashscope.console.aliyun.com',          label: 'dashscope.console.aliyun.com' },
  custom:    { url: '', label: '' },
}

// Плейсхолдер ключа
const KEY_PLACEHOLDERS: Record<string, string> = {
  anthropic: 'sk-ant-api03-...',
  openai:    'sk-...',
  gemini:    'AIza...',
  deepseek:  'sk-...',
  qwen:      'sk-...',
  custom:    'API ключ',
}

// ── Компонент ────────────────────────────────────────────────────────────────

export function AdminAITab() {
  const { data: config, isLoading } = useAIConfig()
  const update = useUpdateAIConfig()
  const [form, setForm] = useState<AIConfig | null>(null)
  const [showKey, setShowKey] = useState(false)

  const current = form ?? config
  const set = (patch: Partial<AIConfig>) =>
    setForm(prev => ({ ...(prev ?? config!), ...patch }))

  const handleProviderChange = (provider: string) => {
    set({ provider, model: PROVIDER_DEFAULT_MODEL[provider] ?? '', api_key: '' })
  }

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
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    )
  }

  const isDirty = form !== null
  const provider = current?.provider || 'anthropic'
  const providerLabel = PROVIDERS.find(p => p.value === provider)?.label ?? provider
  const models = PROVIDER_MODELS[provider] ?? []
  const keyLink = KEY_LINKS[provider]

  const keyPreview = current?.api_key
    ? `...${current.api_key.slice(-4)}`
    : null

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Настройки ИИ-интеграции. Ключ и модель применяются ко всем ИИ-функциям платформы.
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

        {/* Провайдер */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Провайдер</Label>
          <Select value={provider} onValueChange={handleProviderChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* API ключ */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">API-ключ {providerLabel}</Label>
          <div className="flex gap-2">
            <Input
              type={showKey ? 'text' : 'password'}
              value={current?.api_key ?? ''}
              onChange={e => set({ api_key: e.target.value })}
              placeholder={KEY_PLACEHOLDERS[provider] ?? 'API ключ'}
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
          {keyLink?.url && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Получить на&nbsp;
              <a
                href={keyLink.url}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5"
              >
                {keyLink.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          )}
        </div>

        {/* Base URL (только для custom) */}
        {provider === 'custom' && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Base URL</Label>
            <Input
              value={current?.base_url ?? ''}
              onChange={e => set({ base_url: e.target.value })}
              placeholder="https://api.example.com/v1"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              OpenAI-совместимый API. URL без trailing slash и без /chat/completions
            </p>
          </div>
        )}

        {/* Модель */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Модель</Label>
          {provider === 'custom' ? (
            <Input
              value={current?.model ?? ''}
              onChange={e => set({ model: e.target.value })}
              placeholder="Название модели, например: llama-3.3-70b"
              className="font-mono text-sm"
            />
          ) : (
            <Select
              value={current?.model ?? models[0]?.value ?? ''}
              onValueChange={v => set({ model: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map(m => (
                  <SelectItem key={m.value} value={m.value}>
                    <div>
                      <span className="font-medium">{m.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">— {m.desc}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
              <span>
                ИИ активен · <span className="font-medium">{providerLabel}</span>
                {' · '}модель: <span className="font-mono text-xs">{current.model}</span>
                {' · '}токенов: {current.max_tokens}
              </span>
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
              { icon: Sparkles,       label: 'Генератор bio и описаний' },
              { icon: BarChart2,      label: 'Анализ клиентской базы' },
              { icon: MessageSquare,  label: 'Telegram-бот (ИИ-ответы)' },
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
