-- Enable Realtime for team_members table so that
-- the owner sees instant updates when members join or leave.
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
