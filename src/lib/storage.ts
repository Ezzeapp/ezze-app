import { supabase } from './supabase'

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

export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw error
}
