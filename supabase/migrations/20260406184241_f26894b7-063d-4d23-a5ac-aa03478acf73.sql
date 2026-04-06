
CREATE TABLE public.post_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(draft_id)
);

ALTER TABLE public.post_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own performance" ON public.post_performance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own performance" ON public.post_performance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own performance" ON public.post_performance FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own performance" ON public.post_performance FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_post_performance_updated_at BEFORE UPDATE ON public.post_performance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
