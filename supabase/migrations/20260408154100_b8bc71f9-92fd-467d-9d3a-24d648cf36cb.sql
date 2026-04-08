
-- context_sources table
CREATE TABLE public.context_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'text',
  source_category TEXT NOT NULL DEFAULT 'company_overview',
  raw_content TEXT,
  file_url TEXT,
  source_url TEXT,
  ingestion_status TEXT NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT true,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.context_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own context sources" ON public.context_sources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own context sources" ON public.context_sources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own context sources" ON public.context_sources FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own context sources" ON public.context_sources FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_context_sources_updated_at BEFORE UPDATE ON public.context_sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- context_chunks table
CREATE TABLE public.context_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_id UUID NOT NULL REFERENCES public.context_sources(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.context_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own context chunks" ON public.context_chunks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own context chunks" ON public.context_chunks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own context chunks" ON public.context_chunks FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_context_chunks_source_id ON public.context_chunks(source_id);

-- business_profiles table (one per user)
CREATE TABLE public.business_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  company_summary TEXT,
  founder_story TEXT,
  product_summary TEXT,
  target_audience TEXT,
  industries_served JSONB DEFAULT '[]'::jsonb,
  customer_problems JSONB DEFAULT '[]'::jsonb,
  product_features JSONB DEFAULT '[]'::jsonb,
  customer_benefits JSONB DEFAULT '[]'::jsonb,
  differentiators JSONB DEFAULT '[]'::jsonb,
  proof_points JSONB DEFAULT '[]'::jsonb,
  offers_campaigns JSONB DEFAULT '[]'::jsonb,
  objections JSONB DEFAULT '[]'::jsonb,
  brand_tone TEXT,
  desired_perception TEXT,
  current_priorities JSONB DEFAULT '[]'::jsonb,
  messaging_pillars JSONB DEFAULT '[]'::jsonb,
  valid_ctas JSONB DEFAULT '[]'::jsonb,
  restricted_claims JSONB DEFAULT '[]'::jsonb,
  keywords JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own business profile" ON public.business_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own business profile" ON public.business_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own business profile" ON public.business_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own business profile" ON public.business_profiles FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_business_profiles_updated_at BEFORE UPDATE ON public.business_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- context_settings table (one per user)
CREATE TABLE public.context_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  default_active_categories JSONB DEFAULT '["company_overview","product_overview","positioning","pain_points"]'::jsonb,
  founder_tone_weight INTEGER NOT NULL DEFAULT 50,
  product_docs_weight INTEGER NOT NULL DEFAULT 50,
  auto_extract_on_ingest BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.context_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own context settings" ON public.context_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own context settings" ON public.context_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own context settings" ON public.context_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_context_settings_updated_at BEFORE UPDATE ON public.context_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for uploaded files
INSERT INTO storage.buckets (id, name, public) VALUES ('context-files', 'context-files', false);

CREATE POLICY "Users can upload own context files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'context-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own context files" ON storage.objects FOR SELECT USING (bucket_id = 'context-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own context files" ON storage.objects FOR DELETE USING (bucket_id = 'context-files' AND auth.uid()::text = (storage.foldername(name))[1]);
