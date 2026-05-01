import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, ShoppingBag, Phone, MapPin, Plus, Minus,
  Trash2, Sparkles, CheckCircle2, Loader2, AlertCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PRODUCT } from '@/lib/config'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  usePublicCleaningPrices, usePublicCleaningOrderTypes, buildPriceGroups,
  type CleaningPriceRow,
} from './landingShared'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── Types ────────────────────────────────────────────────────────────────────

interface PublicProfile {
  id: string
  display_name: string | null
  profession: string | null
  avatar: string | null
  phone: string | null
  page_enabled: boolean
  is_public: boolean
  currency: string | null
  booking_slug: string
}

interface SelectedItem {
  id: string
  price_row: CleaningPriceRow
  qty: number
  notes?: string
}

// ── Data ─────────────────────────────────────────────────────────────────────

function usePublicMaster(slug: string) {
  return useQuery({
    queryKey: ['public-cleaning-master', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('master_profiles')
        .select('id, display_name, profession, avatar, phone, page_enabled, is_public, currency, booking_slug')
        .eq('booking_slug', slug)
        .eq('product', 'cleaning')
        .maybeSingle()
      if (error) throw error
      return data as PublicProfile | null
    },
    staleTime: 120_000,
    enabled: PRODUCT === 'cleaning',
  })
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function PublicCleaningOrderPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: profile, isLoading: pLoading } = usePublicMaster(slug ?? '')
  const { data: prices = [], isLoading: prLoading } = usePublicCleaningPrices()
  const { data: orderTypes = [] } = usePublicCleaningOrderTypes()

  const [selectedTypeSlug, setSelectedTypeSlug] = useState<string>('')
  const [selected, setSelected] = useState<SelectedItem[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneNumber, setDoneNumber] = useState<string | null>(null)

  const groups = useMemo(() => buildPriceGroups(prices, orderTypes), [prices, orderTypes])

  // Auto-select first type when groups load
  useEffect(() => {
    if (!selectedTypeSlug && groups.length > 0) setSelectedTypeSlug(groups[0].slug)
  }, [groups, selectedTypeSlug])

  const activeGroup = groups.find(g => g.slug === selectedTypeSlug) ?? groups[0]
  const total = selected.reduce((s, it) => s + it.price_row.default_price * it.qty, 0)

  function addItem(row: CleaningPriceRow) {
    setSelected(prev => {
      const existing = prev.find(p => p.id === row.id)
      if (existing) return prev.map(p => p.id === row.id ? { ...p, qty: p.qty + 1 } : p)
      return [...prev, { id: row.id, price_row: row, qty: 1 }]
    })
  }

  function changeQty(id: string, delta: number) {
    setSelected(prev =>
      prev.map(p => p.id === id ? { ...p, qty: Math.max(0, p.qty + delta) } : p)
        .filter(p => p.qty > 0)
    )
  }

  function removeItem(id: string) {
    setSelected(prev => prev.filter(p => p.id !== id))
  }

  async function submit() {
    setError(null)
    if (!profile) return
    if (!name.trim() || !phone.trim()) {
      setError('Укажите имя и телефон')
      return
    }
    if (selected.length === 0) {
      setError('Добавьте хотя бы одну позицию')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        slug: profile.booking_slug,
        order_type: activeGroup?.slug || 'clothing',
        client: { name: name.trim(), phone: phone.trim(), address: address.trim() || null, notes: notes.trim() || null },
        items: selected.flatMap(s => Array(s.qty).fill(0).map(() => ({
          item_type_id: s.price_row.id,
          item_type_name: s.price_row.name,
          price: s.price_row.default_price,
        }))),
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cleaning-public-order-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Не удалось создать заказ')
      setDoneNumber(json.order_number)
    } catch (e: any) {
      setError(e?.message || 'Ошибка отправки')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render: loading / 404 ──────────────────────────────────────────────────
  if (pLoading || prLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    )
  }
  if (!profile || profile.page_enabled === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-50 px-4">
        <p className="text-2xl">😔</p>
        <p className="text-zinc-600 text-center">Страница временно недоступна</p>
        <Link to="/" className="text-sm text-blue-600 hover:underline">На главную</Link>
      </div>
    )
  }

  // ── Render: success ────────────────────────────────────────────────────────
  if (doneNumber) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 grid place-items-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold">Заказ создан!</h2>
          <p className="text-sm text-zinc-600">Номер заказа: <b>#{doneNumber}</b></p>
          <p className="text-xs text-zinc-500">
            Менеджер свяжется с вами по телефону {phone} в ближайшее время.
          </p>
          <Link
            to={`/p/${profile.booking_slug}`}
            className="inline-block w-full text-center px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
          >
            Вернуться на страницу
          </Link>
        </div>
      </div>
    )
  }

  // ── Render: form ───────────────────────────────────────────────────────────
  const businessName = profile.display_name || 'Cleaning'
  const currency = profile.currency || 'UZS'

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to={`/p/${profile.booking_slug}`} className="p-2 -ml-2 rounded-lg hover:bg-zinc-100">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate">{businessName}</div>
            <div className="text-xs text-zinc-500">Оформление заказа</div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-5 grid lg:grid-cols-[1fr_320px] gap-5">
        {/* ── Левая колонка: выбор позиций ── */}
        <div className="space-y-4">
          {/* Категории */}
          {groups.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {groups.map(g => {
                const Icon = g.icon
                const isActive = g.slug === selectedTypeSlug
                return (
                  <button
                    key={g.slug}
                    onClick={() => setSelectedTypeSlug(g.slug)}
                    className={[
                      'shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition',
                      isActive ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                    ].join(' ')}
                  >
                    <Icon className="w-4 h-4" />
                    {g.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Список позиций */}
          <div className="bg-white rounded-2xl border divide-y">
            {(activeGroup?.items ?? []).length === 0 ? (
              <div className="p-6 text-center text-sm text-zinc-500">
                <Sparkles className="w-6 h-6 mx-auto mb-2 opacity-40" />
                В этой категории пока нет позиций
              </div>
            ) : (
              activeGroup?.items.map(row => {
                const sel = selected.find(s => s.id === row.id)
                return (
                  <div key={row.id} className="flex items-center gap-3 p-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{row.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {formatCurrency(row.default_price, currency)}
                      </div>
                    </div>
                    {sel ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => changeQty(row.id, -1)} className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 grid place-items-center">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center text-sm font-semibold">{sel.qty}</span>
                        <button onClick={() => changeQty(row.id, 1)} className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-700 text-white grid place-items-center">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addItem(row)}
                        className="rounded-full h-8 px-3"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Добавить
                      </Button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── Правая колонка: корзина + контакты ── */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {/* Cart */}
          <div className="bg-white rounded-2xl border p-4">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              Ваш заказ ({selected.reduce((s, i) => s + i.qty, 0)})
            </h3>
            {selected.length === 0 ? (
              <p className="text-xs text-zinc-500">Пока пусто. Добавьте позиции из списка.</p>
            ) : (
              <div className="space-y-2">
                {selected.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{s.price_row.name}</div>
                      <div className="text-xs text-zinc-500">{s.qty} × {formatCurrency(s.price_row.default_price, currency)}</div>
                    </div>
                    <button onClick={() => removeItem(s.id)} className="p-1 text-zinc-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2 flex justify-between text-sm font-bold">
                  <span>Итого:</span>
                  <span>{formatCurrency(total, currency)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Контакты */}
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h3 className="font-bold text-sm">Ваши данные</h3>
            <div className="space-y-1.5">
              <Label className="text-xs">Имя</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иван Иванов" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Phone className="w-3 h-3" /> Телефон
              </Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> Адрес <span className="text-zinc-400">(необязательно)</span>
              </Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="ул. Амира Темура 12, кв. 5"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Комментарий <span className="text-zinc-400">(необязательно)</span></Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Удобное время, пожелания…"
              />
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 rounded-lg p-2 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              loading={submitting}
              disabled={selected.length === 0 || !name.trim() || !phone.trim()}
              onClick={submit}
            >
              Оформить заказ {total > 0 ? `· ${formatCurrency(total, currency)}` : ''}
            </Button>

            <p className="text-[11px] text-zinc-400 text-center">
              Нажимая кнопку, вы соглашаетесь на обработку персональных данных
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
