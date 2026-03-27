import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Users, Search, Phone, MessageCircle, Calendar,
  X, Edit2, Trash2, ShieldOff, Shield,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/shared/Toaster'
import dayjs from 'dayjs'

// ── Типы ─────────────────────────────────────────────────────────────────────

interface TgClientRow {
  id: string
  tg_chat_id: string
  name: string | null
  phone: string | null
  tg_username: string | null
  tg_name: string | null
  is_blocked: boolean
  created_at: string
}

interface MasterClientRow {
  id: string
  first_name: string
  last_name: string | null
  phone: string | null
  tg_chat_id: string | null
  created_at: string
  master_id: string
}

interface UnifiedClient {
  key: string
  source: 'platform' | 'master'
  platformId?: string
  masterId?: string
  name: string
  phone: string | null
  tgChatId: string | null
  tgUsername: string | null
  tgName: string | null
  masterName: string | null
  isBlocked: boolean
  createdAt: string
}

// ── Компонент ─────────────────────────────────────────────────────────────────

export function AdminTgClientsTab() {
  const qc = useQueryClient()
  const [query, setQuery]             = useState('')
  const [editClient, setEditClient]   = useState<UnifiedClient | null>(null)
  const [editName, setEditName]       = useState('')
  const [editPhone, setEditPhone]     = useState('')
  const [deleteKey, setDeleteKey]     = useState<string | null>(null)
  const [deleteApptCount, setDeleteApptCount] = useState(0)
  const [saving, setSaving]           = useState(false)

  // ── Запросы ──────────────────────────────────────────────────────────────────

  const { data: tgClients = [], isLoading: tgLoading } = useQuery<TgClientRow[]>({
    queryKey: ['admin_tg_clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tg_clients').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 30_000,
  })

  const { data: masterClients = [], isLoading: mcLoading } = useQuery<MasterClientRow[]>({
    queryKey: ['admin_master_clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, first_name, last_name, phone, tg_chat_id, created_at, master_id')
        .order('created_at', { ascending: false })
        .limit(1000)
      if (error) throw error
      return data ?? []
    },
    staleTime: 30_000,
  })

  // Имена мастеров
  const masterIds = useMemo(
    () => [...new Set(masterClients.map(c => c.master_id).filter(Boolean))],
    [masterClients],
  )
  const { data: masterUsers = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['admin_master_users', masterIds.join(',')],
    queryFn: async () => {
      if (!masterIds.length) return []
      const { data } = await supabase.from('users').select('id, name').in('id', masterIds)
      return data ?? []
    },
    enabled: masterIds.length > 0,
    staleTime: 60_000,
  })
  const masterMap = useMemo(
    () => new Map(masterUsers.map(u => [u.id, u.name])),
    [masterUsers],
  )

  // ── Объединённый список ───────────────────────────────────────────────────────

  const unified = useMemo<UnifiedClient[]>(() => {
    const enrichedMaster = masterClients.map(mc => ({
      ...mc,
      name: [mc.first_name, mc.last_name].filter(Boolean).join(' ') || '—',
      masterName: masterMap.get(mc.master_id) ?? null,
    }))

    // Телефоны и chat_id уже охваченных tg_clients
    const tgPhones  = new Set(tgClients.map(c => c.phone).filter(Boolean))
    const tgChatIds = new Set(tgClients.map(c => c.tg_chat_id).filter(Boolean))

    // Клиенты мастеров, которых НЕТ в tg_clients
    const unmatchedMaster = enrichedMaster.filter(mc =>
      !(mc.phone     && tgPhones.has(mc.phone)) &&
      !(mc.tg_chat_id && tgChatIds.has(mc.tg_chat_id)),
    )

    const platformEntries: UnifiedClient[] = tgClients.map(tc => {
      // Проверяем, есть ли у него запись к мастеру (по телефону или tg_chat_id)
      const matched = enrichedMaster.find(mc =>
        (tc.phone     && mc.phone      === tc.phone) ||
        (tc.tg_chat_id && mc.tg_chat_id === tc.tg_chat_id),
      )
      return {
        key:        `tg_${tc.id}`,
        source:     'platform',
        platformId: tc.id,
        name:       tc.name ?? '—',
        phone:      tc.phone,
        tgChatId:   tc.tg_chat_id,
        tgUsername: tc.tg_username,
        tgName:     tc.tg_name ?? null,
        masterName: matched?.masterName ?? null,
        isBlocked:  tc.is_blocked,
        createdAt:  tc.created_at,
      }
    })

    const masterEntries: UnifiedClient[] = unmatchedMaster.map(mc => ({
      key:        `mc_${mc.id}`,
      source:     'master',
      masterId:   mc.id,
      name:       mc.name,
      phone:      mc.phone,
      tgChatId:   mc.tg_chat_id,
      tgUsername: null,
      tgName:     null,
      masterName: mc.masterName,
      isBlocked:  false,
      createdAt:  mc.created_at,
    }))

    return [...platformEntries, ...masterEntries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [tgClients, masterClients, masterMap])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return unified
    return unified.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone       ?? '').includes(q) ||
      (c.tgUsername  ?? '').toLowerCase().includes(q) ||
      (c.tgChatId    ?? '').includes(q) ||
      (c.masterName  ?? '').toLowerCase().includes(q),
    )
  }, [unified, query])

  const isLoading = tgLoading || mcLoading

  // ── Действия ─────────────────────────────────────────────────────────────────

  const openEdit = (client: UnifiedClient) => {
    setEditClient(client)
    setEditName(client.name === '—' ? '' : client.name)
    setEditPhone(client.phone ?? '')
  }

  const saveEdit = async () => {
    if (!editClient) return
    setSaving(true)
    try {
      if (editClient.source === 'platform' && editClient.platformId) {
        const { error } = await supabase.from('tg_clients').update({
          name:       editName.trim() || null,
          phone:      editPhone.trim() || null,
          updated_at: new Date().toISOString(),
        }).eq('id', editClient.platformId)
        if (error) throw error
        qc.invalidateQueries({ queryKey: ['admin_tg_clients'] })
      } else if (editClient.source === 'master' && editClient.masterId) {
        const parts = editName.trim().split(/\s+/)
        const { error } = await supabase.from('clients').update({
          first_name: parts[0] ?? '',
          last_name:  parts.slice(1).join(' ') || null,
          phone:      editPhone.trim() || null,
        }).eq('id', editClient.masterId)
        if (error) throw error
        qc.invalidateQueries({ queryKey: ['admin_master_clients'] })
      }
      toast.success('Сохранено')
      setEditClient(null)
    } catch {
      toast.error('Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  const toggleBlock = async (client: UnifiedClient) => {
    if (client.source !== 'platform' || !client.platformId) return
    try {
      const { error } = await supabase.from('tg_clients').update({
        is_blocked: !client.isBlocked,
        updated_at: new Date().toISOString(),
      }).eq('id', client.platformId)
      if (error) throw error
      toast.success(client.isBlocked ? 'Клиент разблокирован' : 'Клиент заблокирован')
      qc.invalidateQueries({ queryKey: ['admin_tg_clients'] })
    } catch {
      toast.error('Ошибка')
    }
  }

  const openDeleteConfirm = async (client: UnifiedClient) => {
    // Проверяем кол-во записей (только для клиентов мастера)
    let apptCount = 0
    if (client.source === 'master' && client.masterId) {
      const { count } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', client.masterId)
      apptCount = count ?? 0
    }
    setDeleteApptCount(apptCount)
    setDeleteKey(client.key)
  }

  const handleDelete = async () => {
    if (!deleteKey) return
    const client = unified.find(c => c.key === deleteKey)
    if (!client) return
    try {
      if (client.source === 'platform' && client.platformId) {
        const { error, count } = await supabase
          .from('tg_clients').delete({ count: 'exact' }).eq('id', client.platformId)
        if (error) throw error
        if ((count ?? 0) === 0) throw new Error('Нет доступа или клиент не найден')
        qc.invalidateQueries({ queryKey: ['admin_tg_clients'] })
      } else if (client.source === 'master' && client.masterId) {
        const { error, count } = await supabase
          .from('clients').delete({ count: 'exact' }).eq('id', client.masterId)
        if (error) throw error
        if ((count ?? 0) === 0) throw new Error('Нет доступа или клиент не найден')
        qc.invalidateQueries({ queryKey: ['admin_master_clients'] })
      }

      // Уведомляем клиента в Telegram (если привязан)
      if (client.tgChatId) {
        await supabase.functions.invoke('telegram-notifications', {
          body: { type: 'CLIENT_DELETED', tg_chat_id: client.tgChatId },
        }).catch(() => { /* не блокируем если уведомление не дошло */ })
      }

      toast.success('Клиент удалён')
    } catch (e: any) {
      toast.error(e?.message ?? 'Ошибка при удалении')
    }
    setDeleteKey(null)
  }

  // ── Рендер ───────────────────────────────────────────────────────────────────

  const deleteTarget = deleteKey ? unified.find(c => c.key === deleteKey) : null

  return (
    <div className="space-y-4">

      {/* ── Модалка редактирования ─────────────────────────────────────────── */}
      {editClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditClient(null)}>
          <div className="bg-background rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Редактировать клиента</h3>
              <button onClick={() => setEditClient(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Имя</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Имя клиента" />
              </div>
              <div className="space-y-1.5">
                <Label>Телефон</Label>
                <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+7..." />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditClient(null)}>Отмена</Button>
              <Button className="flex-1" onClick={saveEdit} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Подтверждение удаления ─────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteKey(null)}>
          <div className="bg-background rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold">Удалить клиента?</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong className="text-foreground">{deleteTarget.name}</strong> будет удалён безвозвратно.</p>
              {deleteApptCount > 0 && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-amber-800 dark:text-amber-300 text-xs">
                  ⚠️ У клиента <strong>{deleteApptCount}</strong> {deleteApptCount === 1 ? 'запись' : deleteApptCount < 5 ? 'записи' : 'записей'}.
                  Сами записи сохранятся, но потеряют привязку к клиенту.
                </div>
              )}
              {deleteTarget.source === 'platform' && (
                <p className="text-xs">Данные из Telegram-бота будут удалены. Клиент сможет зарегистрироваться заново.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteKey(null)}>Отмена</Button>
              <Button variant="destructive" className="flex-1" onClick={handleDelete}>Удалить</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Основная карточка ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Все клиенты платформы
          </CardTitle>
          <CardDescription>
            Клиенты без мастера (зарегистрированы в боте) и клиенты мастеров. Зелёный значок — привязан к мастеру.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Поиск */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Имя, телефон, @username, мастер..."
              className="pl-9 pr-9"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Счётчик */}
          {!isLoading && (
            <p className="text-xs text-muted-foreground">
              {filtered.length} из {unified.length} клиентов
              <span className="ml-3 text-muted-foreground/60">
                ({tgClients.length} в боте · {masterClients.length} у мастеров)
              </span>
            </p>
          )}

          {/* Список */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {query ? 'Ничего не найдено' : 'Нет клиентов'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border -mx-6">
              {filtered.map(client => (
                <div
                  key={client.key}
                  className={cn(
                    'flex items-center gap-3 px-6 py-3 transition-colors',
                    client.isBlocked ? 'opacity-50' : 'hover:bg-muted/20',
                  )}
                >
                  {/* Аватар */}
                  <div className={cn(
                    'h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold',
                    client.isBlocked
                      ? 'bg-muted text-muted-foreground'
                      : client.source === 'platform'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                  )}>
                    {client.name && client.name !== '—' ? client.name.charAt(0).toUpperCase() : '?'}
                  </div>

                  {/* Информация */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium leading-tight truncate">{client.name}</p>
                      {client.isBlocked && (
                        <Badge variant="destructive" className="text-[9px] px-1 py-0 leading-tight">Заблокирован</Badge>
                      )}
                      {client.masterName ? (
                        <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10">
                          {client.masterName}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground">
                          Без мастера
                        </Badge>
                      )}
                    </div>
                    {/* Telegram-имя профиля (если отличается от введённого) */}
                    {client.tgName && client.tgName.toLowerCase() !== client.name.toLowerCase() && (
                      <p className="text-[11px] text-muted-foreground/70 truncate leading-tight">
                        TG: {client.tgName}
                      </p>
                    )}
                    <div className="flex items-center gap-3 flex-wrap">
                      {client.phone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />{client.phone}
                        </span>
                      )}
                      {client.tgUsername && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageCircle className="h-3 w-3" />@{client.tgUsername}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                        <Calendar className="h-3 w-3" />
                        {dayjs(client.createdAt).format('DD.MM.YY')}
                      </span>
                    </div>
                  </div>

                  {/* Кнопки действий */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* Редактировать */}
                    <button
                      onClick={() => openEdit(client)}
                      title="Редактировать"
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    {/* Блокировка — только для платформенных клиентов */}
                    {client.source === 'platform' ? (
                      <button
                        onClick={() => toggleBlock(client)}
                        title={client.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                        className={cn(
                          'h-8 w-8 flex items-center justify-center rounded-lg transition-colors',
                          client.isBlocked
                            ? 'text-destructive hover:bg-destructive/10'
                            : 'text-muted-foreground hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20',
                        )}
                      >
                        {client.isBlocked
                          ? <Shield className="h-3.5 w-3.5" />
                          : <ShieldOff className="h-3.5 w-3.5" />
                        }
                      </button>
                    ) : (
                      /* Пустое место для выравнивания */
                      <div className="h-8 w-8" />
                    )}

                    {/* Удалить */}
                    <button
                      onClick={() => openDeleteConfirm(client)}
                      title="Удалить"
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
