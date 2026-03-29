import imageCompression from 'browser-image-compression'

// ─── Пресеты сжатия ──────────────────────────────────────────────────────────

/** Аватар / фото профиля — маленький, квадратный */
const PRESET_AVATAR = {
  maxSizeMB: 0.15,          // 150 KB максимум
  maxWidthOrHeight: 400,    // 400×400 px
  useWebWorker: true,
  fileType: 'image/webp',
  initialQuality: 0.82,
}

/** Фото услуги / товара — среднее */
const PRESET_SERVICE = {
  maxSizeMB: 0.3,           // 300 KB максимум
  maxWidthOrHeight: 1200,   // 1200px по большей стороне
  useWebWorker: true,
  fileType: 'image/webp',
  initialQuality: 0.82,
}

/** Логотип платформы / бренда */
const PRESET_LOGO = {
  maxSizeMB: 0.2,           // 200 KB максимум
  maxWidthOrHeight: 512,    // 512px по большей стороне
  useWebWorker: true,
  fileType: 'image/webp',
  initialQuality: 0.9,      // чуть выше качество для логотипов
}

/** Фото команды / баннер */
const PRESET_BANNER = {
  maxSizeMB: 0.5,           // 500 KB максимум
  maxWidthOrHeight: 1600,   // 1600px по большей стороне
  useWebWorker: true,
  fileType: 'image/webp',
  initialQuality: 0.82,
}

/** Документ / скан — качество важнее размера */
const PRESET_DOCUMENT = {
  maxSizeMB: 0.8,           // 800 KB максимум
  maxWidthOrHeight: 2000,   // 2000px — чтобы читался текст
  useWebWorker: true,
  fileType: 'image/jpeg',   // JPEG лучше для документов с текстом
  initialQuality: 0.88,
}

// ─── Основная функция ─────────────────────────────────────────────────────────

type CompressionPreset = 'avatar' | 'service' | 'logo' | 'banner' | 'document'

const PRESETS = {
  avatar:   PRESET_AVATAR,
  service:  PRESET_SERVICE,
  logo:     PRESET_LOGO,
  banner:   PRESET_BANNER,
  document: PRESET_DOCUMENT,
}

/**
 * Сжимает изображение по заданному пресету.
 * Возвращает сжатый File с правильным именем (.webp или .jpg).
 *
 * @example
 * const compressed = await compressImage(file, 'avatar')
 * await uploadFile('avatars', `${userId}/avatar.webp`, compressed)
 */
export async function compressImage(
  file: File,
  preset: CompressionPreset = 'service'
): Promise<File> {
  // Не сжимаем SVG и GIF
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file
  }

  const options = PRESETS[preset]
  const originalSizeMB = file.size / 1024 / 1024

  try {
    const compressed = await imageCompression(file, options)

    const compressedSizeKB = Math.round(compressed.size / 1024)
    const originalSizeKB  = Math.round(file.size / 1024)
    const ratio = Math.round((1 - compressed.size / file.size) * 100)

    if (import.meta.env.DEV) {
      console.log(
        `🖼 Сжатие [${preset}]: ${originalSizeKB} KB → ${compressedSizeKB} KB (-${ratio}%)`
      )
    }

    // Переименовываем с правильным расширением
    const ext      = options.fileType === 'image/webp' ? 'webp' : 'jpg'
    const baseName = file.name.replace(/\.[^.]+$/, '')
    return new File([compressed], `${baseName}.${ext}`, {
      type: options.fileType,
    })
  } catch (err) {
    // Если сжатие не удалось — возвращаем оригинал
    console.warn('imageCompression failed, using original:', err)
    return file
  }
}

// ─── Удобные алиасы ──────────────────────────────────────────────────────────

/** Аватар мастера / клиента */
export const compressAvatar   = (f: File) => compressImage(f, 'avatar')

/** Фото услуги или товара */
export const compressService  = (f: File) => compressImage(f, 'service')

/** Логотип платформы или команды */
export const compressLogo     = (f: File) => compressImage(f, 'logo')

/** Баннер / обложка команды */
export const compressBanner   = (f: File) => compressImage(f, 'banner')

/** Документ / скан */
export const compressDocument = (f: File) => compressImage(f, 'document')

// ─── Хелпер: проверка типа файла ─────────────────────────────────────────────

/** Проверяет, является ли файл изображением */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/** Возвращает читаемый размер файла */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
