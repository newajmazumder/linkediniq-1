
-- 1. Add intelligence snapshot to campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS intelligence_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS intelligence_updated_at timestamptz;

-- 2. Track applied changes on adaptations
ALTER TABLE public.campaign_adaptations
  ADD COLUMN IF NOT EXISTS applied_changes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Advisor questions (proactive prompts)
CREATE TABLE IF NOT EXISTS public.campaign_advisor_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  question_key text NOT NULL,
  question text NOT NULL,
  why_it_matters text,
  severity text NOT NULL DEFAULT 'medium', -- low | medium | high
  status text NOT NULL DEFAULT 'open',     -- open | answered | dismissed
  answer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  UNIQUE (campaign_id, question_key)
);

ALTER TABLE public.campaign_advisor_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own advisor questions"
  ON public.campaign_advisor_questions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create own advisor questions"
  ON public.campaign_advisor_questions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own advisor questions"
  ON public.campaign_advisor_questions FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own advisor questions"
  ON public.campaign_advisor_questions FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_campaign_advisor_questions_updated_at
  BEFORE UPDATE ON public.campaign_advisor_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_advisor_questions_campaign
  ON public.campaign_advisor_questions(campaign_id, status);

-- 4. Strategy versioning
CREATE TABLE IF NOT EXISTS public.campaign_strategy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  version_number integer NOT NULL,
  strategy_thesis text,
  phase_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta_progression jsonb NOT NULL DEFAULT '[]'::jsonb,
  hypotheses jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason_for_revision text,
  evidence_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, version_number)
);

ALTER TABLE public.campaign_strategy_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own strategy versions"
  ON public.campaign_strategy_versions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create own strategy versions"
  ON public.campaign_strategy_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own strategy versions"
  ON public.campaign_strategy_versions FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own strategy versions"
  ON public.campaign_strategy_versions FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_campaign_strategy_versions_updated_at
  BEFORE UPDATE ON public.campaign_strategy_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_strategy_versions_campaign
  ON public.campaign_strategy_versions(campaign_id, version_number DESC);
