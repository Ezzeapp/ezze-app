export interface BaseRecord {
  id: string
  created: string
  updated: string
  collectionId: string
  collectionName: string
}

export interface User extends BaseRecord {
  email: string
  name: string
  avatar?: string
  language?: string
  theme?: string
  timezone?: string
  onboarded?: boolean
  is_admin?: boolean
  plan?: 'free' | 'pro' | 'enterprise'
}

// ── Справочник видов деятельности и специальностей ──────────────────────────
export interface ActivityType extends BaseRecord {
  name: string        // «Красота и уход»
  icon?: string       // emoji или slug иконки
  order?: number
}

export interface Specialty extends BaseRecord {
  activity_type: string          // FK → activity_types
  name: string                   // «Парикмахер»
  order?: number
  expand?: { activity_type?: ActivityType }
}

// Что сохраняется у мастера в профиле
export interface MasterSpecialty {
  activity_type_id: string
  activity_type_name: string
  specialty_id: string
  specialty_name: string
}

// ── Глобальные справочники (admin-managed) ───────────────────────────────────
export interface GlobalService extends BaseRecord {
  name: string
  description?: string
  category?: string
  duration_min?: number
  price?: number
  order?: number
}

export interface GlobalProduct extends BaseRecord {
  name: string
  description?: string
  category?: string
  unit?: string
  price?: number
  order?: number
}

export interface MasterProfile extends BaseRecord {
  user: string
  profession: string
  activity_type?: string   // FK → activity_types
  specialty?: string       // FK → specialties
  bio?: string
  phone?: string
  city?: string
  address?: string
  website?: string
  instagram?: string
  telegram?: string
  whatsapp?: string
  vk?: string
  avatar?: string
  portfolio?: string[]
  booking_slug: string
  is_public: boolean
  currency: string
  tg_bot_token?: string
  tg_chat_id?: string
  remind_master_hours?: number   // 0 = выключено, 1/2/24 = за N часов
  remind_client_hours?: number   // 0 = выключено, 1/2/24 = за N часов
  booking_theme?: string
  notification_email?: string  // email для уведомлений (если нет email в users)
}

export interface Client extends BaseRecord {
  master: string
  first_name: string
  last_name?: string
  phone?: string
  email?: string
  birthday?: string
  notes?: string
  source?: string
  tags?: string[]
  total_visits?: number
  avatar?: string
  last_visit?: string
}

export interface ServiceCategory extends BaseRecord {
  master: string
  name: string
  color?: string
  order?: number
}

export interface Service extends BaseRecord {
  master: string
  category?: string
  name: string
  description?: string
  duration_min: number
  price: number
  price_max?: number
  is_active: boolean
  is_bookable: boolean
  image?: string
  order?: number
  expand?: {
    category?: ServiceCategory
  }
}

export interface Schedule extends BaseRecord {
  master: string
  mon_enabled: boolean
  mon_start: string
  mon_end: string
  tue_enabled: boolean
  tue_start: string
  tue_end: string
  wed_enabled: boolean
  wed_start: string
  wed_end: string
  thu_enabled: boolean
  thu_start: string
  thu_end: string
  fri_enabled: boolean
  fri_start: string
  fri_end: string
  sat_enabled: boolean
  sat_start: string
  sat_end: string
  sun_enabled: boolean
  sun_start: string
  sun_end: string
  slot_duration: number
  advance_days: number
}

export interface ScheduleBreak extends BaseRecord {
  master: string
  day_of_week: number
  start_time: string
  end_time: string
  label?: string
  is_recurring: boolean
}

export interface AppointmentService extends BaseRecord {
  appointment: string
  service: string
  price?: number
  duration_min?: number
  sort_order?: number
  expand?: {
    service?: Service
  }
}

export interface Appointment extends BaseRecord {
  master: string
  client?: string
  service: string
  date: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'done' | 'cancelled' | 'no_show'
  price?: number
  discount?: number
  payment_method?: 'cash' | 'card' | 'transfer' | 'other'
  paid_amount?: number
  notes?: string
  client_name?: string
  client_phone?: string
  client_email?: string
  client_telegram?: string
  booked_via?: 'manual' | 'online'
  confirmed_at?: string
  cancel_token?: string
  telegram_id?: string
  promo_code?: string
  promo_discount?: number
  expand?: {
    client?: Client
    service?: Service
    'appointment_services(appointment)'?: AppointmentService[]
  }
}

export interface ServiceMaterial extends BaseRecord {
  service: string
  inventory_item: string
  quantity: number
  expand?: {
    inventory_item?: InventoryItem
  }
}

export interface InventoryItem extends BaseRecord {
  master: string
  name: string
  sku?: string
  category?: string
  description?: string
  unit?: string
  quantity: number
  min_quantity?: number
  cost_price?: number
  sell_price?: number
  supplier?: string
  image?: string
}

