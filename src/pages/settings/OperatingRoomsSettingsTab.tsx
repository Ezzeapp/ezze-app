import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClinicOperatingRooms, useCreateOperatingRoom, useUpdateOperatingRoom, useDeleteOperatingRoom } from '@/hooks/useClinicSurgeries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { toast } from '@/components/shared/Toaster'
import { Plus, Pencil, Trash2, Syringe, Save } from 'lucide-react'
import type { ClinicOperatingRoom } from '@/types'

export function OperatingRoomsSettingsTab() {
  const { t } = useTranslation()
  const { data: rooms = [], isLoading } = useClinicOperatingRooms()
  const create = useCreateOperatingRoom()
  const update = useUpdateOperatingRoom()
  const remove = useDeleteOperatingRoom()

  const [editing, setEditing] = useState<{ id?: string; name: string; equipment_notes: string; status: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleSave = async () => {
    if (!editing || !editing.name.trim()) return
    try {
      if (editing.id) {
        await update.mutateAsync({ id: editing.id, name: editing.name.trim(), equipment_notes: editing.equipment_notes || null, status: editing.status as any })
      } else {
        await create.mutateAsync({ name: editing.name.trim(), equipment_notes: editing.equipment_notes || null })
      }
      toast.success(t('common.saved'))
      setEditing(null)
    } catch { toast.error(t('common.saveError')) }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting)
      toast.success(t('common.deleted'))
      setDeleting(null)
    } catch { toast.error(t('common.saveError')) }
  }

  const STATUS_COLORS: Record<string, string> = { available: 'default', in_use: 'secondary', maintenance: 'outline' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('clinic.surgery.operatingRooms')}</h3>
        <Button size="sm" className="gap-1.5" onClick={() => setEditing({ name: '', equipment_notes: '', status: 'available' })}>
          <Plus className="h-3.5 w-3.5" />{t('clinic.surgery.addOR')}
        </Button>
      </div>

      {!isLoading && rooms.length === 0 && (
        <EmptyState icon={Syringe} title={t('clinic.surgery.operatingRooms')} description={t('clinic.surgery.noSurgeriesDesc')} />
      )}

      <div className="space-y-2">
        {rooms.map(room => (
          <Card key={room.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{room.name}</p>
                <div className="flex gap-2 mt-0.5">
                  <Badge variant={STATUS_COLORS[room.status] as any} className="text-xs">{t(`clinic.surgery.orStatus.${room.status}`)}</Badge>
                  {room.equipment_notes && <span className="text-xs text-muted-foreground">{room.equipment_notes}</span>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing({ id: room.id, name: room.name, equipment_notes: room.equipment_notes || '', status: room.status })}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleting(room.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{editing.id ? t('clinic.surgery.operatingRooms') : t('clinic.surgery.addOR')}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t('clinic.surgery.orName')}</Label>
                <Input className="h-9 mt-1" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">{t('clinic.surgery.equipment')}</Label>
                <Input className="h-9 mt-1" value={editing.equipment_notes} onChange={e => setEditing({ ...editing, equipment_notes: e.target.value })} />
              </div>
              {editing.id && (
                <div>
                  <Label className="text-xs">{t('clinic.ward.bedStatus')}</Label>
                  <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v })}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">{t('clinic.surgery.orStatus.available')}</SelectItem>
                      <SelectItem value="in_use">{t('clinic.surgery.orStatus.in_use')}</SelectItem>
                      <SelectItem value="maintenance">{t('clinic.surgery.orStatus.maintenance')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
              <Button disabled={!editing.name.trim()} onClick={handleSave} className="gap-1.5"><Save className="h-3.5 w-3.5" />{t('common.save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deleting && <ConfirmDialog open title={t('common.delete')} description={t('common.deleteConfirm')} onConfirm={handleDelete} onClose={() => setDeleting(null)} />}
    </div>
  )
}
