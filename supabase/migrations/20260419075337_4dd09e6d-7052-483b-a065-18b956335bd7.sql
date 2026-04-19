ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS unattributed_goal_value integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goal_status text DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS goal_progress_percent numeric DEFAULT 0;