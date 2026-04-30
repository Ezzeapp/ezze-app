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
  /** Если заполнено — пользователь существует только как сотрудник этой команды */
  team_only_for?: string | null
}

// ── Справочник видов деятельности и специальностей ──────────────────────────
export interface ActivityType extends BaseRecord {
  name: string        // «Красота и уход»
  icon?: string       // emoji или slug иконки
  order?: number
}

export interface Specialty extends BaseRecord {
  activity_type_id: string       // FK → activity_types
  name: string                   // «Парикмахер»
  order?: number
  activity_type?: ActivityType   // joined object from select
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

// premium/minimal/bold — для cleaning, glamour/soft/editorial — для beauty
export type LandingTemplate = 'premium' | 'minimal' | 'bold' | 'glamour' | 'soft' | 'editorial'

export interface LandingHowStep {
  title: string
  description: string
}

export interface LandingReview {
  name: string
  text: string
  rating?: number
  date?: string
}

export interface LandingContent {
  hero_badge?: string
  business_subtitle?: string
  turnaround_hours?: number
  free_pickup_threshold?: number
  working_hours?: string
  show_eco_badge?: boolean
  show_quality_badge?: boolean
  how_steps?: LandingHowStep[]
  reviews?: LandingReview[]
}

export interface PageSettings {
  template?:   'minimal' | 'dark' | 'bold' | 'elegant'
  accent?:     string
  bg?:         'white' | 'dark' | 'soft' | 'custom'
  bg_custom?:  string
  btn_shape?:  'rounded' | 'pill' | 'square'
  font?:       'inter' | 'montserrat' | 'playfair'
  landing_template?: LandingTemplate
  landing_content?: LandingContent
}

export interface MasterProduct {
  id:           string
  user_id:      string
  name:         string
  description?: string
  price:        number
  photo_url?:   string
  is_available: boolean
  order_index:  number
  created_at:   string
}

export interface MasterProfile extends BaseRecord {
  user: string
  display_name?: string    // Отображаемое имя мастера (ФИО или псевдоним)
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
  cover_url?:     string
  lat?:           number
  lng?:           number
  page_enabled?:  boolean
  youtube?:       string
  tiktok?:        string
  page_settings?: PageSettings
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
  telegram?: string    // Telegram @username (никнейм, read-only)
  tg_chat_id?: string  // Telegram chat ID
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
  master_id: string       // user ID
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

export interface Subscription {
  id:                      string
  created_at:              string
  user_id:                 string
  /** Joined user record — available when querying with select('*, user:users(*)') */
  user?:                   User
  plan:                    SubscriptionPlan
  amount_uzs:              number
  provider:                SubscriptionProvider
  status:                  SubscriptionStatus
  provider_transaction_id: string
  period_months:           number
  expires_at?:             string
  create_time_ms:          number
  perform_time_ms?:        number
  cancel_time_ms?:         number
  cancel_reason?:          number
  /** Payme transaction state: 1=created, 2=completed, -1=cancelled, -2=cancelled_after */
  state?:                  number
  raw_payload?:            unknown
}

// ── Clinic (Медицина) ──────────────────────────────────────────

export type Gender = 'male' | 'female'
export type BloodType = 'I+' | 'I-' | 'II+' | 'II-' | 'III+' | 'III-' | 'IV+' | 'IV-'
export type ToothStatus = 'healthy' | 'caries' | 'filling' | 'crown' | 'missing' | 'implant' | 'bridge' | 'root_canal'

export interface Prescription {
  name: string
  dosage: string
  frequency: string
  duration: string
}

export interface ClinicPatientCard {
  id: string
  client_id: string
  master_id: string
  gender?: Gender | null
  blood_type?: BloodType | null
  allergies?: string | null
  contraindications?: string | null
  chronic_diseases?: string | null
  insurance_number?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  created_at: string
  updated_at: string
}

export interface ClinicVisit {
  id: string
  appointment_id: string
  master_id: string
  complaints?: string | null
  examination?: string | null
  diagnosis?: string | null
  diagnosis_code?: string | null
  treatment?: string | null
  prescriptions: Prescription[]
  recommendations?: string | null
  next_visit_date?: string | null
  attachments: { url: string; name: string; type: string }[]
  template_id?: string | null
  created_at: string
  updated_at: string
}

export interface ClinicDentalChart {
  id: string
  client_id: string
  master_id: string
  teeth: Record<number, { status: ToothStatus; notes?: string }>
  created_at: string
  updated_at: string
}

export interface ClinicVisitTemplate {
  id: string
  master_id: string
  name: string
  specialty?: string | null
  complaints?: string | null
  examination?: string | null
  diagnosis?: string | null
  treatment?: string | null
  prescriptions: Prescription[]
  recommendations?: string | null
  sort_order: number
  created_at: string
}

// ── Clinic Laboratory ────────────────────────────────────────────

export type LabOrderStatus = 'ordered' | 'in_progress' | 'completed' | 'cancelled'
export type LabResultFlag = 'normal' | 'low' | 'high' | 'abnormal'

export interface ClinicLabTest {
  id: string
  master_id: string
  name: string
  category?: string | null
  unit?: string | null
  ref_min?: number | null
  ref_max?: number | null
  ref_text?: string | null
  price?: number | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ClinicLabOrder {
  id: string
  master_id: string
  client_id: string
  visit_id?: string | null
  status: LabOrderStatus
  notes?: string | null
  ordered_at: string
  completed_at?: string | null
  created_at: string
  updated_at: string
  // joined
  client?: { first_name: string; last_name?: string | null } | null
  items?: ClinicLabOrderItem[]
}

export interface ClinicLabOrderItem {
  id: string
  order_id: string
  test_id?: string | null
  test_name: string
  result_value?: string | null
  result_unit?: string | null
  ref_min?: number | null
  ref_max?: number | null
  ref_text?: string | null
  flag?: LabResultFlag | null
  notes?: string | null
  completed_at?: string | null
  created_at: string
}

// ── Clinic Pharmacy ──────────────────────────────────────────────

export type DosageForm = 'tablet' | 'capsule' | 'injection' | 'syrup' |
  'cream' | 'drops' | 'ointment' | 'powder' |
  'solution' | 'suppository' | 'inhaler' | 'other'

export interface ClinicPharmacyItem {
  id: string
  master_id: string
  name: string
  generic_name?: string | null
  category?: string | null
  dosage_form?: DosageForm | null
  manufacturer?: string | null
  sku?: string | null
  quantity: number
  min_quantity: number
  cost_price?: number | null
  sell_price?: number | null
  expiry_date?: string | null
  prescription_required: boolean
  unit?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface ClinicPharmacyReceipt {
  id: string
  master_id: string
  item_id: string
  quantity: number
  cost_price?: number | null
  supplier?: string | null
  batch_number?: string | null
  expiry_date?: string | null
  date: string
  notes?: string | null
  created_at: string
}

export interface ClinicDispensing {
  id: string
  master_id: string
  client_id: string
  visit_id?: string | null
  item_id: string
  quantity: number
  price?: number | null
  notes?: string | null
  dispensed_at: string
  created_at: string
  // joined
  item?: { name: string } | null
  client?: { first_name: string; last_name?: string | null } | null
}

// ── Clinic Inpatient (Стационар) ──────────────────────────────────

export type WardType = 'therapeutic' | 'surgical' | 'intensive' | 'pediatric' | 'maternity' | 'other'
export type BedStatus = 'free' | 'occupied' | 'maintenance'
export type HospitalizationStatus = 'admitted' | 'in_treatment' | 'pre_discharge' | 'discharged'

export interface ClinicWard {
  id: string
  master_id: string
  name: string
  ward_type: WardType
  floor?: number | null
  capacity: number
  notes?: string | null
  created_at: string
  updated_at: string
  rooms?: ClinicRoom[]
}

export interface ClinicRoom {
  id: string
  ward_id: string
  name: string
  capacity: number
  notes?: string | null
  created_at: string
  updated_at: string
  beds?: ClinicBed[]
  ward?: { name: string } | null
}

export interface ClinicBed {
  id: string
  room_id: string
  number: string
  status: BedStatus
  created_at: string
  updated_at: string
  room?: { name: string; ward_id: string } | null
}

export interface ClinicHospitalization {
  id: string
  master_id: string
  client_id: string
  visit_id?: string | null
  ward_id: string
  room_id: string
  bed_id: string
  admission_date: string
  discharge_date?: string | null
  status: HospitalizationStatus
  diagnosis?: string | null
  diagnosis_code?: string | null
  reason?: string | null
  attending_doctor?: string | null
  discharge_summary?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
  client?: { first_name: string; last_name?: string | null } | null
  ward?: { name: string } | null
  room?: { name: string } | null
  bed?: { number: string } | null
}

export interface ClinicDailyObservation {
  id: string
  hospitalization_id: string
  master_id: string
  observation_date: string
  temperature?: number | null
  bp_systolic?: number | null
  bp_diastolic?: number | null
  pulse?: number | null
  spo2?: number | null
  respiratory_rate?: number | null
  notes?: string | null
  treatment_notes?: string | null
  created_at: string
}

// ── Clinic Surgery (Операционная) ─────────────────────────────────

export type SurgeryStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type AnesthesiaType = 'general' | 'regional' | 'local' | 'sedation'

export interface ClinicOperatingRoom {
  id: string
  master_id: string
  name: string
  equipment_notes?: string | null
  status: 'available' | 'in_use' | 'maintenance'
  created_at: string
  updated_at: string
}

export interface ClinicSurgery {
  id: string
  master_id: string
  client_id: string
  hospitalization_id: string
  operating_room_id?: string | null
  scheduled_date: string
  actual_start?: string | null
  actual_end?: string | null
  status: SurgeryStatus
  procedure_name: string
  pre_op_diagnosis?: string | null
  post_op_diagnosis?: string | null
  anesthesia_type?: AnesthesiaType | null
  anesthesia_duration_min?: number | null
  blood_loss_ml?: number | null
  complications?: string | null
  surgeon_name?: string | null
  anesthesiologist_name?: string | null
  assistants: string[]
  notes?: string | null
  created_at: string
  updated_at: string
  client?: { first_name: string; last_name?: string | null } | null
  hospitalization?: { diagnosis?: string | null } | null
  operating_room?: { name: string } | null
}

// ── Clinic Nutrition (Питание) ────────────────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface ClinicDietTable {
  id: string
  master_id: string
  number: string
  name: string
  description?: string | null
  allowed_foods?: string | null
  restricted_foods?: string | null
  calories_target?: number | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface ClinicMealPlan {
  id: string
  hospitalization_id: string
  diet_table_id: string
  start_date: string
  end_date?: string | null
  special_instructions?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
  diet_table?: { number: string; name: string } | null
  hospitalization?: { client?: { first_name: string; last_name?: string | null } | null } | null
}

export interface ClinicMealRecord {
  id: string
  meal_plan_id: string
  date: string
  meal_type: MealType
  menu_items?: string | null
  served: boolean
  notes?: string | null
  created_at: string
}

export interface ClinicExamRoom {
  id: string
  master_id: string
  name: string
  floor?: number | null
  notes?: string | null
  sort_order: number
  created_at: string
  updated_at: string
}
