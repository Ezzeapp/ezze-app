-- Migration 026: add product column to master_profiles
-- Allows filtering public master search by product (beauty, clinic, workshop, etc.)

ALTER TABLE public.master_profiles
  ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT 'beauty';

-- Backfill from users table
UPDATE public.master_profiles mp
SET product = u.product
FROM public.users u
WHERE mp.user_id = u.id;

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_master_profiles_product ON public.master_profiles(product);

-- RLS: public read stays the same (is_public=true), just adds product context
