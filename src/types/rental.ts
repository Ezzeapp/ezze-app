export type RentalPricingUnit = 'hour' | 'day' | 'week' | 'month'
export type RentalDepositType = 'fixed' | 'percent_of_price'
export type RentalItemStatus  = 'available' | 'rented' | 'maintenance' | 'retired'
export type RentalCategory    = 'transport' | 'tool' | 'event' | 'sport' | 'household' | 'other'

export interface RentalItem {
  id: string
  product: string
  team_id: string | null
  created_by: string | null
  name: string
  category: RentalCategory | string | null
  subcategory: string | null
  description: string | null
  photos: string[]
  brand: string | null
  model: string | null
  serial_number: string | null
  registration_plate: string | null
  inventory_qty: number
  pricing_unit: RentalPricingUnit
  price_per_hour: number | null
  price_per_day: number | null
  price_per_week: number | null
  price_per_month: number | null
  min_rental_minutes: number
  deposit_required: boolean
  deposit_type: RentalDepositType
  deposit_amount: number
  pickup_address: string | null
  pickup_hours: string | null
  delivery_available: boolean
  status: RentalItemStatus
  specs: Record<string, unknown>
  notes: string | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type RentalBookingStatus =
  | 'pending'
  | 'confirmed'
  | 'active'
  | 'returned'
  | 'cancelled'
  | 'overdue'

export type RentalDepositStatus =
  | 'pending'
  | 'paid'
  | 'returned'
  | 'withheld'
  | 'partial_returned'

export type RentalPaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded'

export interface RentalBooking {
  id: string
  product: string
  team_id: string | null
  created_by: string | null
  number: string
  item_id: string
  client_id: string | null
  accepted_by: string | null
  assigned_to: string | null
  start_at: string
  end_at: string
  actual_returned_at: string | null
  pricing_unit: RentalPricingUnit
  unit_price: number
  units_count: number
  base_price: number
  delivery_fee: number
  late_fee: number
  damages_amount: number
  total_amount: number
  prepaid_amount: number
  paid_amount: number
  payment_status: RentalPaymentStatus
  deposit_required: boolean
  deposit_amount: number
  deposit_status: RentalDepositStatus
  deposit_returned: number
  deposit_withheld: number
  status: RentalBookingStatus
  notes: string | null
  cancel_reason: string | null
  created_at: string
  updated_at: string
}

export interface RentalContract {
  id: string
  product: string
  booking_id: string
  contract_number: string
  client_identity: Record<string, unknown>
  client_documents: string[]
  terms: Record<string, unknown>
  contract_pdf_url: string | null
  signed_by_client: boolean
  client_signature_url: string | null
  signed_at: string | null
  signed_by_master: string | null
  status: 'draft' | 'signed' | 'cancelled'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RentalHandover {
  id: string
  product: string
  booking_id: string
  type: 'pickup' | 'return'
  photos: string[]
  damage_photos: string[]
  specs_snapshot: Record<string, unknown>
  condition_notes: string | null
  damages_description: string | null
  missing_items: string | null
  late_minutes: number
  late_fee: number
  damages_amount: number
  cleaning_fee: number
  fuel_charge: number
  other_charges: number
  charges_total: number
  charges_breakdown: Record<string, unknown>
  deposit_returned: number
  deposit_withheld: number
  withhold_reason: string | null
  signed_by_master: string | null
  signed_by_client: boolean
  client_signature_url: string | null
  signed_at: string | null
  notes: string | null
  created_at: string
}

export interface RentalMaintenance {
  id: string
  product: string
  item_id: string
  type: 'scheduled' | 'repair' | 'inspection' | 'cleaning' | 'other'
  title: string
  description: string | null
  planned_at: string | null
  completed_at: string | null
  cost: number
  parts_cost: number
  labor_cost: number
  odometer_at_service: number | null
  engine_hours_at_service: number | null
  next_service_at: string | null
  next_service_odometer: number | null
  performed_by: string | null
  contractor: string | null
  receipt_url: string | null
  photos: string[]
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface GlobalRentalItem {
  id: string
  product: string
  name: string
  category: RentalCategory
  subcategory: string | null
  default_pricing_unit: RentalPricingUnit
  default_price_per_day: number
  default_price_per_hour: number | null
  default_min_rental_minutes: number
  default_deposit_required: boolean
  default_deposit_percent: number
  icon: string | null
  sort_order: number
  active: boolean
  created_at: string
}

export const RENTAL_CATEGORY_LABELS: Record<RentalCategory, string> = {
  transport: 'Транспорт',
  tool:      'Инструмент',
  event:     'Мероприятия',
  sport:     'Спорт',
  household: 'Бытовое',
  other:     'Прочее',
}

export const RENTAL_PRICING_UNIT_LABELS: Record<RentalPricingUnit, string> = {
  hour:  'час',
  day:   'день',
  week:  'неделя',
  month: 'месяц',
}

export const RENTAL_STATUS_LABELS: Record<RentalItemStatus, string> = {
  available:   'Доступен',
  rented:      'В аренде',
  maintenance: 'На ТО',
  retired:     'Списан',
}
