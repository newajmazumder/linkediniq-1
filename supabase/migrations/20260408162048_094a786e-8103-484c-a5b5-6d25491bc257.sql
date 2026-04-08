
-- content_tags: structured tagging for every published post
CREATE TABLE public.content_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  draft_id uuid REFERENCES public.drafts(id) ON DELETE SET NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  linkedin_post_id uuid REFERENCES public.linkedin_posts(id) ON DELETE SET NULL,
  hook_type text,
  tone text,
  content_type text,
  post_style text,
  content_intent text,
  persona_id uuid REFERENCES public.audience_personas(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  topic text,
  cta_type text,
  goal text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own content tags" ON public.content_tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own content tags" ON public.content_tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own content tags" ON public.content_tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own content tags" ON public.content_tags FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_content_tags_user ON public.content_tags(user_id);
CREATE INDEX idx_content_tags_hook ON public.content_tags(user_id, hook_type);
CREATE INDEX idx_content_tags_tone ON public.content_tags(user_id, tone);

-- content_patterns: learned performance patterns
CREATE TABLE public.content_patterns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  dimension text NOT NULL,
  dimension_value text NOT NULL,
  sample_count integer NOT NULL DEFAULT 0,
  avg_impressions float DEFAULT 0,
  avg_engagement_rate float DEFAULT 0,
  avg_likes float DEFAULT 0,
  avg_comments float DEFAULT 0,
  best_combination jsonb DEFAULT '{}'::jsonb,
  insight text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own content patterns" ON public.content_patterns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own content patterns" ON public.content_patterns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own content patterns" ON public.content_patterns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own content patterns" ON public.content_patterns FOR DELETE USING (auth.uid() = user_id);

CREATE UNIQUE INDEX idx_content_patterns_unique ON public.content_patterns(user_id, dimension, dimension_value);

-- prediction_scores: pre-publish scores for drafts
CREATE TABLE public.prediction_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  draft_id uuid REFERENCES public.drafts(id) ON DELETE CASCADE,
  hook_strength integer DEFAULT 0,
  persona_relevance integer DEFAULT 0,
  clarity integer DEFAULT 0,
  goal_alignment integer DEFAULT 0,
  predicted_score integer DEFAULT 0,
  risk_level text DEFAULT 'medium',
  suggestions jsonb DEFAULT '[]'::jsonb,
  historical_comparison text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prediction_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prediction scores" ON public.prediction_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own prediction scores" ON public.prediction_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own prediction scores" ON public.prediction_scores FOR DELETE USING (auth.uid() = user_id);

-- strategy_recommendations: "what to post next"
CREATE TABLE public.strategy_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  recommendation jsonb NOT NULL DEFAULT '{}'::jsonb,
  gap_analysis jsonb DEFAULT '{}'::jsonb,
  confidence float DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.strategy_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own strategy recommendations" ON public.strategy_recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own strategy recommendations" ON public.strategy_recommendations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own strategy recommendations" ON public.strategy_recommendations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own strategy recommendations" ON public.strategy_recommendations FOR DELETE USING (auth.uid() = user_id);

-- Add saves and profile_visits to post_performance
ALTER TABLE public.post_performance ADD COLUMN IF NOT EXISTS saves integer NOT NULL DEFAULT 0;
ALTER TABLE public.post_performance ADD COLUMN IF NOT EXISTS profile_visits integer NOT NULL DEFAULT 0;
