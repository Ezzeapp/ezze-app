-- Третья часть смешанной оплаты: безналичный агрегатор (Click/Payme/Uzum).
-- payment_method='mixed' теперь может содержать одновременно payment_cash + payment_card + payment_aggregator_amount.
-- payment_provider — какой именно агрегатор (используется и для одиночного card-платежа, и для агрегатор-части в Mixed).
ALTER TABLE cleaning_orders
  ADD COLUMN IF NOT EXISTS payment_aggregator_amount NUMERIC(12,2) DEFAULT 0;
