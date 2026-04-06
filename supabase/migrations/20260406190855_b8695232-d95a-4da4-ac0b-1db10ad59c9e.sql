
-- Audience Personas
CREATE TABLE public.audience_personas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  business_size TEXT,
  geography TEXT,
  language_style TEXT DEFAULT 'english',
  awareness_level TEXT DEFAULT 'unaware',
  pain_points JSONB DEFAULT '[]'::jsonb,
  goals JSONB DEFAULT '[]'::jsonb,
  objections JSONB DEFAULT '[]'::jsonb,
  buying_triggers TEXT,
  content_preference TEXT DEFAULT 'educational',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audience_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personas" ON public.audience_personas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own personas" ON public.audience_personas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own personas" ON public.audience_personas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own personas" ON public.audience_personas FOR DELETE USING (auth.uid() = user_id);

-- Campaigns / Strategy
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  goal TEXT DEFAULT 'awareness',
  primary_persona_id UUID REFERENCES public.audience_personas(id) ON DELETE SET NULL,
  secondary_persona_id UUID REFERENCES public.audience_personas(id) ON DELETE SET NULL,
  core_message TEXT,
  offer TEXT,
  cta_type TEXT DEFAULT 'soft',
  style_storytelling INTEGER DEFAULT 25,
  style_educational INTEGER DEFAULT 25,
  style_product_led INTEGER DEFAULT 25,
  style_authority INTEGER DEFAULT 25,
  tone TEXT DEFAULT 'friendly',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own campaigns" ON public.campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own campaigns" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own campaigns" ON public.campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own campaigns" ON public.campaigns FOR DELETE USING (auth.uid() = user_id);

-- Add content_intent to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS content_intent TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS persona_id UUID;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS campaign_id UUID;
