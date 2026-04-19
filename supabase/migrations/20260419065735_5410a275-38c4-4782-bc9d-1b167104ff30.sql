ALTER TABLE public.post_metrics
  ADD COLUMN IF NOT EXISTS goal_contribution integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goal_metric text,
  ADD COLUMN IF NOT EXISTS attribution_note text;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS current_goal_value integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goal_value_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_post_metrics_goal_contribution
  ON public.post_metrics (linkedin_post_id)
  WHERE goal_contribution > 0;