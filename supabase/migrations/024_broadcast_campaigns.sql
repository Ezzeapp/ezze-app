-- 024: broadcast_campaigns — таблица для ручных рассылок мастеров

CREATE TABLE IF NOT EXISTS broadcast_campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id        UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name             TEXT NOT NULL,
  message          TEXT NOT NULL,
  promo_code_id    UUID REFERENCES promo_codes(id) ON DELETE SET NULL,
  filter_type      TEXT NOT NULL DEFAULT 'all',
    -- 'all' | 'tag' | 'level' | 'inactive' | 'birthday_month'
  filter_value     TEXT,
    -- tag: имя тега; level: 'regular'|'vip'|'premium'; inactive: кол-во дней; birthday_month: '1'–'12'
  status           TEXT NOT NULL DEFAULT 'draft',
    -- 'draft' | 'sending' | 'sent' | 'failed'
  total_recipients INT DEFAULT 0,
  sent_count       INT DEFAULT 0,
  failed_count     INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  sent_at          TIMESTAMPTZ
);

ALTER TABLE broadcast_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broadcast_campaigns_own" ON broadcast_campaigns
  FOR ALL
  USING  (master_id = auth.uid())
  WITH CHECK (master_id = auth.uid());
