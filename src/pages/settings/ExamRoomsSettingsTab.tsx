import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClinicExamRooms, useCreateExamRoom, useUpdateExamRoom, useDeleteExamRoom } from '@/hooks/useClinicExamRooms'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { toast } from '@/components/shared/Toaster'
import { Plus, Pencil, Trash2, DoorOpen, Save } from 'lucide-react'
import type { ClinicExamRoom } from '@/types'

export function ExamRoomsSettingsTab() {
  const { t } = useTranslation()
  const { data: rooms = [], isLoading } = useClinicExamRooms()
  const create = useCreateExamRoom()
  const update = useUpdateExamRoom()
  const remove = useDeleteExamRoom()

  const [editing, setEditing] = useState<{ id?: string; name: string; floor: string; notes: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleSave = async () => {
    if (!editing || !editing.name.trim()) return
    try {
      const floorNum = editing.floor.trim() ? parseInt(editing.floor, 10) : null
      if (editing.id) {
        await update.mutateAsync({ id: editing.id, name: editing.name.trim(), floor: floorNum, notes: editing.notes.trim() || null })
      } else {
        await create.mutateAsync({ name: editing.name.trim(), floor: floorNum, notes: editing.notes.trim() || null })
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('clinic.ward.examRoom')}</h3>
        <Button size="sm" className="gap-1.5" onClick={() => setEditing({ name: '', floor: '', notes: '' })}>
          <Plus className="h-3.5 w-3.5" />{t('clinic.ward.addExamRoom')}
        </Button>
      </div>

      {!isLoading && rooms.length === 0 && (
        <EmptyState icon={DoorOpen} title={t('clinic.ward.noExamRooms')} description={t('clinic.ward.noExamRoomsDesc')} />
      )}

      <div className="space-y-2">
        {rooms.map(room => (
          <Card key={room.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{room.name}</p>
                <div className="flex gap-2 mt-0.5">
                  {room.floor != null && <span className="text-xs text-muted-foreground">{t('clinic.ward.floor')}: {room.floor}</span>}
                  {room.notes && <span className="text-xs text-muted-foreground">{room.notes}</span>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing({ id: room.id, name: room.name, floor: room.floor != null ? String(room.floor) : '', notes: room.notes || '' })}>
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
            <DialogHeader><DialogTitle>{editing.id ? t('clinic.ward.examRoom') : t('clinic.ward.addExamRoom')}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t('common.name')}</Label>
                <Input className="h-9 mt-1" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">{t('clinic.ward.floor')}</Label>
                <Input className="h-9 mt-1" type="number" value={editing.floor} onChange={e => setEditing({ ...editing, floor: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">{t('common.notes')}</Label>
                <Input className="h-9 mt-1" value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} />
              </div>
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
