-- Поля оплаты и надбавки для заказов химчистки
ALTER TABLE cleaning_orders
  ADD COLUMN IF NOT EXISTS is_express       BOOLEAN  DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_method   TEXT     DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS surcharge_percent NUMERIC  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surcharge_amount  NUMERIC  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_cash      NUMERIC  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_card      NUMERIC  DEFAULT 0;
