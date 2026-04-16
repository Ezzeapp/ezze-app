-- 048: RPC for saving order types config (bypasses RLS for authenticated users)
-- Fixes: toggles in superadmin and POS settings not persisting

CREATE OR REPLACE FUNCTION public.save_order_types_config(p_config text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.app_settings
  SET value = p_config
  WHERE product = 'cleaning'
    AND key = 'cleaning_order_types_config';

  IF NOT FOUND THEN
    INSERT INTO public.app_settings (product, key, value)
    VALUES ('cleaning', 'cleaning_order_types_config', p_config);
  END IF;
END;
$$;
