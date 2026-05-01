-- Migration 087: per-product master_profiles
--
-- Old schema (001): master_profiles.user_id UNIQUE — одна запись на юзера на все продукты.
-- Migration 026 добавила колонку product, но constraint не поменяла → multi-product сломан:
-- юзер с record(product='beauty') не может создать профиль на cleaning.ezze.site
-- (useProfile фильтрует по product → null → INSERT → 409 на UNIQUE(user_id)).
--
-- Fix: убираем UNIQUE(user_id), добавляем UNIQUE(user_id, product) —
-- разрешить одну запись на пару (юзер, продукт).

-- 1) Drop старого UNIQUE constraint на user_id.
--    Имя auto-generated при column-level UNIQUE: <table>_<col>_key.
ALTER TABLE public.master_profiles
  DROP CONSTRAINT IF EXISTS master_profiles_user_id_key;

-- 2) Добавляем композитный UNIQUE(user_id, product).
ALTER TABLE public.master_profiles
  ADD CONSTRAINT master_profiles_user_id_product_key UNIQUE (user_id, product);

-- 3) Индекс idx_master_profiles_user_id (regular, не unique) остаётся —
--    он нужен для FK lookup-ов и продолжает работать.
