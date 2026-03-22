-- Fix: allow authenticated users to insert/update their own team membership
-- Previously only team owners could INSERT into team_members,
-- which blocked regular users from joining via invite code.

-- Allow any authenticated user to add themselves to a team
CREATE POLICY "team_members_self_insert" ON public.team_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Allow users to update their own membership row (needed for re-join after removal)
CREATE POLICY "team_members_self_update" ON public.team_members
  FOR UPDATE USING (user_id = auth.uid());
