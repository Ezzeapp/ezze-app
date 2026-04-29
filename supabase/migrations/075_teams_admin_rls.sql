-- ─────────────────────────────────────────────────────────────────
-- 075_teams_admin_rls.sql
-- Superadmin (is_admin) RLS policies для teams / team_members / team_invites.
-- Без них admin@ezze.site через anon-key не видит чужие команды.
-- ─────────────────────────────────────────────────────────────────

-- teams: admin может читать и удалять любую
DROP POLICY IF EXISTS "teams_admin_all" ON public.teams;
CREATE POLICY "teams_admin_all" ON public.teams
  FOR ALL USING (public.is_admin());

-- team_members: admin полный доступ (для просмотра + удаления участников)
DROP POLICY IF EXISTS "team_members_admin_all" ON public.team_members;
CREATE POLICY "team_members_admin_all" ON public.team_members
  FOR ALL USING (public.is_admin());

-- team_invites: admin полный доступ
DROP POLICY IF EXISTS "team_invites_admin_all" ON public.team_invites;
CREATE POLICY "team_invites_admin_all" ON public.team_invites
  FOR ALL USING (public.is_admin());

-- master_profiles: admin может читать все профили (даже непубличные)
-- Нужно для embed-а в teams/clients/masters в superadmin
DROP POLICY IF EXISTS "master_profiles_admin_all" ON public.master_profiles;
CREATE POLICY "master_profiles_admin_all" ON public.master_profiles
  FOR ALL USING (public.is_admin());
