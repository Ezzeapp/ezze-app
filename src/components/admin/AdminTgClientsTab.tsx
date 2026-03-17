import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Search, Phone, MessageCircle, Calendar, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import dayjs from 'dayjs'

interface TgClient {
  id: string
  tg_chat_id: string
  name: string | null
  phone: string | null
  tg_username: string | null
  created_at: string
}

export function AdminTgClientsTab() {
  const [query, setQuery] = useState('')

  const { data: clients = [], isLoading } = useQuery<TgClient[]>({
    queryKey: ['admin_tg_clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tg_clients')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 30_000,
  })

  const filtered = clients.filter((c) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      (c.name ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q) ||
      (c.tg_username ?? '').toLowerCase().includes(q) ||
      c.tg_chat_id.includes(q)
    )
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Клиенты платформы
          </CardTitle>
          <CardDescription>
            Клиенты, самостоятельно зарегистрировавшиеся через Telegram-бот.
            До первой записи они не привязаны ни к одному мастеру.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Поиск */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по имени, телефону, @username..."
              className="pl-9 pr-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Счётчик */}
          {!isLoading && (
            <p className="text-xs text-muted-foreground">
              {filtered.length} из {clients.length} клиентов
            </p>
          )}

          {/* Список */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {query ? 'Ничего не найдено' : 'Нет зарегистрированных клиентов'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border -mx-6">
              {filtered.map((client) => (
                <div key={client.id} className="flex items-center gap-3 px-6 py-3 hover:bg-muted/30 transition-colors">
                  {/* Аватар-инициалы */}
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-semibold text-primary">
                    {client.name ? client.name.charAt(0).toUpperCase() : '?'}
                  </div>

                  {/* Данные */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-medium leading-tight truncate">
                      {client.name ?? <span className="text-muted-foreground italic">Без имени</span>}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      {client.phone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {client.phone}
                        </span>
                      )}
                      {client.tg_username && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageCircle className="h-3 w-3" />
                          @{client.tg_username}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Мета */}
                  <div className="shrink-0 text-right space-y-1">
                    <Badge variant="secondary" className="text-[10px]">
                      ID: {client.tg_chat_id}
                    </Badge>
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground justify-end">
                      <Calendar className="h-3 w-3" />
                      {dayjs(client.created_at).format('DD.MM.YYYY')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
