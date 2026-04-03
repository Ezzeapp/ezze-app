-- Temporary phone verification codes for web login
CREATE TABLE IF NOT EXISTS phone_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for lookup
CREATE INDEX IF NOT EXISTS idx_phone_codes_phone ON phone_codes(phone, used, expires_at);

-- Auto-cleanup: delete expired codes on insert (same pattern as tg_phone_cache)
CREATE OR REPLACE FUNCTION cleanup_phone_codes() RETURNS trigger AS $$
BEGIN
  DELETE FROM phone_codes WHERE expires_at < now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cleanup_phone_codes
  BEFORE INSERT ON phone_codes
  FOR EACH STATEMENT EXECUTE FUNCTION cleanup_phone_codes();

-- RLS: only service_role can access (edge functions use service role key)
ALTER TABLE phone_codes ENABLE ROW LEVEL SECURITY;
