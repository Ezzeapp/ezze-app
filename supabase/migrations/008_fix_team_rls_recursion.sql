-- Fix circular RLS dependency introduced in migration 007.
-- team_members_public_read → SELECT teams → teams_member_read → SELECT team_members → loop
--
-- Solution: use a SECURITY DEFINER function to check team visibility,
-- which bypasses RLS on the teams table and breaks the cycle.

-- Drop the recursive policy
DROP POLICY IF EXISTS "team_members_public_read" ON public.team_members;

-- Create a helper function that checks if a team is public (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_team_public(p_team_id UUID) RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.teams
      WHERE id = p_team_id AND is_public = true
    );
  $$;

-- Recreate the policy using the safe function (no circular reference)
CREATE POLICY "team_members_public_read" ON public.team_members
  FOR SELECT USING (public.is_team_public(team_id));
