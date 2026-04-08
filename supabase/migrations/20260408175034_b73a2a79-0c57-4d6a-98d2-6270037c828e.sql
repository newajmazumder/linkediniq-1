
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'text';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_briefs jsonb DEFAULT '[]'::jsonb;
