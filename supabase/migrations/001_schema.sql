-- ============================================================
-- Ezze SaaS Platform — Supabase PostgreSQL Migration 001
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";


-- ============================================================
-- 1. PUBLIC USERS TABLE (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan        TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  is_admin    BOOLEAN NOT NULL DEFAULT false,
  onboarded   BOOLEAN NOT NULL DEFAULT false,
  disabled    BOOLEAN NOT NULL DEFAULT false,
  language    TEXT DEFAULT 'ru',
  theme       TEXT DEFAULT 'light',
  timezone    TEXT DEFAULT 'Asia/Tashkent',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create user record on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 2. MASTER PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.master_profiles (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  profession            TEXT,
  bio                   TEXT,
  booking_slug          TEXT UNIQUE,
  is_public             BOOLEAN NOT NULL DEFAULT false,
  phone                 TEXT,
  city                  TEXT,
  address               TEXT,
  website               TEXT,
  instagram             TEXT,
  telegram              TEXT,
  whatsapp              TEXT,
  vk                    TEXT,
  tg_chat_id            TEXT,
  notification_email    TEXT,
  avatar                TEXT,
  portfolio             TEXT[] DEFAULT '{}',
  currency              TEXT DEFAULT 'UZS',
  timezone              TEXT DEFAULT 'Asia/Tashkent',
  remind_master_hours   INT DEFAULT 2,
  remind_client_hours   INT DEFAULT 2,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_profiles_user_id     ON public.master_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_master_profiles_booking_slug ON public.master_profiles(booking_slug);


-- ============================================================
-- 3. CLIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  master_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  first_name    TEXT NOT NULL,
  last_name     TEXT,
  phone         TEXT,
  email         TEXT,
  birthday      TEXT,
  avatar        TEXT,
  notes         TEXT,
  source        TEXT,
  tags          JSONB DEFAULT '[]',
  total_visits  INT DEFAULT 0,
  last_visit    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_master_id ON public.clients(master_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone     ON public.clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_email     ON public.clients(email);


-- ============================================================
-- 4. SERVICE CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  master_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT,
  "order"     INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_categories_master_id ON public.service_categories(master_id);


-- ============================================================
-- 5. SERVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.services (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  master_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  duration_min  INT NOT NULL,
  price         NUMERIC NOT NULL DEFAULT 0,
  price_max     NUMERIC,
  is_active     BOOLEAN DEFAULT true,
  is_bookable   BOOLEAN DEFAULT true,
  image         TEXT,
  "order"       INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_master_id   ON public.services(master_id);
CREATE INDEX IF NOT EXISTS idx_services_category_id ON public.services(category_id);
CREATE INDEX IF NOT EXISTS idx_services_is_active   ON public.services(is_active);


-- ============================================================
-- 6. SCHEDULES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.schedules (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  master_id      UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  mon_enabled    BOOLEAN DEFAULT true,
  tue_enabled    BOOLEAN DEFAULT true,
  wed_enabled    BOOLEAN DEFAULT true,
  thu_enabled    BOOLEAN DEFAULT true,
  fri_enabled    BOOLEAN DEFAULT true,
  sat_enabled    BOOLEAN DEFAULT false,
  sun_enabled    BOOLEAN DEFAULT false,
  mon_start      TEXT DEFAULT '09:00',
  tue_start      TEXT DEFAULT '09:00',
  wed_start      TEXT DEFAULT '09:00',
  thu_start      TEXT DEFAULT '09:00',
  fri_start      TEXT DEFAULT '09:00',
  sat_start      TEXT DEFAULT '09:00',
  sun_start      TEXT DEFAULT '09:00',
  mon_end        TEXT DEFAULT '18:00',
  tue_end        TEXT DEFAULT '18:00',
  wed_end        TEXT DEFAULT '18:00',
  thu_end        TEXT DEFAULT '18:00',
  fri_end        TEXT DEFAULT '18:00',
  sat_end        TEXT DEFAULT '18:00',
  sun_end        TEXT DEFAULT '18:00',
  slot_duration  INT DEFAULT 30,
  advance_days   INT DEFAULT 30,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedules_master_id ON public.schedules(master_id);


-- ============================================================
-- 7. SCHEDULE BREAKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.schedule_breaks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  master_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day_of_week  TEXT,
  start_time   TEXT,
  end_time     TEXT,
  label        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_breaks_master_id ON public.schedule_breaks(master_id);


-- ============================================================
-- 8. APPOINTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  master_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id              UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  service_id             UUID REFERENCES public.services(id) ON DELETE SET NULL,
  date                   TEXT NOT NULL,
  start_time             TEXT NOT NULL,
  end_time               TEXT NOT NULL,
  status                 TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','done','cancelled','no_show')),
  price                  NUMERIC DEFAULT 0,
  client_name            TEXT,
  client_phone           TEXT,
  client_email           TEXT,
  telegram_id            TEXT,
  client_telegram        TEXT,
  client_avatar          TEXT,
  notes                  TEXT,
  booked_via             TEXT DEFAULT 'manual' CHECK (booked_via IN ('manual','online')),
  cancel_token           TEXT,
  promo_code             TEXT,
  booking_theme          TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_master_id  ON public.appointments(master_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id  ON public.appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON public.appointments(service_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date       ON public.appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_status     ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_cancel_token ON public.appointments(cancel_token);


-- ============================================================
-- 9. APPOINTMENT SERVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointment_services (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id  UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  service_id      UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_name    TEXT,
  price           NUMERIC DEFAULT 0,
  duration_min    INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_services_appointment_id ON public.appointment_services(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_services_service_id     ON public.appointment_services(service_id);


-- ============================================================
-- 10. INVENTORY ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  master_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  sku           TEXT,
  category      TEXT,
  description   TEXT,
  unit          TEXT DEFAULT 'шт',
  quantity      NUMERIC NOT NULL DEFAULT 0,
  min_quantity  NUMERIC DEFAULT 0,
  cost_price    NUMERIC DEFAULT 0,
  sell_price    NUMERIC DEFAULT 0,
  supplier      TEXT,
  image         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_master_id ON public.inventory_items(master_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku       ON public.inventory_items(sku);


-- ============================================================
-- 11. INVENTORY RECEIPTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory_receipts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_item_id   UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity            NUMERIC NOT NULL,
  date                TEXT,
  reference           TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_receipts_inventory_item_id ON public.inventory_receipts(inventory_item_id);


-- ============================================================
-- 12. SERVICE MATERIALS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_materials (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id          UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  inventory_item_id   UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity            NUMERIC NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_id, inventory_item_id)
);

CREATE INDEX IF NOT EXISTS idx_service_materials_service_id        ON public.service_materials(service_id);
CREATE INDEX IF NOT EXISTS idx_service_materials_inventory_item_id ON public.service_materials(inventory_item_id);


-- ============================================================
-- 13. TEAMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.teams (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT,
  logo         TEXT,
  is_public    BOOLEAN DEFAULT false,
  currency     TEXT DEFAULT 'UZS',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON public.teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_slug     ON public.teams(slug);


-- ============================================================
-- 14. TEAM MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.team_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role       TEXT DEFAULT 'member',
  status     TEXT DEFAULT 'active' CHECK (status IN ('active','paused','removed')),
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);


-- ============================================================
-- 15. TEAM INVITES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.team_invites (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id         UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code            TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  max_uses        INT,
  use_count       INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  label           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_invites_team_id ON public.team_invites(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_code    ON public.team_invites(code);


-- ============================================================
-- 16. FEATURE FLAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE,
  flag_name   TEXT NOT NULL,
  enabled     BOOLEAN DEFAULT false,
  value       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_user_id   ON public.feature_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_flag_name ON public.feature_flags(flag_name);


-- ============================================================
-- 17. SPECIALTIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.specialties (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  master_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT,
  level       TEXT,
  years       INT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_specialties_master_id ON public.specialties(master_id);


-- ============================================================
-- 18. GLOBAL SERVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.global_services (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  category    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_global_services_category ON public.global_services(category);


-- ============================================================
-- 19. GLOBAL PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.global_products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  category    TEXT,
  unit        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_global_products_category ON public.global_products(category);


-- ============================================================
-- 20. APP SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings(key);


-- ============================================================
-- 21. NOTIFICATION SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  master_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type                  TEXT NOT NULL,
  enabled               BOOLEAN DEFAULT true,
  timing_hours          INT,
  timing_days           INT,
  template              TEXT,
  enable_email          BOOLEAN DEFAULT false,
  notification_email    TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(master_id, type)
);

CREATE INDEX IF NOT EXISTS idx_notification_settings_master_id ON public.notification_settings(master_id);


-- ============================================================
-- 22. REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  master_id       TEXT NOT NULL,
  telegram_id     TEXT,
  client_name     TEXT,
  rating          INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  appointment_id  TEXT,
  is_visible      BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_master_id  ON public.reviews(master_id);
CREATE INDEX IF NOT EXISTS idx_reviews_is_visible ON public.reviews(is_visible);


-- ============================================================
-- 23. PROMO CODES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  master_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  discount_type   TEXT NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value  NUMERIC NOT NULL,
  valid_from      TEXT,
  valid_until     TEXT,
  max_uses        INT,
  use_count       INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_master_id ON public.promo_codes(master_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code      ON public.promo_codes(code);


-- ============================================================
-- 24. DATE BLOCKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.date_blocks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  master_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date          TEXT,
  date_from     TEXT,
  date_to       TEXT,
  reason        TEXT,
  is_recurring  BOOLEAN DEFAULT false,
  all_day       BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_date_blocks_master_id ON public.date_blocks(master_id);
CREATE INDEX IF NOT EXISTS idx_date_blocks_date      ON public.date_blocks(date);


-- ============================================================
-- 25. COPY SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.copy_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_user_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  data            JSONB,
  expires_at      TIMESTAMPTZ,
  used            BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_copy_snapshots_source_user_id ON public.copy_snapshots(source_user_id);
CREATE INDEX IF NOT EXISTS idx_copy_snapshots_token          ON public.copy_snapshots(token);


-- ============================================================
-- 26. SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan                      TEXT NOT NULL,
  amount_uzs                NUMERIC,
  provider                  TEXT CHECK (provider IN ('payme','click')),
  status                    TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','cancelled','expired')),
  provider_transaction_id   TEXT,
  period_months             INT,
  expires_at                TIMESTAMPTZ,
  create_time_ms            BIGINT,
  perform_time_ms           BIGINT,
  cancel_time_ms            BIGINT,
  cancel_reason             INT,
  raw_payload               JSONB,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id   ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status    ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider  ON public.subscriptions(provider);


-- ============================================================
-- 27. EMAIL LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id  TEXT,
  type            TEXT,
  recipient       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(appointment_id, type)
);

CREATE INDEX IF NOT EXISTS idx_email_log_appointment_id ON public.email_log(appointment_id);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- SECURITY DEFINER helper — bypasses RLS, prevents infinite recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.users WHERE id = auth.uid()),
    false
  )
$$;

-- users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_owner" ON public.users
  FOR ALL USING (id = auth.uid());
CREATE POLICY "users_admin_read" ON public.users
  FOR SELECT USING (public.is_admin());

-- master_profiles
ALTER TABLE public.master_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "master_profiles_owner" ON public.master_profiles
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "master_profiles_public_read" ON public.master_profiles
  FOR SELECT USING (is_public = true);

-- clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_owner" ON public.clients
  FOR ALL USING (master_id = auth.uid());

-- service_categories
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_categories_owner" ON public.service_categories
  FOR ALL USING (master_id = auth.uid());

-- services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services_owner" ON public.services
  FOR ALL USING (master_id = auth.uid());
CREATE POLICY "services_public_read" ON public.services
  FOR SELECT USING (is_bookable = true AND is_active = true);

-- schedules
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules_owner" ON public.schedules
  FOR ALL USING (master_id = auth.uid());
CREATE POLICY "schedules_public_read" ON public.schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.master_profiles mp
      WHERE mp.user_id = schedules.master_id AND mp.is_public = true
    )
  );

-- schedule_breaks
ALTER TABLE public.schedule_breaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule_breaks_owner" ON public.schedule_breaks
  FOR ALL USING (master_id = auth.uid());

-- appointments
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appointments_owner" ON public.appointments
  FOR ALL USING (master_id = auth.uid());

-- appointment_services
ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appointment_services_owner" ON public.appointment_services
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_services.appointment_id
        AND a.master_id = auth.uid()
    )
  );

-- inventory_items
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_items_owner" ON public.inventory_items
  FOR ALL USING (master_id = auth.uid());

-- inventory_receipts
ALTER TABLE public.inventory_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_receipts_owner" ON public.inventory_receipts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.inventory_items ii
      WHERE ii.id = inventory_receipts.inventory_item_id
        AND ii.master_id = auth.uid()
    )
  );

-- service_materials
ALTER TABLE public.service_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_materials_owner" ON public.service_materials
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = service_materials.service_id
        AND s.master_id = auth.uid()
    )
  );

-- teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_owner" ON public.teams
  FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "teams_member_read" ON public.teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = teams.id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
    )
  );
