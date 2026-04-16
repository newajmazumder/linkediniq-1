
-- Add screenshot-related columns to competitor_posts
ALTER TABLE public.competitor_posts
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS screenshot_url text,
  ADD COLUMN IF NOT EXISTS visual_summary text,
  ADD COLUMN IF NOT EXISTS post_format text,
  ADD COLUMN IF NOT EXISTS extraction_confidence jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS original_extraction jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS manual_corrections jsonb DEFAULT '{}'::jsonb;

-- Create storage bucket for competitor screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('competitor-screenshots', 'competitor-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can view competitor screenshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'competitor-screenshots');

CREATE POLICY "Authenticated users can upload competitor screenshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'competitor-screenshots' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update own competitor screenshots"
ON storage.objects FOR UPDATE
USING (bucket_id = 'competitor-screenshots' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own competitor screenshots"
ON storage.objects FOR DELETE
USING (bucket_id = 'competitor-screenshots' AND auth.role() = 'authenticated');
