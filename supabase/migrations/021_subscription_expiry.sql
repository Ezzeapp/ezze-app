-- Migration 021: Subscription expiry soft-lock support
-- Adds flags to track which records were deactivated due to subscription expiry
-- (distinguishes from manually deactivated records, enables auto-restore on renewal)

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS suspended_by_expiry BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS suspended_by_expiry BOOLEAN NOT NULL DEFAULT false;

-- Track which reminder days have been sent to avoid duplicate TG notifications
-- Format: { "7": "2026-04-03T09:00:00Z", "3": "...", "1": "..." }
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS reminders_sent JSONB NOT NULL DEFAULT '{}';
