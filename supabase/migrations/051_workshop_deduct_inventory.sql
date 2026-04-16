-- ─────────────────────────────────────────────────────────────────
-- 051_workshop_deduct_inventory.sql
-- RPC для атомарного списания запчасти со склада.
-- Защищает от отрицательного остатка при конкурентных операциях
-- (FOR UPDATE блокировка строки). Возвращает новый остаток и мин.
-- для UI-алерта «низкий остаток».
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION workshop_deduct_inventory(p_item_id UUID, p_qty NUMERIC)
RETURNS TABLE(new_quantity NUMERIC, min_quantity NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current NUMERIC;
  v_min     NUMERIC;
BEGIN
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;

  SELECT quantity, COALESCE(min_quantity, 0)
    INTO v_current, v_min
    FROM inventory_items
    WHERE id = p_item_id
    FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'inventory_item_not_found';
  END IF;

  IF v_current < p_qty THEN
    RAISE EXCEPTION 'insufficient_stock'
      USING DETAIL = format('available:%s required:%s', v_current, p_qty);
  END IF;

  UPDATE inventory_items
    SET quantity = v_current - p_qty
    WHERE id = p_item_id;

  new_quantity := v_current - p_qty;
  min_quantity := v_min;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION workshop_deduct_inventory(UUID, NUMERIC) TO authenticated;
