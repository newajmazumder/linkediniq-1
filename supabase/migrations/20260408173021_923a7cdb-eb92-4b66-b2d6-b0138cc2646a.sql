
ALTER TABLE public.prediction_scores ADD COLUMN IF NOT EXISTS cta_alignment integer DEFAULT 0;
ALTER TABLE public.prediction_scores ADD COLUMN IF NOT EXISTS context_relevance integer DEFAULT 0;
ALTER TABLE public.prediction_scores ADD COLUMN IF NOT EXISTS strongest_element text;
ALTER TABLE public.prediction_scores ADD COLUMN IF NOT EXISTS weakest_element text;
ALTER TABLE public.prediction_scores ADD COLUMN IF NOT EXISTS failure_reasons jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.prediction_scores ADD COLUMN IF NOT EXISTS improved_hooks jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.prediction_scores ADD COLUMN IF NOT EXISTS improved_ctas jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.prediction_scores ADD COLUMN IF NOT EXISTS publish_recommendation text DEFAULT 'revise';

ALTER TABLE public.content_patterns ADD COLUMN IF NOT EXISTS confidence_level text DEFAULT 'low';
ALTER TABLE public.content_patterns ADD COLUMN IF NOT EXISTS comparative_insight text;