CREATE POLICY "teams_public_read" ON public.teams
  FOR SELECT USING (is_public = true);

-- team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_members_owner" ON public.team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id
        AND t.owner_id = auth.uid()
    )
  );
CREATE POLICY "team_members_self_read" ON public.team_members
  FOR SELECT USING (user_id = auth.uid());

-- team_invites
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_invites_owner" ON public.team_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_invites.team_id
        AND t.owner_id = auth.uid()
    )
  );
CREATE POLICY "team_invites_public_read" ON public.team_invites
  FOR SELECT USING (is_active = true AND expires_at > NOW());

-- feature_flags
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_flags_owner" ON public.feature_flags
  FOR ALL USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "feature_flags_admin" ON public.feature_flags
  FOR ALL USING (
    public.is_admin()
  );

-- specialties
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "specialties_owner" ON public.specialties
  FOR ALL USING (master_id = auth.uid());
CREATE POLICY "specialties_public_read" ON public.specialties
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.master_profiles mp
      WHERE mp.user_id = specialties.master_id AND mp.is_public = true
    )
  );

-- global_services (public read)
ALTER TABLE public.global_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "global_services_public_read" ON public.global_services
  FOR SELECT USING (true);
CREATE POLICY "global_services_admin_write" ON public.global_services
  FOR ALL USING (
    public.is_admin()
  );

