
ALTER TABLE public.competitor_insights
  ADD COLUMN IF NOT EXISTS win_strategy jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS content_gap_matrix jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS content_angles jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS opportunity_scores jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS predicted_outcomes jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS campaign_blueprint jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS winning_position jsonb DEFAULT '{}'::jsonb;
