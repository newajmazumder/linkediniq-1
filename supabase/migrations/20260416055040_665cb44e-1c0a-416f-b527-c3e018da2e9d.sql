
-- Add engagement metrics and analysis to competitor_posts
ALTER TABLE public.competitor_posts
  ADD COLUMN IF NOT EXISTS likes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reposts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impressions integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS post_url text,
  ADD COLUMN IF NOT EXISTS post_analysis jsonb DEFAULT '{}'::jsonb;

-- Add UPDATE policy for competitor_posts
CREATE POLICY "Users can update own competitor posts"
  ON public.competitor_posts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Add comprehensive report columns to competitor_insights
ALTER TABLE public.competitor_insights
  ADD COLUMN IF NOT EXISTS content_strategy_overview jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS messaging_patterns jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS audience_strategy jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS strengths_analysis jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS weaknesses_analysis jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS performance_insights jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS strategic_opportunities jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS actionable_recommendations jsonb DEFAULT '[]'::jsonb;

-- Add UPDATE policy for competitor_insights
CREATE POLICY "Users can update own insights"
  ON public.competitor_insights
  FOR UPDATE
  USING (auth.uid() = user_id);
