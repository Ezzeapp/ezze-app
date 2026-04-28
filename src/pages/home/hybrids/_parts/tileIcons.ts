import {
  Calendar, Users, ClipboardList, ShoppingCart, Truck, Droplets,
  BarChart3, Tag, Settings2, Wallet, LayoutDashboard, Wrench,
  MessageSquare, Star, Package, UserCheck, Bot, Shield,
  FlaskConical, Pill, BedDouble, Syringe, UtensilsCrossed,
  CalendarDays, BarChart2, Beef, Wheat, Factory,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const TILE_ICON_MAP: Record<string, LucideIcon> = {
  Calendar, CalendarDays, Users, ClipboardList, ShoppingCart, Truck, Droplets,
  BarChart3, BarChart2, Tag, Settings2, Wallet, LayoutDashboard, Wrench,
  MessageSquare, Star, Package, UserCheck, Bot, Shield,
  FlaskConical, Pill, BedDouble, Syringe, UtensilsCrossed,
  Beef, Wheat, Factory,
}

export function getTileIcon(name: string): LucideIcon {
  return TILE_ICON_MAP[name] ?? LayoutDashboard
}

/** Цветовая палитра по id плитки (для гибридов с цветными плитками) */
export const TILE_COLOR_MAP: Record<string, { from: string; to: string; bg: string; fg: string }> = {
  orders:   { from: '#60a5fa', to: '#1d4ed8', bg: 'bg-blue-100 dark:bg-blue-950/40',     fg: 'text-blue-700 dark:text-blue-300' },
  pos:      { from: '#34d399', to: '#047857', bg: 'bg-emerald-100 dark:bg-emerald-950/40', fg: 'text-emerald-700 dark:text-emerald-300' },
  clients:  { from: '#c084fc', to: '#6d28d9', bg: 'bg-violet-100 dark:bg-violet-950/40',  fg: 'text-violet-700 dark:text-violet-300' },
  delivery: { from: '#fbbf24', to: '#b45309', bg: 'bg-amber-100 dark:bg-amber-950/40',    fg: 'text-amber-700 dark:text-amber-300' },
  supplies: { from: '#22d3ee', to: '#0e7490', bg: 'bg-cyan-100 dark:bg-cyan-950/40',      fg: 'text-cyan-700 dark:text-cyan-300' },
  stats:    { from: '#f472b6', to: '#be185d', bg: 'bg-pink-100 dark:bg-pink-950/40',      fg: 'text-pink-700 dark:text-pink-300' },
  services: { from: '#94a3b8', to: '#475569', bg: 'bg-slate-100 dark:bg-slate-800/60',    fg: 'text-slate-700 dark:text-slate-300' },
  settings: { from: '#94a3b8', to: '#334155', bg: 'bg-slate-100 dark:bg-slate-800/60',    fg: 'text-slate-700 dark:text-slate-300' },
}

export function getTileColor(id: string) {
  return TILE_COLOR_MAP[id] ?? TILE_COLOR_MAP.settings
}
