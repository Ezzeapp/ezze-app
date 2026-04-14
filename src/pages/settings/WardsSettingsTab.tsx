import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClinicWards, useCreateWard, useUpdateWard, useDeleteWard, useCreateRoom, useDeleteRoom, useCreateBed, useDeleteBed } from '@/hooks/useClinicWards'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { toast } from '@/components/shared/Toaster'
import { Plus, Trash2, BedDouble, ChevronDown, ChevronRight, Save } from 'lucide-react'
import type { WardType } from '@/types'

const WARD_TYPES: WardType[] = ['therapeutic', 'surgical', 'intensive', 'pediatric', 'maternity', 'other']

export function WardsSettingsTab() {
  const { t } = useTranslation()
  const { data: wards = [], isLoading } = useClinicWards()
  const createWard = useCreateWard()
  const deleteWard = useDeleteWard()
  const createRoom = useCreateRoom()
  const deleteRoom = useDeleteRoom()
  const createBed = useCreateBed()
  const deleteBed = useDeleteBed()

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [addingWard, setAddingWard] = useState(false)
  const [wardForm, setWardForm] = useState({ name: '', ward_type: 'therapeutic' as WardType, floor: '' })
  const [addingRoom, setAddingRoom] = useState<string | null>(null)
  const [roomName, setRoomName] = useState('')
  const [addingBed, setAddingBed] = useState<string | null>(null)
  const [bedNumber, setBedNumber] = useState('')
  const [deleting, setDeleting] = useState<{ type: 'ward' | 'room' | 'bed'; id: string } | null>(null)

  const toggle = (id: string) => {
    const next = new Set(expanded)
    next.has(id) ? next.delete(id) : next.add(id)
    setExpanded(next)
  }

  const handleCreateWard = async () => {
    if (!wardForm.name.trim()) return
    try {
      await createWard.mutateAsync({
        name: wardForm.name.trim(),
        ward_type: wardForm.ward_type,
        floor: wardForm.floor ? Number(wardForm.floor) : null,
      })
      toast.success(t('common.saved'))
      setAddingWard(false)
      setWardForm({ name: '', ward_type: 'therapeutic', floor: '' })
    } catch { toast.error(t('common.saveError')) }
  }

  const handleCreateRoom = async (wardId: string) => {
    if (!roomName.trim()) return
    try {
      await createRoom.mutateAsync({ ward_id: wardId, name: roomName.trim() })
      toast.success(t('common.saved'))
      setAddingRoom(null)
      setRoomName('')
    } catch { toast.error(t('common.saveError')) }
  }

  const handleCreateBed = async (roomId: string) => {
    if (!bedNumber.trim()) return
    try {
      await createBed.mutateAsync({ room_id: roomId, number: bedNumber.trim() })
      toast.success(t('common.saved'))
      setAddingBed(null)
      setBedNumber('')
    } catch { toast.error(t('common.saveError')) }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      if (deleting.type === 'ward') await deleteWard.mutateAsync(deleting.id)
      else if (deleting.type === 'room') await deleteRoom.mutateAsync(deleting.id)
      else await deleteBed.mutateAsync(deleting.id)
      toast.success(t('common.deleted'))
      setDeleting(null)
    } catch { toast.error(t('common.saveError')) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('clinic.ward.wards')}</h3>
        <Button size="sm" className="gap-1.5" onClick={() => setAddingWard(true)}>
          <Plus className="h-3.5 w-3.5" />
          {t('clinic.ward.addWard')}
        </Button>
      </div>

      {!isLoading && wards.length === 0 && (
        <EmptyState icon={BedDouble} title={t('clinic.ward.noWards')} description={t('clinic.ward.noWardsDesc')} />
      )}

      {wards.map(ward => {
        const isExpanded = expanded.has(ward.id)
        const totalBeds = ward.rooms?.reduce((sum, r) => sum + (r.beds?.length ?? 0), 0) ?? 0
        const occupiedBeds = ward.rooms?.reduce((sum, r) => sum + (r.beds?.filter(b => b.status === 'occupied').length ?? 0), 0) ?? 0

        return (
          <Card key={ward.id}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => toggle(ward.id)}>
                <div className="flex items-center gap-2 min-w-0">
                  {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <div>
                    <p className="font-medium text-sm">{ward.name}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">{t(`clinic.ward.types.${ward.ward_type}`)}</Badge>
                      <span>{occupiedBeds}/{totalBeds} {t('clinic.ward.beds').toLowerCase()}</span>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); setDeleting({ type: 'ward', id: ward.id }) }}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>

              {isExpanded && (
                <div className="mt-3 ml-6 space-y-2">
                  {ward.rooms?.map(room => (
                    <div key={room.id} className="border rounded-lg p-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{room.name}</p>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setAddingBed(room.id); setBedNumber('') }}>
                            <Plus className="h-3 w-3 mr-1" />{t('clinic.ward.addBed')}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeleting({ type: 'room', id: room.id })}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {room.beds?.map(bed => (
                          <div
                            key={bed.id}
                            className={`w-8 h-8 rounded flex items-center justify-center text-xs font-medium border cursor-pointer ${
                              bed.status === 'free' ? 'bg-green-100 border-green-300 text-green-700' :
                              bed.status === 'occupied' ? 'bg-red-100 border-red-300 text-red-700' :
                              'bg-gray-100 border-gray-300 text-gray-500'
                            }`}
                            title={`${bed.number} — ${t(`clinic.ward.${bed.status}`)}`}
                            onClick={() => setDeleting({ type: 'bed', id: bed.id })}
                          >
                            {bed.number}
                          </div>
                        ))}
                      </div>
                      {addingBed === room.id && (
                        <div className="flex gap-2 mt-2">
                          <Input className="h-7 text-xs flex-1" placeholder={t('clinic.ward.bedNumber')} value={bedNumber} onChange={e => setBedNumber(e.target.value)} />
                          <Button size="sm" className="h-7 text-xs" onClick={() => handleCreateBed(room.id)}>{t('common.save')}</Button>
                        </div>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setAddingRoom(ward.id); setRoomName('') }}>
                    <Plus className="h-3 w-3" />{t('clinic.ward.addRoom')}
                  </Button>
                  {addingRoom === ward.id && (
                    <div className="flex gap-2">
                      <Input className="h-7 text-xs flex-1" placeholder={t('clinic.ward.roomName')} value={roomName} onChange={e => setRoomName(e.target.value)} />
                      <Button size="sm" className="h-7 text-xs" onClick={() => handleCreateRoom(ward.id)}>{t('common.save')}</Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      {addingWard && (
        <Dialog open onOpenChange={() => setAddingWard(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{t('clinic.ward.addWard')}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t('clinic.ward.wardName')}</Label>
                <Input className="h-9 mt-1" value={wardForm.name} onChange={e => setWardForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">{t('clinic.ward.wardType')}</Label>
                <Select value={wardForm.ward_type} onValueChange={v => setWardForm(f => ({ ...f, ward_type: v as WardType }))}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WARD_TYPES.map(wt => <SelectItem key={wt} value={wt}>{t(`clinic.ward.types.${wt}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t('clinic.ward.floor')}</Label>
                <Input type="number" className="h-9 mt-1" value={wardForm.floor} onChange={e => setWardForm(f => ({ ...f, floor: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddingWard(false)}>{t('common.cancel')}</Button>
              <Button disabled={!wardForm.name.trim()} onClick={handleCreateWard} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />{t('common.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deleting && (
        <ConfirmDialog open title={t('common.delete')} description={t('common.deleteConfirm')} onConfirm={handleDelete} onClose={() => setDeleting(null)} />
      )}
    </div>
  )
}
