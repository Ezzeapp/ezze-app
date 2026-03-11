/**
 * Feature Flags — централизованный конфиг всех функций платформы.
 *
 * plan: какие планы имеют доступ к функции по умолчанию
 *   'free'       — доступно всем
 *   'pro'        — только pro и enterprise
 *   'enterprise' — только enterprise
 *
 * behavior при отсутствии доступа:
 *   'hidden'   — полностью скрыть (пункт меню, раздел, кнопка)
 *   'locked'   — показать с замком + призыв к апгрейду
 *   'readonly' — показать без возможности редактирования
 *
 * Флаги могут быть переопределены через коллекцию feature_flags в PocketBase.
 */

export type FeaturePlan = 'free' | 'pro' | 'enterprise'
export type FeatureBehavior = 'hidden' | 'locked' | 'readonly'

export interface FeatureConfig {
  key: string
  label: string          // название для admin UI
  description: string    // описание для admin UI
  defaultPlan: FeaturePlan   // минимальный план для доступа
  behavior: FeatureBehavior  // что делать если нет доступа
  section: FeatureSection
}

export type FeatureSection =
  | 'navigation'   // пункты меню
  | 'integrations' // сторонние сервисы
  | 'analytics'    // статистика и отчёты
  | 'catalog'      // справочники
  | 'tools'        // инструменты
  | 'marketing'    // маркетинг и продвижение

export const FEATURES: FeatureConfig[] = [
  // ── Навигация ─────────────────────────────────────────────────────────────
  {
    key: 'inventory',
    label: 'Склад',
    description: 'Управление товарами, материалами и складским учётом',
    defaultPlan: 'free',
    behavior: 'hidden',
    section: 'navigation',
  },
  {
    key: 'calendar',
    label: 'Календарь',
    description: 'Просмотр записей в календарном виде',
    defaultPlan: 'free',
    behavior: 'hidden',
    section: 'navigation',
  },
  {
    key: 'clients',
    label: 'Клиенты',
    description: 'CRM — база клиентов, история визитов',
    defaultPlan: 'free',
    behavior: 'hidden',
    section: 'navigation',
  },
  {
    key: 'schedule',
    label: 'Расписание',
    description: 'Настройка рабочего времени и перерывов',
    defaultPlan: 'free',
    behavior: 'hidden',
    section: 'navigation',
  },
  {
    key: 'public_booking',
    label: 'Онлайн-запись',
    description: 'Публичная страница для самозаписи клиентов',
    defaultPlan: 'pro',
    behavior: 'locked',
    section: 'navigation',
  },
  // ── Интеграции ────────────────────────────────────────────────────────────
  {
    key: 'telegram',
    label: 'Telegram-бот',
    description: 'Уведомления о новых записях через Telegram',
    defaultPlan: 'pro',
    behavior: 'locked',
    section: 'integrations',
  },
  {
    key: 'client_cabinet',
    label: 'Кабинет клиента (Telegram)',
    description: 'Личный кабинет клиента в Telegram Mini App — история записей, повторная запись, отмена',
    defaultPlan: 'pro',
    behavior: 'locked',
    section: 'integrations',
  },
  // ── Аналитика ─────────────────────────────────────────────────────────────
  {
    key: 'analytics_revenue',
    label: 'Статистика выручки',
    description: 'Графики дохода, средний чек, динамика',
    defaultPlan: 'pro',
    behavior: 'locked',
    section: 'analytics',
  },
  {
    key: 'analytics_clients',
    label: 'Аналитика клиентов',
    description: 'Новые vs возвращающиеся, источники, LTV',
    defaultPlan: 'enterprise',
    behavior: 'locked',
    section: 'analytics',
  },
  // ── Справочники ───────────────────────────────────────────────────────────
  {
    key: 'global_services_catalog',
    label: 'Глобальный справочник услуг',
    description: 'Добавление услуг из общего справочника платформы',
    defaultPlan: 'free',
    behavior: 'hidden',
    section: 'catalog',
  },
  {
    key: 'global_products_catalog',
    label: 'Глобальный справочник товаров',
    description: 'Добавление товаров/материалов из общего справочника',
    defaultPlan: 'pro',
    behavior: 'locked',
    section: 'catalog',
  },
  // ── Команда ───────────────────────────────────────────────────────────────
  {
    key: 'teams',
    label: 'Команда мастеров',
    description: 'Объединение мастеров в команду, совместная аналитика, приглашения',
    defaultPlan: 'pro',
    behavior: 'locked',
    section: 'navigation',
  },
  // ── Инструменты ───────────────────────────────────────────────────────────
  {
    key: 'appointment_notes',
    label: 'Заметки в записи',
    description: 'Поле для заметок и пожеланий клиента в форме создания записи',
    defaultPlan: 'free',
    behavior: 'hidden',
    section: 'tools',
  },
  {
    key: 'appointment_recurring',
    label: 'Повторяющаяся запись',
    description: 'Возможность создать серию повторяющихся записей по расписанию',
    defaultPlan: 'free',
    behavior: 'hidden',
    section: 'tools',
  },
  {
    key: 'service_materials',
    label: 'Материалы к услугам',
    description: 'Привязка расходных материалов из склада к услугам для автоматического учёта',
    defaultPlan: 'pro',
    behavior: 'hidden',
    section: 'tools',
  },
  {
    key: 'date_blocks',
    label: 'Блокировка дат',
    description: 'Блокировка дней и временных интервалов — отгул, отпуск, недоступность',
    defaultPlan: 'free',
    behavior: 'hidden',
    section: 'tools',
  },
  {
    key: 'data_transfer',
    label: 'Перенос данных',
    description: 'Генерация кода для копирования услуг, категорий, материалов и склада другому мастеру',
    defaultPlan: 'pro',
    behavior: 'locked',
    section: 'tools',
  },
  // ── Маркетинг ─────────────────────────────────────────────────────────────
  {
    key: 'reviews',
    label: 'Отзывы',
    description: 'Сбор и управление отзывами клиентов после визита',
    defaultPlan: 'free',
    behavior: 'hidden',
    section: 'marketing',
  },
  {
    key: 'promo_codes',
    label: 'Промокоды',
    description: 'Создание скидочных кодов и спецпредложений для клиентов',
    defaultPlan: 'pro',
    behavior: 'hidden',
    section: 'marketing',
  },
]

/** Порядок планов — чем больше индекс, тем выше план */
export const PLAN_ORDER: FeaturePlan[] = ['free', 'pro', 'enterprise']

/** Метки планов для UI */
export const PLAN_LABELS: Record<FeaturePlan, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

/** Цвета badge для планов */
export const PLAN_COLORS: Record<FeaturePlan, string> = {
  free: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  pro: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  enterprise: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

/** Метки секций для admin UI */
export const SECTION_LABELS: Record<FeatureSection, string> = {
  navigation: 'Навигация',
  integrations: 'Интеграции',
  analytics: 'Аналитика',
  catalog: 'Справочники',
  tools: 'Инструменты',
  marketing: 'Маркетинг',
}

/** Карта key → config для быстрого доступа */
export const FEATURE_MAP = Object.fromEntries(
  FEATURES.map((f) => [f.key, f])
) as Record<string, FeatureConfig>