export interface InventoryReceipt extends BaseRecord {
  master: string
  inventory_item: string
  date: string
  quantity: number
  cost_price?: number
  supplier?: string
  note?: string
  expand?: {
    inventory_item?: InventoryItem
  }
}

export type AppointmentStatus = Appointment['status']

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export const DAY_KEYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const DOW_INDEX: Record<number, DayOfWeek> = {
  1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat', 0: 'sun'
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export interface Team extends BaseRecord {
  name: string
  slug: string
  owner: string          // FK → users
  description?: string
  logo?: string
  is_public: boolean
  currency: string
  expand?: { owner?: User }
}

export type TeamMemberRole = 'member'
export type TeamMemberStatus = 'active' | 'paused' | 'removed'

export interface TeamMember extends BaseRecord {
  team: string           // FK → teams
  user: string           // FK → users
  role: TeamMemberRole
  status: TeamMemberStatus
  joined_at: string
  expand?: { user?: User; team?: Team }
}

export interface TeamInvite extends BaseRecord {
  team: string           // FK → teams
  code: string
  created_by: string     // FK → users
  expires_at: string
  max_uses: number       // 0 = unlimited
  use_count: number
  is_active: boolean
  label?: string
  expand?: { team?: Team }
}

export type TeamRole = 'owner' | 'member' | null

export interface TeamMemberStats {
  userId: string
  userName: string
  userAvatar?: string
  revenue: number
  appointmentCount: number
  doneCount: number
  avgCheck: number
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export interface Review extends BaseRecord {
  master: string          // user ID
  telegram_id?: string
  client_name?: string
  rating: number          // 1-5
  comment?: string
  appointment_id?: string
  is_visible: boolean
}

// ── Promo Codes ───────────────────────────────────────────────────────────────

export interface PromoCode extends BaseRecord {
  master: string          // user ID
  code: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  valid_from?: string     // YYYY-MM-DD
  valid_until?: string    // YYYY-MM-DD
  max_uses?: number       // 0 = unlimited
  use_count?: number
  is_active: boolean
  description?: string
}

// ── Date Blocks ───────────────────────────────────────────────────────────────

export interface DateBlock extends BaseRecord {
  master: string          // user ID
  date_from: string       // YYYY-MM-DD
  date_to: string         // YYYY-MM-DD
  label?: string
  all_day: boolean
}

// ── Copy Snapshots (перенос данных между мастерами) ───────────────────────────

export interface CopySnapshotDataCategory {
  id: string
  name: string
  color?: string
  order?: number
}

export interface CopySnapshotDataService {
  id: string
  category_id?: string    // original ID → mapped to new
  name: string
  description?: string
  duration_min: number
  price: number
  price_max?: number
  is_active: boolean
  is_bookable: boolean
  order?: number
}

export interface CopySnapshotDataMaterial {
  service_id: string         // original ID → mapped to new
  inventory_item_id: string  // original ID → mapped to new
  quantity: number
}

export interface CopySnapshotDataInventory {
  id: string
  name: string
  sku?: string
  category?: string
  description?: string
  unit?: string
  quantity: number
  min_quantity?: number
  cost_price?: number
  sell_price?: number
  supplier?: string
}

export interface CopySnapshotData {
  service_categories: CopySnapshotDataCategory[]
  services: CopySnapshotDataService[]
  service_materials: CopySnapshotDataMaterial[]
  inventory_items: CopySnapshotDataInventory[]
}

export interface CopySnapshot extends BaseRecord {
  source_user: string
  token: string
  data: CopySnapshotData
  expires_at: string
  used: boolean
}

export interface ImportResult {
  categoriesAdded: number
  categoriesReplaced: number
  categoriesSkipped: number
  servicesAdded: number
  servicesReplaced: number
  servicesSkipped: number
  materialsAdded: number
  inventoryAdded: number
  inventoryReplaced: number
  inventorySkipped: number
}

// ── Subscriptions (Payme / Click.uz) ─────────────────────────────────────────

export type SubscriptionStatus = 'pending' | 'active' | 'cancelled' | 'expired'
export type SubscriptionProvider = 'payme' | 'click'
export type SubscriptionPlan = 'pro' | 'enterprise'

export interface Subscription extends BaseRecord {
  user:                    string
  plan:                    SubscriptionPlan
  amount_uzs:              number
  provider:                SubscriptionProvider
  status:                  SubscriptionStatus
  provider_transaction_id: string
  period_months:           number
  expires_at:              string
  create_time_ms:          number
  perform_time_ms?:        number
  cancel_time_ms?:         number
  cancel_reason?:          number
  raw_payload?:            unknown
  expand?: {
    user?: User
  }
}
