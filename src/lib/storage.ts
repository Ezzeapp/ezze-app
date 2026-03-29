import { supabase } from './supabase'
import { compressImage } from './imageCompression'

// re-export для удобства
export {
  compressAvatar,
  compressService,
  compressLogo,
  compressBanner,
  compressDocument,
  formatFileSize,
} from './imageCompression'

export function getFileUrl(bucket: string, path: string | null | undefined): string {
  if (!path) return ''
  // Already a full URL
  if (path.startsWith('http')) return path
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
  })
  if (error) throw error
  return path
}

/**
 * Загружает изображение с автоматическим сжатием.
 * Расширение (.webp или .jpg) добавляется автоматически.
 *
 * @param bucket  — бакет Supabase Storage
 * @param path    — путь БЕЗ расширения (например `${userId}/avatar`)
 * @param file    — исходный файл от пользователя
 * @param preset  — пресет сжатия: 'avatar' | 'service' | 'logo' | 'banner' | 'document'
 * @returns полный путь к файлу (с расширением)
 *
 * @example
 * const path = await uploadImage('avatars', `${userId}/avatar`, file, 'avatar')
 * const url  = getFileUrl('avatars', path)
 */
export async function uploadImage(
  bucket: string,
  path: string,
  file: File,
  preset: 'avatar' | 'service' | 'logo' | 'banner' | 'document' = 'service'
): Promise<string> {
  const compressed = await compressImage(file, preset)
  const ext        = compressed.type === 'image/webp' ? 'webp' : 'jpg'
  const fullPath   = `${path}.${ext}`

  const { error } = await supabase.storage.from(bucket).upload(fullPath, compressed, {
    upsert: true,
    contentType: compressed.type,
  })
  if (error) throw error
  return fullPath
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw error
}
