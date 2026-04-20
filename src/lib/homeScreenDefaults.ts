import type { HomeScreenTile } from '@/hooks/useAppSettings'

const t = (ru: string, en: string, kz: string, uz: string): Record<string, string> => ({ ru, en, kz, uz })

export const HOME_SCREEN_DEFAULTS: Record<string, HomeScreenTile[]> = {
  cleaning: [
    { id: 'orders',   label: t('Заказы',      'Orders',    'Тапсырыстар', 'Buyurtmalar'),       icon: 'ClipboardList', route: '/orders',    visible: true,  order: 0 },
    { id: 'pos',      label: t('Касса',        'POS',       'Касса',       'Kassa'),             icon: 'ShoppingCart',  route: '/orders/pos', visible: true,  order: 1 },
    { id: 'clients',  label: t('Клиенты',      'Clients',   'Клиенттер',   'Mijozlar'),          icon: 'Users',         route: '/clients',   visible: true,  order: 2 },
    { id: 'delivery', label: t('Доставка',     'Delivery',  'Жеткізу',     'Yetkazib berish'),   icon: 'Truck',         route: '/delivery',  visible: true,  order: 3 },
    { id: 'supplies', label: t('Расходники',   'Supplies',  'Жабдықтар',   'Materiallar'),       icon: 'Droplets',      route: '/supplies',  visible: true,  order: 4 },
    { id: 'stats',    label: t('Статистика',   'Stats',     'Статистика',  'Statistika'),        icon: 'BarChart3',     route: '/stats',     visible: true,  order: 5 },
    { id: 'services', label: t('Услуги',       'Services',  'Қызметтер',   'Xizmatlar'),         icon: 'Tag',           route: '/services',  visible: false, order: 6 },
    { id: 'settings', label: t('Настройки',    'Settings',  'Параметрлер', 'Sozlamalar'),        icon: 'Settings2',     route: '/settings',  visible: true,  order: 7 },
  ],
  beauty: [
    { id: 'calendar', label: t('Запись',       'Appointments', 'Жазылу',   'Yozuv'),             icon: 'Calendar',      route: '/calendar',  visible: true,  order: 0 },
    { id: 'clients',  label: t('Клиенты',      'Clients',   'Клиенттер',   'Mijozlar'),          icon: 'Users',         route: '/clients',   visible: true,  order: 1 },
    { id: 'services', label: t('Услуги',       'Services',  'Қызметтер',   'Xizmatlar'),         icon: 'Tag',           route: '/services',  visible: true,  order: 2 },
    { id: 'settings', label: t('Настройки',    'Settings',  'Параметрлер', 'Sozlamalar'),        icon: 'Settings2',     route: '/settings',  visible: true,  order: 3 },
  ],
}

/** Возвращает дефолтные плитки для продукта, фоллбэк — beauty */
export function getDefaultTiles(product: string): HomeScreenTile[] {
  return HOME_SCREEN_DEFAULTS[product] ?? HOME_SCREEN_DEFAULTS.beauty
}
