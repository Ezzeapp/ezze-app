-- Migration 022: Add Payme state column to subscriptions
-- Payme JSONRPC protocol requires tracking numeric state:
--   1  = created (reserved)
--   2  = completed (funds charged)
--  -1  = cancelled (before completion)
--  -2  = cancelled_after (after completion)
-- Without this column CreateTransaction / PerformTransaction / CancelTransaction all fail.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS state INTEGER;
