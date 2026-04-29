-- ─────────────────────────────────────────────────────────────────
-- 076_team_module_access.sql
-- teams.module_access — JSONB-карта { role: [module, module, ...] }.
-- Владелец команды настраивает, какие разделы видит каждая роль.
-- Owner всегда видит всё (не зависит от этой настройки).
-- Default: совпадает с захардкоженной логикой из src/contexts/TeamContext.tsx
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS module_access JSONB NOT NULL DEFAULT '{
    "admin":    ["dashboard","orders","clients","services","inventory","promo","loyalty","marketing","reports","delivery","team_analytics"],
    "operator": ["orders","clients","services","promo","loyalty","delivery"],
    "worker":   ["orders"],
    "member":   ["orders","clients","services","promo","loyalty"]
  }'::jsonb;

COMMENT ON COLUMN public.teams.module_access IS
  'Карта доступных модулей по роли: { role: [module_slug,...] }. Owner всегда видит всё.';
