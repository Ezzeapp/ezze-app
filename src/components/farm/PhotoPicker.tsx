import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { uploadImage, getFileUrl } from '@/lib/storage'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  value: string | null | undefined   // сохранённый path (НЕ url)
  onChange: (path: string | null) => void
  subPath: string                    // напр. `animals/${id}` или `equipment/${id}`
  size?: number                      // px, по умолчанию 96
}

export function PhotoPicker({ value, onChange, subPath, size = 96 }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const ref = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const url = value ? getFileUrl('products', value) : ''

  async function handleFile(file: File) {
    if (!user?.id) return
    setLoading(true); setErr(null)
    try {
      const path = await uploadImage('products', `${user.id}/${subPath}`, file, 'service')
      onChange(path)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className="rounded-lg bg-muted border-2 border-dashed border-border overflow-hidden relative shrink-0"
        style={{ width: size, height: size }}
      >
        {url ? (
          <img src={url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Camera className="h-6 w-6" />
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <input
          ref={ref} type="file" accept="image/*" className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => ref.current?.click()} disabled={loading}>
          <Camera className="h-4 w-4 mr-1" /> {value ? t('farm.photo.change') : t('farm.photo.upload')}
        </Button>
        {value && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
            <Trash2 className="h-4 w-4 mr-1 text-destructive" /> {t('farm.common.delete')}
          </Button>
        )}
        {err && <p className="text-xs text-destructive">{err}</p>}
      </div>
    </div>
  )
}
