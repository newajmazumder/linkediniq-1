
-- =========================================================
-- PHASE 1: Canonical post_lifecycle + FK graph + score consolidation
-- =========================================================

-- 1) Lifecycle enum
DO $$ BEGIN
  CREATE TYPE public.post_lifecycle_state AS ENUM
    ('idea','drafted','scheduled','posted','missed','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Canonical post_lifecycle table
CREATE TABLE IF NOT EXISTS public.post_lifecycle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid,
  week_plan_id uuid,
  post_plan_id uuid,
  draft_id uuid,
  linkedin_post_ref_id uuid,
  idea_id uuid,
  variation_post_id uuid,
  lifecycle_state public.post_lifecycle_state NOT NULL DEFAULT 'drafted',
  content text,
  hook text,
  cta text,
  format text,
  hook_type text,
  cta_type text,
  tone text,
  post_style text,
  planned_date timestamptz,
  scheduled_at timestamptz,
  posted_at timestamptz,
  linkedin_post_url text,
  linkedin_post_external_id text,
  source text NOT NULL DEFAULT 'manual',
  primary_score numeric DEFAULT 0,
  primary_score_kind text,
  score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.post_lifecycle ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own post_lifecycle" ON public.post_lifecycle
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create own post_lifecycle" ON public.post_lifecycle
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own post_lifecycle" ON public.post_lifecycle
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own post_lifecycle" ON public.post_lifecycle
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS update_post_lifecycle_updated_at ON public.post_lifecycle;
CREATE TRIGGER update_post_lifecycle_updated_at
BEFORE UPDATE ON public.post_lifecycle
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_pl_user ON public.post_lifecycle(user_id);
CREATE INDEX IF NOT EXISTS idx_pl_campaign ON public.post_lifecycle(campaign_id);
CREATE INDEX IF NOT EXISTS idx_pl_week_plan ON public.post_lifecycle(week_plan_id);
CREATE INDEX IF NOT EXISTS idx_pl_post_plan ON public.post_lifecycle(post_plan_id);
CREATE INDEX IF NOT EXISTS idx_pl_draft ON public.post_lifecycle(draft_id);
CREATE INDEX IF NOT EXISTS idx_pl_linkedin_ref ON public.post_lifecycle(linkedin_post_ref_id);
CREATE INDEX IF NOT EXISTS idx_pl_lifecycle ON public.post_lifecycle(lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_pl_user_lifecycle ON public.post_lifecycle(user_id, lifecycle_state);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pl_draft_id
  ON public.post_lifecycle(draft_id) WHERE draft_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pl_linkedin_ref
  ON public.post_lifecycle(linkedin_post_ref_id) WHERE linkedin_post_ref_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pl_post_plan_id
  ON public.post_lifecycle(post_plan_id) WHERE post_plan_id IS NOT NULL;

-- 3) Score consolidation columns on campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS primary_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS primary_score_kind text,
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4) Foreign keys
DO $$ BEGIN
  ALTER TABLE public.campaign_week_plans
    ADD CONSTRAINT campaign_week_plans_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaign_week_plans
    ADD CONSTRAINT campaign_week_plans_blueprint_id_fkey
    FOREIGN KEY (blueprint_id) REFERENCES public.campaign_blueprints(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaign_post_plans
    ADD CONSTRAINT campaign_post_plans_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaign_post_plans
    ADD CONSTRAINT campaign_post_plans_week_plan_id_fkey
    FOREIGN KEY (week_plan_id) REFERENCES public.campaign_week_plans(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaign_post_plans
    ADD CONSTRAINT campaign_post_plans_linked_draft_id_fkey
    FOREIGN KEY (linked_draft_id) REFERENCES public.drafts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaign_blueprints
    ADD CONSTRAINT campaign_blueprints_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaign_blueprints
    ADD CONSTRAINT campaign_blueprints_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES public.campaign_conversations(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaign_strategy_versions
    ADD CONSTRAINT campaign_strategy_versions_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaign_progress
    ADD CONSTRAINT campaign_progress_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaign_reports
    ADD CONSTRAINT campaign_reports_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaign_adaptations
    ADD CONSTRAINT campaign_adaptations_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaign_advisor_questions
    ADD CONSTRAINT campaign_advisor_questions_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaigns
    ADD CONSTRAINT campaigns_primary_persona_id_fkey
    FOREIGN KEY (primary_persona_id) REFERENCES public.audience_personas(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaigns
    ADD CONSTRAINT campaigns_secondary_persona_id_fkey
    FOREIGN KEY (secondary_persona_id) REFERENCES public.audience_personas(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaigns
    ADD CONSTRAINT campaigns_market_context_id_fkey
    FOREIGN KEY (market_context_id) REFERENCES public.market_contexts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.drafts
    ADD CONSTRAINT drafts_idea_id_fkey
    FOREIGN KEY (idea_id) REFERENCES public.ideas(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.linkedin_posts
    ADD CONSTRAINT linkedin_posts_linked_draft_id_fkey
    FOREIGN KEY (linked_draft_id) REFERENCES public.drafts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.competitor_posts
    ADD CONSTRAINT competitor_posts_competitor_id_fkey
    FOREIGN KEY (competitor_id) REFERENCES public.competitors(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.competitor_insights
    ADD CONSTRAINT competitor_insights_competitor_id_fkey
    FOREIGN KEY (competitor_id) REFERENCES public.competitors(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.competitor_insights
    ADD CONSTRAINT competitor_insights_market_context_id_fkey
    FOREIGN KEY (market_context_id) REFERENCES public.market_contexts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.post_metrics
    ADD CONSTRAINT post_metrics_linkedin_post_id_fkey
    FOREIGN KEY (linkedin_post_id) REFERENCES public.linkedin_posts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.post_context
    ADD CONSTRAINT post_context_linkedin_post_id_fkey
    FOREIGN KEY (linkedin_post_id) REFERENCES public.linkedin_posts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.goal_evaluations
    ADD CONSTRAINT goal_evaluations_linkedin_post_id_fkey
    FOREIGN KEY (linkedin_post_id) REFERENCES public.linkedin_posts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.content_tags
    ADD CONSTRAINT content_tags_draft_id_fkey
    FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.content_tags
    ADD CONSTRAINT content_tags_linkedin_post_id_fkey
    FOREIGN KEY (linkedin_post_id) REFERENCES public.linkedin_posts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- post_lifecycle FKs
DO $$ BEGIN
  ALTER TABLE public.post_lifecycle
    ADD CONSTRAINT pl_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.post_lifecycle
    ADD CONSTRAINT pl_week_plan_id_fkey
    FOREIGN KEY (week_plan_id) REFERENCES public.campaign_week_plans(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.post_lifecycle
    ADD CONSTRAINT pl_post_plan_id_fkey
    FOREIGN KEY (post_plan_id) REFERENCES public.campaign_post_plans(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.post_lifecycle
    ADD CONSTRAINT pl_draft_id_fkey
    FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.post_lifecycle
    ADD CONSTRAINT pl_linkedin_post_ref_id_fkey
    FOREIGN KEY (linkedin_post_ref_id) REFERENCES public.linkedin_posts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.post_lifecycle
    ADD CONSTRAINT pl_idea_id_fkey
    FOREIGN KEY (idea_id) REFERENCES public.ideas(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.post_lifecycle
    ADD CONSTRAINT pl_variation_post_id_fkey
    FOREIGN KEY (variation_post_id) REFERENCES public.posts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) Backfill
-- 5a) From linkedin_posts (posted)
INSERT INTO public.post_lifecycle (
  user_id, draft_id, linkedin_post_ref_id, lifecycle_state,
  content, posted_at, linkedin_post_url, linkedin_post_external_id,
  source, created_at, updated_at
)
SELECT
  lp.user_id,
  lp.linked_draft_id,
  lp.id,
  'posted'::public.post_lifecycle_state,
  lp.content,
  COALESCE(lp.publish_date, lp.imported_at),
  lp.post_url,
  lp.linkedin_post_id,
  COALESCE(lp.source_type, 'manual'),
  lp.created_at,
  lp.updated_at
FROM public.linkedin_posts lp
WHERE NOT EXISTS (
  SELECT 1 FROM public.post_lifecycle p WHERE p.linkedin_post_ref_id = lp.id
);

-- 5b) From drafts not already represented
INSERT INTO public.post_lifecycle (
  user_id, draft_id, idea_id, lifecycle_state, content,
  scheduled_at, source, created_at, updated_at
)
SELECT
  d.user_id,
  d.id,
  d.idea_id,
  CASE
    WHEN d.status = 'posted' THEN 'posted'::public.post_lifecycle_state
    WHEN d.status = 'scheduled' THEN 'scheduled'::public.post_lifecycle_state
    WHEN d.status = 'missed' THEN 'missed'::public.post_lifecycle_state
    WHEN d.status = 'archived' THEN 'archived'::public.post_lifecycle_state
    ELSE 'drafted'::public.post_lifecycle_state
  END,
  d.custom_content,
  d.scheduled_at,
  'generated',
  d.created_at,
  d.updated_at
FROM public.drafts d
WHERE NOT EXISTS (
  SELECT 1 FROM public.post_lifecycle p WHERE p.draft_id = d.id
);

-- 5c) Link existing lifecycle rows to plans
UPDATE public.post_lifecycle pl
SET post_plan_id = pp.id,
    campaign_id  = COALESCE(pl.campaign_id, pp.campaign_id),
    week_plan_id = COALESCE(pl.week_plan_id, pp.week_plan_id),
    planned_date = COALESCE(pl.planned_date, pp.planned_date)
FROM public.campaign_post_plans pp
WHERE pl.post_plan_id IS NULL
  AND (
    (pp.linked_draft_id = pl.draft_id AND pl.draft_id IS NOT NULL)
    OR (pp.linked_post_id = pl.linkedin_post_ref_id AND pl.linkedin_post_ref_id IS NOT NULL)
  );

-- 5d) Create planned lifecycle rows for plans without realized post
INSERT INTO public.post_lifecycle (
  user_id, campaign_id, week_plan_id, post_plan_id, lifecycle_state,
  planned_date, source, created_at, updated_at
)
SELECT
  pp.user_id,
  pp.campaign_id,
  pp.week_plan_id,
  pp.id,
  CASE
    WHEN pp.status = 'posted' THEN 'posted'::public.post_lifecycle_state
    WHEN pp.status = 'scheduled' THEN 'scheduled'::public.post_lifecycle_state
    WHEN pp.status = 'drafted' THEN 'drafted'::public.post_lifecycle_state
    WHEN pp.status = 'missed' THEN 'missed'::public.post_lifecycle_state
    WHEN pp.status = 'skipped' THEN 'archived'::public.post_lifecycle_state
    ELSE 'idea'::public.post_lifecycle_state
  END,
  pp.planned_date,
  'generated',
  pp.created_at,
  pp.updated_at
FROM public.campaign_post_plans pp
WHERE NOT EXISTS (
  SELECT 1 FROM public.post_lifecycle p WHERE p.post_plan_id = pp.id
);

-- 6) Backfill primary_score on campaigns
UPDATE public.campaigns
SET primary_score = COALESCE(
      NULLIF(execution_score, 0),
      NULLIF(strategy_strength_score, 0),
      NULLIF(goal_progress_percent, 0),
      0
    ),
    primary_score_kind = CASE
      WHEN execution_status IN ('active','at_risk') THEN 'execution'
      WHEN execution_status = 'completed' THEN 'goal'
      ELSE 'strategy'
    END,
    score_breakdown = jsonb_build_object(
      'execution', COALESCE(execution_score, 0),
      'velocity',  COALESCE(velocity_score, 0),
      'strategy',  COALESCE(strategy_strength_score, 0),
      'goal',      COALESCE(goal_progress_percent, 0)
    )
WHERE primary_score IS NULL OR primary_score = 0;
