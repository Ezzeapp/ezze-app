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

type Status = 'received' | 'diagnosing' | 'waiting_approval' | 'waiting_parts' | 'in_progress' | 'ready' | 'issued'

interface NotificationTemplate {
  status: Status
  enabled: boolean
  text: string
}

const STATUS_LABELS: Record<Status, string> = {
  received: 'Принят',
  diagnosing: 'Диагностика',
  waiting_approval: 'Ждём согласия клиента',
  waiting_parts: 'Ждём запчасти',
  in_progress: 'В ремонте',
  ready: 'Готов к выдаче',
  issued: 'Выдан',
}

const DEFAULT_TEMPLATES: NotificationTemplate[] = [
  { status: 'received',         enabled: true,  text: 'Ваш заказ {number} принят в работу. Отследить статус: {track_url}' },
  { status: 'diagnosing',       enabled: false, text: 'Мастер начал диагностику по заказу {number}.' },
  { status: 'waiting_approval', enabled: true,  text: 'Диагностика по {number} завершена. Стоимость ремонта: {total}. Свяжитесь с нами для подтверждения.' },
  { status: 'waiting_parts',    enabled: false, text: 'По заказу {number} заказаны запчасти. Ожидаемая готовность: {ready_date}.' },
  { status: 'in_progress',      enabled: false, text: 'Начат ремонт по заказу {number}.' },
  { status: 'ready',            enabled: true,  text: '{device} по заказу {number} готов к выдаче. Сумма к оплате: {remaining}.' },
  { status: 'issued',           enabled: false, text: 'Спасибо за обращение! По заказу {number} начинается гарантия.' },
]

const SETTINGS_KEY = 'workshop_notification_templates'

export function WorkshopNotificationTemplatesTab() {
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
      // Мерджим сохранённое с дефолтными (чтобы не потерять новые статусы)
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
          <div><code>{'{device}'}</code> — тип + бренд + модель</div>
          <div><code>{'{client_name}'}</code> — имя клиента</div>
          <div><code>{'{ready_date}'}</code> — дата готовности</div>
          <div><code>{'{total}'}</code> — итого к оплате</div>
          <div><code>{'{remaining}'}</code> — остаток долга</div>
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
            rows={2}
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
