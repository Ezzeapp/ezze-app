-- Allow anonymous users to read team members if the team is public
-- This is needed for the public team booking page (/book/team/:slug)
CREATE POLICY "team_members_public_read" ON public.team_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id
        AND t.is_public = true
    )
  );
