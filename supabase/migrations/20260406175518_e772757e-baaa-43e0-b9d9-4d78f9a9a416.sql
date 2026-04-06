
-- Competitors table
CREATE TABLE public.competitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  linkedin_url TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own competitors" ON public.competitors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own competitors" ON public.competitors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own competitors" ON public.competitors FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own competitors" ON public.competitors FOR DELETE USING (auth.uid() = user_id);

-- Competitor posts table (pasted posts for analysis)
CREATE TABLE public.competitor_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  hook_style TEXT,
  tone TEXT,
  topic TEXT,
  cta_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.competitor_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own competitor posts" ON public.competitor_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own competitor posts" ON public.competitor_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own competitor posts" ON public.competitor_posts FOR DELETE USING (auth.uid() = user_id);

-- Competitor insights table
CREATE TABLE public.competitor_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  competitor_id UUID REFERENCES public.competitors(id) ON DELETE CASCADE,
  patterns JSONB DEFAULT '[]',
  overused_themes JSONB DEFAULT '[]',
  gaps JSONB DEFAULT '[]',
  suggested_angles JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.competitor_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights" ON public.competitor_insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own insights" ON public.competitor_insights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own insights" ON public.competitor_insights FOR DELETE USING (auth.uid() = user_id);
