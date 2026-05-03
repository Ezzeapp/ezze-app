/**
 * RealtimeSync — глобальный провайдер Supabase Realtime
 *
 * Один канал на всё приложение. При любом изменении в таблице
 * инвалидирует связанные React Query кеши → компоненты
 * автоматически перезагружают свежие данные без ручного refresh.
 *
 * Монтируется один раз в корне App.tsx.
 */
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function RealtimeSync() {
  const qc = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('app_realtime_global')

      // ── Записи (calendar, stats, client cabinet) ────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        qc.invalidateQueries({ queryKey: ['appointments'] })
        qc.invalidateQueries({ queryKey: ['team_calendar'] })
        qc.invalidateQueries({ queryKey: ['client_stats'] })
        qc.invalidateQueries({ queryKey: ['global_search_appts'] })
        qc.invalidateQueries({ queryKey: ['admin_reports'] })
      })

      // ── Cleaning заказы ─────────────────────────────────────────────────────
      // Без realtime команда не видит заказы соратников, пока не F5: статус
      // сменился, заказ создан — не отражается в /orders, /stats, OpsModule.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cleaning_orders' }, () => {
        qc.invalidateQueries({ queryKey: ['cleaning_orders'] })
        qc.invalidateQueries({ queryKey: ['cleaning_stats'] })
        qc.invalidateQueries({ queryKey: ['cleaning_delivery'] })
        qc.invalidateQueries({ queryKey: ['cleaning_reports'] })
        qc.invalidateQueries({ queryKey: ['cleaning_reports_all'] })
        qc.invalidateQueries({ queryKey: ['cleaning_client_stats'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cleaning_order_items' }, () => {
        qc.invalidateQueries({ queryKey: ['cleaning_orders'] })
        qc.invalidateQueries({ queryKey: ['cleaning_stats'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cleaning_supplies' }, () => {
        qc.invalidateQueries({ queryKey: ['cleaning_supplies'] })
      })

      // ── Клиенты мастеров ────────────────────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        qc.invalidateQueries({ queryKey: ['clients'] })
        qc.invalidateQueries({ queryKey: ['admin_master_clients'] })
      })

      // ── Telegram-клиенты (admin panel, client cabinet) ──────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tg_clients' }, () => {
        qc.invalidateQueries({ queryKey: ['admin_tg_clients'] })
        qc.invalidateQueries({ queryKey: ['admin_reports'] })
      })

      // ── Профили мастеров (поиск, бронирование) ──────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'master_profiles' }, () => {
        qc.invalidateQueries({ queryKey: ['master_profile'] })
        qc.invalidateQueries({ queryKey: ['master_search'] })
        qc.invalidateQueries({ queryKey: ['master_search_cabinet'] })
      })

      // ── Услуги ──────────────────────────────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => {
        qc.invalidateQueries({ queryKey: ['services'] })
        qc.invalidateQueries({ queryKey: ['global_services'] })
      })

      // ── Команды ─────────────────────────────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        qc.invalidateQueries({ queryKey: ['public_teams_cabinet'] })
        qc.invalidateQueries({ queryKey: ['public_teams_search'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, () => {
        qc.invalidateQueries({ queryKey: ['public_team_members'] })
        qc.invalidateQueries({ queryKey: ['team_analytics'] })
      })

      // ── Отзывы ──────────────────────────────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => {
        qc.invalidateQueries({ queryKey: ['reviews'] })
      })

      // ── Промокоды ───────────────────────────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'promo_codes' }, () => {
        qc.invalidateQueries({ queryKey: ['promo_codes'] })
      })

      // ── Расписание и блокировки ─────────────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
        qc.invalidateQueries({ queryKey: ['schedule'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_breaks' }, () => {
        qc.invalidateQueries({ queryKey: ['schedule_breaks'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'date_blocks' }, () => {
        qc.invalidateQueries({ queryKey: ['date_blocks'] })
      })

      // ── Склад ───────────────────────────────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        qc.invalidateQueries({ queryKey: ['inventory'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_receipts' }, () => {
        qc.invalidateQueries({ queryKey: ['inventory_receipts'] })
      })

      // ── Лояльность ──────────────────────────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loyalty_settings' }, () => {
        qc.invalidateQueries({ queryKey: ['loyalty_settings'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loyalty_points' }, () => {
        qc.invalidateQueries({ queryKey: ['loyalty_points'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loyalty_holidays' }, () => {
        qc.invalidateQueries({ queryKey: ['loyalty_holidays'] })
      })

      // ── Подписки (биллинг) ──────────────────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => {
        qc.invalidateQueries({ queryKey: ['subscriptions'] })
        qc.invalidateQueries({ queryKey: ['my_subscription'] })
        qc.invalidateQueries({ queryKey: ['admin_reports'] })
      })

      // ── Пользователи (admin) ────────────────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        qc.invalidateQueries({ queryKey: ['users'] })
      })

      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])

  return null
}
