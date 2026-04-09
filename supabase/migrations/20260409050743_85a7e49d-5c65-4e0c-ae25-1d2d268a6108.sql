-- Phase 1: Add measurable target columns to campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS primary_objective text DEFAULT 'awareness';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS target_metric text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS target_quantity integer;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS target_timeframe text DEFAULT 'monthly';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS target_priority text DEFAULT 'medium';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS target_start_date timestamptz DEFAULT now();

-- Phase 1: Create campaign_progress table
CREATE TABLE IF NOT EXISTS public.campaign_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  metric_name text NOT NULL,
  current_value integer DEFAULT 0,
  target_value integer DEFAULT 0,
  period_start timestamptz,
  period_end timestamptz,
  contributing_post_ids jsonb DEFAULT '[]'::jsonb,
  gap_analysis text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own campaign progress"
  ON public.campaign_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own campaign progress"
  ON public.campaign_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaign progress"
  ON public.campaign_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaign progress"
  ON public.campaign_progress FOR DELETE
  USING (auth.uid() = user_id);

-- Phase 3: Add outcome probability columns to prediction_scores
ALTER TABLE public.prediction_scores ADD COLUMN IF NOT EXISTS outcome_probability integer DEFAULT 0;
ALTER TABLE public.prediction_scores ADD COLUMN IF NOT EXISTS goal_fit_score integer DEFAULT 0;
ALTER TABLE public.prediction_scores ADD COLUMN IF NOT EXISTS attention_potential integer DEFAULT 0;
ALTER TABLE public.prediction_scores ADD COLUMN IF NOT EXISTS engagement_potential integer DEFAULT 0;
ALTER TABLE public.prediction_scores ADD COLUMN IF NOT EXISTS action_potential integer DEFAULT 0;
ALTER TABLE public.prediction_scores ADD COLUMN IF NOT EXISTS outcome_potential integer DEFAULT 0;
ALTER TABLE public.prediction_scores ADD COLUMN IF NOT EXISTS weak_stage text;
ALTER TABLE public.prediction_scores ADD COLUMN IF NOT EXISTS stage_breakdown jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.prediction_scores ADD COLUMN IF NOT EXISTS target_metric text;
ALTER TABLE public.prediction_scores ADD COLUMN IF NOT EXISTS target_quantity integer;

-- Phase 5: Add outcome segmentation to content_patterns
ALTER TABLE public.content_patterns ADD COLUMN IF NOT EXISTS outcome_type text;
ALTER TABLE public.content_patterns ADD COLUMN IF NOT EXISTS target_metric text;