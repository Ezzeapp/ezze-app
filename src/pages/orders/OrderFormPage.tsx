import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/shared/Toaster'
import { useCreateOrder } from '@/hooks/useCleaningOrders'
import { useCleaningItemTypes } from '@/hooks/useCleaningItemTypes'
import { useClientsPaged } from '@/hooks/useClients'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import { formatCurrency } from '@/lib/utils'
import { useCurrencySymbol } from '@/hooks/useCurrency'
import dayjs from 'dayjs'

interface ItemRow {
  key: number
  item_type_id: string
  item_type_name: string
  color: string
  brand: string
  defects: string
  price: string
  ready_date: string
}

let keySeq = 0
function newRow(name = '', price = 0, days = 3): ItemRow {
  const readyDate = dayjs().add(days, 'day').format('YYYY-MM-DD')
  return { key: ++keySeq, item_type_id: '', item_type_name: name, color: '', brand: '', defects: '', price: String(price), ready_date: readyDate }
}

export function OrderFormPage() {
  const navigate = useNavigate()
  const symbol = useCurrencySymbol()

  const { data: itemTypes = [] } = useCleaningItemTypes()
  const { data: clientsData } = useClientsPaged('', 1, 100)
  const clients = clientsData?.items ?? []

  // Список сотрудников из master_profiles для текущего продукта
  const { data: members = [] } = useQuery({
    queryKey: ['master_profiles_list', PRODUCT],
    queryFn: async () => {
      const { data } = await supabase
        .from('master_profiles')
        .select('id, display_name')
        .eq('product', PRODUCT)
        .order('display_name')
      return data ?? []
    },
  })

  const { mutateAsync: createOrder, isPending } = useCreateOrder()

  const [clientId, setClientId] = useState<string>('')
  const [assignedTo, setAssignedTo] = useState<string>('')
  const [prepaid, setPrepaid] = useState<string>('')
  const [readyDate, setReadyDate] = useState<string>(dayjs().add(3, 'day').format('YYYY-MM-DD'))
  const [notes, setNotes] = useState<string>('')
  const [items, setItems] = useState<ItemRow[]>([newRow()])

  const total = items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0)

  function addItem() {
    setItems(prev => [...prev, newRow()])
  }

  function removeItem(key: number) {
    setItems(prev => prev.filter(i => i.key !== key))
  }

  function updateItem(key: number, field: keyof ItemRow, value: string) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i))
  }

  function selectType(key: number, typeId: string) {
    const type = itemTypes.find(t => t.id === typeId)
    if (!type) return
    const readyDate = dayjs().add(type.default_days, 'day').format('YYYY-MM-DD')
    setItems(prev => prev.map(i => i.key === key
      ? { ...i, item_type_id: typeId, item_type_name: type.name, price: String(type.default_price), ready_date: readyDate }
      : i
    ))
  }

  async function handleSubmit() {
    const validItems = items.filter(i => i.item_type_name.trim())
    if (validItems.length === 0) {
      toast.error('Добавьте хотя бы одно изделие')
      return
    }

    try {
      const order = await createOrder({
        client_id: clientId || null,
        assigned_to: assignedTo || null,
        prepaid_amount: parseFloat(prepaid) || 0,
        total_amount: total,
        ready_date: readyDate || null,
        notes: notes || null,
        items: validItems.map(i => ({
          item_type_id: i.item_type_id || null,
          item_type_name: i.item_type_name,
          color: i.color || null,
          brand: i.brand || null,
          defects: i.defects || null,
          price: parseFloat(i.price) || 0,
          ready_date: i.ready_date || null,
        })),
      })
      toast.success('Заказ создан')
      navigate(`/orders/${order.id}`)
    } catch (e: any) {
      toast.error(e.message || 'Ошибка создания')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">Новый заказ</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-32 space-y-4 pt-4">

        {/* Клиент */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Клиент</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Клиент</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Выберите клиента..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Без клиента —</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {[c.first_name, c.last_name].filter(Boolean).join(' ')}{c.phone ? ` · ${c.phone}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Исполнитель</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Назначить исполнителя..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Не назначен —</SelectItem>
                  {members.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Изделия */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Изделия</CardTitle>
              <Button variant="ghost" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Добавить
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, idx) => (
              <div key={item.key} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Изделие {idx + 1}</span>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(item.key)} className="text-destructive hover:opacity-70">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Тип */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Label>Тип изделия</Label>
                    <Select value={item.item_type_id} onValueChange={v => selectType(item.key, v)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Выберите тип..." />
                      </SelectTrigger>
                      <SelectContent>
                        {itemTypes.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!item.item_type_id && (
                      <Input
                        placeholder="Или введите вручную..."
                        value={item.item_type_name}
                        onChange={e => updateItem(item.key, 'item_type_name', e.target.value)}
                        className="mt-2"
                      />
                    )}
                  </div>

                  <div>
                    <Label>Цвет</Label>
                    <Input
                      placeholder="Синий..."
                      value={item.color}
                      onChange={e => updateItem(item.key, 'color', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Бренд</Label>
                    <Input
                      placeholder="Zara..."
                      value={item.brand}
                      onChange={e => updateItem(item.key, 'brand', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Дефекты */}
                <div>
                  <Label>Дефекты при приёме</Label>
                  <Textarea
                    placeholder="Пятно на рукаве, потёртость..."
                    value={item.defects}
                    onChange={e => updateItem(item.key, 'defects', e.target.value)}
                    className="mt-1 resize-none"
                    rows={2}
                  />
                </div>

                {/* Цена и срок */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Цена ({symbol})</Label>
                    <Input
                      type="number"
                      min={0}
                      value={item.price}
                      onChange={e => updateItem(item.key, 'price', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Срок готовности</Label>
                    <Input
                      type="date"
                      value={item.ready_date}
                      onChange={e => updateItem(item.key, 'ready_date', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            ))}

            <Separator />
            <div className="flex justify-between text-sm font-semibold">
              <span>Итого</span>
              <span>{formatCurrency(total)} {symbol}</span>
            </div>
          </CardContent>
        </Card>

        {/* Оплата и сроки */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Оплата и сроки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Предоплата ({symbol})</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={prepaid}
                onChange={e => setPrepaid(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Общий срок готовности</Label>
              <Input
                type="date"
                value={readyDate}
                onChange={e => setReadyDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Примечания</Label>
              <Textarea
                placeholder="Дополнительные пожелания..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="mt-1 resize-none"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 lg:relative lg:bottom-auto bg-background border-t px-4 py-3 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => navigate('/orders')}>
          Отмена
        </Button>
        <Button className="flex-1" onClick={handleSubmit} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Создать заказ
        </Button>
      </div>
    </div>
  )
}