-- global_products (public read)
ALTER TABLE public.global_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "global_products_public_read" ON public.global_products
  FOR SELECT USING (true);
CREATE POLICY "global_products_admin_write" ON public.global_products
  FOR ALL USING (
    public.is_admin()
  );

-- app_settings (public read)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings_public_read" ON public.app_settings
  FOR SELECT USING (true);
CREATE POLICY "app_settings_admin_write" ON public.app_settings
  FOR ALL USING (
    public.is_admin()
  );

-- notification_settings
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification_settings_owner" ON public.notification_settings
  FOR ALL USING (master_id = auth.uid());

-- reviews (public read when visible)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_read" ON public.reviews
  FOR SELECT USING (is_visible = true);
CREATE POLICY "reviews_master_manage" ON public.reviews
  FOR ALL USING (master_id = auth.uid()::text);
CREATE POLICY "reviews_insert_anon" ON public.reviews
  FOR INSERT WITH CHECK (true);

-- promo_codes
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_codes_owner" ON public.promo_codes
  FOR ALL USING (master_id = auth.uid());

-- date_blocks
ALTER TABLE public.date_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "date_blocks_owner" ON public.date_blocks
  FOR ALL USING (master_id = auth.uid());

-- copy_snapshots
ALTER TABLE public.copy_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copy_snapshots_owner" ON public.copy_snapshots
  FOR ALL USING (source_user_id = auth.uid());
