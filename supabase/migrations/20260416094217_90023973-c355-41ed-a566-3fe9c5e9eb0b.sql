ALTER TABLE public.competitor_insights 
  ADD COLUMN IF NOT EXISTS execution_plan jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS why_posts_work jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS confidence_layer jsonb DEFAULT '{}'::jsonb;