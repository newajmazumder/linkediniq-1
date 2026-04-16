
-- Create market_contexts table
CREATE TABLE public.market_contexts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  region_code text NOT NULL,
  region_name text NOT NULL,
  audience_type text NOT NULL DEFAULT 'general',
  primary_channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  common_customer_behaviors jsonb NOT NULL DEFAULT '[]'::jsonb,
  common_pain_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  tone_preference text NOT NULL DEFAULT 'professional',
  language_defaults jsonb NOT NULL DEFAULT '["english"]'::jsonb,
  preferred_cta_style text NOT NULL DEFAULT 'direct',
  buyer_maturity text NOT NULL DEFAULT 'medium',
  trust_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_style_bias text NOT NULL DEFAULT 'balanced',
  localized_examples jsonb NOT NULL DEFAULT '[]'::jsonb,
  localized_phrases jsonb NOT NULL DEFAULT '[]'::jsonb,
  platform_reality jsonb NOT NULL DEFAULT '{}'::jsonb,
  sales_conversation_behavior jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_preset boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.market_contexts ENABLE ROW LEVEL SECURITY;

-- Everyone can read presets; users can read their own custom contexts
CREATE POLICY "Anyone can view preset market contexts"
  ON public.market_contexts FOR SELECT
  USING (is_preset = true);

CREATE POLICY "Users can view own market contexts"
  ON public.market_contexts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own market contexts"
  ON public.market_contexts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own market contexts"
  ON public.market_contexts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own market contexts"
  ON public.market_contexts FOR DELETE
  USING (auth.uid() = user_id);

-- Add market_context_id to campaigns
ALTER TABLE public.campaigns
  ADD COLUMN market_context_id uuid REFERENCES public.market_contexts(id);

-- Add market_context_id to posts
ALTER TABLE public.posts
  ADD COLUMN market_context_id uuid REFERENCES public.market_contexts(id);

-- Add market_context_id to competitor_insights
ALTER TABLE public.competitor_insights
  ADD COLUMN market_context_id uuid REFERENCES public.market_contexts(id);
