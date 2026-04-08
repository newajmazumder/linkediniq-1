ALTER TABLE public.content_tags ADD COLUMN IF NOT EXISTS word_count integer;
ALTER TABLE public.content_tags ADD COLUMN IF NOT EXISTS publish_hour integer;