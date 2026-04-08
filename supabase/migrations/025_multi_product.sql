-- Migration 025: Multi-product support
-- Adds 'product' column to users and app_settings
-- Changes app_settings UNIQUE from (key) to (product, key)

-- 1. Add product column to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT 'beauty';

-- 2. Add product column to app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT 'beauty';

-- 3. Drop old UNIQUE constraint on key alone
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_key_key;

-- 4. Add new UNIQUE constraint on (product, key)
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_product_key_unique UNIQUE(product, key);

-- 5. Drop old index, create new one
DROP INDEX IF EXISTS idx_app_settings_key;
CREATE INDEX IF NOT EXISTS idx_app_settings_product_key ON public.app_settings(product, key);

-- 6. Update handle_new_user trigger to read product from auth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, product)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'product', 'beauty')
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Backfill existing rows
UPDATE public.app_settings SET product = 'beauty' WHERE product IS NULL OR product = '';
UPDATE public.users SET product = 'beauty' WHERE product IS NULL OR product = '';
