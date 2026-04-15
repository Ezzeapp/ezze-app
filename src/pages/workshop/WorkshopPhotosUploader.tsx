import { useState, useRef } from 'react'
import { Camera, Loader2, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { uploadImage, getFileUrl, deleteFile } from '@/lib/storage'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/shared/Toaster'
import { cn } from '@/lib/utils'

const BUCKET = 'workshop-photos'
const MAX_PHOTOS = 10

interface Props {
  orderId?: string          // если есть — заливаем в {userId}/{orderId}/, иначе в tmp/
  photos: string[]
  onChange: (photos: string[]) => void
  compact?: boolean         // компактное отображение в форме
}

export function WorkshopPhotosUploader({ orderId, photos, onChange, compact }: Props) {
  const { user } = useAuth()
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  async function onPick(files: FileList | null) {
    if (!files || !user) return
    if (photos.length + files.length > MAX_PHOTOS) {
      toast.error(`Максимум ${MAX_PHOTOS} фото`)
      return
    }
    setUploading(true)
    const added: string[] = []
    try {
      for (const file of Array.from(files)) {
        const id = Math.random().toString(36).slice(2, 10)
        const prefix = orderId ? `${user.id}/${orderId}` : `${user.id}/tmp`
        const path = await uploadImage(BUCKET, `${prefix}/${id}`, file, 'banner')
        added.push(path)
      }
      onChange([...photos, ...added])
    } catch (e: any) {
      toast.error(e.message ?? 'Ошибка загрузки')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function onRemove(path: string) {
    onChange(photos.filter(p => p !== path))
    deleteFile(BUCKET, path).catch(() => { /* ignore */ })
  }

  return (
    <>
      <div className={cn('grid gap-2', compact ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-3 sm:grid-cols-5')}>
        {photos.map(path => {
          const url = getFileUrl(BUCKET, path)
          return (
            <div key={path} className="relative aspect-square rounded-md overflow-hidden border group">
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setPreview(url)}
              />
              <button
                type="button"
                onClick={() => onRemove(path)}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )
        })}

        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className={cn(
              'aspect-square rounded-md border-2 border-dashed flex items-center justify-center',
              'hover:bg-accent/50 text-muted-foreground transition-colors',
              uploading && 'opacity-50 cursor-not-allowed',
            )}
          >
            {uploading
              ? <Loader2 className="h-6 w-6 animate-spin" />
              : <Camera className="h-6 w-6" />}
          </button>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => onPick(e.target.files)}
        />
      </div>

      {photos.length === 0 && !compact && (
        <p className="text-xs text-muted-foreground mt-2">
          Приложите фото устройства — это защитит и вас, и клиента от споров.
        </p>
      )}

      {/* Preview lightbox */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <button
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center"
            onClick={(e) => { e.stopPropagation(); setPreview(null) }}
          >
            <X className="h-5 w-5" />
          </button>
          <img src={preview} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </>
  )
}

export function getWorkshopPhotoUrl(path: string): string {
  return getFileUrl(BUCKET, path)
}
