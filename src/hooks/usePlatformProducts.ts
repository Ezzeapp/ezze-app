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
      .from('platform_products')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .then(({ data: rows, error }) => {
        if (error || !rows || rows.length === 0) {
          setData(buildFallback())
        } else {
          setData(rows as PlatformProduct[])
        }
        setIsLoading(false)
      })
  }, [])

  return { data, isLoading }
}
