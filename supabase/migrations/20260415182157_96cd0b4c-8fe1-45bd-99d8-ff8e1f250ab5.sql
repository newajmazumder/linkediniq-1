DELETE FROM public.competitor_insights a
USING public.competitor_insights b
WHERE a.id > b.id AND a.competitor_id = b.competitor_id;

CREATE UNIQUE INDEX IF NOT EXISTS competitor_insights_competitor_id_unique ON public.competitor_insights (competitor_id);