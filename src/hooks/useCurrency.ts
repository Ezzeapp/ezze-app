import { useProfile } from './useProfile'
import { useTranslation } from 'react-i18next'
import { LANG_TO_CURRENCY, getCurrencySymbol } from '@/lib/utils'

export function useCurrency(): string {
  const { data: profile } = useProfile()
  const { i18n } = useTranslation()

  if (profile?.currency) return profile.currency
  return LANG_TO_CURRENCY[i18n.language] || 'RUB'
}

export function useCurrencySymbol(): string {
  const currency = useCurrency()
  return getCurrencySymbol(currency)
}
