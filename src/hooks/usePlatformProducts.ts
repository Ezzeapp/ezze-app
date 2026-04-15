import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PRODUCT_LIST } from '@/lib/products'

export interface PlatformProduct {
  key: string
  name_ru: string
  name_en: string | null
  name_uz: string | null
  name_kz: string | null
  name_ky: string | null
  name_tg: string | null
  name_uk: string | null
  name_by: string | null
  name_kaa: string | null
  desc_ru: string | null
  desc_en: string | null
  desc_uz: string | null
  desc_kz: string | null
  desc_ky: string | null
  desc_tg: string | null
  desc_uk: string | null
  desc_by: string | null
  desc_kaa: string | null
  active: boolean
  sort_order: number
}

/** Возвращает локализованное название продукта с fallback на ru */
export function getProductName(p: PlatformProduct, lang: string): string {
  const key = `name_${lang}` as keyof PlatformProduct
  return (p[key] as string | null) || p.name_ru
}

/** Возвращает локализованное описание продукта с fallback на ru */
export function getProductDesc(p: PlatformProduct, lang: string): string {
  const key = `desc_${lang}` as keyof PlatformProduct
  return (p[key] as string | null) || p.desc_ru || ''
}

interface ProductConfig {
  slug: string
  label: string
  url: string
  hidden: boolean
  comingSoon: boolean
  showInRegistration?: boolean
  nameI18n?: Record<string, string>
  descI18n?: Record<string, string>
}

/** Конвертирует ProductConfig в PlatformProduct */
function toPlatformProduct(p: ProductConfig, index: number): PlatformProduct {
  const nameI18n = p.nameI18n || {}
  const descI18n = p.descI18n || {}
  return {
    key: p.slug,
    name_ru:  nameI18n['ru']  || p.label,
    name_en:  nameI18n['en']  || null,
    name_uz:  nameI18n['uz']  || null,
    name_kz:  nameI18n['kz']  || null,
    name_ky:  nameI18n['ky']  || null,
    name_tg:  nameI18n['tg']  || null,
    name_uk:  nameI18n['uk']  || null,
    name_by:  nameI18n['by']  || null,
    name_kaa: nameI18n['kaa'] || null,
    desc_ru:  descI18n['ru']  || '',
    desc_en:  descI18n['en']  || null,
    desc_uz:  descI18n['uz']  || null,
    desc_kz:  descI18n['kz']  || null,
    desc_ky:  descI18n['ky']  || null,
    desc_tg:  descI18n['tg']  || null,
    desc_uk:  descI18n['uk']  || null,
    desc_by:  descI18n['by']  || null,
    desc_kaa: descI18n['kaa'] || null,
    // active if showInRegistration is explicitly true, or not set and not comingSoon/hidden
    active: p.showInRegistration !== undefined
      ? p.showInRegistration
      : (!p.comingSoon && !p.hidden),
    sort_order: index,
  }
}

/** Fallback: преобразует PRODUCT_LIST в формат PlatformProduct */
function buildFallback(): PlatformProduct[] {
  return PRODUCT_LIST.map((p, i) => ({
    key: p.key,
    name_ru: p.name,
    name_en: null, name_uz: null, name_kz: null, name_ky: null,
    name_tg: null, name_uk: null, name_by: null, name_kaa: null,
    desc_ru: p.desc,
    desc_en: null, desc_uz: null, desc_kz: null, desc_ky: null,
    desc_tg: null, desc_uk: null, desc_by: null, desc_kaa: null,
    active: true,
    sort_order: i,
  }))
}

export function usePlatformProducts() {
  const [data, setData] = useState<PlatformProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('value')
      .eq('product', 'main')
      .eq('key', 'products_config')
      .single()
      .then(({ data: row, error }) => {
        if (error || !row?.value) {
          setData(buildFallback())
          setIsLoading(false)
          return
        }
        try {
          const list: ProductConfig[] = JSON.parse(
            typeof row.value === 'string' ? row.value : JSON.stringify(row.value)
          )
          if (!Array.isArray(list) || list.length === 0) {
            setData(buildFallback())
          } else {
            const mapped = list
              .filter(p => {
                const show = p.showInRegistration !== undefined
                  ? p.showInRegistration
                  : (!p.comingSoon && !p.hidden)
                return show
              })
              .map((p, i) => toPlatformProduct(p, i))
            setData(mapped.length > 0 ? mapped : buildFallback())
          }
        } catch {
          setData(buildFallback())
        }
        setIsLoading(false)
      })
  }, [])

  return { data, isLoading }
}
