import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export const NOTIF_SETTINGS_KEY = 'notification_settings'

export type NotifType =
  | 'new_appointment'
  | 'reminder_master'
  | 'birthday_notify'
  | 'appointment_confirmed'
  | 'appointment_master_confirmed'
  | 'reminder_client'
  | 'appointment_cancelled'
  | 'appointment_rescheduled'
  | 'post_visit_review'
  | 'birthday_greeting'
  | 'win_back'

export interface NotificationSetting {
  id?: string
  master_id: string
  type: NotifType
  enabled: boolean
  enable_email?: boolean   // email-канал (opt-in, дефолт false)
  timing_hours?: number    // для reminder_master / reminder_client
  timing_days?: number     // для win_back
  template?: string        // null/empty = системный шаблон (Telegram)
  email_template?: string  // null/empty = системный шаблон (Email)
}

// ─── Дефолтные значения ─────────────────────────────────────────────────────
export const NOTIF_DEFAULTS: Record<NotifType, Omit<NotificationSetting, 'id' | 'master_id'>> = {
  new_appointment: {
    type: 'new_appointment',
    enabled: true, enable_email: false,
    template: '', email_template: '',
  },
  reminder_master: {
    type: 'reminder_master',
    enabled: true, enable_email: false,
    timing_hours: 24,
    template: '', email_template: '',
  },
  birthday_notify: {
    type: 'birthday_notify',
    enabled: true, enable_email: false,
    template: '', email_template: '',
  },
  appointment_confirmed: {
    type: 'appointment_confirmed',
    enabled: true, enable_email: false,
    template: '', email_template: '',
  },
  appointment_master_confirmed: {
    type: 'appointment_master_confirmed',
    enabled: true, enable_email: false,
    template: '', email_template: '',
  },
  reminder_client: {
    type: 'reminder_client',
    enabled: true, enable_email: false,
    timing_hours: 24,
    template: '', email_template: '',
  },
  appointment_cancelled: {
    type: 'appointment_cancelled',
    enabled: true, enable_email: false,
    template: '', email_template: '',
  },
  appointment_rescheduled: {
    type: 'appointment_rescheduled',
    enabled: true, enable_email: false,
    template: '', email_template: '',
  },
  post_visit_review: {
    type: 'post_visit_review',
    enabled: true, enable_email: false,
    template: '', email_template: '',
  },
  birthday_greeting: {
    type: 'birthday_greeting',
    enabled: true, enable_email: false,
    template: '', email_template: '',
  },
  win_back: {
    type: 'win_back',
    enabled: false, enable_email: false,
    timing_days: 30,
    template: '', email_template: '',
  },
}

// ─── Дефолтные шаблоны (для отображения в UI как placeholder) ────────────────
export const NOTIF_DEFAULT_TEMPLATES: Record<NotifType, string> = {
  new_appointment:
    '🔔 Новая запись!\n\n👤 {client_name}\n✂️ {service}\n📅 {date} в {time}',
  reminder_master:
    '⏰ Напоминание! Через {hours} у вас запись:\n\n👤 {client_name}\n✂️ {service}\n🕐 {time}',
  birthday_notify:
    '🎂 Сегодня день рождения клиента {client_name}!\n📞 {client_phone}\n\n🎉 Не забудьте поздравить!',
  appointment_confirmed:
    '✅ Запись подтверждена!\n\nВы записаны к {master_name}\n✂️ {service}\n📅 {date} в {time}\n\n❌ Отменить: {cancel_link}',
  appointment_master_confirmed:
    '✅ Запись подтверждена мастером!\n\n👤 Мастер: {master_name}\n✂️ {service}\n📅 {date} в {time}\n\nДо встречи! 🌟\n\n❌ Отменить: {cancel_link}',
  reminder_client:
    '⏰ Напоминание! Через {hours} у вас запись:\n\n💇 {master_name}\n✂️ {service}\n🕐 {time}',
  appointment_cancelled:
    '❌ Ваша запись на {date} в {time} отменена.\n\nЗаписаться снова: {booking_link}',
  appointment_rescheduled:
    '📅 Ваша запись перенесена!\n✂️ {service}\nНовое время: {date} в {time}\n\n❌ Отменить: {cancel_link}',
  post_visit_review:
    '⭐ Спасибо за визит!\n\nБудем рады вашему отзыву: {review_link}',
  birthday_greeting:
    '🎂 С Днём Рождения, {client_name}!\n\nПоздравляет {master_name} 🎉\nЗаписаться: {booking_link}',
  win_back:
    'Привет, {client_name}! 👋\n\nДавно не видались — заходите снова!\nЗаписаться: {booking_link}',
}

// ─── Хуки ───────────────────────────────────────────────────────────────────

export function useNotificationSettings() {
  const { user } = useAuth()

  return useQuery({
    queryKey: [NOTIF_SETTINGS_KEY, user?.id],
    queryFn: async () => {
      const { data: records, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('master_id', user!.id)
      if (error) throw error

      // Мержим с дефолтами: для типов без записи в БД — используем дефолт
      const map: Record<NotifType, NotificationSetting> = {} as Record<NotifType, NotificationSetting>
      const allTypes = Object.keys(NOTIF_DEFAULTS) as NotifType[]

      for (const type of allTypes) {
        const dbRecord = (records ?? []).find((r) => r.type === type)
        if (dbRecord) {
          map[type] = dbRecord as NotificationSetting
        } else {
          map[type] = { ...NOTIF_DEFAULTS[type], master_id: user!.id }
        }
      }
      return map
    },
    enabled: !!user,
    staleTime: 60_000,
  })
}

export function useUpsertNotificationSetting() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (data: Partial<NotificationSetting> & { type: NotifType }) => {
      const payload = {
        ...NOTIF_DEFAULTS[data.type],
        ...data,
        master_id: user!.id,
      }

      const { data: result, error } = await supabase
        .from('notification_settings')
        .upsert(payload, { onConflict: 'master_id,type' })
        .select()
        .single()
      if (error) throw error
      return result as NotificationSetting
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIF_SETTINGS_KEY, user?.id] })
    },
  })
}
