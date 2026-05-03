-- 087_cleaning_realtime.sql
-- Добавляем cleaning-таблицы в supabase_realtime publication.
--
-- Без этого фронт может subscribe в RealtimeProvider, но изменения от других
-- участников команды не приходят — каждый видит только свои локальные мутации.
-- В частности: один сотрудник принял заказ, второй на /orders не видит его
-- без F5; статус сменился, плашка «к выдаче» не обновилась.

ALTER PUBLICATION supabase_realtime ADD TABLE public.cleaning_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cleaning_order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cleaning_supplies;
