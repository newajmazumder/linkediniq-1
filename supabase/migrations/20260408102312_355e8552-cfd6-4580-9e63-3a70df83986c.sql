
-- LinkedIn Accounts table
CREATE TABLE public.linkedin_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_user_id TEXT,
  display_name TEXT,
  profile_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  connection_status TEXT NOT NULL DEFAULT 'disconnected',
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.linkedin_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own linkedin account" ON public.linkedin_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own linkedin account" ON public.linkedin_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own linkedin account" ON public.linkedin_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own linkedin account" ON public.linkedin_accounts FOR DELETE USING (auth.uid() = user_id);

-- LinkedIn Synced Posts table
CREATE TABLE public.linkedin_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_post_id TEXT,
  post_url TEXT,
  content TEXT NOT NULL,
  publish_date TIMESTAMP WITH TIME ZONE,
  has_media BOOLEAN DEFAULT false,
  source_type TEXT NOT NULL DEFAULT 'manual',
  linked_draft_id UUID REFERENCES public.drafts(id) ON DELETE SET NULL,
  imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.linkedin_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own linkedin posts" ON public.linkedin_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own linkedin posts" ON public.linkedin_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own linkedin posts" ON public.linkedin_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own linkedin posts" ON public.linkedin_posts FOR DELETE USING (auth.uid() = user_id);

-- Post Context table (goal, persona, strategy mapping)
CREATE TABLE public.post_context (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_post_id UUID NOT NULL REFERENCES public.linkedin_posts(id) ON DELETE CASCADE,
  goal TEXT,
  persona_id UUID REFERENCES public.audience_personas(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  strategy_type TEXT,
  tone TEXT,
  hook_type TEXT,
  cta_type TEXT,
  auto_mapped BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(linkedin_post_id)
);

ALTER TABLE public.post_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own post context" ON public.post_context FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own post context" ON public.post_context FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own post context" ON public.post_context FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own post context" ON public.post_context FOR DELETE USING (auth.uid() = user_id);

-- Post Metrics table
CREATE TABLE public.post_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_post_id UUID NOT NULL REFERENCES public.linkedin_posts(id) ON DELETE CASCADE,
  reactions INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  reposts INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  profile_visits INTEGER DEFAULT 0,
  follower_gain INTEGER DEFAULT 0,
  manual_notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(linkedin_post_id)
);

ALTER TABLE public.post_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own post metrics" ON public.post_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own post metrics" ON public.post_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own post metrics" ON public.post_metrics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own post metrics" ON public.post_metrics FOR DELETE USING (auth.uid() = user_id);

-- Goal Evaluations table
CREATE TABLE public.goal_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_post_id UUID NOT NULL REFERENCES public.linkedin_posts(id) ON DELETE CASCADE,
  goal_fulfillment_score INTEGER DEFAULT 0,
  fulfillment_status TEXT DEFAULT 'not_evaluated',
  reason_summary TEXT,
  strongest_factor TEXT,
  weakest_factor TEXT,
  full_analysis JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(linkedin_post_id)
);

ALTER TABLE public.goal_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goal evaluations" ON public.goal_evaluations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own goal evaluations" ON public.goal_evaluations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goal evaluations" ON public.goal_evaluations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goal evaluations" ON public.goal_evaluations FOR DELETE USING (auth.uid() = user_id);

-- Writing Diagnoses table
CREATE TABLE public.writing_diagnoses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_post_id UUID NOT NULL REFERENCES public.linkedin_posts(id) ON DELETE CASCADE,
  hook_analysis JSONB DEFAULT '{}'::jsonb,
  content_analysis JSONB DEFAULT '{}'::jsonb,
  structure_analysis JSONB DEFAULT '{}'::jsonb,
  cta_analysis JSONB DEFAULT '{}'::jsonb,
  what_worked TEXT[] DEFAULT '{}',
  what_weakened TEXT[] DEFAULT '{}',
  what_to_change TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(linkedin_post_id)
);

ALTER TABLE public.writing_diagnoses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own writing diagnoses" ON public.writing_diagnoses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own writing diagnoses" ON public.writing_diagnoses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own writing diagnoses" ON public.writing_diagnoses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own writing diagnoses" ON public.writing_diagnoses FOR DELETE USING (auth.uid() = user_id);

-- Post Recommendations table
CREATE TABLE public.post_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_post_id UUID NOT NULL REFERENCES public.linkedin_posts(id) ON DELETE CASCADE,
  what_to_repeat TEXT[] DEFAULT '{}',
  what_to_avoid TEXT[] DEFAULT '{}',
  improved_hooks TEXT[] DEFAULT '{}',
  improved_angles TEXT[] DEFAULT '{}',
  improved_ctas TEXT[] DEFAULT '{}',
  strategy_suggestion TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(linkedin_post_id)
);

ALTER TABLE public.post_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own post recommendations" ON public.post_recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own post recommendations" ON public.post_recommendations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own post recommendations" ON public.post_recommendations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own post recommendations" ON public.post_recommendations FOR DELETE USING (auth.uid() = user_id);

-- Sync Logs table
CREATE TABLE public.sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL DEFAULT 'linkedin_posts',
  status TEXT NOT NULL DEFAULT 'started',
  posts_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync logs" ON public.sync_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own sync logs" ON public.sync_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sync logs" ON public.sync_logs FOR UPDATE USING (auth.uid() = user_id);

-- Add update triggers
CREATE TRIGGER update_linkedin_accounts_updated_at BEFORE UPDATE ON public.linkedin_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_linkedin_posts_updated_at BEFORE UPDATE ON public.linkedin_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_post_context_updated_at BEFORE UPDATE ON public.post_context FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_post_metrics_updated_at BEFORE UPDATE ON public.post_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_goal_evaluations_updated_at BEFORE UPDATE ON public.goal_evaluations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_writing_diagnoses_updated_at BEFORE UPDATE ON public.writing_diagnoses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_post_recommendations_updated_at BEFORE UPDATE ON public.post_recommendations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
