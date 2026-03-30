-- Migration 016: Add click_invoice_id to subscriptions
-- Stores the Click Merchant API invoice ID created before payment

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS click_invoice_id BIGINT;

COMMENT ON COLUMN public.subscriptions.click_invoice_id IS
  'Invoice ID from Click Merchant API (created server-side before payment)';