CREATE POLICY "copy_snapshots_token_read" ON public.copy_snapshots
  FOR SELECT USING (used = false AND (expires_at IS NULL OR expires_at > NOW()));

-- subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_owner" ON public.subscriptions
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "subscriptions_admin" ON public.subscriptions
  FOR ALL USING (
    public.is_admin()
  );

-- email_log
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_log_admin" ON public.email_log
  FOR ALL USING (
    public.is_admin()
  );


-- ============================================================
-- PLAN LIMITS TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_plan_limits()
RETURNS TRIGGER AS $$
DECLARE
  user_plan      TEXT;
  current_count  INT;
  limits         JSONB;
  table_limit    INT;
  limit_key      TEXT;
BEGIN
  -- Get user plan
  SELECT plan INTO user_plan FROM public.users WHERE id = auth.uid();
  IF user_plan IN ('pro', 'enterprise') THEN RETURN NEW; END IF;

  -- Get limits from app_settings
  SELECT value::jsonb INTO limits FROM public.app_settings WHERE key = 'plan_limits';
  IF limits IS NULL THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'clients' THEN
    limit_key := 'clients';
    SELECT COUNT(*) INTO current_count FROM public.clients WHERE master_id = NEW.master_id;
  ELSIF TG_TABLE_NAME = 'services' THEN
    limit_key := 'services';
    SELECT COUNT(*) INTO current_count FROM public.services WHERE master_id = NEW.master_id;
  ELSIF TG_TABLE_NAME = 'appointments' THEN
    limit_key := 'appts_month';
    SELECT COUNT(*) INTO current_count FROM public.appointments
    WHERE master_id = NEW.master_id
      AND date >= to_char(date_trunc('month', NOW()), 'YYYY-MM-DD')
      AND date < to_char(date_trunc('month', NOW()) + INTERVAL '1 month', 'YYYY-MM-DD');
  END IF;

  table_limit := (limits -> 'free' ->> limit_key)::INT;
  IF table_limit IS NOT NULL AND current_count >= table_limit THEN
    RAISE EXCEPTION 'Plan limit reached for %', limit_key;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_clients_limit ON public.clients;
