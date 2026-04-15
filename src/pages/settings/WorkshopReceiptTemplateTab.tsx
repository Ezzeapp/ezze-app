import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Save, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import { toast } from '@/components/shared/Toaster'

export interface WorkshopReceiptTemplate {
  company_name: string
  address: string
  phone: string
  inn: string
  header_note: string           // под названием компании (режим работы, и т.д.)
  warranty_terms: string         // условия гарантии
  refuse_terms: string           // условия при отказе от ремонта
  pickup_terms: string           // условия получения (срок хранения)
  footer: string                 // нижний текст квитанции
  show_qr: boolean
}

const SETTINGS_KEY = 'workshop_receipt_template'

export const DEFAULT_TEMPLATE: WorkshopReceiptTemplate = {
  company_name: '',
  address: '',
  phone: '',
  inn: '',
  header_note: '',
  warranty_terms:
    'Гарантия распространяется только на выполненные работы и установленные запчасти. ' +
    'Не покрывает: механические повреждения, попадание жидкости, несанкционированное вскрытие.',
  refuse_terms:
    'В случае отказа от ремонта после диагностики оплачивается стоимость диагностики.',
  pickup_terms:
    'Устройство, не востребованное в течение 30 дней с даты готовности, может быть утилизировано.',
  footer: 'Спасибо за обращение!',
  show_qr: true,
}

export function useWorkshopReceiptTemplate() {
  return useQuery({
    queryKey: [SETTINGS_KEY, PRODUCT],
    queryFn: async (): Promise<WorkshopReceiptTemplate> => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('product', PRODUCT)
        .eq('key', SETTINGS_KEY)
        .maybeSingle()
      if (!data?.value) return DEFAULT_TEMPLATE
      try {
        return { ...DEFAULT_TEMPLATE, ...JSON.parse(data.value) }
      } catch {
        return DEFAULT_TEMPLATE
      }
    },
  })
}

export function WorkshopReceiptTemplateTab() {
  const qc = useQueryClient()
  const { data: saved, isLoading } = useWorkshopReceiptTemplate()
  const [tpl, setTpl] = useState<WorkshopReceiptTemplate>(DEFAULT_TEMPLATE)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (saved) {
      setTpl(saved)
      setDirty(false)
    }
  }, [saved])

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { product: PRODUCT, key: SETTINGS_KEY, value: JSON.stringify(tpl) },
          { onConflict: 'product,key' }
        )
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SETTINGS_KEY, PRODUCT] })
      setDirty(false)
      toast.success('Шаблон сохранён')
    },
    onError: (e: any) => toast.error(e.message ?? 'Ошибка'),
  })

  function update<K extends keyof WorkshopReceiptTemplate>(key: K, val: WorkshopReceiptTemplate[K]) {
    setTpl(prev => ({ ...prev, [key]: val }))
    setDirty(true)
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Шаблон квитанции</h3>
        <p className="text-sm text-muted-foreground">Данные подставятся в печатную квитанцию.</p>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="text-sm font-semibold">Реквизиты</h4>
        <div>
          <Label>Название мастерской</Label>
          <Input value={tpl.company_name} onChange={e => update('company_name', e.target.value)} placeholder="ИП Иванов И.И., ООО «РемонтПро»..." />
        </div>
        <div>
          <Label>Адрес</Label>
          <Input value={tpl.address} onChange={e => update('address', e.target.value)} placeholder="г. Ташкент, ул. Амира Темура 1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Телефон</Label>
            <Input value={tpl.phone} onChange={e => update('phone', e.target.value)} placeholder="+998 90 123 45 67" />
          </div>
          <div>
            <Label>ИНН / регистр. №</Label>
            <Input value={tpl.inn} onChange={e => update('inn', e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Подпись под названием (режим работы и т.д.)</Label>
          <Input value={tpl.header_note} onChange={e => update('header_note', e.target.value)} placeholder="Пн–Сб 10:00–20:00" />
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="text-sm font-semibold">Условия и правила</h4>
        <div>
          <Label>Условия гарантии</Label>
          <Textarea value={tpl.warranty_terms} onChange={e => update('warranty_terms', e.target.value)} rows={2} />
        </div>
        <div>
          <Label>При отказе от ремонта</Label>
          <Textarea value={tpl.refuse_terms} onChange={e => update('refuse_terms', e.target.value)} rows={2} />
        </div>
        <div>
          <Label>Срок хранения после готовности</Label>
          <Textarea value={tpl.pickup_terms} onChange={e => update('pickup_terms', e.target.value)} rows={2} />
        </div>
        <div>
          <Label>Нижний текст</Label>
          <Input value={tpl.footer} onChange={e => update('footer', e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="text-sm font-semibold">Оформление</h4>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={tpl.show_qr}
            onChange={e => update('show_qr', e.target.checked)}
            className="h-4 w-4"
          />
          Печатать QR-код со ссылкой на отслеживание
        </label>
      </div>

      <div className="flex gap-2 justify-between sticky bottom-0 bg-background pt-2 pb-4">
        <Button variant="ghost" size="sm" onClick={() => { setTpl(DEFAULT_TEMPLATE); setDirty(true) }}>
          <RotateCcw className="h-4 w-4 mr-1" /> По умолчанию
        </Button>
        <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Сохранить
        </Button>
      </div>
    </div>
  )
}
