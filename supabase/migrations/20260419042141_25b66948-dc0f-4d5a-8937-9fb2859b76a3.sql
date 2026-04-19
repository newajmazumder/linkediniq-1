-- ============================================
-- PHASE 1: Closed-loop execution system schema
-- ============================================

-- 1. Campaigns: execution lifecycle fields
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS execution_status text NOT NULL DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS execution_score numeric(4,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS velocity_score numeric(4,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS strategy_strength_score numeric(4,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversion_signal_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_evaluated_at timestamptz;

-- Validate execution_status via trigger (avoid CHECK constraint inflexibility)
CREATE OR REPLACE FUNCTION public.validate_campaign_execution_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.execution_status NOT IN ('planned','active','at_risk','completed','failed','paused') THEN
    RAISE EXCEPTION 'Invalid execution_status: %', NEW.execution_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_campaign_execution_status_trigger ON public.campaigns;
CREATE TRIGGER validate_campaign_execution_status_trigger
BEFORE INSERT OR UPDATE OF execution_status ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_execution_status();

-- 2. Campaign post plans: execution + signal tracking
ALTER TABLE public.campaign_post_plans
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS planned_date timestamptz,
  ADD COLUMN IF NOT EXISTS posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS posted_url text,
  ADD COLUMN IF NOT EXISTS missed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expected_outcome text;

-- Validate post plan status (extends with scheduled/posted/missed)
CREATE OR REPLACE FUNCTION public.validate_post_plan_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('planned','drafted','scheduled','posted','missed','skipped') THEN
    RAISE EXCEPTION 'Invalid post plan status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_post_plan_status_trigger ON public.campaign_post_plans;
CREATE TRIGGER validate_post_plan_status_trigger
BEFORE INSERT OR UPDATE OF status ON public.campaign_post_plans
FOR EACH ROW EXECUTE FUNCTION public.validate_post_plan_status();

-- 3. Post signals: per-post outcome capture for learning
CREATE TABLE IF NOT EXISTS public.post_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  post_plan_id uuid REFERENCES public.campaign_post_plans(id) ON DELETE CASCADE,
  draft_id uuid REFERENCES public.drafts(id) ON DELETE SET NULL,
  linkedin_post_id uuid REFERENCES public.linkedin_posts(id) ON DELETE SET NULL,
  impressions integer DEFAULT 0,
  engagement integer DEFAULT 0,
  clicks integer DEFAULT 0,
  comment_quality text DEFAULT 'unknown', -- shallow | medium | deep | unknown
  conversion_signal_score integer DEFAULT 0, -- 0-100 AI-evaluated proxy
  conversion_intent text, -- e.g., "demo interest", "objection raised"
  hook_type text,
  post_style text,
  cta_type text,
  format text,
  phase text,
  ai_evaluation jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.post_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own post signals" ON public.post_signals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own post signals" ON public.post_signals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own post signals" ON public.post_signals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own post signals" ON public.post_signals
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_post_signals_updated_at
BEFORE UPDATE ON public.post_signals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_post_signals_campaign ON public.post_signals(campaign_id);
CREATE INDEX IF NOT EXISTS idx_post_signals_user ON public.post_signals(user_id);

-- 4. Campaign adaptations: weekly AI-generated adjustments
CREATE TABLE IF NOT EXISTS public.campaign_adaptations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  week_number integer,
  trigger_reason text, -- "low_engagement", "low_conversion", "low_velocity", "weekly_review"
  adjustments jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{type, target, change, rationale}]
  patterns_observed jsonb DEFAULT '{}'::jsonb,
  predicted_impact text,
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | rejected | applied
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_adaptations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own adaptations" ON public.campaign_adaptations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own adaptations" ON public.campaign_adaptations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own adaptations" ON public.campaign_adaptations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own adaptations" ON public.campaign_adaptations
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_campaign_adaptations_updated_at
BEFORE UPDATE ON public.campaign_adaptations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_campaign_adaptations_campaign ON public.campaign_adaptations(campaign_id);

-- 5. Helpful indexes
CREATE INDEX IF NOT EXISTS idx_campaign_post_plans_planned_date ON public.campaign_post_plans(planned_date);
CREATE INDEX IF NOT EXISTS idx_campaign_post_plans_status ON public.campaign_post_plans(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_execution_status ON public.campaigns(execution_status);

-- Enable pg_cron + pg_net for the daily execution tick (Phase 2)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;