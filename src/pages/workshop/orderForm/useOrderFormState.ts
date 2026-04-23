import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { toast } from '@/components/shared/Toaster'
import {
  useCreateWorkshopOrder,
  useWorkshopItemTypes,
  usePeekWorkshopOrderNumber,
  type WorkshopItemType,
  type WorkshopPriority,
} from '@/hooks/useWorkshopOrders'
import { useClients } from '@/hooks/useClients'
import { useAppSettings } from '@/hooks/useAppSettings'
import { getCurrencySymbol } from '@/lib/utils'
import { COMPLETENESS_KEYS, type CompletenessKey } from './sections'

export interface OrderFormState {
  clientId: string
  itemTypeId: string
  brand: string
  model: string
  serial: string
  imei: string
  unlockCode: string
  defect: string
  visible: string
  completenessItems: CompletenessKey[]
  completenessExtra: string
  priority: WorkshopPriority
  diagnosticPrice: number
  estimated: number | ''
  prepaid: number
  readyDate: string
  warrantyDays: number
  notes: string
  photos: string[]
  consent: boolean
}

const INITIAL: OrderFormState = {
  clientId: '',
  itemTypeId: '',
  brand: '',
  model: '',
  serial: '',
  imei: '',
  unlockCode: '',
  defect: '',
  visible: '',
  completenessItems: [],
  completenessExtra: '',
  priority: 'normal',
  diagnosticPrice: 0,
  estimated: '',
  prepaid: 0,
  readyDate: '',
  warrantyDays: 30,
  notes: '',
  photos: [],
  consent: false,
}

export interface OrderFormHandle {
  state: OrderFormState
  patch: (p: Partial<OrderFormState>) => void
  onTypeChange: (id: string) => void
  toggleCompleteness: (k: CompletenessKey) => void
  pickClientDevice: (d: {
    item_type_id: string | null
    brand: string | null; model: string | null
    serial_number: string | null; imei: string | null
  }) => void
  submit: () => void
  submitting: boolean
  canSubmit: boolean
  itemTypes: WorkshopItemType[]
  clients: any[]
  selectedType: WorkshopItemType | undefined
  selectedClient: any | null
  completenessLabels: string[]
  nextNumber: string | null | undefined
  currencySymbol: string
}

export function useOrderFormState(): OrderFormHandle {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const { data: itemTypes } = useWorkshopItemTypes()
  const { data: clients } = useClients()
  const { data: appSettings } = useAppSettings()
  const { data: nextNumber } = usePeekWorkshopOrderNumber()
  const createOrder = useCreateWorkshopOrder()

  const currencySymbol = getCurrencySymbol(appSettings?.default_currency ?? 'RUB')
  const [state, setState] = useState<OrderFormState>(INITIAL)

  const patch = useCallback((p: Partial<OrderFormState>) => {
    setState(prev => ({ ...prev, ...p }))
  }, [])

  const onTypeChange = useCallback((id: string) => {
    const tp = itemTypes?.find(x => x.id === id)
    setState(prev => {
      const next: OrderFormState = { ...prev, itemTypeId: id }
      if (tp) {
        next.diagnosticPrice = tp.default_diagnostic_price
        next.warrantyDays = tp.default_warranty_days
        if (!prev.readyDate) {
          next.readyDate = dayjs().add(tp.default_days, 'day').format('YYYY-MM-DD')
        }
      }
      return next
    })
  }, [itemTypes])

  const toggleCompleteness = useCallback((k: CompletenessKey) => {
    setState(prev => ({
      ...prev,
      completenessItems: prev.completenessItems.includes(k)
        ? prev.completenessItems.filter(x => x !== k)
        : [...prev.completenessItems, k],
    }))
  }, [])

  const pickClientDevice = useCallback((d: {
    item_type_id: string | null
    brand: string | null; model: string | null
    serial_number: string | null; imei: string | null
  }) => {
    const tm = itemTypes?.find(x => x.id === d.item_type_id)
    if (tm) onTypeChange(tm.id)
    setState(prev => ({
      ...prev,
      brand: d.brand ?? '',
      model: d.model ?? '',
      serial: d.serial_number ?? '',
      imei: d.imei ?? '',
    }))
  }, [itemTypes, onTypeChange])

  const selectedType = useMemo(
    () => itemTypes?.find(x => x.id === state.itemTypeId),
    [itemTypes, state.itemTypeId],
  )

  const selectedClient = useMemo(
    () => clients?.find(c => c.id === state.clientId) ?? null,
    [clients, state.clientId],
  )

  const completenessLabels = useMemo(
    () => [
      ...state.completenessItems.map(k => t(`workshop.form.completenessOptions.${k}`)),
      ...(state.completenessExtra ? [state.completenessExtra] : []),
    ],
    [state.completenessItems, state.completenessExtra, t],
  )

  const canSubmit = !!state.itemTypeId && !!state.defect && state.consent

  const submit = useCallback(async () => {
    if (!selectedType) {
      toast.error(t('workshop.form.itemTypePlaceholder'))
      return
    }
    try {
      const order = await createOrder.mutateAsync({
        client_id: state.clientId || null,
        item_type_id: state.itemTypeId,
        item_type_name: selectedType.name,
        brand: state.brand || null,
        model: state.model || null,
        serial_number: state.serial || null,
        imei: state.imei || null,
        device_unlock_code: state.unlockCode.trim() || null,
        defect_description: state.defect || null,
        visible_defects: state.visible || null,
        completeness: state.completenessExtra.trim() || null,
        completeness_items: state.completenessItems,
        priority: state.priority,
        diagnostic_price: state.diagnosticPrice,
        estimated_cost: state.estimated === '' ? null : Number(state.estimated),
        prepaid_amount: state.prepaid,
        ready_date: state.readyDate || null,
        warranty_days: state.warrantyDays,
        notes: state.notes || null,
        photos: state.photos,
        client_consent_at: state.consent ? new Date().toISOString() : null,
      })
      toast.success(t('workshop.form.created', { number: order.number }))
      navigate(`/orders/${order.id}`)
    } catch (e: any) {
      toast.error(e.message ?? 'Error')
    }
  }, [createOrder, navigate, selectedType, state, t])

  // sanity: ensure COMPLETENESS_KEYS type round-trip stays alive at runtime
  void COMPLETENESS_KEYS

  return {
    state,
    patch,
    onTypeChange,
    toggleCompleteness,
    pickClientDevice,
    submit,
    submitting: createOrder.isPending,
    canSubmit,
    itemTypes: itemTypes ?? [],
    clients: clients ?? [],
    selectedType,
    selectedClient,
    completenessLabels,
    nextNumber,
    currencySymbol,
  }
}
