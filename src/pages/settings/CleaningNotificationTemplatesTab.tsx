import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Save, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import { toast } from '@/components/shared/Toaster'

// Совпадает с cleaning-notify-status: статусы, при которых шлём TG.
type Status = 'received' | 'in_progress' | 'ready' | 'issued' | 'paid' | 'cancelled'

interface NotificationTemplate {
  status: Status
  enabled: boolean
  text: string
}

const STATUS_LABELS: Record<Status, string> = {
  received:    'Принят',
  in_progress: 'В работе',
  ready:       'Готов к выдаче',
  issued:      'Выдан',
  paid:        'Оплачен',
  cancelled:   'Отменён',
}

// Дефолты согласованы с миграцией 049 — лишние статусы пустые, чтобы оператор
// сам решал что включать. Edge-функция не отправляет шаблон если enabled=false
// или text пустой.
const DEFAULT_TEMPLATES: NotificationTemplate[] = [
  { status: 'received',    enabled: false, text: '' },
  { status: 'in_progress', enabled: false, text: '' },
  { status: 'ready',       enabled: true,  text: '✅ Заказ {number} готов!\n\nЗдравствуйте, {client_name}!\nВаш заказ готов к выдаче.\n\nСрок: {ready_date}\nСумма: {total}\nК оплате: {remaining}\n\n📦 Отслеживание: {track_url}' },
  { status: 'issued',      enabled: true,  text: '📦 Заказ {number} выдан\n\nСпасибо, {client_name}!\nВаш заказ выдан.\n\nИтого: {total}' },
  { status: 'paid',        enabled: true,  text: '💳 Оплата подтверждена\n\nЗаказ {number} полностью оплачен.\nСумма: {total}\n\nСпасибо за доверие! 🙏' },
  { status: 'cancelled',   enabled: false, text: '' },
]

const SETTINGS_KEY = 'cleaning_notification_templates'

export function CleaningNotificationTemplatesTab() {
  const qc = useQueryClient()
  const [templates, setTemplates] = useState<NotificationTemplate[]>(DEFAULT_TEMPLATES)
  const [dirty, setDirty] = useState(false)

  const { data: saved, isLoading } = useQuery({
    queryKey: [SETTINGS_KEY, PRODUCT],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('product', PRODUCT)
        .eq('key', SETTINGS_KEY)
        .maybeSingle()
      if (!data?.value) return null
      try {
        return JSON.parse(data.value) as NotificationTemplate[]
      } catch {
        return null
      }
    },
  })

  useEffect(() => {
    if (saved) {
      // Мерджим сохранённое с дефолтами — если в БД нет нового статуса,
      // подставляем дефолт, не теряем уже сохранённые тексты.
      const merged = DEFAULT_TEMPLATES.map(def => {
        const savedT = saved.find(s => s.status === def.status)
        return savedT ?? def
      })
      setTemplates(merged)
      setDirty(false)
    }
  }, [saved])

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { product: PRODUCT, key: SETTINGS_KEY, value: JSON.stringify(templates) },
          { onConflict: 'product,key' }
        )
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SETTINGS_KEY, PRODUCT] })
      setDirty(false)
      toast.success('Шаблоны сохранены')
    },
    onError: (e: any) => toast.error(e.message ?? 'Ошибка'),
  })

  function update(status: Status, patch: Partial<NotificationTemplate>) {
    setTemplates(prev => prev.map(t => t.status === status ? { ...t, ...patch } : t))
    setDirty(true)
  }

  function resetDefaults() {
    setTemplates(DEFAULT_TEMPLATES)
    setDirty(true)
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Шаблоны уведомлений клиенту</h3>
        <p className="text-sm text-muted-foreground">
          Автоматически отправляются в Telegram при смене статуса заказа (если у клиента есть tg_chat_id).
        </p>
      </div>

      <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
        <div className="font-semibold">Доступные подстановки:</div>
        <div className="font-mono space-y-0.5">
          <div><code>{'{number}'}</code> — номер заказа</div>
          <div><code>{'{client_name}'}</code> — имя клиента</div>
          <div><code>{'{ready_date}'}</code> — срок готовности</div>
          <div><code>{'{total}'}</code> — сумма заказа</div>
          <div><code>{'{remaining}'}</code> — остаток к оплате</div>
          <div><code>{'{track_url}'}</code> — ссылка на /track</div>
        </div>
      </div>

      {templates.map(tpl => (
        <div key={tpl.status} className="rounded-lg border p-3">
          <div className="flex items-center justify-between mb-2">
            <Label className="font-semibold">{STATUS_LABELS[tpl.status]}</Label>
            <Switch checked={tpl.enabled} onCheckedChange={v => update(tpl.status, { enabled: v })} />
          </div>
          <Textarea
            value={tpl.text}
            onChange={e => update(tpl.status, { text: e.target.value })}
            rows={4}
            placeholder="Шаблон не задан — уведомление при этом статусе не отправляется"
            className={tpl.enabled ? '' : 'opacity-50'}
            disabled={!tpl.enabled}
          />
        </div>
      ))}

      <div className="flex gap-2 justify-between sticky bottom-0 bg-background pt-2 pb-4">
        <Button variant="ghost" size="sm" onClick={resetDefaults}>
          <RotateCcw className="h-4 w-4 mr-1" /> Сбросить
        </Button>
        <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Сохранить
        </Button>
      </div>
    </div>
  )
}
