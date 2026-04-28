import { useState, useEffect } from 'react'
import { Save, Loader2, FileText, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/shared/Toaster'
import { useReceiptConfig, useUpdateReceiptConfig, DEFAULT_RECEIPT_CONFIG, DEFAULT_TERMS_TEXT, type ReceiptConfig } from '@/hooks/useReceiptConfig'
import { Textarea } from '@/components/ui/textarea'
import { ReceiptModal, type ReceiptData } from '@/components/orders/ReceiptModal'
import dayjs from 'dayjs'

// Демо-заказ для превью
const DEMO_ORDER: ReceiptData = {
  id: 'demo',
  number: 'КВ-0001',
  created_at: dayjs().toISOString(),
  order_type: 'clothing',
  client: { first_name: 'Иван', last_name: 'Иванов', phone: '+7 900 123-45-67' },
  items: [
    { item_type_name: 'Пальто', price: 150000, ready_date: dayjs().add(3, 'day').format('YYYY-MM-DD'), color: 'Серое', brand: 'Zara', defects: null, area_m2: null, width_m: null, length_m: null },
    { item_type_name: 'Куртка', price: 120000, ready_date: dayjs().add(3, 'day').format('YYYY-MM-DD'), color: 'Синяя', brand: null, defects: 'Пятно на рукаве', area_m2: null, width_m: null, length_m: null },
  ],
  total_amount: 270000,
  prepaid_amount: 50000,
  notes: null,
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 w-full text-left"
    >
      {checked
        ? <ToggleRight className="h-5 w-5 text-primary shrink-0" />
        : <ToggleLeft className="h-5 w-5 text-muted-foreground shrink-0" />}
      <span className="text-sm">{label}</span>
    </button>
  )
}

export function ReceiptSettingsTab() {
  const { data: savedConfig, isLoading } = useReceiptConfig()
  const { mutateAsync: updateConfig, isPending } = useUpdateReceiptConfig()

  const [config, setConfig] = useState<ReceiptConfig>(DEFAULT_RECEIPT_CONFIG)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    if (savedConfig) setConfig(savedConfig)
  }, [savedConfig])

  function set<K extends keyof ReceiptConfig>(key: K, value: ReceiptConfig[K]) {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    try {
      await updateConfig(config)
      toast.success('Настройки квитанции сохранены')
    } catch {
      toast.error('Ошибка сохранения')
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-xl">

      {/* Данные организации */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Данные организации
          </CardTitle>
          <CardDescription>Отображаются в шапке квитанции</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Название организации</Label>
            <Input
              placeholder="Химчистка Экспресс"
              value={config.company_name}
              onChange={e => set('company_name', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Адрес</Label>
            <Input
              placeholder="ул. Навои 15, г. Ташкент"
              value={config.company_address}
              onChange={e => set('company_address', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Телефон</Label>
            <Input
              placeholder="+998 71 123-45-67"
              value={config.company_phone}
              onChange={e => set('company_phone', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Текст внизу квитанции</Label>
            <Input
              placeholder="Спасибо за обращение!"
              value={config.footer_text}
              onChange={e => set('footer_text', e.target.value)}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Условия приёмки */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Условия приёмки</CardTitle>
          <CardDescription>Юридический текст оферты — печатается мелким шрифтом перед QR-кодом. Защищает от споров о скрытых дефектах.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={config.terms_text}
            onChange={e => set('terms_text', e.target.value)}
            placeholder="Оставьте пустым, чтобы не показывать"
            rows={8}
            className="text-xs font-mono leading-relaxed"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {config.terms_text ? `${config.terms_text.length} символов` : 'Условия не печатаются'}
            </span>
            <button
              type="button"
              onClick={() => set('terms_text', DEFAULT_TERMS_TEXT)}
              className="text-xs text-primary hover:underline"
            >
              Восстановить шаблон
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Параметры печати */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Параметры печати</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Toggle
            checked={config.show_item_details}
            onChange={v => set('show_item_details', v)}
            label="Показывать детали изделий (цвет, бренд, дефекты)"
          />

          {/* Количество копий */}
          <div>
            <Label className="text-sm mb-2 block">Количество экземпляров</Label>
            <div className="flex gap-2">
              {([1, 2] as const).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set('copy_count', n)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    config.copy_count === n
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {n === 1 ? '1 экземпляр' : '2 экземпляра'}
                  <span className="block text-xs font-normal mt-0.5 text-muted-foreground">
                    {n === 1 ? 'Только для клиента' : 'Клиент + организация'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Кнопки */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setPreviewOpen(true)} className="flex-1">
          Предпросмотр
        </Button>
        <Button onClick={handleSave} disabled={isPending} className="flex-1">
          {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Сохранить
        </Button>
      </div>

      {/* Предпросмотр */}
      {previewOpen && (
        <ReceiptModal
          data={DEMO_ORDER}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  )
}
