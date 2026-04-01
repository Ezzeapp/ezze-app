-- Migration 018: Master public profile page
-- Adds cover, geo, page settings, social links, products table

-- New columns in master_profiles
ALTER TABLE master_profiles
  ADD COLUMN IF NOT EXISTS cover_url     TEXT,
  ADD COLUMN IF NOT EXISTS lat           DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng           DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS page_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS youtube       TEXT,
  ADD COLUMN IF NOT EXISTS tiktok        TEXT,
  ADD COLUMN IF NOT EXISTS page_settings JSONB   NOT NULL DEFAULT '{}';

-- Products table
CREATE TABLE IF NOT EXISTS master_products (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  description  TEXT,
  price        INT         NOT NULL DEFAULT 0,
  photo_url    TEXT,
  is_available BOOLEAN     NOT NULL DEFAULT TRUE,
  order_index  INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE master_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_owner_all" ON master_products
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "products_public_select" ON master_products
  FOR SELECT USING (TRUE);

-- Storage bucket for product photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', TRUE)
ON CONFLICT DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'products_upload' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "products_upload" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'products' AND auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'products_delete' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "products_delete" ON storage.objects
      FOR DELETE USING (bucket_id = 'products' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'products_read' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "products_read" ON storage.objects
      FOR SELECT USING (bucket_id = 'products');
  END IF;
END $$;

-- Storage bucket for cover photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', TRUE)
ON CONFLICT DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'covers_upload' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "covers_upload" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'covers_delete' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "covers_delete" ON storage.objects
      FOR DELETE USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'covers_read' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "covers_read" ON storage.objects
      FOR SELECT USING (bucket_id = 'covers');
  END IF;
END $$;
