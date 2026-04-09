
-- Campaign Blueprints
CREATE TABLE public.campaign_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  conversation_id uuid,
  campaign_summary jsonb DEFAULT '{}',
  business_rationale jsonb DEFAULT '{}',
  audience_summary jsonb DEFAULT '{}',
  messaging_strategy jsonb DEFAULT '{}',
  cta_strategy jsonb DEFAULT '{}',
  content_strategy jsonb DEFAULT '{}',
  success_model jsonb DEFAULT '{}',
  ai_recommendations jsonb DEFAULT '[]',
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.campaign_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blueprints" ON public.campaign_blueprints FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own blueprints" ON public.campaign_blueprints FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own blueprints" ON public.campaign_blueprints FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own blueprints" ON public.campaign_blueprints FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_campaign_blueprints_updated_at BEFORE UPDATE ON public.campaign_blueprints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Campaign Conversations
CREATE TABLE public.campaign_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  blueprint_id uuid REFERENCES public.campaign_blueprints(id) ON DELETE SET NULL,
  messages jsonb DEFAULT '[]',
  current_step text DEFAULT 'goal',
  collected_data jsonb DEFAULT '{}',
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.campaign_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" ON public.campaign_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own conversations" ON public.campaign_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON public.campaign_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON public.campaign_conversations FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_campaign_conversations_updated_at BEFORE UPDATE ON public.campaign_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update blueprint conversation_id FK
ALTER TABLE public.campaign_blueprints ADD CONSTRAINT campaign_blueprints_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.campaign_conversations(id) ON DELETE SET NULL;

-- Campaign Week Plans
CREATE TABLE public.campaign_week_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  blueprint_id uuid REFERENCES public.campaign_blueprints(id) ON DELETE SET NULL,
  week_number integer NOT NULL,
  weekly_goal text,
  primary_message text,
  audience_lens text,
  recommended_post_count integer DEFAULT 2,
  recommended_formats jsonb DEFAULT '[]',
  hook_styles jsonb DEFAULT '[]',
  cta_strategy text,
  week_purpose text,
  status text DEFAULT 'planned',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.campaign_week_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own week plans" ON public.campaign_week_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own week plans" ON public.campaign_week_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own week plans" ON public.campaign_week_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own week plans" ON public.campaign_week_plans FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_campaign_week_plans_updated_at BEFORE UPDATE ON public.campaign_week_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Campaign Post Plans
CREATE TABLE public.campaign_post_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  week_plan_id uuid REFERENCES public.campaign_week_plans(id) ON DELETE CASCADE,
  post_number integer NOT NULL,
  week_number integer NOT NULL,
  post_objective text,
  content_angle text,
  recommended_format text DEFAULT 'text',
  suggested_hook_type text,
  suggested_tone text,
  suggested_cta_type text,
  strategic_rationale text,
  linked_draft_id uuid REFERENCES public.drafts(id) ON DELETE SET NULL,
  linked_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  status text DEFAULT 'planned',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.campaign_post_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own post plans" ON public.campaign_post_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own post plans" ON public.campaign_post_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own post plans" ON public.campaign_post_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own post plans" ON public.campaign_post_plans FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_campaign_post_plans_updated_at BEFORE UPDATE ON public.campaign_post_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Campaign Reports
CREATE TABLE public.campaign_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  report_type text DEFAULT 'progress',
  health_status text DEFAULT 'on_track',
  posting_progress jsonb DEFAULT '{}',
  outcome_progress jsonb DEFAULT '{}',
  contribution_analysis jsonb DEFAULT '{}',
  stage_performance jsonb DEFAULT '{}',
  cta_performance jsonb DEFAULT '{}',
  weekly_trends jsonb DEFAULT '[]',
  recommendations jsonb DEFAULT '[]',
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.campaign_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports" ON public.campaign_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own reports" ON public.campaign_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reports" ON public.campaign_reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reports" ON public.campaign_reports FOR DELETE USING (auth.uid() = user_id);
