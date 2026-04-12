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
import { useCreateOrder, type OrderType, ORDER_TYPE_LABELS, ORDER_TYPE_EMOJI } from '@/hooks/useCleaningOrders'
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
  // ковры
  width_m: string
  length_m: string
}

let keySeq = 0
function newRow(name = '', price = 0, days = 3): ItemRow {
  const readyDate = dayjs().add(days, 'day').format('YYYY-MM-DD')
  return {
    key: ++keySeq,
    item_type_id: '', item_type_name: name,
    color: '', brand: '', defects: '',
    price: String(price), ready_date: readyDate,
    width_m: '', length_m: '',
  }
}

const ORDER_TYPES: OrderType[] = ['clothing', 'carpet', 'furniture']

export function OrderFormPage() {
  const navigate = useNavigate()
  const symbol = useCurrencySymbol()

  const { data: itemTypes = [] } = useCleaningItemTypes()
  const { data: clientsData } = useClientsPaged('', 1, 100)
  const clients = clientsData?.items ?? []

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

  // Общие поля
  const [orderType, setOrderType] = useState<OrderType>('clothing')
  const [clientId, setClientId] = useState<string>('none')
  const [assignedTo, setAssignedTo] = useState<string>('none')
  const [prepaid, setPrepaid] = useState<string>('')
  const [readyDate, setReadyDate] = useState<string>(dayjs().add(3, 'day').format('YYYY-MM-DD'))
  const [notes, setNotes] = useState<string>('')
  // Ковры
  const [pickupDate, setPickupDate] = useState<string>('')
  const [deliveryDate, setDeliveryDate] = useState<string>('')
  // Мебель
  const [visitAddress, setVisitAddress] = useState<string>('')
  const [visitDate, setVisitDate] = useState<string>('')

  const [items, setItems] = useState<ItemRow[]>([newRow()])

  // Авторасчёт площади и цены для ковров
  function calcArea(w: string, l: string) {
    const wn = parseFloat(w) || 0
    const ln = parseFloat(l) || 0
    return wn * ln
  }

  // Цена = площадь × тариф (берём из выбранного типа)
  function carpetPrice(item: ItemRow): number {
    const area = calcArea(item.width_m, item.length_m)
    if (area === 0) return parseFloat(item.price) || 0
    const type = itemTypes.find(t => t.id === item.item_type_id)
    if (!type) return parseFloat(item.price) || 0
    return area * type.default_price
  }

  const total = orderType === 'carpet'
    ? items.reduce((s, i) => s + carpetPrice(i), 0)
    : items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0)

  function addItem() { setItems(prev => [...prev, newRow()]) }
  function removeItem(key: number) { setItems(prev => prev.filter(i => i.key !== key)) }
  function updateItem(key: number, field: keyof ItemRow, value: string) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i))
  }

  function selectType(key: number, typeId: string) {
    const type = itemTypes.find(t => t.id === typeId)
    if (!type) return
    const rd = dayjs().add(type.default_days, 'day').format('YYYY-MM-DD')
    setItems(prev => prev.map(i => i.key === key
      ? { ...i, item_type_id: typeId, item_type_name: type.name, price: String(type.default_price), ready_date: rd }
      : i
    ))
  }

  // Фильтрация типов по категории
  const filteredTypes = itemTypes.filter(t => {
    if (orderType === 'carpet') return t.name.toLowerCase().includes('кв.м') || t.name.toLowerCase().includes('ковёр') || t.name.toLowerCase().includes('ковр')
    if (orderType === 'furniture') return ['диван','кресло','матрас','пуф'].some(k => t.name.toLowerCase().includes(k))
    // clothing: всё что не ковры и не мебель
    return !t.name.toLowerCase().includes('кв.м') && !['диван','кресло','матрас','пуф'].some(k => t.name.toLowerCase().includes(k))
  })

  async function handleSubmit() {
    const validItems = items.filter(i => i.item_type_name.trim())
    if (validItems.length === 0) {
      toast.error('Добавьте хотя бы одно изделие')
      return
    }

    try {
      const order = await createOrder({
        order_type:     orderType,
        client_id:      clientId === 'none' ? null : clientId || null,
        assigned_to:    assignedTo === 'none' ? null : assignedTo || null,
        prepaid_amount: parseFloat(prepaid) || 0,
        total_amount:   total,
        ready_date:     readyDate || null,
        notes:          notes || null,
        pickup_date:    orderType === 'carpet' ? pickupDate || null : null,
        delivery_date:  orderType === 'carpet' ? deliveryDate || null : null,
        visit_address:  orderType === 'furniture' ? visitAddress || null : null,
        visit_date:     orderType === 'furniture' ? visitDate || null : null,
        items: validItems.map(i => {
          const area = orderType === 'carpet' ? calcArea(i.width_m, i.length_m) : null
          return {
            item_type_id:   i.item_type_id || null,
            item_type_name: i.item_type_name,
            color:          i.color || null,
            brand:          i.brand || null,
            defects:        i.defects || null,
            price:          orderType === 'carpet' ? carpetPrice(i) : parseFloat(i.price) || 0,
            ready_date:     i.ready_date || null,
            width_m:        orderType === 'carpet' ? parseFloat(i.width_m) || null : null,
            length_m:       orderType === 'carpet' ? parseFloat(i.length_m) || null : null,
            area_m2:        area && area > 0 ? area : null,
          }
        }),
      })
      toast.success('Заказ создан')
      navigate(`/orders/${order.id}`)
    } catch (e: any) {
      toast.error(e.message || 'Ошибка создания')
    }
  }

  const itemLabel = orderType === 'carpet' ? 'Ковёр' : orderType === 'furniture' ? 'Предмет' : 'Изделие'

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

        {/* Тип заказа */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Тип заказа</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {ORDER_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => { setOrderType(t); setItems([newRow()]) }}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-lg border-2 transition-colors text-sm font-medium ${
                    orderType === t
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  <span className="text-xl">{ORDER_TYPE_EMOJI[t]}</span>
                  {ORDER_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Клиент и исполнитель */}
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
                  <SelectItem value="none">— Без клиента —</SelectItem>
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
                  <SelectItem value="none">— Не назначен —</SelectItem>
                  {members.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Поля для мягкой мебели — адрес и дата выезда */}
            {orderType === 'furniture' && (
              <>
                <div>
                  <Label>Адрес выезда</Label>
                  <Input
                    placeholder="ул. Пушкина, д. 10, кв. 5"
                    value={visitAddress}
                    onChange={e => setVisitAddress(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Дата и время выезда</Label>
                  <Input
                    type="datetime-local"
                    value={visitDate}
                    onChange={e => setVisitDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {/* Поля для ковров — забор и доставка */}
            {orderType === 'carpet' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Дата забора</Label>
                  <Input
                    type="date"
                    value={pickupDate}
                    onChange={e => setPickupDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Дата доставки</Label>
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={e => setDeliveryDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Изделия */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{itemLabel}ия</CardTitle>
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
                  <span className="text-sm font-medium text-muted-foreground">{itemLabel} {idx + 1}</span>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(item.key)} className="text-destructive hover:opacity-70">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Тип */}
                <div className="col-span-2">
                  <Label>Тип</Label>
                  <Select value={item.item_type_id} onValueChange={v => selectType(item.key, v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Выберите тип..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredTypes.map(t => (
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

                {/* Размеры — только для ковров */}
                {orderType === 'carpet' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>Ширина (м)</Label>
                      <Input
                        type="number" min={0} step={0.1}
                        placeholder="2.0"
                        value={item.width_m}
                        onChange={e => updateItem(item.key, 'width_m', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Длина (м)</Label>
                      <Input
                        type="number" min={0} step={0.1}
                        placeholder="3.0"
                        value={item.length_m}
                        onChange={e => updateItem(item.key, 'length_m', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Площадь</Label>
                      <div className="mt-1 h-9 px-3 flex items-center rounded-md border bg-muted text-sm font-medium">
                        {calcArea(item.width_m, item.length_m).toFixed(1)} м²
                      </div>
                    </div>
                  </div>
                )}

                {/* Цвет и бренд — для одежды и мебели */}
                {orderType !== 'carpet' && (
                  <div className="grid grid-cols-2 gap-2">
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
                        placeholder={orderType === 'furniture' ? 'IKEA...' : 'Zara...'}
                        value={item.brand}
                        onChange={e => updateItem(item.key, 'brand', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}

                {/* Дефекты */}
                <div>
                  <Label>Дефекты при приёме</Label>
                  <Textarea
                    placeholder={orderType === 'carpet' ? 'Пятна, потёртости, запах...' : 'Пятно на рукаве, потёртость...'}
                    value={item.defects}
                    onChange={e => updateItem(item.key, 'defects', e.target.value)}
                    className="mt-1 resize-none"
                    rows={2}
                  />
                </div>

                {/* Цена и срок */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>
                      {orderType === 'carpet'
                        ? `Цена (${symbol}/м²)`
                        : `Цена (${symbol})`}
                    </Label>
                    <Input
                      type="number" min={0}
                      value={item.price}
                      onChange={e => updateItem(item.key, 'price', e.target.value)}
                      className="mt-1"
                    />
                    {orderType === 'carpet' && calcArea(item.width_m, item.length_m) > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Итого: {formatCurrency(carpetPrice(item))} {symbol}
                      </p>
                    )}
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
                type="number" min={0}
                placeholder="0"
                value={prepaid}
                onChange={e => setPrepaid(e.target.value)}
                className="mt-1"
              />
            </div>
            {orderType !== 'carpet' && (
              <div>
                <Label>Общий срок готовности</Label>
                <Input
                  type="date"
                  value={readyDate}
                  onChange={e => setReadyDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
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