CREATE TRIGGER check_clients_limit
  BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.check_plan_limits();

DROP TRIGGER IF EXISTS check_services_limit ON public.services;
CREATE TRIGGER check_services_limit
  BEFORE INSERT ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.check_plan_limits();

DROP TRIGGER IF EXISTS check_appointments_limit ON public.appointments;
CREATE TRIGGER check_appointments_limit
  BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.check_plan_limits();


-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all relevant tables
DROP TRIGGER IF EXISTS set_updated_at ON public.users;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.master_profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.master_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.clients;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.services;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.schedules;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.appointments;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.inventory_items;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.teams;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.app_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.notification_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.promo_codes;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.subscriptions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars',   'avatars',   true),
  ('portfolio', 'portfolio', true),
  ('inventory', 'inventory', true),
  ('teams',     'teams',     true),
  ('services',  'services',  true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public read avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Auth upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "Owner delete avatars" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read portfolio" ON storage.objects
  FOR SELECT USING (bucket_id = 'portfolio');
CREATE POLICY "Auth upload portfolio" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'portfolio' AND auth.uid() IS NOT NULL);
CREATE POLICY "Owner delete portfolio" ON storage.objects
  FOR DELETE USING (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read inventory" ON storage.objects
  FOR SELECT USING (bucket_id = 'inventory');
CREATE POLICY "Auth upload inventory" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'inventory' AND auth.uid() IS NOT NULL);
CREATE POLICY "Owner delete inventory" ON storage.objects
  FOR DELETE USING (bucket_id = 'inventory' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read teams" ON storage.objects
  FOR SELECT USING (bucket_id = 'teams');
CREATE POLICY "Auth upload teams" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'teams' AND auth.uid() IS NOT NULL);
CREATE POLICY "Owner delete teams" ON storage.objects
  FOR DELETE USING (bucket_id = 'teams' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read services" ON storage.objects
  FOR SELECT USING (bucket_id = 'services');
CREATE POLICY "Auth upload services" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'services' AND auth.uid() IS NOT NULL);
CREATE POLICY "Owner delete services" ON storage.objects
  FOR DELETE USING (bucket_id = 'services' AND auth.uid()::text = (storage.foldername(name))[1]);


-- ============================================================
-- DEFAULT APP SETTINGS
-- ============================================================
INSERT INTO public.app_settings (key, value) VALUES
  ('plan_limits', '{"free":{"clients":50,"services":10,"appts_month":100},"pro":{"clients":null,"services":null,"appts_month":null}}')
ON CONFLICT (key) DO NOTHING;
