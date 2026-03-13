import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Shield, ShieldOff, Search, Download, Users, TrendingUp, UserCheck2, Ban, Trash2, AlertTriangle, CheckSquare, Lock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useUsers, useToggleUserAdmin, useUpdateUserPlan, useToggleUserDisabled, useDeleteUser } from '@/hooks/useUsers'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from '@/components/shared/Toaster'
import { PLAN_LABELS, PLAN_COLORS, PLAN_ORDER, type FeaturePlan } from '@/config/features'
import { getFileUrl } from '@/lib/utils'
import dayjs from 'dayjs'

interface DeleteTarget {
  id: string
  name: string
  email: string
}

export function AdminUsersTab() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const { data: users, isLoading } = useUsers()
  const toggleAdmin = useToggleUserAdmin()
  const updatePlan = useUpdateUserPlan()
  const toggleDisabled = useToggleUserDisabled()
  const deleteUser = useDeleteUser()
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<FeaturePlan | 'all'>('all')
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const handleToggleAdmin = async (userId: string, currentIsAdmin: boolean) => {
    try {
      await toggleAdmin.mutateAsync({ id: userId, currentValue: currentIsAdmin })
      toast.success(currentIsAdmin ? t('admin.removeAdminSuccess') : t('admin.makeAdminSuccess'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const handlePlanChange = async (userId: string, plan: FeaturePlan) => {
    try {
      await updatePlan.mutateAsync({ id: userId, plan })
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const handleToggleDisabled = async (userId: string, currentDisabled: boolean) => {
    try {
      await toggleDisabled.mutateAsync({ id: userId, currentValue: currentDisabled })
      toast.success(currentDisabled ? t('admin.userEnabled') : t('admin.userDisabled'))
    } catch {
      toast.error(t('common.saveError'))
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteUser.mutateAsync(deleteTarget.id)
      setSelectedIds(prev => { const next = new Set(prev); next.delete(deleteTarget.id); return next })
      toast.success(t('admin.userDeleted'))
      setDeleteTarget(null)
    } catch {
      toast.error(t('admin.deleteError'))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    setBulkDeleting(true)
    let succeeded = 0
    let failed = 0
    for (const id of selectedIds) {
      if (id === currentUser?.id) continue
      try {
        await deleteUser.mutateAsync(id)
        succeeded++
      } catch {
        failed++
      }
    }
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
    setSelectedIds(new Set())
    if (succeeded > 0) toast.success(t('admin.deletedCount', { count: succeeded }))
    if (failed > 0) toast.error(t('admin.deleteFailedCount', { count: failed }))
  }

  const getAvatarUrl = (u: any) => {
    if (!u.avatar) return ''
    return getFileUrl('avatars', u.avatar)
  }

  const getInitials = (name: string) => {
    return (name || '?')
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const stats = useMemo(() => {
    const all = users ?? []
    const thisMonth = dayjs().startOf('month')
    return {
      total: all.length,
      newThisMonth: all.filter(u => dayjs((u as any).created_at).isAfter(thisMonth)).length,
      disabled: all.filter(u => !!(u as any).disabled).length,
      byPlan: PLAN_ORDER.reduce<Record<string, number>>((acc, p) => {
        acc[p] = all.filter(u => ((u as any).plan || 'free') === p).length
        return acc
      }, {}),
    }
  }, [users])

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (users ?? []).filter(u => {
      const matchSearch = !q ||
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      const matchPlan = planFilter === 'all' || ((u as any).plan || 'free') === planFilter
      return matchSearch && matchPlan
    })
  }, [users, search, planFilter])

  const selectableFiltered = useMemo(
    () => filteredUsers.filter(u => u.id !== currentUser?.id),
    [filteredUsers, currentUser],
  )
  const allFilteredSelected =
    selectableFiltered.length > 0 && selectableFiltered.every(u => selectedIds.has(u.id))
  const someSelected = selectedIds.size > 0

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        selectableFiltered.forEach(u => next.delete(u.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        selectableFiltered.forEach(u => next.add(u.id))
        return next
      })
    }
  }

  const exportCSV = () => {
    const all = users ?? []
    if (!all.length) return
    const headers = [t('admin.csvName'), t('admin.csvEmail'), t('admin.csvPlan'), t('admin.csvAdmin'), t('admin.csvDisabled'), t('admin.csvDate')]
    const rows = all.map(u => [
      u.name || '',
      u.email || '',
      (u as any).plan || 'free',
      (u as any).is_admin ? t('admin.csvYes') : t('admin.csvNo'),
      (u as any).disabled ? t('admin.csvYes') : t('admin.csvNo'),
      (u as any).created_at ? dayjs((u as any).created_at).format('DD.MM.YYYY') : '',
    ])
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `users_${dayjs().format('YYYY-MM-DD')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('admin.exportDone'))
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
        <Skeleton className="h-9 w-full rounded-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 rounded-lg" />
        ))}
      </div>
    )
  }

  const PlanSelect = ({ userId, userPlan, isPending, onPlanChange, className = '' }: {
    userId: string; userPlan: FeaturePlan; isPending: boolean
    onPlanChange: (id: string, plan: FeaturePlan) => void; className?: string
  }) => (
    <Select value={userPlan} onValueChange={(v) => onPlanChange(userId, v as FeaturePlan)} disabled={isPending}>
      <SelectTrigger className={`w-[88px] h-7 text-xs shrink-0 ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PLAN_ORDER.map((plan) => (
          <SelectItem key={plan} value={plan} className="text-xs">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${PLAN_COLORS[plan]}`}>
              {PLAN_LABELS[plan]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-3">

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl border bg-card p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">{t('admin.statsTotal')}</span>
          </div>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-medium text-muted-foreground">{t('admin.statsNewMonth')}</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">+{stats.newThisMonth}</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <UserCheck2 className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-medium text-muted-foreground">{t('admin.statsPaid')}</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {(stats.byPlan['pro'] || 0) + (stats.byPlan['enterprise'] || 0)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Ban className="h-4 w-4 text-destructive" />
            <span className="text-xs font-medium text-muted-foreground">{t('admin.statsDisabled')}</span>
          </div>
          <p className="text-2xl font-bold text-destructive">{stats.disabled}</p>
        </div>
      </div>

      {/* Search + Export */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t('admin.searchUsers')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={exportCSV} title={t('admin.exportCSV')} className="shrink-0 h-9 w-9">
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Plan filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {(['all', ...PLAN_ORDER] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPlanFilter(p)}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors border ${
              planFilter === p
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
            }`}
          >
            {p === 'all' ? `${t('common.all')} (${stats.total})` : `${PLAN_LABELS[p]} (${stats.byPlan[p] || 0})`}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium">
              {t('admin.selectedCount', { count: selectedIds.size })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
            >
              {t('admin.deselect')}
            </button>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('admin.deleteSelected', { count: selectedIds.size })}
            </Button>
          </div>
        </div>
      )}

      {/* Column headers — desktop only */}
      {filteredUsers.length > 0 && (
        <div className="hidden sm:flex items-center gap-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          <Checkbox
            checked={allFilteredSelected}
            onCheckedChange={toggleSelectAll}
            className="h-3.5 w-3.5 shrink-0"
            aria-label={t('admin.selectAll')}
          />
          <div className="w-8 shrink-0" />
          <div className="flex-1 min-w-0">{t('admin.colUser')}</div>
          <div className="w-[88px] shrink-0 text-center">{t('admin.colPlan')}</div>
          <div className="w-16 shrink-0 text-center">{t('admin.colAdmin')}</div>
          <div className="w-16 shrink-0 text-center">{t('admin.colStatus')}</div>
          <div className="w-8 shrink-0" />
        </div>
      )}

      {/* User rows */}
      {filteredUsers.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">
          {search || planFilter !== 'all' ? t('admin.usersNotFound') : t('admin.usersEmpty')}
        </p>
      ) : (
        <div className="space-y-1">
          {filteredUsers.map((u) => {
            const isSelf = u.id === currentUser?.id
            const isAdmin = !!(u as any).is_admin
            const isDisabled = !!(u as any).disabled
            const userPlan: FeaturePlan = ((u as any).plan as FeaturePlan) || 'free'

            return (
              <div
                key={u.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                  selectedIds.has(u.id)
                    ? 'border-primary/40 bg-primary/5'
                    : isDisabled
                    ? 'border-destructive/30 bg-destructive/5 opacity-70'
                    : 'bg-background hover:border-primary/30'
                }`}
              >
                {/* Checkbox */}
                {!isSelf && !isAdmin ? (
                  <Checkbox
                    checked={selectedIds.has(u.id)}
                    onCheckedChange={() => toggleSelect(u.id)}
                    className="shrink-0 self-start mt-1.5"
                    aria-label={t('admin.selectUser', { name: u.name || u.email })}
                  />
                ) : (
                  <div className="w-4 shrink-0" />
                )}

                {/* Avatar */}
                <Avatar className="h-8 w-8 shrink-0 self-start mt-0.5">
                  <AvatarImage src={getAvatarUrl(u)} alt={u.name} />
                  <AvatarFallback className="text-xs font-medium">
                    {getInitials(u.name || u.email)}
                  </AvatarFallback>
                </Avatar>

                {/* Name + email + date — mobile also shows controls below */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate leading-tight">
                      {u.name || '—'}
                    </span>
                    {isSelf && (
                      <span className="text-xs text-muted-foreground shrink-0">({t('admin.youLabel')})</span>
                    )}
                    {isDisabled && (
                      <Ban className="h-3 w-3 text-destructive shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate leading-tight">
                    {u.email} · {dayjs((u as any).created_at).format('DD.MM.YYYY')}
                  </p>

                  {/* Mobile controls row */}
                  <div className="flex items-center gap-2 mt-1.5 sm:hidden">
                    <PlanSelect userId={u.id} userPlan={userPlan} isPending={updatePlan.isPending} onPlanChange={handlePlanChange} />
                    <div className="ml-auto flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={isAdmin}
                          disabled={isSelf || isAdmin || toggleAdmin.isPending}
                          onCheckedChange={() => handleToggleAdmin(u.id, isAdmin)}
                        />
                        {isAdmin
                          ? <Shield className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          : <ShieldOff className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                        }
                      </div>
                      {!isSelf && !isAdmin && (
                        <Switch
                          checked={!isDisabled}
                          disabled={toggleDisabled.isPending}
                          onCheckedChange={() => handleToggleDisabled(u.id, isDisabled)}
                        />
                      )}
                      {!isSelf && (
                        isAdmin
                          ? <Lock className="h-3.5 w-3.5 text-amber-500/50 shrink-0" aria-label={t('admin.cannotDeleteAdmin')} />
                          : <button
                              onClick={() => setDeleteTarget({ id: u.id, name: u.name || '—', email: u.email || '' })}
                              disabled={deleteUser.isPending}
                              title={t('admin.deleteUserAction')}
                              className="p-1 rounded transition-colors text-muted-foreground/40 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Desktop controls */}
                <PlanSelect userId={u.id} userPlan={userPlan} isPending={updatePlan.isPending} onPlanChange={handlePlanChange} className="hidden sm:flex" />

                <div className="hidden sm:flex w-16 items-center justify-center gap-1 shrink-0">
                  <Switch
                    checked={isAdmin}
                    disabled={isSelf || isAdmin || toggleAdmin.isPending}
                    onCheckedChange={() => handleToggleAdmin(u.id, isAdmin)}
                    title={isSelf ? t('admin.cannotSelf') : isAdmin ? t('admin.cannotRemoveAdmin') : t('admin.makeAdmin')}
                  />
                  {isAdmin
                    ? <Shield className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    : <ShieldOff className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  }
                </div>

                <div className="hidden sm:flex w-16 items-center justify-center shrink-0">
                  {isSelf || isAdmin ? (
                    <span className="text-[10px] text-muted-foreground/40">—</span>
                  ) : (
                    <Switch
                      checked={!isDisabled}
                      disabled={toggleDisabled.isPending}
                      onCheckedChange={() => handleToggleDisabled(u.id, isDisabled)}
                      title={isDisabled ? t('admin.enableUser') : t('admin.userDisabled')}
                    />
                  )}
                </div>

                {/* Delete button — desktop */}
                <div className="hidden sm:flex w-8 items-center justify-center shrink-0">
                  {isSelf ? null : isAdmin ? (
                    <Lock className="h-4 w-4 text-amber-500/40" aria-label={t('admin.cannotDeleteAdmin')} />
                  ) : (
                    <button
                      onClick={() => setDeleteTarget({ id: u.id, name: u.name || '—', email: u.email || '' })}
                      disabled={deleteUser.isPending}
                      title={t('admin.deleteUserAction')}
                      className="p-1.5 rounded-md transition-colors text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bulk delete confirmation modal */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(open) => { if (!open) setBulkDeleteOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {t('admin.bulkDeleteTitle', { count: selectedIds.size })}
            </DialogTitle>
            <DialogDescription className="pt-1 space-y-1">
              <span className="block">
                {t('admin.bulkDeleteDesc', { count: selectedIds.size })}
              </span>
              <span className="block pt-1 text-xs text-destructive/80">
                {t('admin.deleteIrreversible')}
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setBulkDeleteOpen(false)}
              disabled={bulkDeleting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? t('admin.deleting') : t('admin.deleteSelected', { count: selectedIds.size })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {t('admin.deleteUserTitle')}
            </DialogTitle>
            <DialogDescription className="pt-1 space-y-1">
              <span className="block">
                {t('admin.deleteUserDesc')}
              </span>
              <span className="block font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              <span className="block text-xs text-muted-foreground">
                {deleteTarget?.email}
              </span>
              <span className="block pt-1 text-xs text-destructive/80">
                {t('admin.deleteUserDetails')}
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteUser.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? t('admin.deleting') : t('admin.deleteUserAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
