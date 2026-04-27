-- Платёжные агрегаторы (Click/Payme/Uzum) и промокод/скидка по промокоду
-- payment_method остаётся: 'cash' | 'card' | 'transfer' | 'mixed'
-- payment_provider — детализация для card-оплаты: 'click' | 'payme' | 'uzum' | NULL
ALTER TABLE cleaning_orders
  ADD COLUMN IF NOT EXISTS payment_provider TEXT NULL,
  ADD COLUMN IF NOT EXISTS promo_code       TEXT NULL,
  ADD COLUMN IF NOT EXISTS promo_amount     NUMERIC(12,2) DEFAULT 0;
