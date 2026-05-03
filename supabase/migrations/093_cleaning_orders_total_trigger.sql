-- 093_cleaning_orders_total_trigger.sql
-- Автоматический пересчёт cleaning_orders.total_amount триггером.
--
-- Раньше пересчёт делался в JS-хуках useAddItemToOrder /
-- useRemoveItemFromOrder / useUpdateOrderItem двумя отдельными
-- запросами: операция над items + UPDATE orders. PostgREST не
-- транзакционный — если второй запрос падает (network/RLS), total
-- расходится с фактической суммой items.price. Также два пользователя,
-- одновременно правящие позиции одного заказа, могут затереть итог
-- друг друга.
--
-- Триггер делает пересчёт атомарно в одной транзакции с INSERT/UPDATE/
-- DELETE на cleaning_order_items.
--
-- Хуки в JS пока продолжают делать UPDATE — это безвредно, триггер
-- перезатрёт правильным значением. Со временем JS-update можно убрать.

CREATE OR REPLACE FUNCTION public.recalc_cleaning_order_total()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_order_id UUID;
  v_total    NUMERIC;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);
  IF v_order_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(price), 0)
    INTO v_total
    FROM public.cleaning_order_items
   WHERE order_id = v_order_id;

  UPDATE public.cleaning_orders
     SET total_amount = v_total
   WHERE id = v_order_id
     AND total_amount IS DISTINCT FROM v_total;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_cleaning_order_total_ins ON public.cleaning_order_items;
CREATE TRIGGER trg_recalc_cleaning_order_total_ins
  AFTER INSERT ON public.cleaning_order_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_cleaning_order_total();

DROP TRIGGER IF EXISTS trg_recalc_cleaning_order_total_upd ON public.cleaning_order_items;
CREATE TRIGGER trg_recalc_cleaning_order_total_upd
  AFTER UPDATE OF price, order_id ON public.cleaning_order_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_cleaning_order_total();

DROP TRIGGER IF EXISTS trg_recalc_cleaning_order_total_del ON public.cleaning_order_items;
CREATE TRIGGER trg_recalc_cleaning_order_total_del
  AFTER DELETE ON public.cleaning_order_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_cleaning_order_total();

-- Backfill: один раз пересчитать total_amount для существующих заказов.
-- Безопасно — триггер сам пересчитает, но мы вручную чтобы покрыть
-- заказы, у которых items уже на месте.
UPDATE public.cleaning_orders co
   SET total_amount = sub.s
  FROM (
    SELECT order_id, COALESCE(SUM(price), 0) AS s
      FROM public.cleaning_order_items
  GROUP BY order_id
  ) sub
 WHERE sub.order_id = co.id
   AND co.total_amount IS DISTINCT FROM sub.s;
