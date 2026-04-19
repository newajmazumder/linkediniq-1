-- 1. Add target_end_date to campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS target_end_date timestamptz;

-- Backfill: existing campaigns get start + 28d if null
UPDATE public.campaigns
SET target_end_date = COALESCE(target_start_date, created_at) + INTERVAL '28 days'
WHERE target_end_date IS NULL;

-- 2. Add planned_time to campaign_post_plans
ALTER TABLE public.campaign_post_plans
  ADD COLUMN IF NOT EXISTS planned_time text;

-- Optional: light validation that planned_time is HH:MM (24h) when present
ALTER TABLE public.campaign_post_plans
  DROP CONSTRAINT IF EXISTS campaign_post_plans_planned_time_format;
ALTER TABLE public.campaign_post_plans
  ADD CONSTRAINT campaign_post_plans_planned_time_format
  CHECK (planned_time IS NULL OR planned_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');